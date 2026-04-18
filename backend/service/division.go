package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/court-command/court-command/db/generated"
)

// DivisionService handles division business logic.
type DivisionService struct {
	queries *generated.Queries
}

// NewDivisionService creates a new DivisionService.
func NewDivisionService(queries *generated.Queries) *DivisionService {
	return &DivisionService{queries: queries}
}

// DivisionResponse is the public representation of a division.
type DivisionResponse struct {
	ID                  int64    `json:"id"`
	TournamentID        int64    `json:"tournament_id"`
	Name                string   `json:"name"`
	Slug                string   `json:"slug"`
	Format              string   `json:"format"`
	GenderRestriction   *string  `json:"gender_restriction,omitempty"`
	SkillMin            *float64 `json:"skill_min,omitempty"`
	SkillMax            *float64 `json:"skill_max,omitempty"`
	RatingSystem        *string  `json:"rating_system,omitempty"`
	BracketFormat       string   `json:"bracket_format"`
	ScoringFormat       *string  `json:"scoring_format,omitempty"`
	MaxTeams            *int32   `json:"max_teams,omitempty"`
	MaxRosterSize       *int32   `json:"max_roster_size,omitempty"`
	EntryFeeCurrency    *string  `json:"entry_fee_currency,omitempty"`
	Status              string   `json:"status"`
	SeedMethod          *string  `json:"seed_method,omitempty"`
	SortOrder           *int32   `json:"sort_order,omitempty"`
	Notes               *string  `json:"notes,omitempty"`
	AutoApprove         bool     `json:"auto_approve"`
	RegistrationMode    *string  `json:"registration_mode,omitempty"`
	AutoPromoteWaitlist bool     `json:"auto_promote_waitlist"`
	CurrentPhase        *string  `json:"current_phase,omitempty"`
	CreatedAt           string   `json:"created_at"`
	UpdatedAt           string   `json:"updated_at"`
}

func toDivisionResponse(d generated.Division) DivisionResponse {
	resp := DivisionResponse{
		ID:                d.ID,
		TournamentID:      d.TournamentID,
		Name:              d.Name,
		Slug:              d.Slug,
		Format:            d.Format,
		GenderRestriction: d.GenderRestriction,
		RatingSystem:      d.RatingSystem,
		BracketFormat:     d.BracketFormat,
		ScoringFormat:     d.ScoringFormat,
		EntryFeeCurrency:  d.EntryFeeCurrency,
		Status:            d.Status,
		SeedMethod:        d.SeedMethod,
		Notes:             d.Notes,
		RegistrationMode:  d.RegistrationMode,
		CurrentPhase:      d.CurrentPhase,
		CreatedAt:         d.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         d.UpdatedAt.Format(time.RFC3339),
	}

	if d.SkillMin.Valid {
		resp.SkillMin = &d.SkillMin.Float64
	}
	if d.SkillMax.Valid {
		resp.SkillMax = &d.SkillMax.Float64
	}
	if d.MaxTeams.Valid {
		resp.MaxTeams = &d.MaxTeams.Int32
	}
	if d.MaxRosterSize.Valid {
		resp.MaxRosterSize = &d.MaxRosterSize.Int32
	}
	if d.SortOrder.Valid {
		resp.SortOrder = &d.SortOrder.Int32
	}
	if d.AutoApprove.Valid {
		resp.AutoApprove = d.AutoApprove.Bool
	}
	if d.AutoPromoteWaitlist.Valid {
		resp.AutoPromoteWaitlist = d.AutoPromoteWaitlist.Bool
	}

	return resp
}

// generateUniqueSlug generates a unique slug scoped to a tournament.
func (s *DivisionService) generateUniqueSlug(ctx context.Context, tournamentID int64, name string) (string, error) {
	base := generateSlug(name)
	for i := 0; i < 100; i++ {
		candidate := base
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", base, i)
		}
		exists, err := s.queries.SlugExistsDivision(ctx, generated.SlugExistsDivisionParams{
			TournamentID: tournamentID,
			Slug:         candidate,
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

// Create creates a new division.
func (s *DivisionService) Create(ctx context.Context, params generated.CreateDivisionParams) (DivisionResponse, error) {
	if params.Name == "" {
		return DivisionResponse{}, &ValidationError{Message: "name is required"}
	}
	if params.Format == "" {
		return DivisionResponse{}, &ValidationError{Message: "format is required"}
	}

	slug, err := s.generateUniqueSlug(ctx, params.TournamentID, params.Name)
	if err != nil {
		return DivisionResponse{}, err
	}
	params.Slug = slug
	params.Status = "draft"

	division, err := s.queries.CreateDivision(ctx, params)
	if err != nil {
		return DivisionResponse{}, fmt.Errorf("failed to create division: %w", err)
	}

	return toDivisionResponse(division), nil
}

// GetByID retrieves a division by ID.
func (s *DivisionService) GetByID(ctx context.Context, id int64) (DivisionResponse, error) {
	division, err := s.queries.GetDivisionByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return DivisionResponse{}, &NotFoundError{Message: "division not found"}
		}
		return DivisionResponse{}, fmt.Errorf("get division by id: %w", err)
	}
	return toDivisionResponse(division), nil
}

// GetBySlug retrieves a division by tournament-scoped slug.
func (s *DivisionService) GetBySlug(ctx context.Context, tournamentID int64, slug string) (DivisionResponse, error) {
	division, err := s.queries.GetDivisionBySlug(ctx, generated.GetDivisionBySlugParams{
		TournamentID: tournamentID,
		Slug:         slug,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return DivisionResponse{}, &NotFoundError{Message: "division not found"}
		}
		return DivisionResponse{}, fmt.Errorf("get division by slug: %w", err)
	}
	return toDivisionResponse(division), nil
}

// ListByTournament lists divisions for a tournament.
func (s *DivisionService) ListByTournament(ctx context.Context, tournamentID int64) ([]DivisionResponse, int64, error) {
	divisions, err := s.queries.ListDivisionsByTournament(ctx, tournamentID)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list divisions: %w", err)
	}

	count, err := s.queries.CountDivisionsByTournament(ctx, tournamentID)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count divisions: %w", err)
	}

	result := make([]DivisionResponse, len(divisions))
	for i, d := range divisions {
		result[i] = toDivisionResponse(d)
	}

	return result, count, nil
}

// Update updates a division.
func (s *DivisionService) Update(ctx context.Context, id int64, params generated.UpdateDivisionParams) (DivisionResponse, error) {
	params.ID = id

	division, err := s.queries.UpdateDivision(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return DivisionResponse{}, &NotFoundError{Message: "division not found"}
		}
		return DivisionResponse{}, fmt.Errorf("update division: %w", err)
	}

	return toDivisionResponse(division), nil
}

// Delete soft-deletes a division.
func (s *DivisionService) Delete(ctx context.Context, id int64) error {
	return s.queries.SoftDeleteDivision(ctx, id)
}

// validDivisionTransitions defines allowed status transitions for divisions.
var validDivisionTransitions = map[string][]string{
	"draft":               {"registration_open"},
	"registration_open":   {"registration_closed"},
	"registration_closed": {"seeding"},
	"seeding":             {"in_progress"},
	"in_progress":         {"completed"},
}

// UpdateStatus transitions a division to a new status.
func (s *DivisionService) UpdateStatus(ctx context.Context, id int64, newStatus string) (DivisionResponse, error) {
	division, err := s.queries.GetDivisionByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return DivisionResponse{}, &NotFoundError{Message: "division not found"}
		}
		return DivisionResponse{}, fmt.Errorf("get division for status update: %w", err)
	}

	allowed, ok := validDivisionTransitions[division.Status]
	if !ok {
		return DivisionResponse{}, &ValidationError{Message: fmt.Sprintf("no transitions allowed from status %q", division.Status)}
	}

	valid := false
	for _, s := range allowed {
		if s == newStatus {
			valid = true
			break
		}
	}
	if !valid {
		return DivisionResponse{}, &ValidationError{Message: fmt.Sprintf("cannot transition from %q to %q", division.Status, newStatus)}
	}

	updated, err := s.queries.UpdateDivision(ctx, generated.UpdateDivisionParams{
		ID:     id,
		Status: &newStatus,
	})
	if err != nil {
		return DivisionResponse{}, fmt.Errorf("failed to update division status: %w", err)
	}

	return toDivisionResponse(updated), nil
}

// CreateFromTemplate creates a division from a division template.
func (s *DivisionService) CreateFromTemplate(ctx context.Context, tournamentID int64, templateID int64) (DivisionResponse, error) {
	tmpl, err := s.queries.GetDivisionTemplateByID(ctx, templateID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return DivisionResponse{}, &NotFoundError{Message: "division template not found"}
		}
		return DivisionResponse{}, fmt.Errorf("get division template by id: %w", err)
	}

	slug, err := s.generateUniqueSlug(ctx, tournamentID, tmpl.Name)
	if err != nil {
		return DivisionResponse{}, err
	}

	division, err := s.queries.CreateDivision(ctx, generated.CreateDivisionParams{
		TournamentID:        tournamentID,
		Name:                tmpl.Name,
		Slug:                slug,
		Format:              tmpl.Format,
		GenderRestriction:   tmpl.GenderRestriction,
		AgeRestriction:      tmpl.AgeRestriction,
		SkillMin:            tmpl.SkillMin,
		SkillMax:            tmpl.SkillMax,
		RatingSystem:        tmpl.RatingSystem,
		BracketFormat:       tmpl.BracketFormat,
		ScoringFormat:       tmpl.ScoringFormat,
		MaxTeams:            tmpl.MaxTeams,
		MaxRosterSize:       tmpl.MaxRosterSize,
		EntryFeeAmount:      tmpl.EntryFeeAmount,
		EntryFeeCurrency:    tmpl.EntryFeeCurrency,
		CheckInOpen:         pgtype.Bool{},
		AllowSelfCheckIn:    tmpl.AllowSelfCheckIn,
		Status:              "draft",
		SeedMethod:          tmpl.SeedMethod,
		SortOrder:           tmpl.SortOrder,
		Notes:               tmpl.Notes,
		AutoApprove:         tmpl.AutoApprove,
		RegistrationMode:    tmpl.RegistrationMode,
		AutoPromoteWaitlist: tmpl.AutoPromoteWaitlist,
		GrandFinalsReset:    tmpl.GrandFinalsReset,
		AdvancementCount:    tmpl.AdvancementCount,
		CurrentPhase:        nil,
		ReportToDupr:        tmpl.ReportToDupr,
		ReportToVair:        tmpl.ReportToVair,
		AllowRefPlayerAdd:   tmpl.AllowRefPlayerAdd,
	})
	if err != nil {
		return DivisionResponse{}, fmt.Errorf("failed to create division from template: %w", err)
	}

	return toDivisionResponse(division), nil
}
