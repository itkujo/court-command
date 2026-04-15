package service

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/court-command/court-command/db/generated"
)

// QuickMatchInput holds the input for creating a quick match.
type QuickMatchInput struct {
	GamesPerSet        int32  `json:"games_per_set"`
	SetsToWin          int32  `json:"sets_to_win"`
	PointsToWin        int32  `json:"points_to_win"`
	WinBy              int32  `json:"win_by"`
	MaxPoints          *int32 `json:"max_points"`
	RallyScoring       bool   `json:"rally_scoring"`
	TimeoutsPerGame    int32  `json:"timeouts_per_game"`
	TimeoutDurationSec int32  `json:"timeout_duration_sec"`
	FreezeAt           *int32 `json:"freeze_at"`
}

// CreateQuickMatch creates an ephemeral match that auto-deletes after 24 hours.
func (s *MatchService) CreateQuickMatch(ctx context.Context, userID int64, input QuickMatchInput) (MatchResponse, error) {
	if input.PointsToWin < 1 {
		return MatchResponse{}, &ValidationError{Message: "points_to_win must be at least 1"}
	}
	if input.WinBy < 1 {
		return MatchResponse{}, &ValidationError{Message: "win_by must be at least 1"}
	}
	if input.SetsToWin < 1 {
		return MatchResponse{}, &ValidationError{Message: "sets_to_win must be at least 1"}
	}
	if input.GamesPerSet < 1 {
		return MatchResponse{}, &ValidationError{Message: "games_per_set must be at least 1"}
	}

	expiresAt := time.Now().Add(24 * time.Hour)

	match, err := s.queries.CreateQuickMatch(ctx, generated.CreateQuickMatchParams{
		CreatedByUserID:    userID,
		GamesPerSet:        input.GamesPerSet,
		SetsToWin:          input.SetsToWin,
		PointsToWin:        input.PointsToWin,
		WinBy:              input.WinBy,
		MaxPoints:          toPgInt4(input.MaxPoints),
		RallyScoring:       input.RallyScoring,
		TimeoutsPerGame:    input.TimeoutsPerGame,
		TimeoutDurationSec: input.TimeoutDurationSec,
		FreezeAt:           toPgInt4(input.FreezeAt),
		ExpiresAt:          pgtype.Timestamptz{Time: expiresAt, Valid: true},
	})
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to create quick match: %w", err)
	}

	return toMatchResponse(match), nil
}

// ListQuickMatchesByUser returns quick matches for a user.
func (s *MatchService) ListQuickMatchesByUser(ctx context.Context, userID int64, limit, offset int32) ([]MatchResponse, error) {
	matches, err := s.queries.ListQuickMatchesByUser(ctx, generated.ListQuickMatchesByUserParams{
		CreatedByUserID: userID,
		Limit:           limit,
		Offset:          offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list quick matches: %w", err)
	}

	var results []MatchResponse
	for _, m := range matches {
		results = append(results, toMatchResponse(m))
	}
	return results, nil
}

// Note: CleanupExpiredQuickMatches is defined in match.go
