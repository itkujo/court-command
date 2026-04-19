package service

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/court-command/court-command/bracket"
	"github.com/court-command/court-command/db/generated"
)

// BracketService handles bracket generation and winner advancement.
type BracketService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

// NewBracketService creates a new BracketService.
func NewBracketService(queries *generated.Queries, pool *pgxpool.Pool) *BracketService {
	return &BracketService{queries: queries, pool: pool}
}

// GenerateBracketResult is returned after bracket generation.
type GenerateBracketResult struct {
	DivisionID   int64           `json:"division_id"`
	Format       string          `json:"format"`
	TotalMatches int             `json:"total_matches"`
	Matches      []MatchResponse `json:"matches"`
}

// GenerateBracket reads the division and its approved/checked-in registrations,
// generates a bracket using the division's bracket_format, persists all matches
// in a transaction (with bracket wiring), and auto-advances BYEs.
func (s *BracketService) GenerateBracket(ctx context.Context, divisionID int64, userID int64) (GenerateBracketResult, error) {
	// 1. Fetch division
	div, err := s.queries.GetDivisionByID(ctx, divisionID)
	if err != nil {
		return GenerateBracketResult{}, &NotFoundError{Message: "division not found"}
	}

	// 2. Check that no matches already exist for this division
	existingCount, err := s.queries.CountMatchesByDivision(ctx, pgtype.Int8{Int64: divisionID, Valid: true})
	if err != nil {
		return GenerateBracketResult{}, fmt.Errorf("checking existing matches: %w", err)
	}
	if existingCount > 0 {
		return GenerateBracketResult{}, &ConflictError{Message: "bracket already generated for this division"}
	}

	// 3. Fetch registrations (approved or checked_in, ordered by seed)
	regs, err := s.queries.ListRegistrationsByDivisionAndStatus(ctx, generated.ListRegistrationsByDivisionAndStatusParams{
		DivisionID: divisionID,
		Status:     "approved",
		Limit:      1000,
		Offset:     0,
	})
	if err != nil {
		return GenerateBracketResult{}, fmt.Errorf("fetching registrations: %w", err)
	}

	// Also include checked-in registrations
	checkedIn, err := s.queries.ListRegistrationsByDivisionAndStatus(ctx, generated.ListRegistrationsByDivisionAndStatusParams{
		DivisionID: divisionID,
		Status:     "checked_in",
		Limit:      1000,
		Offset:     0,
	})
	if err != nil {
		return GenerateBracketResult{}, fmt.Errorf("fetching checked-in registrations: %w", err)
	}
	regs = append(regs, checkedIn...)

	if len(regs) < 2 {
		return GenerateBracketResult{}, &ValidationError{Message: "need at least 2 registered teams to generate a bracket"}
	}

	// 4. Build seed entries
	entries := make([]bracket.SeedEntry, len(regs))
	for i, reg := range regs {
		seed := i + 1
		if reg.Seed.Valid && reg.Seed.Int32 > 0 {
			seed = int(reg.Seed.Int32)
		}
		var teamID int64
		if reg.TeamID.Valid {
			teamID = reg.TeamID.Int64
		}
		entries[i] = bracket.SeedEntry{
			Seed:   seed,
			TeamID: teamID,
		}
	}

	// 5. Generate bracket based on format
	var bracketMatches []bracket.BracketMatch
	format := div.BracketFormat

	switch format {
	case "single_elimination":
		bracketMatches, err = bracket.GenerateSingleElimination(entries)
	case "double_elimination":
		bracketMatches, err = bracket.GenerateDoubleElimination(entries)
	case "round_robin":
		bracketMatches, err = bracket.GenerateRoundRobin(entries)
	default:
		return GenerateBracketResult{}, &ValidationError{
			Message: fmt.Sprintf("unsupported bracket format: %s", format),
		}
	}
	if err != nil {
		return GenerateBracketResult{}, fmt.Errorf("generating bracket: %w", err)
	}

	// 6. Persist all matches in a transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return GenerateBracketResult{}, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	// matchNumberToDBID maps bracket match number -> database match ID
	matchNumberToDBID := make(map[int]int64)
	// Store created matches for wiring and response
	createdMatches := make([]generated.Match, 0, len(bracketMatches))

	// First pass: create all matches (without bracket wiring — we need IDs first)
	for _, bm := range bracketMatches {
		params := generated.CreateMatchParams{
			DivisionID:      pgtype.Int8{Int64: divisionID, Valid: true},
			TournamentID:    pgtype.Int8{Int64: div.TournamentID, Valid: true},
			CreatedByUserID: userID,
			MatchType:       "tournament",
			Round:           pgtype.Int4{Int32: int32(bm.Round), Valid: true},
			RoundName:       &bm.RoundName,
			MatchNumber:     pgtype.Int4{Int32: int32(bm.MatchNumber), Valid: true},
			Status:          "scheduled",
			// Scoring defaults
			GamesPerSet:        1,
			SetsToWin:          1,
			PointsToWin:        11,
			WinBy:              2,
			TimeoutsPerGame:    0,
			TimeoutDurationSec: 60,
		}

		// Set teams if assigned (first round with known seeds)
		if bm.Team1TeamID > 0 {
			params.Team1ID = pgtype.Int8{Int64: bm.Team1TeamID, Valid: true}
		}
		if bm.Team2TeamID > 0 {
			params.Team2ID = pgtype.Int8{Int64: bm.Team2TeamID, Valid: true}
		}
		if bm.Team1Seed > 0 {
			params.Team1Seed = pgtype.Int4{Int32: int32(bm.Team1Seed), Valid: true}
		}
		if bm.Team2Seed > 0 {
			params.Team2Seed = pgtype.Int4{Int32: int32(bm.Team2Seed), Valid: true}
		}

		match, err := qtx.CreateMatch(ctx, params)
		if err != nil {
			return GenerateBracketResult{}, fmt.Errorf("creating match %d: %w", bm.MatchNumber, err)
		}

		matchNumberToDBID[bm.MatchNumber] = match.ID
		createdMatches = append(createdMatches, match)
	}

	// Second pass: wire bracket connections (next_match_id, loser_next_match_id)
	for i, bm := range bracketMatches {
		dbID := matchNumberToDBID[bm.MatchNumber]
		wiringParams := generated.UpdateMatchBracketWiringParams{ID: dbID}
		needsUpdate := false

		if bm.NextMatchNumber > 0 {
			if nextID, ok := matchNumberToDBID[bm.NextMatchNumber]; ok {
				wiringParams.NextMatchID = pgtype.Int8{Int64: nextID, Valid: true}
				wiringParams.NextMatchSlot = pgtype.Int4{Int32: int32(bm.NextMatchSlot), Valid: true}
				needsUpdate = true
			}
		}
		if bm.LoserNextMatchNumber > 0 {
			if loserNextID, ok := matchNumberToDBID[bm.LoserNextMatchNumber]; ok {
				wiringParams.LoserNextMatchID = pgtype.Int8{Int64: loserNextID, Valid: true}
				wiringParams.LoserNextMatchSlot = pgtype.Int4{Int32: int32(bm.LoserNextMatchSlot), Valid: true}
				needsUpdate = true
			}
		}

		if needsUpdate {
			updated, err := qtx.UpdateMatchBracketWiring(ctx, wiringParams)
			if err != nil {
				return GenerateBracketResult{}, fmt.Errorf("wiring match %d: %w", bm.MatchNumber, err)
			}
			createdMatches[i] = updated
		}
	}

	// Third pass: auto-advance BYEs
	for i, bm := range bracketMatches {
		if !bm.IsBye || bm.NextMatchNumber == 0 {
			continue
		}

		byeMatchID := matchNumberToDBID[bm.MatchNumber]

		// Mark the bye match as completed
		completedMatch, err := qtx.UpdateMatchStatus(ctx, generated.UpdateMatchStatusParams{
			ID:     byeMatchID,
			Status: "completed",
		})
		if err != nil {
			return GenerateBracketResult{}, fmt.Errorf("completing bye match %d: %w", bm.MatchNumber, err)
		}
		createdMatches[i] = completedMatch

		// Advance the bye winner to the next match
		if nextMatchID, ok := matchNumberToDBID[bm.NextMatchNumber]; ok {
			var winnerTeamID int64
			if bm.Team1TeamID > 0 && bm.Team2Seed == 0 {
				winnerTeamID = bm.Team1TeamID
			} else if bm.Team2TeamID > 0 && bm.Team1Seed == 0 {
				winnerTeamID = bm.Team2TeamID
			}

			if winnerTeamID > 0 {
				// Set winner on bye match
				_, err = qtx.UpdateMatchResult(ctx, generated.UpdateMatchResultParams{
					ID:           byeMatchID,
					WinnerTeamID: pgtype.Int8{Int64: winnerTeamID, Valid: true},
					WinReason:    strPtr("bye"),
				})
				if err != nil {
					return GenerateBracketResult{}, fmt.Errorf("setting bye winner for match %d: %w", bm.MatchNumber, err)
				}

				// Place winner into the next match
				nextMatch, err := qtx.GetMatch(ctx, nextMatchID)
				if err != nil {
					return GenerateBracketResult{}, fmt.Errorf("fetching next match: %w", err)
				}

				updateParams := generated.UpdateMatchTeamsParams{
					ID:        nextMatchID,
					Team1ID:   nextMatch.Team1ID,
					Team2ID:   nextMatch.Team2ID,
					Team1Seed: nextMatch.Team1Seed,
					Team2Seed: nextMatch.Team2Seed,
				}

				winnerSeed := int32(bm.ByeWinnerSeed)
				if bm.NextMatchSlot == 1 {
					updateParams.Team1ID = pgtype.Int8{Int64: winnerTeamID, Valid: true}
					updateParams.Team1Seed = pgtype.Int4{Int32: winnerSeed, Valid: true}
				} else {
					updateParams.Team2ID = pgtype.Int8{Int64: winnerTeamID, Valid: true}
					updateParams.Team2Seed = pgtype.Int4{Int32: winnerSeed, Valid: true}
				}

				_, err = qtx.UpdateMatchTeams(ctx, updateParams)
				if err != nil {
					return GenerateBracketResult{}, fmt.Errorf("advancing bye winner to match: %w", err)
				}
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return GenerateBracketResult{}, fmt.Errorf("committing bracket: %w", err)
	}

	// Build response
	responses := make([]MatchResponse, len(createdMatches))
	for i, m := range createdMatches {
		responses[i] = toMatchResponse(m)
	}

	return GenerateBracketResult{
		DivisionID:   divisionID,
		Format:       format,
		TotalMatches: len(createdMatches),
		Matches:      responses,
	}, nil
}

// AdvanceWinner slots the winner of a completed match into the next match.
// Uses a transaction with FOR UPDATE to prevent race conditions when
// two matches complete simultaneously and feed into the same next match.
func (s *BracketService) AdvanceWinner(ctx context.Context, matchID int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	match, err := qtx.GetMatchForUpdate(ctx, matchID)
	if err != nil {
		return &NotFoundError{Message: "match not found"}
	}

	if match.Status != "completed" && match.Status != "forfeited" {
		return &ValidationError{Message: "match must be completed to advance winner"}
	}

	if !match.WinnerTeamID.Valid {
		return &ValidationError{Message: "match has no winner set"}
	}

	winnerTeamID := match.WinnerTeamID.Int64

	// Advance winner to next match
	if match.NextMatchID.Valid {
		nextMatch, err := qtx.GetMatchForUpdate(ctx, match.NextMatchID.Int64)
		if err != nil {
			return fmt.Errorf("fetching next match: %w", err)
		}

		slot := 1
		if match.NextMatchSlot.Valid {
			slot = int(match.NextMatchSlot.Int32)
		} else if match.MatchNumber.Valid {
			slot = bracket.DetermineSlotInNextMatch(int(match.MatchNumber.Int32))
		}

		params := generated.UpdateMatchTeamsParams{
			ID:        nextMatch.ID,
			Team1ID:   nextMatch.Team1ID,
			Team2ID:   nextMatch.Team2ID,
			Team1Seed: nextMatch.Team1Seed,
			Team2Seed: nextMatch.Team2Seed,
		}

		if slot == 1 {
			params.Team1ID = pgtype.Int8{Int64: winnerTeamID, Valid: true}
		} else {
			params.Team2ID = pgtype.Int8{Int64: winnerTeamID, Valid: true}
		}

		if _, err := qtx.UpdateMatchTeams(ctx, params); err != nil {
			return fmt.Errorf("advancing winner to next match: %w", err)
		}
	}

	// Advance loser to losers bracket (double elimination)
	if match.LoserNextMatchID.Valid && match.LoserTeamID.Valid {
		loserTeamID := match.LoserTeamID.Int64
		loserNextMatch, err := qtx.GetMatchForUpdate(ctx, match.LoserNextMatchID.Int64)
		if err != nil {
			return fmt.Errorf("fetching loser next match: %w", err)
		}

		slot := 1
		if match.LoserNextMatchSlot.Valid {
			slot = int(match.LoserNextMatchSlot.Int32)
		}

		params := generated.UpdateMatchTeamsParams{
			ID:        loserNextMatch.ID,
			Team1ID:   loserNextMatch.Team1ID,
			Team2ID:   loserNextMatch.Team2ID,
			Team1Seed: loserNextMatch.Team1Seed,
			Team2Seed: loserNextMatch.Team2Seed,
		}

		if slot == 1 {
			params.Team1ID = pgtype.Int8{Int64: loserTeamID, Valid: true}
		} else {
			params.Team2ID = pgtype.Int8{Int64: loserTeamID, Valid: true}
		}

		if _, err := qtx.UpdateMatchTeams(ctx, params); err != nil {
			return fmt.Errorf("advancing loser to losers bracket: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("committing bracket advancement: %w", err)
	}

	return nil
}
