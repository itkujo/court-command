package service

import (
	"context"
	"fmt"
	"time"

	"github.com/court-command/court-command/db/generated"
)

// ScoringPresetService handles scoring preset business logic.
type ScoringPresetService struct {
	queries *generated.Queries
}

// NewScoringPresetService creates a new ScoringPresetService.
func NewScoringPresetService(queries *generated.Queries) *ScoringPresetService {
	return &ScoringPresetService{queries: queries}
}

// ScoringPresetResponse is the public representation of a scoring preset.
type ScoringPresetResponse struct {
	ID                 int64   `json:"id"`
	Name               string  `json:"name"`
	Description        *string `json:"description,omitempty"`
	Sport              string  `json:"sport"`
	IsSystem           bool    `json:"is_system"`
	IsActive           bool    `json:"is_active"`
	GamesPerSet        int32   `json:"games_per_set"`
	SetsToWin          int32   `json:"sets_to_win"`
	PointsToWin        int32   `json:"points_to_win"`
	WinBy              int32   `json:"win_by"`
	MaxPoints          *int32  `json:"max_points,omitempty"`
	RallyScoring       bool    `json:"rally_scoring"`
	TimeoutsPerGame    int32   `json:"timeouts_per_game"`
	TimeoutDurationSec int32   `json:"timeout_duration_sec"`
	FreezeAt           *int32  `json:"freeze_at,omitempty"`
	CreatedByUserID    *int64  `json:"created_by_user_id,omitempty"`
	CreatedAt          string  `json:"created_at"`
	UpdatedAt          string  `json:"updated_at"`
}

func toScoringPresetResponse(p generated.ScoringPreset) ScoringPresetResponse {
	resp := ScoringPresetResponse{
		ID:                 p.ID,
		Name:               p.Name,
		Description:        p.Description,
		Sport:              p.Sport,
		IsSystem:           p.IsSystem,
		IsActive:           p.IsActive,
		GamesPerSet:        p.GamesPerSet,
		SetsToWin:          p.SetsToWin,
		PointsToWin:        p.PointsToWin,
		WinBy:              p.WinBy,
		RallyScoring:       p.RallyScoring,
		TimeoutsPerGame:    p.TimeoutsPerGame,
		TimeoutDurationSec: p.TimeoutDurationSec,
		CreatedAt:          p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:          p.UpdatedAt.Format(time.RFC3339),
	}

	if p.MaxPoints.Valid {
		resp.MaxPoints = &p.MaxPoints.Int32
	}
	if p.FreezeAt.Valid {
		resp.FreezeAt = &p.FreezeAt.Int32
	}
	if p.CreatedByUserID.Valid {
		resp.CreatedByUserID = &p.CreatedByUserID.Int64
	}

	return resp
}

// Create creates a new scoring preset.
func (s *ScoringPresetService) Create(ctx context.Context, params generated.CreateScoringPresetParams) (ScoringPresetResponse, error) {
	if params.Name == "" {
		return ScoringPresetResponse{}, &ValidationError{Message: "name is required"}
	}
	if params.PointsToWin < 1 {
		return ScoringPresetResponse{}, &ValidationError{Message: "points_to_win must be at least 1"}
	}
	if params.WinBy < 1 {
		return ScoringPresetResponse{}, &ValidationError{Message: "win_by must be at least 1"}
	}
	if params.SetsToWin < 1 {
		return ScoringPresetResponse{}, &ValidationError{Message: "sets_to_win must be at least 1"}
	}
	if params.GamesPerSet < 1 {
		return ScoringPresetResponse{}, &ValidationError{Message: "games_per_set must be at least 1"}
	}

	// Non-admin users cannot create system presets
	params.IsSystem = false
	params.IsActive = true

	preset, err := s.queries.CreateScoringPreset(ctx, params)
	if err != nil {
		return ScoringPresetResponse{}, fmt.Errorf("failed to create scoring preset: %w", err)
	}

	return toScoringPresetResponse(preset), nil
}

// GetByID retrieves a scoring preset by ID.
func (s *ScoringPresetService) GetByID(ctx context.Context, id int64) (ScoringPresetResponse, error) {
	preset, err := s.queries.GetScoringPreset(ctx, id)
	if err != nil {
		return ScoringPresetResponse{}, &NotFoundError{Message: "scoring preset not found"}
	}
	return toScoringPresetResponse(preset), nil
}

// ListActive returns all active scoring presets.
func (s *ScoringPresetService) ListActive(ctx context.Context) ([]ScoringPresetResponse, error) {
	presets, err := s.queries.ListScoringPresetsActive(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list active scoring presets: %w", err)
	}

	result := make([]ScoringPresetResponse, len(presets))
	for i, p := range presets {
		result[i] = toScoringPresetResponse(p)
	}
	return result, nil
}

// ListAll returns all scoring presets (including inactive).
func (s *ScoringPresetService) ListAll(ctx context.Context) ([]ScoringPresetResponse, error) {
	presets, err := s.queries.ListScoringPresetsAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list scoring presets: %w", err)
	}

	result := make([]ScoringPresetResponse, len(presets))
	for i, p := range presets {
		result[i] = toScoringPresetResponse(p)
	}
	return result, nil
}

// Update updates a scoring preset. System presets cannot be modified.
func (s *ScoringPresetService) Update(ctx context.Context, id int64, params generated.UpdateScoringPresetParams) (ScoringPresetResponse, error) {
	existing, err := s.queries.GetScoringPreset(ctx, id)
	if err != nil {
		return ScoringPresetResponse{}, &NotFoundError{Message: "scoring preset not found"}
	}
	if existing.IsSystem {
		return ScoringPresetResponse{}, &ForbiddenError{Message: "system presets cannot be modified"}
	}

	params.PresetID = id

	preset, err := s.queries.UpdateScoringPreset(ctx, params)
	if err != nil {
		return ScoringPresetResponse{}, fmt.Errorf("failed to update scoring preset: %w", err)
	}
	return toScoringPresetResponse(preset), nil
}

// Deactivate deactivates a scoring preset. System presets cannot be deactivated.
func (s *ScoringPresetService) Deactivate(ctx context.Context, id int64) error {
	existing, err := s.queries.GetScoringPreset(ctx, id)
	if err != nil {
		return &NotFoundError{Message: "scoring preset not found"}
	}
	if existing.IsSystem {
		return &ForbiddenError{Message: "system presets cannot be deactivated"}
	}

	return s.queries.DeactivateScoringPreset(ctx, id)
}

// Activate re-activates a scoring preset.
func (s *ScoringPresetService) Activate(ctx context.Context, id int64) error {
	_, err := s.queries.GetScoringPreset(ctx, id)
	if err != nil {
		return &NotFoundError{Message: "scoring preset not found"}
	}

	return s.queries.ActivateScoringPreset(ctx, id)
}

// GetRawPreset returns the raw generated model (for use by MatchService to snapshot config).
func (s *ScoringPresetService) GetRawPreset(ctx context.Context, id int64) (generated.ScoringPreset, error) {
	preset, err := s.queries.GetScoringPreset(ctx, id)
	if err != nil {
		return generated.ScoringPreset{}, &NotFoundError{Message: "scoring preset not found"}
	}
	return preset, nil
}
