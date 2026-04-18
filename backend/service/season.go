package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/court-command/court-command/db/generated"
)

// SeasonService handles season business logic.
type SeasonService struct {
	queries *generated.Queries
}

// NewSeasonService creates a new SeasonService.
func NewSeasonService(queries *generated.Queries) *SeasonService {
	return &SeasonService{queries: queries}
}

// SeasonResponse is the public representation of a season.
type SeasonResponse struct {
	ID                         int64   `json:"id"`
	Name                       string  `json:"name"`
	Slug                       string  `json:"slug"`
	LeagueID                   int64   `json:"league_id"`
	Status                     string  `json:"status"`
	StartDate                  *string `json:"start_date,omitempty"`
	EndDate                    *string `json:"end_date,omitempty"`
	Description                *string `json:"description,omitempty"`
	Notes                      *string `json:"notes,omitempty"`
	RosterConfirmationDeadline *string `json:"roster_confirmation_deadline,omitempty"`
	StandingsMethod            *string `json:"standings_method,omitempty"`
	CreatedAt                  string  `json:"created_at"`
	UpdatedAt                  string  `json:"updated_at"`
}

func toSeasonResponse(s generated.Season) SeasonResponse {
	resp := SeasonResponse{
		ID:              s.ID,
		Name:            s.Name,
		Slug:            s.Slug,
		LeagueID:        s.LeagueID,
		Status:          s.Status,
		Description:     s.Description,
		Notes:           s.Notes,
		StandingsMethod: s.StandingsMethod,
		CreatedAt:       s.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       s.UpdatedAt.Format(time.RFC3339),
	}

	if s.StartDate.Valid {
		d := s.StartDate.Time.Format("2006-01-02")
		resp.StartDate = &d
	}
	if s.EndDate.Valid {
		d := s.EndDate.Time.Format("2006-01-02")
		resp.EndDate = &d
	}
	if s.RosterConfirmationDeadline.Valid {
		d := s.RosterConfirmationDeadline.Time.Format(time.RFC3339)
		resp.RosterConfirmationDeadline = &d
	}

	return resp
}

// generateUniqueSlug generates a unique slug scoped to a league.
func (svc *SeasonService) generateUniqueSlug(ctx context.Context, leagueID int64, name string) (string, error) {
	base := generateSlug(name)
	for i := 0; i < 100; i++ {
		candidate := base
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", base, i)
		}
		exists, err := svc.queries.SlugExistsSeason(ctx, generated.SlugExistsSeasonParams{
			LeagueID: leagueID,
			Slug:     candidate,
		})
		if err != nil {
			return "", fmt.Errorf("failed to check slug: %w", err)
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", &ConflictError{Message: "unable to generate unique slug, try a different name"}
}

// Create creates a new season.
func (svc *SeasonService) Create(ctx context.Context, params generated.CreateSeasonParams) (SeasonResponse, error) {
	if params.Name == "" {
		return SeasonResponse{}, &ValidationError{Message: "name is required"}
	}

	slug, err := svc.generateUniqueSlug(ctx, params.LeagueID, params.Name)
	if err != nil {
		return SeasonResponse{}, err
	}
	params.Slug = slug
	params.Status = "draft"

	season, err := svc.queries.CreateSeason(ctx, params)
	if err != nil {
		return SeasonResponse{}, fmt.Errorf("failed to create season: %w", err)
	}

	return toSeasonResponse(season), nil
}

// GetByID retrieves a season by ID.
func (svc *SeasonService) GetByID(ctx context.Context, id int64) (SeasonResponse, error) {
	season, err := svc.queries.GetSeasonByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SeasonResponse{}, &NotFoundError{Message: "season not found"}
		}
		return SeasonResponse{}, fmt.Errorf("get season by id: %w", err)
	}
	return toSeasonResponse(season), nil
}

// GetBySlug retrieves a season by league-scoped slug.
func (svc *SeasonService) GetBySlug(ctx context.Context, leagueID int64, slug string) (SeasonResponse, error) {
	season, err := svc.queries.GetSeasonBySlug(ctx, generated.GetSeasonBySlugParams{
		LeagueID: leagueID,
		Slug:     slug,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SeasonResponse{}, &NotFoundError{Message: "season not found"}
		}
		return SeasonResponse{}, fmt.Errorf("get season by slug: %w", err)
	}
	return toSeasonResponse(season), nil
}

// ListByLeague returns seasons for a league.
func (svc *SeasonService) ListByLeague(ctx context.Context, leagueID int64, limit, offset int32) ([]SeasonResponse, int64, error) {
	seasons, err := svc.queries.ListSeasonsByLeague(ctx, generated.ListSeasonsByLeagueParams{
		LeagueID: leagueID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list seasons: %w", err)
	}

	count, err := svc.queries.CountSeasonsByLeague(ctx, leagueID)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count seasons: %w", err)
	}

	result := make([]SeasonResponse, len(seasons))
	for i, s := range seasons {
		result[i] = toSeasonResponse(s)
	}

	return result, count, nil
}

// Update updates a season.
func (svc *SeasonService) Update(ctx context.Context, id int64, params generated.UpdateSeasonParams) (SeasonResponse, error) {
	params.ID = id

	season, err := svc.queries.UpdateSeason(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SeasonResponse{}, &NotFoundError{Message: "season not found"}
		}
		return SeasonResponse{}, fmt.Errorf("update season: %w", err)
	}

	return toSeasonResponse(season), nil
}

// Delete soft-deletes a season.
func (svc *SeasonService) Delete(ctx context.Context, id int64) error {
	return svc.queries.SoftDeleteSeason(ctx, id)
}

// validSeasonTransitions defines allowed status transitions for seasons.
var validSeasonTransitions = map[string][]string{
	"draft":     {"active"},
	"active":    {"completed"},
	"completed": {"archived"},
}

// UpdateStatus transitions a season to a new status.
func (svc *SeasonService) UpdateStatus(ctx context.Context, id int64, newStatus string) (SeasonResponse, error) {
	season, err := svc.queries.GetSeasonByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SeasonResponse{}, &NotFoundError{Message: "season not found"}
		}
		return SeasonResponse{}, fmt.Errorf("get season for status update: %w", err)
	}

	allowed, ok := validSeasonTransitions[season.Status]
	if !ok {
		return SeasonResponse{}, &ValidationError{Message: fmt.Sprintf("no transitions allowed from status %q", season.Status)}
	}

	valid := false
	for _, s := range allowed {
		if s == newStatus {
			valid = true
			break
		}
	}
	if !valid {
		return SeasonResponse{}, &ValidationError{Message: fmt.Sprintf("cannot transition from %q to %q", season.Status, newStatus)}
	}

	updated, err := svc.queries.UpdateSeason(ctx, generated.UpdateSeasonParams{
		ID:     id,
		Status: &newStatus,
	})
	if err != nil {
		return SeasonResponse{}, fmt.Errorf("failed to update season status: %w", err)
	}

	return toSeasonResponse(updated), nil
}
