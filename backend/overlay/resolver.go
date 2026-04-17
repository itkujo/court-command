package overlay

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/court-command/court-command/db/generated"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// Resolver transforms internal data into the canonical OverlayData contract.
type Resolver struct {
	queries *generated.Queries
	logger  *slog.Logger
}

// NewResolver creates a new Resolver.
func NewResolver(queries *generated.Queries, logger *slog.Logger) *Resolver {
	if logger == nil {
		logger = slog.Default()
	}
	return &Resolver{queries: queries, logger: logger}
}

// ResolveFromMatch builds OverlayData from a Match and its related entities.
func (r *Resolver) ResolveFromMatch(ctx context.Context, match generated.Match) (OverlayData, error) {
	data := OverlayData{
		MatchStatus: match.Status,
		CurrentGame: int(match.CurrentGame),
		IsPaused:    match.Status == "paused",
	}

	// ServingTeam and ServerNumber are pgtype.Int4
	if match.ServingTeam.Valid {
		data.ServingTeam = int(match.ServingTeam.Int32)
	}
	if match.ServerNumber.Valid {
		data.ServerNumber = int(match.ServerNumber.Int32)
	}

	// Parse set scores (stored as JSON in SetScores field)
	if len(match.SetScores) > 0 {
		var setScores [][]int
		if err := json.Unmarshal(match.SetScores, &setScores); err == nil {
			for i, scores := range setScores {
				if len(scores) >= 2 {
					winner := 0
					if scores[0] > scores[1] {
						winner = 1
					} else if scores[1] > scores[0] {
						winner = 2
					}
					data.CompletedGames = append(data.CompletedGames, GameResult{
						GameNum:    i + 1,
						ScoreTeam1: scores[0],
						ScoreTeam2: scores[1],
						Winner:     winner,
					})
				}
			}
		}
	}
	if data.CompletedGames == nil {
		data.CompletedGames = []GameResult{}
	}

	// Timeouts from match fields
	data.TimeoutsRemaining1 = int(match.TimeoutsPerGame)
	data.TimeoutsRemaining2 = int(match.TimeoutsPerGame)

	// Resolve team 1
	if match.Team1ID.Valid {
		team, err := r.queries.GetTeamByID(ctx, match.Team1ID.Int64)
		if err != nil && !isNotFound(err) {
			r.logger.Warn("resolver: failed to get team 1", "team_id", match.Team1ID.Int64, "error", err)
		} else if err == nil {
			data.Team1 = r.teamToOverlay(ctx, team, int(match.Team1Score))
			data.Team1.GameWins = r.countGameWins(data.CompletedGames, 1)
		}
	}

	// Resolve team 2
	if match.Team2ID.Valid {
		team, err := r.queries.GetTeamByID(ctx, match.Team2ID.Int64)
		if err != nil && !isNotFound(err) {
			r.logger.Warn("resolver: failed to get team 2", "team_id", match.Team2ID.Int64, "error", err)
		} else if err == nil {
			data.Team2 = r.teamToOverlay(ctx, team, int(match.Team2Score))
			data.Team2.GameWins = r.countGameWins(data.CompletedGames, 2)
		}
	}

	// Resolve division -> tournament -> league chain
	if match.DivisionID.Valid {
		div, err := r.queries.GetDivisionByID(ctx, match.DivisionID.Int64)
		if err != nil && !isNotFound(err) {
			r.logger.Warn("resolver: failed to get division", "division_id", match.DivisionID.Int64, "error", err)
		} else if err == nil {
			data.DivisionName = div.Name
			if match.Round.Valid {
				data.RoundLabel = fmt.Sprintf("Round %d", match.Round.Int32)
			}

			// Get tournament
			tournament, err := r.queries.GetTournamentByID(ctx, div.TournamentID)
			if err != nil && !isNotFound(err) {
				r.logger.Warn("resolver: failed to get tournament", "tournament_id", div.TournamentID, "error", err)
			} else if err == nil {
				data.TournamentName = tournament.Name
				if tournament.LogoUrl != nil {
					data.TournamentLogoURL = *tournament.LogoUrl
				}

				// Parse sponsor info
				if len(tournament.SponsorInfo) > 0 {
					var sponsors []SponsorLogo
					if err := json.Unmarshal(tournament.SponsorInfo, &sponsors); err == nil {
						data.SponsorLogos = sponsors
					}
				}

				// Get league if present
				if tournament.LeagueID.Valid {
					league, err := r.queries.GetLeagueByID(ctx, tournament.LeagueID.Int64)
					if err != nil && !isNotFound(err) {
						r.logger.Warn("resolver: failed to get league", "league_id", tournament.LeagueID.Int64, "error", err)
					} else if err == nil {
						data.LeagueName = league.Name
						if league.LogoUrl != nil {
							data.LeagueLogoURL = *league.LogoUrl
						}
					}
				}
			}
		}
	}

	if data.SponsorLogos == nil {
		data.SponsorLogos = []SponsorLogo{}
	}

	// Resolve court name
	if match.CourtID.Valid {
		court, err := r.queries.GetCourtByID(ctx, match.CourtID.Int64)
		if err != nil && !isNotFound(err) {
			r.logger.Warn("resolver: failed to get court", "court_id", match.CourtID.Int64, "error", err)
		} else if err == nil {
			data.CourtName = court.Name
		}
	}

	// Resolve match info
	data.MatchInfo = r.buildMatchInfo(match)

	// Resolve bracket data if this match belongs to a bracket division
	if match.DivisionID.Valid {
		bracket := r.resolveBracket(ctx, match.DivisionID.Int64, data.DivisionName)
		if bracket != nil {
			data.Bracket = bracket
		}
	}

	// Resolve pool standings if the division uses pool play
	if match.DivisionID.Valid {
		pool := r.resolvePool(ctx, match.DivisionID.Int64, data.DivisionName)
		if pool != nil {
			data.Pool = pool
		}
	}

	// Resolve series score if this is a series match
	if match.MatchSeriesID.Valid {
		series, err := r.queries.GetMatchSeries(ctx, match.MatchSeriesID.Int64)
		if err != nil && !isNotFound(err) {
			r.logger.Warn("resolver: failed to get match series", "series_id", match.MatchSeriesID.Int64, "error", err)
		} else if err == nil {
			bestOf := int(series.GamesToWin)*2 - 1
			data.SeriesScore = &SeriesScoreData{
				Team1Wins: int(series.Team1Wins),
				Team2Wins: int(series.Team2Wins),
				BestOf:    bestOf,
			}
		}
	}

	return data, nil
}

// ResolveIdle returns overlay data for when no match is active.
func (r *Resolver) ResolveIdle(ctx context.Context, courtID int64) OverlayData {
	data := OverlayData{
		MatchStatus:    "idle",
		CompletedGames: []GameResult{},
		SponsorLogos:   []SponsorLogo{},
	}

	court, err := r.queries.GetCourtByID(ctx, courtID)
	if err != nil && !isNotFound(err) {
		r.logger.Warn("resolver: failed to get court for idle", "court_id", courtID, "error", err)
	} else if err == nil {
		data.CourtName = court.Name
	}

	return data
}

func (r *Resolver) teamToOverlay(ctx context.Context, team generated.Team, score int) OverlayTeamData {
	t := OverlayTeamData{
		Name:    team.Name,
		Score:   score,
		Players: []PlayerBrief{},
	}
	t.ShortName = team.ShortName
	if team.PrimaryColor != nil {
		t.Color = *team.PrimaryColor
	}
	if team.LogoUrl != nil {
		t.LogoURL = *team.LogoUrl
	}

	// Load roster players
	roster, err := r.queries.GetActiveRoster(ctx, team.ID)
	if err != nil && !isNotFound(err) {
		r.logger.Warn("resolver: failed to get roster", "team_id", team.ID, "error", err)
	} else if err == nil {
		for _, member := range roster {
			name := member.FirstName + " " + member.LastName
			if member.DisplayName != nil {
				name = *member.DisplayName
			}
			t.Players = append(t.Players, PlayerBrief{Name: name})
		}
	}

	return t
}

// isNotFound returns true if the error is a pgx "no rows" error.
func isNotFound(err error) bool {
	return err == pgx.ErrNoRows
}

func (r *Resolver) countGameWins(games []GameResult, team int) int {
	wins := 0
	for _, g := range games {
		if g.Winner == team {
			wins++
		}
	}
	return wins
}

func (r *Resolver) buildMatchInfo(match generated.Match) string {
	if match.SetsToWin > 1 {
		return fmt.Sprintf("Best of %d", match.SetsToWin*2-1)
	}
	return ""
}

// resolveBracket fetches bracket matches for the division and groups them by round.
// Returns nil if the division has no bracket matches or uses pool_play/round_robin format.
func (r *Resolver) resolveBracket(ctx context.Context, divisionID int64, divisionName string) *BracketData {
	div, err := r.queries.GetDivisionByID(ctx, divisionID)
	if err != nil {
		return nil
	}

	// Only build bracket for elimination formats
	switch div.BracketFormat {
	case "single_elimination", "double_elimination", "pool_to_bracket":
		// proceed
	default:
		return nil
	}

	matches, err := r.queries.ListMatchesByDivision(ctx, generated.ListMatchesByDivisionParams{
		DivisionID: pgtype.Int8{Int64: divisionID, Valid: true},
		Limit:      200,
		Offset:     0,
	})
	if err != nil || len(matches) == 0 {
		return nil
	}

	// Group by round
	roundMap := map[int][]BracketMatch{}
	roundNames := map[int]string{}
	for _, m := range matches {
		roundNum := 1
		if m.Round.Valid {
			roundNum = int(m.Round.Int32)
		}
		roundName := fmt.Sprintf("Round %d", roundNum)
		if m.RoundName != nil && *m.RoundName != "" {
			roundName = *m.RoundName
		}

		winner := 0
		if m.WinnerTeamID.Valid {
			if m.Team1ID.Valid && m.WinnerTeamID.Int64 == m.Team1ID.Int64 {
				winner = 1
			} else if m.Team2ID.Valid && m.WinnerTeamID.Int64 == m.Team2ID.Int64 {
				winner = 2
			}
		}

		bm := BracketMatch{
			MatchNumber: int(m.MatchNumber.Int32),
			Team1Score:  int(m.Team1Score),
			Team2Score:  int(m.Team2Score),
			Winner:      winner,
			Status:      m.Status,
		}

		// Resolve team names
		if m.Team1ID.Valid {
			team, err := r.queries.GetTeamByID(ctx, m.Team1ID.Int64)
			if err == nil {
				bm.Team1Name = team.ShortName
				if bm.Team1Name == "" {
					bm.Team1Name = team.Name
				}
			}
		}
		if m.Team2ID.Valid {
			team, err := r.queries.GetTeamByID(ctx, m.Team2ID.Int64)
			if err == nil {
				bm.Team2Name = team.ShortName
				if bm.Team2Name == "" {
					bm.Team2Name = team.Name
				}
			}
		}

		roundMap[roundNum] = append(roundMap[roundNum], bm)
		roundNames[roundNum] = roundName
	}

	// Build sorted rounds
	var rounds []BracketRound
	for rn := 1; rn <= len(roundMap); rn++ {
		if ms, ok := roundMap[rn]; ok {
			rounds = append(rounds, BracketRound{
				RoundNum:  rn,
				RoundName: roundNames[rn],
				Matches:   ms,
			})
		}
	}

	if len(rounds) == 0 {
		return nil
	}

	return &BracketData{
		DivisionName:  divisionName,
		BracketFormat: div.BracketFormat,
		Rounds:        rounds,
	}
}

// resolvePool fetches pool standings for the division.
// Returns nil if the division does not use pool play or has no standings.
func (r *Resolver) resolvePool(ctx context.Context, divisionID int64, divisionName string) *PoolData {
	div, err := r.queries.GetDivisionByID(ctx, divisionID)
	if err != nil {
		return nil
	}

	// Only build pool for pool formats
	switch div.BracketFormat {
	case "round_robin", "pool_play", "pool_to_bracket":
		// proceed
	default:
		return nil
	}

	// Get the tournament to find the season ID for standings
	tournament, err := r.queries.GetTournamentByID(ctx, div.TournamentID)
	if err != nil {
		return nil
	}

	if !tournament.SeasonID.Valid {
		return nil
	}

	standings, err := r.queries.ListStandingsByDivision(ctx, generated.ListStandingsByDivisionParams{
		SeasonID:   tournament.SeasonID.Int64,
		DivisionID: divisionID,
		Limit:      50,
		Offset:     0,
	})
	if err != nil || len(standings) == 0 {
		return nil
	}

	var entries []PoolTeamEntry
	for _, s := range standings {
		teamName := fmt.Sprintf("Team %d", s.TeamID)
		team, err := r.queries.GetTeamByID(ctx, s.TeamID)
		if err == nil {
			teamName = team.Name
		}
		entries = append(entries, PoolTeamEntry{
			Rank:              int(s.Rank),
			TeamName:          teamName,
			Wins:              int(s.Wins),
			Losses:            int(s.Losses),
			PointDifferential: int(s.PointDifferential),
		})
	}

	return &PoolData{
		DivisionName: divisionName,
		PoolName:     div.Name,
		Standings:    entries,
	}
}
