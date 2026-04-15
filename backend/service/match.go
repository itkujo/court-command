package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/engine"
)

// MatchService handles match business logic.
type MatchService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

// NewMatchService creates a new MatchService.
func NewMatchService(queries *generated.Queries, pool *pgxpool.Pool) *MatchService {
	return &MatchService{queries: queries, pool: pool}
}

// ScoreSnapshot holds the denormalized score state for a match.
type ScoreSnapshot struct {
	Team1Score   int32           `json:"team1_score"`
	Team2Score   int32           `json:"team2_score"`
	CurrentSet   int32           `json:"current_set"`
	CurrentGame  int32           `json:"current_game"`
	ServingTeam  pgtype.Int4     `json:"serving_team"`
	ServerNumber pgtype.Int4     `json:"server_number"`
	SetScores    json.RawMessage `json:"set_scores"`
}

// MatchResponse is the public representation of a match.
type MatchResponse struct {
	ID                 int64           `json:"id"`
	PublicID           string          `json:"public_id"`
	TournamentID       *int64          `json:"tournament_id,omitempty"`
	DivisionID         *int64          `json:"division_id,omitempty"`
	PodID              *int64          `json:"pod_id,omitempty"`
	CourtID            *int64          `json:"court_id,omitempty"`
	CreatedByUserID    int64           `json:"created_by_user_id"`
	MatchType          string          `json:"match_type"`
	Round              *int32          `json:"round,omitempty"`
	RoundName          *string         `json:"round_name,omitempty"`
	MatchNumber        *int32          `json:"match_number,omitempty"`
	Team1ID            *int64          `json:"team1_id,omitempty"`
	Team2ID            *int64          `json:"team2_id,omitempty"`
	Team1Seed          *int32          `json:"team1_seed,omitempty"`
	Team2Seed          *int32          `json:"team2_seed,omitempty"`
	ScoringPresetID    *int64          `json:"scoring_preset_id,omitempty"`
	GamesPerSet        int32           `json:"games_per_set"`
	SetsToWin          int32           `json:"sets_to_win"`
	PointsToWin        int32           `json:"points_to_win"`
	WinBy              int32           `json:"win_by"`
	MaxPoints          *int32          `json:"max_points,omitempty"`
	RallyScoring       bool            `json:"rally_scoring"`
	TimeoutsPerGame    int32           `json:"timeouts_per_game"`
	TimeoutDurationSec int32           `json:"timeout_duration_sec"`
	FreezeAt           *int32          `json:"freeze_at,omitempty"`
	Team1Score         int32           `json:"team1_score"`
	Team2Score         int32           `json:"team2_score"`
	CurrentSet         int32           `json:"current_set"`
	CurrentGame        int32           `json:"current_game"`
	ServingTeam        *int32          `json:"serving_team,omitempty"`
	ServerNumber       *int32          `json:"server_number,omitempty"`
	SetScores          json.RawMessage `json:"set_scores"`
	Status             string          `json:"status"`
	StartedAt          *string         `json:"started_at,omitempty"`
	CompletedAt        *string         `json:"completed_at,omitempty"`
	WinnerTeamID       *int64          `json:"winner_team_id,omitempty"`
	LoserTeamID        *int64          `json:"loser_team_id,omitempty"`
	WinReason          *string         `json:"win_reason,omitempty"`
	NextMatchID        *int64          `json:"next_match_id,omitempty"`
	NextMatchSlot      *int32          `json:"next_match_slot,omitempty"`
	LoserNextMatchID   *int64          `json:"loser_next_match_id,omitempty"`
	LoserNextMatchSlot *int32          `json:"loser_next_match_slot,omitempty"`
	RefereeUserID      *int64          `json:"referee_user_id,omitempty"`
	Notes              *string         `json:"notes,omitempty"`
	ExpiresAt          *string         `json:"expires_at,omitempty"`
	ScheduledAt        *string         `json:"scheduled_at,omitempty"`
	CreatedAt          string          `json:"created_at"`
	UpdatedAt          string          `json:"updated_at"`
}

// MatchEventResponse is the public representation of a match event.
type MatchEventResponse struct {
	ID              int64           `json:"id"`
	MatchID         int64           `json:"match_id"`
	SequenceID      int32           `json:"sequence_id"`
	EventType       string          `json:"event_type"`
	Team1Score      int32           `json:"team1_score"`
	Team2Score      int32           `json:"team2_score"`
	CurrentSet      int32           `json:"current_set"`
	CurrentGame     int32           `json:"current_game"`
	ServingTeam     *int32          `json:"serving_team,omitempty"`
	ServerNumber    *int32          `json:"server_number,omitempty"`
	SetScores       json.RawMessage `json:"set_scores"`
	Payload         json.RawMessage `json:"payload"`
	CreatedByUserID *int64          `json:"created_by_user_id,omitempty"`
	CreatedAt       string          `json:"created_at"`
}

func optInt8(v pgtype.Int8) *int64 {
	if v.Valid {
		return &v.Int64
	}
	return nil
}

func optInt4(v pgtype.Int4) *int32 {
	if v.Valid {
		return &v.Int32
	}
	return nil
}

func optTimestamptz(v pgtype.Timestamptz) *string {
	if v.Valid {
		s := v.Time.Format(time.RFC3339)
		return &s
	}
	return nil
}

func toMatchResponse(m generated.Match) MatchResponse {
	resp := MatchResponse{
		ID:                 m.ID,
		PublicID:           m.PublicID,
		TournamentID:       optInt8(m.TournamentID),
		DivisionID:         optInt8(m.DivisionID),
		PodID:              optInt8(m.PodID),
		CourtID:            optInt8(m.CourtID),
		CreatedByUserID:    m.CreatedByUserID,
		MatchType:          m.MatchType,
		Round:              optInt4(m.Round),
		RoundName:          m.RoundName,
		MatchNumber:        optInt4(m.MatchNumber),
		Team1ID:            optInt8(m.Team1ID),
		Team2ID:            optInt8(m.Team2ID),
		Team1Seed:          optInt4(m.Team1Seed),
		Team2Seed:          optInt4(m.Team2Seed),
		ScoringPresetID:    optInt8(m.ScoringPresetID),
		GamesPerSet:        m.GamesPerSet,
		SetsToWin:          m.SetsToWin,
		PointsToWin:        m.PointsToWin,
		WinBy:              m.WinBy,
		MaxPoints:          optInt4(m.MaxPoints),
		RallyScoring:       m.RallyScoring,
		TimeoutsPerGame:    m.TimeoutsPerGame,
		TimeoutDurationSec: m.TimeoutDurationSec,
		FreezeAt:           optInt4(m.FreezeAt),
		Team1Score:         m.Team1Score,
		Team2Score:         m.Team2Score,
		CurrentSet:         m.CurrentSet,
		CurrentGame:        m.CurrentGame,
		ServingTeam:        optInt4(m.ServingTeam),
		ServerNumber:       optInt4(m.ServerNumber),
		Status:             m.Status,
		StartedAt:          optTimestamptz(m.StartedAt),
		CompletedAt:        optTimestamptz(m.CompletedAt),
		WinnerTeamID:       optInt8(m.WinnerTeamID),
		LoserTeamID:        optInt8(m.LoserTeamID),
		WinReason:          m.WinReason,
		NextMatchID:        optInt8(m.NextMatchID),
		NextMatchSlot:      optInt4(m.NextMatchSlot),
		LoserNextMatchID:   optInt8(m.LoserNextMatchID),
		LoserNextMatchSlot: optInt4(m.LoserNextMatchSlot),
		RefereeUserID:      optInt8(m.RefereeUserID),
		Notes:              m.Notes,
		ExpiresAt:          optTimestamptz(m.ExpiresAt),
		ScheduledAt:        optTimestamptz(m.ScheduledAt),
		CreatedAt:          m.CreatedAt.Format(time.RFC3339),
		UpdatedAt:          m.UpdatedAt.Format(time.RFC3339),
	}

	if len(m.SetScores) > 0 {
		resp.SetScores = json.RawMessage(m.SetScores)
	} else {
		resp.SetScores = json.RawMessage("[]")
	}

	return resp
}

func toMatchEventResponse(e generated.MatchEvent) MatchEventResponse {
	resp := MatchEventResponse{
		ID:              e.ID,
		MatchID:         e.MatchID,
		SequenceID:      e.SequenceID,
		EventType:       e.EventType,
		Team1Score:      e.Team1Score,
		Team2Score:      e.Team2Score,
		CurrentSet:      e.CurrentSet,
		CurrentGame:     e.CurrentGame,
		ServingTeam:     optInt4(e.ServingTeam),
		ServerNumber:    optInt4(e.ServerNumber),
		CreatedByUserID: optInt8(e.CreatedByUserID),
		CreatedAt:       e.CreatedAt.Format(time.RFC3339),
	}

	if len(e.SetScores) > 0 {
		resp.SetScores = json.RawMessage(e.SetScores)
	} else {
		resp.SetScores = json.RawMessage("[]")
	}
	if len(e.Payload) > 0 {
		resp.Payload = json.RawMessage(e.Payload)
	} else {
		resp.Payload = json.RawMessage("{}")
	}

	return resp
}

// validMatchTransitions defines allowed status transitions.
var validMatchTransitions = map[string][]string{
	"scheduled":   {"warmup", "in_progress", "cancelled"},
	"warmup":      {"in_progress", "cancelled"},
	"in_progress": {"paused", "completed", "cancelled", "forfeited"},
	"paused":      {"in_progress", "cancelled", "forfeited"},
}

// Create creates a new match.
func (s *MatchService) Create(ctx context.Context, params generated.CreateMatchParams) (MatchResponse, error) {
	if params.MatchType == "" {
		params.MatchType = "tournament"
	}

	validTypes := map[string]bool{
		"tournament": true, "quick": true, "pickup": true, "practice": true, "league": true,
	}
	if !validTypes[params.MatchType] {
		return MatchResponse{}, &ValidationError{Message: "invalid match_type"}
	}

	if params.Status == "" {
		params.Status = "scheduled"
	}

	match, err := s.queries.CreateMatch(ctx, params)
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to create match: %w", err)
	}

	return toMatchResponse(match), nil
}

// GetByID retrieves a match by internal ID.
func (s *MatchService) GetByID(ctx context.Context, id int64) (MatchResponse, error) {
	match, err := s.queries.GetMatch(ctx, id)
	if err != nil {
		return MatchResponse{}, &NotFoundError{Message: "match not found"}
	}
	return toMatchResponse(match), nil
}

// GetByPublicID retrieves a match by public ID.
func (s *MatchService) GetByPublicID(ctx context.Context, publicID string) (MatchResponse, error) {
	match, err := s.queries.GetMatchByPublicID(ctx, publicID)
	if err != nil {
		return MatchResponse{}, &NotFoundError{Message: "match not found"}
	}
	return toMatchResponse(match), nil
}

// ListByDivision returns paginated matches for a division.
func (s *MatchService) ListByDivision(ctx context.Context, divisionID int64, limit, offset int32) ([]MatchResponse, int64, error) {
	did := pgtype.Int8{Int64: divisionID, Valid: true}
	matches, err := s.queries.ListMatchesByDivision(ctx, generated.ListMatchesByDivisionParams{
		DivisionID: did,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list matches: %w", err)
	}

	count, err := s.queries.CountMatchesByDivision(ctx, did)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count matches: %w", err)
	}

	result := make([]MatchResponse, len(matches))
	for i, m := range matches {
		result[i] = toMatchResponse(m)
	}
	return result, count, nil
}

// ListByPod returns paginated matches for a pod.
func (s *MatchService) ListByPod(ctx context.Context, podID int64, limit, offset int32) ([]MatchResponse, error) {
	matches, err := s.queries.ListMatchesByPod(ctx, generated.ListMatchesByPodParams{
		PodID:  pgtype.Int8{Int64: podID, Valid: true},
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list matches: %w", err)
	}

	result := make([]MatchResponse, len(matches))
	for i, m := range matches {
		result[i] = toMatchResponse(m)
	}
	return result, nil
}

// ListByCourt returns paginated matches for a court.
func (s *MatchService) ListByCourt(ctx context.Context, courtID int64, limit, offset int32) ([]MatchResponse, error) {
	matches, err := s.queries.ListMatchesByCourt(ctx, generated.ListMatchesByCourtParams{
		CourtID: pgtype.Int8{Int64: courtID, Valid: true},
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list matches: %w", err)
	}

	result := make([]MatchResponse, len(matches))
	for i, m := range matches {
		result[i] = toMatchResponse(m)
	}
	return result, nil
}

// ListByTeam returns paginated matches for a team.
func (s *MatchService) ListByTeam(ctx context.Context, teamID int64, limit, offset int32) ([]MatchResponse, int64, error) {
	tid := pgtype.Int8{Int64: teamID, Valid: true}
	matches, err := s.queries.ListMatchesByTeam(ctx, generated.ListMatchesByTeamParams{
		Team1ID: tid,
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list matches: %w", err)
	}

	count, err := s.queries.CountMatchesByTeam(ctx, tid)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count matches: %w", err)
	}

	result := make([]MatchResponse, len(matches))
	for i, m := range matches {
		result[i] = toMatchResponse(m)
	}
	return result, count, nil
}

// ListByTournament returns paginated matches for a tournament.
func (s *MatchService) ListByTournament(ctx context.Context, tournamentID int64, limit, offset int32) ([]MatchResponse, error) {
	matches, err := s.queries.ListMatchesByTournament(ctx, generated.ListMatchesByTournamentParams{
		TournamentID: pgtype.Int8{Int64: tournamentID, Valid: true},
		Limit:        limit,
		Offset:       offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list matches: %w", err)
	}

	result := make([]MatchResponse, len(matches))
	for i, m := range matches {
		result[i] = toMatchResponse(m)
	}
	return result, nil
}

// ListQuickMatches returns paginated quick matches for a user.
func (s *MatchService) ListQuickMatches(ctx context.Context, userID int64, limit, offset int32) ([]MatchResponse, error) {
	matches, err := s.queries.ListQuickMatches(ctx, generated.ListQuickMatchesParams{
		CreatedByUserID: userID,
		Limit:           limit,
		Offset:          offset,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list quick matches: %w", err)
	}

	result := make([]MatchResponse, len(matches))
	for i, m := range matches {
		result[i] = toMatchResponse(m)
	}
	return result, nil
}

// UpdateStatus transitions a match to a new status.
func (s *MatchService) UpdateStatus(ctx context.Context, id int64, newStatus string) (MatchResponse, error) {
	match, err := s.queries.GetMatch(ctx, id)
	if err != nil {
		return MatchResponse{}, &NotFoundError{Message: "match not found"}
	}

	allowed, ok := validMatchTransitions[match.Status]
	if !ok {
		return MatchResponse{}, &ValidationError{
			Message: fmt.Sprintf("no transitions allowed from status %q", match.Status),
		}
	}

	valid := false
	for _, s := range allowed {
		if s == newStatus {
			valid = true
			break
		}
	}
	if !valid {
		return MatchResponse{}, &ValidationError{
			Message: fmt.Sprintf("cannot transition from %q to %q", match.Status, newStatus),
		}
	}

	updated, err := s.queries.UpdateMatchStatus(ctx, generated.UpdateMatchStatusParams{
		ID:     id,
		Status: newStatus,
	})
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to update match status: %w", err)
	}

	return toMatchResponse(updated), nil
}

// StartMatch transitions a match to in_progress with started_at set, and records a start event.
// Uses a transaction to ensure atomicity.
func (s *MatchService) StartMatch(ctx context.Context, matchID int64, userID int64) (MatchResponse, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	match, err := qtx.GetMatchForUpdate(ctx, matchID)
	if err != nil {
		return MatchResponse{}, &NotFoundError{Message: "match not found"}
	}

	if match.Status != "scheduled" && match.Status != "warmup" {
		return MatchResponse{}, &ValidationError{
			Message: fmt.Sprintf("cannot start match in status %q", match.Status),
		}
	}

	updated, err := qtx.UpdateMatchStarted(ctx, matchID)
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to start match: %w", err)
	}

	// Record start event
	nextSeq, err := qtx.GetNextSequenceID(ctx, matchID)
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to get next sequence: %w", err)
	}

	_, err = qtx.CreateMatchEvent(ctx, generated.CreateMatchEventParams{
		MatchID:         matchID,
		SequenceID:      nextSeq,
		EventType:       "start_game",
		Team1Score:      match.Team1Score,
		Team2Score:      match.Team2Score,
		CurrentSet:      match.CurrentSet,
		CurrentGame:     match.CurrentGame,
		ServingTeam:     match.ServingTeam,
		ServerNumber:    match.ServerNumber,
		SetScores:       match.SetScores,
		Payload:         []byte(`{"action":"match_started"}`),
		CreatedByUserID: pgtype.Int8{Int64: userID, Valid: true},
	})
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to record start event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return MatchResponse{}, fmt.Errorf("failed to commit start match: %w", err)
	}

	return toMatchResponse(updated), nil
}

// RecordEvent records a scoring event and updates the match score.
// Uses a transaction to ensure atomicity.
func (s *MatchService) RecordEvent(ctx context.Context, matchID int64, eventType string, payload json.RawMessage, userID int64) (MatchEventResponse, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return MatchEventResponse{}, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	match, err := qtx.GetMatchForUpdate(ctx, matchID)
	if err != nil {
		return MatchEventResponse{}, &NotFoundError{Message: "match not found"}
	}

	if match.Status != "in_progress" {
		return MatchEventResponse{}, &ValidationError{
			Message: fmt.Sprintf("cannot record events for match in status %q", match.Status),
		}
	}

	nextSeq, err := qtx.GetNextSequenceID(ctx, matchID)
	if err != nil {
		return MatchEventResponse{}, fmt.Errorf("failed to get next sequence: %w", err)
	}

	if payload == nil {
		payload = json.RawMessage("{}")
	}

	// Snapshot BEFORE this event
	event, err := qtx.CreateMatchEvent(ctx, generated.CreateMatchEventParams{
		MatchID:         matchID,
		SequenceID:      nextSeq,
		EventType:       eventType,
		Team1Score:      match.Team1Score,
		Team2Score:      match.Team2Score,
		CurrentSet:      match.CurrentSet,
		CurrentGame:     match.CurrentGame,
		ServingTeam:     match.ServingTeam,
		ServerNumber:    match.ServerNumber,
		SetScores:       match.SetScores,
		Payload:         payload,
		CreatedByUserID: pgtype.Int8{Int64: userID, Valid: true},
	})
	if err != nil {
		return MatchEventResponse{}, fmt.Errorf("failed to create event: %w", err)
	}

	// Apply the event to update match score
	newT1 := match.Team1Score
	newT2 := match.Team2Score
	newServingTeam := match.ServingTeam
	newServerNumber := match.ServerNumber

	switch eventType {
	case "point_team1":
		newT1++
		if match.RallyScoring {
			newServingTeam = pgtype.Int4{Int32: 1, Valid: true}
		}
	case "point_team2":
		newT2++
		if match.RallyScoring {
			newServingTeam = pgtype.Int4{Int32: 2, Valid: true}
		}
	case "side_out":
		if newServingTeam.Valid && newServingTeam.Int32 == 1 {
			newServingTeam = pgtype.Int4{Int32: 2, Valid: true}
		} else {
			newServingTeam = pgtype.Int4{Int32: 1, Valid: true}
		}
		// Toggle server number for doubles
		if newServerNumber.Valid && newServerNumber.Int32 == 1 {
			newServerNumber = pgtype.Int4{Int32: 2, Valid: true}
		} else if newServerNumber.Valid {
			newServerNumber = pgtype.Int4{Int32: 1, Valid: true}
		}
	}

	_, err = qtx.UpdateMatchScoring(ctx, generated.UpdateMatchScoringParams{
		ID:           matchID,
		Team1Score:   newT1,
		Team2Score:   newT2,
		CurrentSet:   match.CurrentSet,
		CurrentGame:  match.CurrentGame,
		ServingTeam:  newServingTeam,
		ServerNumber: newServerNumber,
		SetScores:    match.SetScores,
	})
	if err != nil {
		return MatchEventResponse{}, fmt.Errorf("failed to update match scoring: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return MatchEventResponse{}, fmt.Errorf("failed to commit event: %w", err)
	}

	return toMatchEventResponse(event), nil
}

// Undo reverts the last event by restoring the snapshot from the previous event.
// Uses a transaction to ensure atomicity.
func (s *MatchService) Undo(ctx context.Context, matchID int64, userID int64) (MatchResponse, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	match, err := qtx.GetMatchForUpdate(ctx, matchID)
	if err != nil {
		return MatchResponse{}, &NotFoundError{Message: "match not found"}
	}

	if match.Status != "in_progress" {
		return MatchResponse{}, &ValidationError{
			Message: fmt.Sprintf("cannot undo events for match in status %q", match.Status),
		}
	}

	// Get the latest event
	latestEvent, err := qtx.GetLatestMatchEvent(ctx, matchID)
	if err != nil {
		return MatchResponse{}, &ValidationError{Message: "no events to undo"}
	}

	// Record undo event with the current state as snapshot
	nextSeq, err := qtx.GetNextSequenceID(ctx, matchID)
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to get next sequence: %w", err)
	}

	undoPayload, _ := json.Marshal(map[string]interface{}{
		"undone_event_sequence": latestEvent.SequenceID,
		"undone_event_type":     latestEvent.EventType,
	})

	_, err = qtx.CreateMatchEvent(ctx, generated.CreateMatchEventParams{
		MatchID:         matchID,
		SequenceID:      nextSeq,
		EventType:       "undo",
		Team1Score:      match.Team1Score,
		Team2Score:      match.Team2Score,
		CurrentSet:      match.CurrentSet,
		CurrentGame:     match.CurrentGame,
		ServingTeam:     match.ServingTeam,
		ServerNumber:    match.ServerNumber,
		SetScores:       match.SetScores,
		Payload:         undoPayload,
		CreatedByUserID: pgtype.Int8{Int64: userID, Valid: true},
	})
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to record undo event: %w", err)
	}

	// Restore score from the snapshot stored in the latest event (which captured the state BEFORE that event)
	updated, err := qtx.UpdateMatchScoring(ctx, generated.UpdateMatchScoringParams{
		ID:           matchID,
		Team1Score:   latestEvent.Team1Score,
		Team2Score:   latestEvent.Team2Score,
		CurrentSet:   latestEvent.CurrentSet,
		CurrentGame:  latestEvent.CurrentGame,
		ServingTeam:  latestEvent.ServingTeam,
		ServerNumber: latestEvent.ServerNumber,
		SetScores:    latestEvent.SetScores,
	})
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to restore score: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return MatchResponse{}, fmt.Errorf("failed to commit undo: %w", err)
	}

	return toMatchResponse(updated), nil
}

// GetMatchEvents returns all events for a match.
func (s *MatchService) GetMatchEvents(ctx context.Context, matchID int64) ([]MatchEventResponse, error) {
	// Verify match exists
	_, err := s.queries.GetMatch(ctx, matchID)
	if err != nil {
		return nil, &NotFoundError{Message: "match not found"}
	}

	events, err := s.queries.ListMatchEvents(ctx, matchID)
	if err != nil {
		return nil, fmt.Errorf("failed to list match events: %w", err)
	}

	result := make([]MatchEventResponse, len(events))
	for i, e := range events {
		result[i] = toMatchEventResponse(e)
	}
	return result, nil
}

// AssignToCourt assigns a match to a court.
func (s *MatchService) AssignToCourt(ctx context.Context, matchID int64, courtID int64) (MatchResponse, error) {
	match, err := s.queries.GetMatch(ctx, matchID)
	if err != nil {
		return MatchResponse{}, &NotFoundError{Message: "match not found"}
	}

	if match.Status == "completed" || match.Status == "cancelled" || match.Status == "forfeited" {
		return MatchResponse{}, &ValidationError{
			Message: fmt.Sprintf("cannot assign court to match in status %q", match.Status),
		}
	}

	updated, err := s.queries.UpdateMatchCourt(ctx, generated.UpdateMatchCourtParams{
		ID:      matchID,
		CourtID: pgtype.Int8{Int64: courtID, Valid: true},
	})
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to assign court: %w", err)
	}

	return toMatchResponse(updated), nil
}

// UpdateScoringConfig updates the scoring configuration of a match.
func (s *MatchService) UpdateScoringConfig(ctx context.Context, matchID int64, params generated.UpdateMatchScoringConfigParams) (MatchResponse, error) {
	match, err := s.queries.GetMatch(ctx, matchID)
	if err != nil {
		return MatchResponse{}, &NotFoundError{Message: "match not found"}
	}

	if match.Status != "scheduled" && match.Status != "warmup" {
		return MatchResponse{}, &ValidationError{
			Message: "scoring config can only be changed before a match starts",
		}
	}

	params.ID = matchID
	updated, err := s.queries.UpdateMatchScoringConfig(ctx, params)
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to update scoring config: %w", err)
	}

	return toMatchResponse(updated), nil
}

// UpdateNotes updates the notes of a match.
func (s *MatchService) UpdateNotes(ctx context.Context, matchID int64, notes *string) (MatchResponse, error) {
	updated, err := s.queries.UpdateMatchNotes(ctx, generated.UpdateMatchNotesParams{
		ID:    matchID,
		Notes: notes,
	})
	if err != nil {
		return MatchResponse{}, &NotFoundError{Message: "match not found"}
	}

	return toMatchResponse(updated), nil
}

// UpdateReferee assigns a referee to a match.
func (s *MatchService) UpdateReferee(ctx context.Context, matchID int64, refereeUserID *int64) (MatchResponse, error) {
	var refID pgtype.Int8
	if refereeUserID != nil {
		refID = pgtype.Int8{Int64: *refereeUserID, Valid: true}
	}

	updated, err := s.queries.UpdateMatchReferee(ctx, generated.UpdateMatchRefereeParams{
		ID:            matchID,
		RefereeUserID: refID,
	})
	if err != nil {
		return MatchResponse{}, &NotFoundError{Message: "match not found"}
	}

	return toMatchResponse(updated), nil
}

// GetActiveMatchOnCourt returns the currently active match on a court, if any.
func (s *MatchService) GetActiveMatchOnCourt(ctx context.Context, courtID int64) (*MatchResponse, error) {
	match, err := s.queries.GetActiveMatchOnCourt(ctx, pgtype.Int8{Int64: courtID, Valid: true})
	if err != nil {
		// No active match is not an error
		return nil, nil
	}

	resp := toMatchResponse(match)
	return &resp, nil
}

// CompleteMatch marks a match as completed with a result.
func (s *MatchService) CompleteMatch(ctx context.Context, matchID int64, winnerTeamID, loserTeamID int64, winReason string) (MatchResponse, error) {
	match, err := s.queries.GetMatch(ctx, matchID)
	if err != nil {
		return MatchResponse{}, &NotFoundError{Message: "match not found"}
	}

	if match.Status != "in_progress" && match.Status != "paused" {
		return MatchResponse{}, &ValidationError{
			Message: fmt.Sprintf("cannot complete match in status %q", match.Status),
		}
	}

	updated, err := s.queries.UpdateMatchResult(ctx, generated.UpdateMatchResultParams{
		ID:           matchID,
		WinnerTeamID: pgtype.Int8{Int64: winnerTeamID, Valid: true},
		LoserTeamID:  pgtype.Int8{Int64: loserTeamID, Valid: true},
		WinReason:    &winReason,
	})
	if err != nil {
		return MatchResponse{}, fmt.Errorf("failed to complete match: %w", err)
	}

	return toMatchResponse(updated), nil
}

// CleanupExpiredQuickMatches removes expired quick matches.
func (s *MatchService) CleanupExpiredQuickMatches(ctx context.Context) error {
	return s.queries.DeleteExpiredQuickMatches(ctx)
}

// UpdateTeams updates the teams on a match.
func (s *MatchService) UpdateTeams(ctx context.Context, matchID int64, params generated.UpdateMatchTeamsParams) (MatchResponse, error) {
	params.ID = matchID

	updated, err := s.queries.UpdateMatchTeams(ctx, params)
	if err != nil {
		return MatchResponse{}, &NotFoundError{Message: "match not found"}
	}

	return toMatchResponse(updated), nil
}

// UpdateBracketWiring updates the bracket wiring of a match.
func (s *MatchService) UpdateBracketWiring(ctx context.Context, matchID int64, params generated.UpdateMatchBracketWiringParams) (MatchResponse, error) {
	params.ID = matchID

	updated, err := s.queries.UpdateMatchBracketWiring(ctx, params)
	if err != nil {
		return MatchResponse{}, &NotFoundError{Message: "match not found"}
	}

	return toMatchResponse(updated), nil
}

// ---------------------------------------------------------------------------
// Scoring Engine Integration
// ---------------------------------------------------------------------------

// ScoringActionResult wraps the result of a scoring action.
type ScoringActionResult struct {
	Match             MatchResponse      `json:"match"`
	Event             MatchEventResponse `json:"event"`
	GameOverDetected  bool               `json:"game_over_detected"`
	MatchOverDetected bool               `json:"match_over_detected"`
	EndChangeDetected bool               `json:"end_change_detected"`
	ScoreCall         string             `json:"score_call"`
}

// matchToEngineState converts a generated.Match to an engine.MatchState.
func matchToEngineState(m generated.Match) engine.MatchState {
	state := engine.MatchState{
		TeamOneScore:   m.Team1Score,
		TeamTwoScore:   m.Team2Score,
		CurrentGameNum: m.CurrentGame,
		Status:         engine.MatchStatus(m.Status),
		IsPaused:       m.Status == "paused",
	}

	if m.ServingTeam.Valid {
		state.ServingTeam = m.ServingTeam.Int32
	} else {
		state.ServingTeam = 1
	}
	if m.ServerNumber.Valid {
		state.ServerNumber = m.ServerNumber.Int32
	} else {
		state.ServerNumber = 1
	}

	// Decode completed games from set_scores JSON.
	if len(m.SetScores) > 0 {
		var games []engine.GameResult
		if err := json.Unmarshal(m.SetScores, &games); err == nil {
			state.CompletedGames = games
		}
	}

	return state
}

// matchToScoringConfig builds an engine.ScoringConfig from a match's settings.
func matchToScoringConfig(m generated.Match) engine.ScoringConfig {
	scoringType := engine.SideOutScoring
	if m.RallyScoring {
		scoringType = engine.RallyScoring
	}

	var maxPts int32
	if m.MaxPoints.Valid {
		maxPts = m.MaxPoints.Int32
	}
	var freezeAt int32
	if m.FreezeAt.Valid {
		freezeAt = m.FreezeAt.Int32
	}

	cfg, _ := engine.ParseScoringConfig(scoringType, m.PointsToWin, m.WinBy, maxPts, m.GamesPerSet, m.SetsToWin, freezeAt)
	return cfg
}

// applyEngineResult writes the engine result back to the database in a transaction.
// It updates the match scoring state and records an event with the current snapshot.
func (s *MatchService) applyEngineResult(
	ctx context.Context,
	matchID int64,
	result engine.EngineResult,
	eventType string,
	payload json.RawMessage,
	userID int64,
) (generated.Match, generated.MatchEvent, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return generated.Match{}, generated.MatchEvent{}, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	match, err := qtx.GetMatchForUpdate(ctx, matchID)
	if err != nil {
		return generated.Match{}, generated.MatchEvent{}, &NotFoundError{Message: "match not found"}
	}

	// Encode completed games as set_scores JSON.
	setScores := match.SetScores
	if len(result.State.CompletedGames) > 0 {
		encoded, err := json.Marshal(result.State.CompletedGames)
		if err == nil {
			setScores = encoded
		}
	}

	// Determine new status.
	newStatus := match.Status
	if result.State.Status == engine.StatusPaused {
		newStatus = "paused"
	} else if result.State.Status == engine.StatusCompleted {
		newStatus = "completed"
	} else if result.State.Status == engine.StatusForfeited {
		newStatus = "forfeited"
	} else if result.State.Status == engine.StatusInProgress {
		newStatus = "in_progress"
	}

	// Update match scoring state.
	updated, err := qtx.UpdateMatchScoring(ctx, generated.UpdateMatchScoringParams{
		ID:           matchID,
		Team1Score:   result.State.TeamOneScore,
		Team2Score:   result.State.TeamTwoScore,
		CurrentSet:   match.CurrentSet,
		CurrentGame:  result.State.CurrentGameNum,
		ServingTeam:  pgtype.Int4{Int32: result.State.ServingTeam, Valid: true},
		ServerNumber: pgtype.Int4{Int32: result.State.ServerNumber, Valid: true},
		SetScores:    setScores,
	})
	if err != nil {
		return generated.Match{}, generated.MatchEvent{}, fmt.Errorf("failed to update match scoring: %w", err)
	}

	// If status changed, update it.
	if newStatus != match.Status {
		updated, err = qtx.UpdateMatchStatus(ctx, generated.UpdateMatchStatusParams{
			ID:     matchID,
			Status: newStatus,
		})
		if err != nil {
			return generated.Match{}, generated.MatchEvent{}, fmt.Errorf("failed to update match status: %w", err)
		}
	}

	// Record event.
	nextSeq, err := qtx.GetNextSequenceID(ctx, matchID)
	if err != nil {
		return generated.Match{}, generated.MatchEvent{}, fmt.Errorf("failed to get next sequence: %w", err)
	}

	if payload == nil {
		payload = json.RawMessage("{}")
	}

	event, err := qtx.CreateMatchEvent(ctx, generated.CreateMatchEventParams{
		MatchID:         matchID,
		SequenceID:      nextSeq,
		EventType:       eventType,
		Team1Score:      result.State.TeamOneScore,
		Team2Score:      result.State.TeamTwoScore,
		CurrentSet:      match.CurrentSet,
		CurrentGame:     result.State.CurrentGameNum,
		ServingTeam:     pgtype.Int4{Int32: result.State.ServingTeam, Valid: true},
		ServerNumber:    pgtype.Int4{Int32: result.State.ServerNumber, Valid: true},
		SetScores:       setScores,
		Payload:         payload,
		CreatedByUserID: pgtype.Int8{Int64: userID, Valid: true},
	})
	if err != nil {
		return generated.Match{}, generated.MatchEvent{}, fmt.Errorf("failed to create event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return generated.Match{}, generated.MatchEvent{}, fmt.Errorf("failed to commit: %w", err)
	}

	return updated, event, nil
}

// ScorePoint awards a point to the given team via the scoring engine.
func (s *MatchService) ScorePoint(ctx context.Context, matchID int64, team int32, userID int64) (ScoringActionResult, error) {
	match, err := s.queries.GetMatch(ctx, matchID)
	if err != nil {
		return ScoringActionResult{}, &NotFoundError{Message: "match not found"}
	}

	cfg := matchToScoringConfig(match)
	eng := engine.NewScoringEngine(cfg)
	state := matchToEngineState(match)

	result := eng.Point(state, team)
	if result.IsError {
		return ScoringActionResult{}, &ValidationError{Message: result.ErrorMessage}
	}

	payload, _ := json.Marshal(map[string]interface{}{"team": team})
	eventType := fmt.Sprintf("point_team%d", team)

	updated, event, err := s.applyEngineResult(ctx, matchID, result, eventType, payload, userID)
	if err != nil {
		return ScoringActionResult{}, err
	}

	return ScoringActionResult{
		Match:             toMatchResponse(updated),
		Event:             toMatchEventResponse(event),
		GameOverDetected:  result.GameOverDetected,
		MatchOverDetected: result.MatchOverDetected,
		EndChangeDetected: result.EndChangeDetected,
		ScoreCall:         eng.ScoreCall(result.State),
	}, nil
}

// SideOut handles a side-out (loss of serve).
func (s *MatchService) SideOut(ctx context.Context, matchID int64, userID int64) (ScoringActionResult, error) {
	match, err := s.queries.GetMatch(ctx, matchID)
	if err != nil {
		return ScoringActionResult{}, &NotFoundError{Message: "match not found"}
	}

	cfg := matchToScoringConfig(match)
	eng := engine.NewScoringEngine(cfg)
	state := matchToEngineState(match)

	result := eng.SideOut(state)
	if result.IsError {
		return ScoringActionResult{}, &ValidationError{Message: result.ErrorMessage}
	}

	updated, event, err := s.applyEngineResult(ctx, matchID, result, "side_out", nil, userID)
	if err != nil {
		return ScoringActionResult{}, err
	}

	return ScoringActionResult{
		Match:     toMatchResponse(updated),
		Event:     toMatchEventResponse(event),
		ScoreCall: eng.ScoreCall(result.State),
	}, nil
}

// RemovePoint removes the last point scored for a team.
func (s *MatchService) RemovePoint(ctx context.Context, matchID int64, team int32, userID int64) (ScoringActionResult, error) {
	match, err := s.queries.GetMatch(ctx, matchID)
	if err != nil {
		return ScoringActionResult{}, &NotFoundError{Message: "match not found"}
	}

	cfg := matchToScoringConfig(match)
	eng := engine.NewScoringEngine(cfg)
	state := matchToEngineState(match)

	// Use current serving state as previous (simplified undo — full undo via Undo endpoint).
	result := eng.RemovePoint(state, team, state.ServingTeam, state.ServerNumber)
	if result.IsError {
		return ScoringActionResult{}, &ValidationError{Message: result.ErrorMessage}
	}

	payload, _ := json.Marshal(map[string]interface{}{"team": team})
	updated, event, err := s.applyEngineResult(ctx, matchID, result, "remove_point", payload, userID)
	if err != nil {
		return ScoringActionResult{}, err
	}

	return ScoringActionResult{
		Match:     toMatchResponse(updated),
		Event:     toMatchEventResponse(event),
		ScoreCall: eng.ScoreCall(result.State),
	}, nil
}

// ConfirmGameOver transitions to the next game after a game win is detected.
func (s *MatchService) ConfirmGameOver(ctx context.Context, matchID int64, userID int64) (ScoringActionResult, error) {
	match, err := s.queries.GetMatch(ctx, matchID)
	if err != nil {
		return ScoringActionResult{}, &NotFoundError{Message: "match not found"}
	}

	cfg := matchToScoringConfig(match)
	eng := engine.NewScoringEngine(cfg)
	state := matchToEngineState(match)

	result := eng.ConfirmGameOver(state)
	if result.IsError {
		return ScoringActionResult{}, &ValidationError{Message: result.ErrorMessage}
	}

	updated, event, err := s.applyEngineResult(ctx, matchID, result, "confirm_game_over", nil, userID)
	if err != nil {
		return ScoringActionResult{}, err
	}

	return ScoringActionResult{
		Match:     toMatchResponse(updated),
		Event:     toMatchEventResponse(event),
		ScoreCall: eng.ScoreCall(result.State),
	}, nil
}

// ConfirmMatchOver finalizes the match as completed.
func (s *MatchService) ConfirmMatchOver(ctx context.Context, matchID int64, winnerTeamID, loserTeamID int64, userID int64) (ScoringActionResult, error) {
	match, err := s.queries.GetMatch(ctx, matchID)
	if err != nil {
		return ScoringActionResult{}, &NotFoundError{Message: "match not found"}
	}

	cfg := matchToScoringConfig(match)
	eng := engine.NewScoringEngine(cfg)
	state := matchToEngineState(match)

	result := eng.ConfirmMatchOver(state)
	if result.IsError {
		return ScoringActionResult{}, &ValidationError{Message: result.ErrorMessage}
	}

	updated, event, err := s.applyEngineResult(ctx, matchID, result, "confirm_match_over", nil, userID)
	if err != nil {
		return ScoringActionResult{}, err
	}

	// Also set winner/loser via the existing CompleteMatch logic.
	if winnerTeamID > 0 && loserTeamID > 0 {
		final, err := s.queries.UpdateMatchResult(ctx, generated.UpdateMatchResultParams{
			ID:           matchID,
			WinnerTeamID: pgtype.Int8{Int64: winnerTeamID, Valid: true},
			LoserTeamID:  pgtype.Int8{Int64: loserTeamID, Valid: true},
			WinReason:    strPtr("score"),
		})
		if err == nil {
			return ScoringActionResult{
				Match: toMatchResponse(final),
				Event: toMatchEventResponse(event),
			}, nil
		}
	}

	return ScoringActionResult{
		Match: toMatchResponse(updated),
		Event: toMatchEventResponse(event),
	}, nil
}

// CallTimeout records a timeout event.
func (s *MatchService) CallTimeout(ctx context.Context, matchID int64, team int32, userID int64) (ScoringActionResult, error) {
	match, err := s.queries.GetMatch(ctx, matchID)
	if err != nil {
		return ScoringActionResult{}, &NotFoundError{Message: "match not found"}
	}

	cfg := matchToScoringConfig(match)
	eng := engine.NewScoringEngine(cfg)
	state := matchToEngineState(match)

	result := eng.Timeout(state, team)
	if result.IsError {
		return ScoringActionResult{}, &ValidationError{Message: result.ErrorMessage}
	}

	payload, _ := json.Marshal(map[string]interface{}{"team": team})
	updated, event, err := s.applyEngineResult(ctx, matchID, result, "timeout", payload, userID)
	if err != nil {
		return ScoringActionResult{}, err
	}

	return ScoringActionResult{
		Match:     toMatchResponse(updated),
		Event:     toMatchEventResponse(event),
		ScoreCall: eng.ScoreCall(result.State),
	}, nil
}

// PauseMatch pauses the match.
func (s *MatchService) PauseMatch(ctx context.Context, matchID int64, userID int64) (ScoringActionResult, error) {
	match, err := s.queries.GetMatch(ctx, matchID)
	if err != nil {
		return ScoringActionResult{}, &NotFoundError{Message: "match not found"}
	}

	cfg := matchToScoringConfig(match)
	eng := engine.NewScoringEngine(cfg)
	state := matchToEngineState(match)

	result := eng.Pause(state)
	if result.IsError {
		return ScoringActionResult{}, &ValidationError{Message: result.ErrorMessage}
	}

	updated, event, err := s.applyEngineResult(ctx, matchID, result, "pause", nil, userID)
	if err != nil {
		return ScoringActionResult{}, err
	}

	return ScoringActionResult{
		Match: toMatchResponse(updated),
		Event: toMatchEventResponse(event),
	}, nil
}

// ResumeMatch resumes a paused match.
func (s *MatchService) ResumeMatch(ctx context.Context, matchID int64, userID int64) (ScoringActionResult, error) {
	match, err := s.queries.GetMatch(ctx, matchID)
	if err != nil {
		return ScoringActionResult{}, &NotFoundError{Message: "match not found"}
	}

	cfg := matchToScoringConfig(match)
	eng := engine.NewScoringEngine(cfg)
	state := matchToEngineState(match)

	result := eng.Resume(state)
	if result.IsError {
		return ScoringActionResult{}, &ValidationError{Message: result.ErrorMessage}
	}

	updated, event, err := s.applyEngineResult(ctx, matchID, result, "resume", nil, userID)
	if err != nil {
		return ScoringActionResult{}, err
	}

	return ScoringActionResult{
		Match: toMatchResponse(updated),
		Event: toMatchEventResponse(event),
	}, nil
}

// DeclareForfeit forfeits the match for a team.
func (s *MatchService) DeclareForfeit(ctx context.Context, matchID int64, forfeitingTeam int32, winnerTeamID, loserTeamID int64, userID int64) (ScoringActionResult, error) {
	match, err := s.queries.GetMatch(ctx, matchID)
	if err != nil {
		return ScoringActionResult{}, &NotFoundError{Message: "match not found"}
	}

	cfg := matchToScoringConfig(match)
	eng := engine.NewScoringEngine(cfg)
	state := matchToEngineState(match)

	result := eng.Forfeit(state, forfeitingTeam)
	if result.IsError {
		return ScoringActionResult{}, &ValidationError{Message: result.ErrorMessage}
	}

	payload, _ := json.Marshal(map[string]interface{}{"forfeiting_team": forfeitingTeam})
	updated, event, err := s.applyEngineResult(ctx, matchID, result, "forfeit", payload, userID)
	if err != nil {
		return ScoringActionResult{}, err
	}

	// Set winner/loser.
	if winnerTeamID > 0 && loserTeamID > 0 {
		final, err := s.queries.UpdateMatchResult(ctx, generated.UpdateMatchResultParams{
			ID:           matchID,
			WinnerTeamID: pgtype.Int8{Int64: winnerTeamID, Valid: true},
			LoserTeamID:  pgtype.Int8{Int64: loserTeamID, Valid: true},
			WinReason:    strPtr("forfeit"),
		})
		if err == nil {
			return ScoringActionResult{
				Match: toMatchResponse(final),
				Event: toMatchEventResponse(event),
			}, nil
		}
	}

	return ScoringActionResult{
		Match: toMatchResponse(updated),
		Event: toMatchEventResponse(event),
	}, nil
}

func strPtr(s string) *string {
	return &s
}
