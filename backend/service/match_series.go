package service

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/pubsub"
)

// MatchSeriesService handles match series (MLP-style best-of-N) business logic.
type MatchSeriesService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
	ps      *pubsub.PubSub
}

// NewMatchSeriesService creates a new MatchSeriesService.
func NewMatchSeriesService(queries *generated.Queries, pool *pgxpool.Pool, ps *pubsub.PubSub) *MatchSeriesService {
	return &MatchSeriesService{queries: queries, pool: pool, ps: ps}
}

// MatchSeriesResponse is the public representation of a match series.
type MatchSeriesResponse struct {
	ID              int64           `json:"id"`
	PublicID        string          `json:"public_id"`
	DivisionID      *int64          `json:"division_id,omitempty"`
	PodID           *int64          `json:"pod_id,omitempty"`
	CreatedByUserID int64           `json:"created_by_user_id"`
	Team1ID         *int64          `json:"team1_id,omitempty"`
	Team2ID         *int64          `json:"team2_id,omitempty"`
	SeriesFormat    string          `json:"series_format"`
	GamesToWin      int32           `json:"games_to_win"`
	Team1Wins       int32           `json:"team1_wins"`
	Team2Wins       int32           `json:"team2_wins"`
	Status          string          `json:"status"`
	StartedAt       *string         `json:"started_at,omitempty"`
	CompletedAt     *string         `json:"completed_at,omitempty"`
	WinnerTeamID    *int64          `json:"winner_team_id,omitempty"`
	LoserTeamID     *int64          `json:"loser_team_id,omitempty"`
	WinReason       *string         `json:"win_reason,omitempty"`
	Round           *int32          `json:"round,omitempty"`
	RoundName       *string         `json:"round_name,omitempty"`
	MatchNumber     *int32          `json:"match_number,omitempty"`
	Matches         []MatchResponse `json:"matches,omitempty"`
	CreatedAt       string          `json:"created_at"`
	UpdatedAt       string          `json:"updated_at"`
}

func toMatchSeriesResponse(ms generated.MatchSeries) MatchSeriesResponse {
	return MatchSeriesResponse{
		ID:              ms.ID,
		PublicID:        ms.PublicID,
		DivisionID:      optInt8(ms.DivisionID),
		PodID:           optInt8(ms.PodID),
		CreatedByUserID: ms.CreatedByUserID,
		Team1ID:         optInt8(ms.Team1ID),
		Team2ID:         optInt8(ms.Team2ID),
		SeriesFormat:    ms.SeriesFormat,
		GamesToWin:      ms.GamesToWin,
		Team1Wins:       ms.Team1Wins,
		Team2Wins:       ms.Team2Wins,
		Status:          ms.Status,
		StartedAt:       optTimestamptz(ms.StartedAt),
		CompletedAt:     optTimestamptz(ms.CompletedAt),
		WinnerTeamID:    optInt8(ms.WinnerTeamID),
		LoserTeamID:     optInt8(ms.LoserTeamID),
		WinReason:       ms.WinReason,
		Round:           optInt4(ms.Round),
		RoundName:       ms.RoundName,
		MatchNumber:     optInt4(ms.MatchNumber),
		CreatedAt:       ms.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:       ms.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// CreateSeriesInput holds the input for creating a match series.
type CreateSeriesInput struct {
	DivisionID  *int64  `json:"division_id"`
	PodID       *int64  `json:"pod_id"`
	Team1ID     *int64  `json:"team1_id"`
	Team2ID     *int64  `json:"team2_id"`
	Format      string  `json:"series_format"`
	GamesToWin  int32   `json:"games_to_win"`
	Round       *int32  `json:"round"`
	RoundName   *string `json:"round_name"`
	MatchNumber *int32  `json:"match_number"`
	// Scoring config for child matches
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

func toPgInt8(v *int64) pgtype.Int8 {
	if v == nil {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: *v, Valid: true}
}

func toPgInt4(v *int32) pgtype.Int4 {
	if v == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: *v, Valid: true}
}

// Create creates a new match series with validation.
func (s *MatchSeriesService) Create(ctx context.Context, userID int64, input CreateSeriesInput) (MatchSeriesResponse, error) {
	validFormats := map[string]bool{"best_of_3": true, "best_of_5": true, "best_of_7": true}
	if !validFormats[input.Format] {
		return MatchSeriesResponse{}, &ValidationError{Message: "series_format must be best_of_3, best_of_5, or best_of_7"}
	}
	if input.GamesToWin < 1 {
		return MatchSeriesResponse{}, &ValidationError{Message: "games_to_win must be at least 1"}
	}

	series, err := s.queries.CreateMatchSeries(ctx, generated.CreateMatchSeriesParams{
		DivisionID:      toPgInt8(input.DivisionID),
		PodID:           toPgInt8(input.PodID),
		CreatedByUserID: userID,
		Team1ID:         toPgInt8(input.Team1ID),
		Team2ID:         toPgInt8(input.Team2ID),
		SeriesFormat:    input.Format,
		GamesToWin:      input.GamesToWin,
		Status:          "pending",
		Round:           toPgInt4(input.Round),
		RoundName:       input.RoundName,
		MatchNumber:     toPgInt4(input.MatchNumber),
	})
	if err != nil {
		return MatchSeriesResponse{}, fmt.Errorf("failed to create match series: %w", err)
	}

	return toMatchSeriesResponse(series), nil
}

// Get returns a match series by ID with child matches.
func (s *MatchSeriesService) Get(ctx context.Context, id int64) (MatchSeriesResponse, error) {
	series, err := s.queries.GetMatchSeries(ctx, id)
	if err != nil {
		return MatchSeriesResponse{}, &NotFoundError{Message: "match series not found"}
	}

	resp := toMatchSeriesResponse(series)
	matches, err := s.queries.ListMatchesBySeriesID(ctx, pgtype.Int8{Int64: id, Valid: true})
	if err == nil {
		for _, m := range matches {
			resp.Matches = append(resp.Matches, toMatchResponse(m))
		}
	}

	return resp, nil
}

// GetByPublicID returns a match series by public ID with child matches.
func (s *MatchSeriesService) GetByPublicID(ctx context.Context, publicID string) (MatchSeriesResponse, error) {
	series, err := s.queries.GetMatchSeriesByPublicID(ctx, publicID)
	if err != nil {
		return MatchSeriesResponse{}, &NotFoundError{Message: "match series not found"}
	}

	resp := toMatchSeriesResponse(series)
	matches, err := s.queries.ListMatchesBySeriesID(ctx, pgtype.Int8{Int64: series.ID, Valid: true})
	if err == nil {
		for _, m := range matches {
			resp.Matches = append(resp.Matches, toMatchResponse(m))
		}
	}

	return resp, nil
}

// ListByDivision returns paginated match series for a division.
func (s *MatchSeriesService) ListByDivision(ctx context.Context, divisionID int64, limit, offset int32) ([]MatchSeriesResponse, int64, error) {
	divID := pgtype.Int8{Int64: divisionID, Valid: true}

	series, err := s.queries.ListMatchSeriesByDivision(ctx, generated.ListMatchSeriesByDivisionParams{
		DivisionID: divID,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list match series: %w", err)
	}

	total, err := s.queries.CountMatchSeriesByDivision(ctx, divID)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count match series: %w", err)
	}

	var results []MatchSeriesResponse
	for _, ms := range series {
		results = append(results, toMatchSeriesResponse(ms))
	}

	return results, total, nil
}

// StartSeries transitions a series from pending to in_progress and creates the first child match.
func (s *MatchSeriesService) StartSeries(ctx context.Context, seriesID int64, userID int64) (MatchSeriesResponse, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return MatchSeriesResponse{}, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	series, err := qtx.GetMatchSeriesForUpdate(ctx, seriesID)
	if err != nil {
		return MatchSeriesResponse{}, &NotFoundError{Message: "match series not found"}
	}

	if series.Status != "pending" {
		return MatchSeriesResponse{}, &ValidationError{Message: "series must be in pending status to start"}
	}

	updated, err := qtx.UpdateMatchSeriesStarted(ctx, seriesID)
	if err != nil {
		return MatchSeriesResponse{}, fmt.Errorf("failed to start series: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return MatchSeriesResponse{}, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return toMatchSeriesResponse(updated), nil
}

// RecordMatchResult records the result of a child match and updates series score.
// Auto-completes the series when a team reaches the win threshold.
func (s *MatchSeriesService) RecordMatchResult(ctx context.Context, seriesID int64, matchID int64, winnerTeamID int64) (MatchSeriesResponse, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return MatchSeriesResponse{}, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	series, err := qtx.GetMatchSeriesForUpdate(ctx, seriesID)
	if err != nil {
		return MatchSeriesResponse{}, &NotFoundError{Message: "match series not found"}
	}

	if series.Status != "in_progress" {
		return MatchSeriesResponse{}, &ValidationError{Message: "series must be in_progress to record results"}
	}

	// Determine which team won and update wins
	team1Wins := series.Team1Wins
	team2Wins := series.Team2Wins

	if series.Team1ID.Valid && winnerTeamID == series.Team1ID.Int64 {
		team1Wins++
	} else if series.Team2ID.Valid && winnerTeamID == series.Team2ID.Int64 {
		team2Wins++
	} else {
		return MatchSeriesResponse{}, &ValidationError{Message: "winner must be one of the series teams"}
	}

	_, err = qtx.UpdateMatchSeriesScore(ctx, generated.UpdateMatchSeriesScoreParams{
		ID:        seriesID,
		Team1Wins: team1Wins,
		Team2Wins: team2Wins,
	})
	if err != nil {
		return MatchSeriesResponse{}, fmt.Errorf("failed to update series score: %w", err)
	}

	// Check if series is complete
	var updated generated.MatchSeries
	if team1Wins >= series.GamesToWin {
		// Team 1 wins the series
		var loserID pgtype.Int8
		if series.Team2ID.Valid {
			loserID = series.Team2ID
		}
		reason := "score"
		updated, err = qtx.UpdateMatchSeriesResult(ctx, generated.UpdateMatchSeriesResultParams{
			ID:           seriesID,
			WinnerTeamID: series.Team1ID,
			LoserTeamID:  loserID,
			WinReason:    &reason,
		})
		if err != nil {
			return MatchSeriesResponse{}, fmt.Errorf("failed to complete series: %w", err)
		}
	} else if team2Wins >= series.GamesToWin {
		// Team 2 wins the series
		var loserID pgtype.Int8
		if series.Team1ID.Valid {
			loserID = series.Team1ID
		}
		reason := "score"
		updated, err = qtx.UpdateMatchSeriesResult(ctx, generated.UpdateMatchSeriesResultParams{
			ID:           seriesID,
			WinnerTeamID: series.Team2ID,
			LoserTeamID:  loserID,
			WinReason:    &reason,
		})
		if err != nil {
			return MatchSeriesResponse{}, fmt.Errorf("failed to complete series: %w", err)
		}
	} else {
		// Series continues — re-read after score update
		updated, err = qtx.GetMatchSeries(ctx, seriesID)
		if err != nil {
			return MatchSeriesResponse{}, fmt.Errorf("failed to read updated series: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return MatchSeriesResponse{}, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return toMatchSeriesResponse(updated), nil
}

// ForfeitSeries forfeits a series on behalf of a team.
func (s *MatchSeriesService) ForfeitSeries(ctx context.Context, seriesID int64, forfeitingTeamID int64) (MatchSeriesResponse, error) {
	series, err := s.queries.GetMatchSeries(ctx, seriesID)
	if err != nil {
		return MatchSeriesResponse{}, &NotFoundError{Message: "match series not found"}
	}

	if series.Status != "pending" && series.Status != "in_progress" {
		return MatchSeriesResponse{}, &ValidationError{Message: "series must be pending or in_progress to forfeit"}
	}

	// Determine winner/loser
	var winnerID, loserID pgtype.Int8
	if series.Team1ID.Valid && forfeitingTeamID == series.Team1ID.Int64 {
		winnerID = series.Team2ID
		loserID = series.Team1ID
	} else if series.Team2ID.Valid && forfeitingTeamID == series.Team2ID.Int64 {
		winnerID = series.Team1ID
		loserID = series.Team2ID
	} else {
		return MatchSeriesResponse{}, &ValidationError{Message: "forfeiting team must be one of the series teams"}
	}

	updated, err := s.queries.UpdateMatchSeriesForfeited(ctx, generated.UpdateMatchSeriesForfeitedParams{
		ID:           seriesID,
		WinnerTeamID: winnerID,
		LoserTeamID:  loserID,
	})
	if err != nil {
		return MatchSeriesResponse{}, fmt.Errorf("failed to forfeit series: %w", err)
	}

	return toMatchSeriesResponse(updated), nil
}

// CancelSeries cancels a pending or in-progress series.
func (s *MatchSeriesService) CancelSeries(ctx context.Context, seriesID int64) (MatchSeriesResponse, error) {
	series, err := s.queries.GetMatchSeries(ctx, seriesID)
	if err != nil {
		return MatchSeriesResponse{}, &NotFoundError{Message: "match series not found"}
	}

	if series.Status != "pending" && series.Status != "in_progress" {
		return MatchSeriesResponse{}, &ValidationError{Message: "series must be pending or in_progress to cancel"}
	}

	updated, err := s.queries.UpdateMatchSeriesStatus(ctx, generated.UpdateMatchSeriesStatusParams{
		ID:     seriesID,
		Status: "cancelled",
	})
	if err != nil {
		return MatchSeriesResponse{}, fmt.Errorf("failed to cancel series: %w", err)
	}

	return toMatchSeriesResponse(updated), nil
}

// CreateChildMatch creates a new child match within a series.
func (s *MatchSeriesService) CreateChildMatch(ctx context.Context, seriesID int64, userID int64, input CreateSeriesInput) (MatchResponse, error) {
	series, err := s.queries.GetMatchSeries(ctx, seriesID)
	if err != nil {
		return MatchResponse{}, &NotFoundError{Message: "match series not found"}
	}

	if series.Status != "in_progress" {
		return MatchResponse{}, &ValidationError{Message: "series must be in_progress to create child matches"}
	}

	// Count existing child matches to determine match number
	count, err := s.queries.CountMatchesBySeriesID(ctx, pgtype.Int8{Int64: seriesID, Valid: true})
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to count series matches: %w", err)
	}
	matchNum := int32(count + 1)

	match, err := s.queries.CreateSeriesChildMatch(ctx, generated.CreateSeriesChildMatchParams{
		MatchSeriesID:      pgtype.Int8{Int64: seriesID, Valid: true},
		DivisionID:         series.DivisionID,
		PodID:              series.PodID,
		CreatedByUserID:    userID,
		MatchNumber:        pgtype.Int4{Int32: matchNum, Valid: true},
		Team1ID:            series.Team1ID,
		Team2ID:            series.Team2ID,
		GamesPerSet:        input.GamesPerSet,
		SetsToWin:          input.SetsToWin,
		PointsToWin:        input.PointsToWin,
		WinBy:              input.WinBy,
		MaxPoints:          toPgInt4(input.MaxPoints),
		RallyScoring:       input.RallyScoring,
		TimeoutsPerGame:    input.TimeoutsPerGame,
		TimeoutDurationSec: input.TimeoutDurationSec,
		FreezeAt:           toPgInt4(input.FreezeAt),
	})
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to create child match: %w", err)
	}

	return toMatchResponse(match), nil
}
