package overlay

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/court-command/court-command/db/generated"
)

// Resolver transforms internal data into the canonical OverlayData contract.
type Resolver struct {
	queries *generated.Queries
}

// NewResolver creates a new Resolver.
func NewResolver(queries *generated.Queries) *Resolver {
	return &Resolver{queries: queries}
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
		if err == nil {
			data.Team1 = r.teamToOverlay(ctx, team, int(match.Team1Score))
			data.Team1.GameWins = r.countGameWins(data.CompletedGames, 1)
		}
	}

	// Resolve team 2
	if match.Team2ID.Valid {
		team, err := r.queries.GetTeamByID(ctx, match.Team2ID.Int64)
		if err == nil {
			data.Team2 = r.teamToOverlay(ctx, team, int(match.Team2Score))
			data.Team2.GameWins = r.countGameWins(data.CompletedGames, 2)
		}
	}

	// Resolve division -> tournament -> league chain
	if match.DivisionID.Valid {
		div, err := r.queries.GetDivisionByID(ctx, match.DivisionID.Int64)
		if err == nil {
			data.DivisionName = div.Name
			if match.Round.Valid {
				data.RoundLabel = fmt.Sprintf("Round %d", match.Round.Int32)
			}

			// Get tournament
			tournament, err := r.queries.GetTournamentByID(ctx, div.TournamentID)
			if err == nil {
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
					if err == nil {
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
		if err == nil {
			data.CourtName = court.Name
		}
	}

	// Resolve match info
	data.MatchInfo = r.buildMatchInfo(match)

	// Resolve series score if this is a series match
	if match.MatchSeriesID.Valid {
		series, err := r.queries.GetMatchSeries(ctx, match.MatchSeriesID.Int64)
		if err == nil {
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
	if err == nil {
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
	if err == nil {
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
