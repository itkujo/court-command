package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/court-command/court-command/db/generated"
)

// TournamentService handles tournament business logic.
type TournamentService struct {
	queries      *generated.Queries
	pool         *pgxpool.Pool
	staffService *TournamentStaffService
}

// NewTournamentService creates a new TournamentService.
func NewTournamentService(queries *generated.Queries, pool *pgxpool.Pool, staffService *TournamentStaffService) *TournamentService {
	return &TournamentService{queries: queries, pool: pool, staffService: staffService}
}

// TournamentResponse is the public representation of a tournament.
type TournamentResponse struct {
	ID                  int64           `json:"id"`
	PublicID            string          `json:"public_id"`
	Name                string          `json:"name"`
	Slug                string          `json:"slug"`
	Status              string          `json:"status"`
	StartDate           string          `json:"start_date"`
	EndDate             string          `json:"end_date"`
	VenueID             *int64          `json:"venue_id,omitempty"`
	LeagueID            *int64          `json:"league_id,omitempty"`
	SeasonID            *int64          `json:"season_id,omitempty"`
	Description         *string         `json:"description,omitempty"`
	LogoURL             *string         `json:"logo_url,omitempty"`
	BannerURL           *string         `json:"banner_url,omitempty"`
	ContactEmail        *string         `json:"contact_email,omitempty"`
	ContactPhone        *string         `json:"contact_phone,omitempty"`
	WebsiteURL          *string         `json:"website_url,omitempty"`
	RegistrationOpenAt  *string         `json:"registration_open_at,omitempty"`
	RegistrationCloseAt *string         `json:"registration_close_at,omitempty"`
	MaxParticipants     *int32          `json:"max_participants,omitempty"`
	RulesDocumentURL    *string         `json:"rules_document_url,omitempty"`
	CancellationReason  *string         `json:"cancellation_reason,omitempty"`
	SocialLinks         json.RawMessage `json:"social_links"`
	Notes               *string         `json:"notes,omitempty"`
	SponsorInfo         json.RawMessage `json:"sponsor_info"`
	ShowRegistrations   bool            `json:"show_registrations"`
	CreatedByUserID     int64           `json:"created_by_user_id"`
	TdUserID            *int64          `json:"td_user_id,omitempty"`
	CreatedAt           string          `json:"created_at"`
	UpdatedAt           string          `json:"updated_at"`
}

func toTournamentResponse(t generated.Tournament) TournamentResponse {
	resp := TournamentResponse{
		ID:                 t.ID,
		PublicID:           t.PublicID,
		Name:               t.Name,
		Slug:               t.Slug,
		Status:             t.Status,
		StartDate:          t.StartDate.Format("2006-01-02"),
		EndDate:            t.EndDate.Format("2006-01-02"),
		Description:        t.Description,
		LogoURL:            t.LogoUrl,
		BannerURL:          t.BannerUrl,
		ContactEmail:       t.ContactEmail,
		ContactPhone:       t.ContactPhone,
		WebsiteURL:         t.WebsiteUrl,
		RulesDocumentURL:   t.RulesDocumentUrl,
		CancellationReason: t.CancellationReason,
		Notes:              t.Notes,
		CreatedByUserID:    t.CreatedByUserID,
		CreatedAt:          t.CreatedAt.Format(time.RFC3339),
		UpdatedAt:          t.UpdatedAt.Format(time.RFC3339),
	}

	if t.ShowRegistrations.Valid {
		resp.ShowRegistrations = t.ShowRegistrations.Bool
	}
	if t.VenueID.Valid {
		resp.VenueID = &t.VenueID.Int64
	}
	if t.LeagueID.Valid {
		resp.LeagueID = &t.LeagueID.Int64
	}
	if t.SeasonID.Valid {
		resp.SeasonID = &t.SeasonID.Int64
	}
	if t.TdUserID.Valid {
		resp.TdUserID = &t.TdUserID.Int64
	}
	if t.MaxParticipants.Valid {
		resp.MaxParticipants = &t.MaxParticipants.Int32
	}
	if t.RegistrationOpenAt.Valid {
		s := t.RegistrationOpenAt.Time.Format(time.RFC3339)
		resp.RegistrationOpenAt = &s
	}
	if t.RegistrationCloseAt.Valid {
		s := t.RegistrationCloseAt.Time.Format(time.RFC3339)
		resp.RegistrationCloseAt = &s
	}

	if len(t.SocialLinks) > 0 {
		resp.SocialLinks = json.RawMessage(t.SocialLinks)
	} else {
		resp.SocialLinks = json.RawMessage("{}")
	}
	if len(t.SponsorInfo) > 0 {
		resp.SponsorInfo = json.RawMessage(t.SponsorInfo)
	} else {
		resp.SponsorInfo = json.RawMessage("[]")
	}

	return resp
}

// generateUniqueSlug generates a unique slug for a tournament.
func (s *TournamentService) generateUniqueSlug(ctx context.Context, name string) (string, error) {
	base := generateSlug(name)
	for i := 0; i < 100; i++ {
		candidate := base
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", base, i)
		}
		exists, err := s.queries.SlugExistsTournament(ctx, candidate)
		if err != nil {
			return "", fmt.Errorf("failed to check slug: %w", err)
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", &ConflictError{Message: "unable to generate unique slug, try a different name"}
}

// Create creates a new tournament.
// The caller may set params.Status to either "draft" (default) or "published"
// to publish immediately. All other statuses are only reachable through the
// state machine (UpdateStatus) and are rejected here as ValidationErrors.
func (s *TournamentService) Create(ctx context.Context, params generated.CreateTournamentParams) (TournamentResponse, error) {
	if params.Name == "" {
		return TournamentResponse{}, &ValidationError{Message: "name is required"}
	}

	slug, err := s.generateUniqueSlug(ctx, params.Name)
	if err != nil {
		return TournamentResponse{}, err
	}
	params.Slug = slug

	// Initial status is draft unless the caller explicitly asks to publish.
	// Values mirror the CHECK constraint in api/db/migrations/00010_create_tournaments.sql.
	switch params.Status {
	case "":
		params.Status = "draft"
	case "draft", "published":
		// allowed at create time
	default:
		return TournamentResponse{}, &ValidationError{
			Message: fmt.Sprintf("initial status must be 'draft' or 'published' (got %q); use the status workflow for other transitions", params.Status),
		}
	}

	tournament, err := s.queries.CreateTournament(ctx, params)
	if err != nil {
		return TournamentResponse{}, fmt.Errorf("failed to create tournament: %w", err)
	}

	// Auto-create staff accounts (ref + scorekeeper)
	if err := s.staffService.CreateStaffAccounts(ctx, tournament.ID); err != nil {
		return TournamentResponse{}, fmt.Errorf("creating staff accounts: %w", err)
	}

	return toTournamentResponse(tournament), nil
}

// GetByID retrieves a tournament by ID.
func (s *TournamentService) GetByID(ctx context.Context, id int64) (TournamentResponse, error) {
	tournament, err := s.queries.GetTournamentByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TournamentResponse{}, &NotFoundError{Message: "tournament not found"}
		}
		return TournamentResponse{}, fmt.Errorf("get tournament by id: %w", err)
	}
	return toTournamentResponse(tournament), nil
}

// GetBySlug retrieves a tournament by slug.
func (s *TournamentService) GetBySlug(ctx context.Context, slug string) (TournamentResponse, error) {
	tournament, err := s.queries.GetTournamentBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TournamentResponse{}, &NotFoundError{Message: "tournament not found"}
		}
		return TournamentResponse{}, fmt.Errorf("get tournament by slug: %w", err)
	}
	return toTournamentResponse(tournament), nil
}

// GetByPublicID retrieves a tournament by public ID.
func (s *TournamentService) GetByPublicID(ctx context.Context, publicID string) (TournamentResponse, error) {
	tournament, err := s.queries.GetTournamentByPublicID(ctx, publicID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TournamentResponse{}, &NotFoundError{Message: "tournament not found"}
		}
		return TournamentResponse{}, fmt.Errorf("get tournament by public id: %w", err)
	}
	return toTournamentResponse(tournament), nil
}

// List returns paginated tournaments.
func (s *TournamentService) List(ctx context.Context, limit, offset int32) ([]TournamentResponse, int64, error) {
	tournaments, err := s.queries.ListTournaments(ctx, generated.ListTournamentsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list tournaments: %w", err)
	}

	count, err := s.queries.CountTournaments(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count tournaments: %w", err)
	}

	result := make([]TournamentResponse, len(tournaments))
	for i, t := range tournaments {
		result[i] = toTournamentResponse(t)
	}

	return result, count, nil
}

// ListByLeague returns tournaments for a specific league.
func (s *TournamentService) ListByLeague(ctx context.Context, leagueID int64, limit, offset int32) ([]TournamentResponse, int64, error) {
	lid := pgtype.Int8{Int64: leagueID, Valid: true}
	tournaments, err := s.queries.ListTournamentsByLeague(ctx, generated.ListTournamentsByLeagueParams{
		LeagueID: lid,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list tournaments: %w", err)
	}

	count, err := s.queries.CountTournamentsByLeague(ctx, lid)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count tournaments: %w", err)
	}

	result := make([]TournamentResponse, len(tournaments))
	for i, t := range tournaments {
		result[i] = toTournamentResponse(t)
	}

	return result, count, nil
}

// ListByCreator returns tournaments created by or directed by a user.
func (s *TournamentService) ListByCreator(ctx context.Context, userID int64, limit, offset int32) ([]TournamentResponse, int64, error) {
	tournaments, err := s.queries.ListTournamentsByCreator(ctx, generated.ListTournamentsByCreatorParams{
		CreatedByUserID: userID,
		Limit:           limit,
		Offset:          offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list tournaments: %w", err)
	}

	count, err := s.queries.CountTournamentsByCreator(ctx, userID)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count tournaments: %w", err)
	}

	result := make([]TournamentResponse, len(tournaments))
	for i, t := range tournaments {
		result[i] = toTournamentResponse(t)
	}

	return result, count, nil
}

// ListByStatus returns tournaments filtered by status.
func (s *TournamentService) ListByStatus(ctx context.Context, status string, limit, offset int32) ([]TournamentResponse, int64, error) {
	tournaments, err := s.queries.ListTournamentsByStatus(ctx, generated.ListTournamentsByStatusParams{
		Status: status,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list tournaments by status: %w", err)
	}

	count, err := s.queries.CountTournamentsByStatus(ctx, status)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count tournaments by status: %w", err)
	}

	result := make([]TournamentResponse, len(tournaments))
	for i, t := range tournaments {
		result[i] = toTournamentResponse(t)
	}

	return result, count, nil
}

// SearchByStatus searches tournaments by term and status.
func (s *TournamentService) SearchByStatus(ctx context.Context, term, status string, limit, offset int32) ([]TournamentResponse, int64, error) {
	tournaments, err := s.queries.SearchTournamentsByStatus(ctx, generated.SearchTournamentsByStatusParams{
		Limit:      limit,
		Offset:     offset,
		Status:     status,
		SearchTerm: term,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search tournaments by status: %w", err)
	}

	count, err := s.queries.CountSearchTournamentsByStatus(ctx, generated.CountSearchTournamentsByStatusParams{
		SearchTerm: term,
		Status:     status,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count search results by status: %w", err)
	}

	result := make([]TournamentResponse, len(tournaments))
	for i, t := range tournaments {
		result[i] = toTournamentResponse(t)
	}

	return result, count, nil
}

// Search searches tournaments by term.
func (s *TournamentService) Search(ctx context.Context, term string, limit, offset int32) ([]TournamentResponse, int64, error) {
	tournaments, err := s.queries.SearchTournaments(ctx, generated.SearchTournamentsParams{
		SearchTerm: term,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search tournaments: %w", err)
	}

	count, err := s.queries.CountSearchTournaments(ctx, term)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count search results: %w", err)
	}

	result := make([]TournamentResponse, len(tournaments))
	for i, t := range tournaments {
		result[i] = toTournamentResponse(t)
	}

	return result, count, nil
}

// Update updates a tournament.
func (s *TournamentService) Update(ctx context.Context, id int64, params generated.UpdateTournamentParams) (TournamentResponse, error) {
	params.ID = id

	tournament, err := s.queries.UpdateTournament(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TournamentResponse{}, &NotFoundError{Message: "tournament not found"}
		}
		return TournamentResponse{}, fmt.Errorf("update tournament: %w", err)
	}

	return toTournamentResponse(tournament), nil
}

// Delete soft-deletes a tournament.
func (s *TournamentService) Delete(ctx context.Context, id int64) error {
	return s.queries.SoftDeleteTournament(ctx, id)
}

// validTournamentTransitions defines allowed status transitions for tournaments.
var validTournamentTransitions = map[string][]string{
	"draft":               {"published", "cancelled"},
	"published":           {"registration_open", "cancelled"},
	"registration_open":   {"registration_closed", "cancelled"},
	"registration_closed": {"in_progress", "cancelled"},
	"in_progress":         {"completed", "cancelled"},
	"completed":           {"archived"},
	"cancelled":           {"archived"},
}

// UpdateStatus transitions a tournament to a new status.
func (s *TournamentService) UpdateStatus(ctx context.Context, id int64, newStatus string) (TournamentResponse, error) {
	tournament, err := s.queries.GetTournamentByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TournamentResponse{}, &NotFoundError{Message: "tournament not found"}
		}
		return TournamentResponse{}, fmt.Errorf("get tournament for status update: %w", err)
	}

	allowed, ok := validTournamentTransitions[tournament.Status]
	if !ok {
		return TournamentResponse{}, &ValidationError{Message: fmt.Sprintf("no transitions allowed from status %q", tournament.Status)}
	}

	valid := false
	for _, s := range allowed {
		if s == newStatus {
			valid = true
			break
		}
	}
	if !valid {
		return TournamentResponse{}, &ValidationError{Message: fmt.Sprintf("cannot transition from %q to %q", tournament.Status, newStatus)}
	}

	updated, err := s.queries.UpdateTournament(ctx, generated.UpdateTournamentParams{
		ID:     id,
		Status: &newStatus,
	})
	if err != nil {
		return TournamentResponse{}, fmt.Errorf("failed to update tournament status: %w", err)
	}

	return toTournamentResponse(updated), nil
}

// IsTD checks if a user is the tournament creator or TD.
func (s *TournamentService) IsTD(ctx context.Context, tournamentID, userID int64) (bool, error) {
	tournament, err := s.queries.GetTournamentByID(ctx, tournamentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, &NotFoundError{Message: "tournament not found"}
		}
		return false, fmt.Errorf("get tournament for td check: %w", err)
	}

	if tournament.CreatedByUserID == userID {
		return true, nil
	}
	if tournament.TdUserID.Valid && tournament.TdUserID.Int64 == userID {
		return true, nil
	}

	return false, nil
}

// Clone creates a copy of a tournament with its divisions, optionally including registrations.
// The entire operation is wrapped in a transaction to prevent partial clones.
func (s *TournamentService) Clone(ctx context.Context, sourceTournamentID int64, newName string, createdByUserID int64, includeRegistrations bool) (TournamentResponse, error) {
	source, err := s.queries.GetTournamentByID(ctx, sourceTournamentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return TournamentResponse{}, &NotFoundError{Message: "source tournament not found"}
		}
		return TournamentResponse{}, fmt.Errorf("get source tournament for clone: %w", err)
	}

	slug, err := s.generateUniqueSlug(ctx, newName)
	if err != nil {
		return TournamentResponse{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return TournamentResponse{}, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	newTournament, err := qtx.CreateTournament(ctx, generated.CreateTournamentParams{
		Name:                newName,
		Slug:                slug,
		Status:              "draft",
		StartDate:           source.StartDate,
		EndDate:             source.EndDate,
		VenueID:             source.VenueID,
		LeagueID:            source.LeagueID,
		SeasonID:            pgtype.Int8{}, // clone doesn't inherit season
		Description:         source.Description,
		LogoUrl:             source.LogoUrl,
		BannerUrl:           source.BannerUrl,
		ContactEmail:        source.ContactEmail,
		ContactPhone:        source.ContactPhone,
		WebsiteUrl:          source.WebsiteUrl,
		RegistrationOpenAt:  source.RegistrationOpenAt,
		RegistrationCloseAt: source.RegistrationCloseAt,
		MaxParticipants:     source.MaxParticipants,
		RulesDocumentUrl:    source.RulesDocumentUrl,
		SocialLinks:         source.SocialLinks,
		Notes:               source.Notes,
		SponsorInfo:         source.SponsorInfo,
		ShowRegistrations:   source.ShowRegistrations,
		CreatedByUserID:     createdByUserID,
		TdUserID:            source.TdUserID,
	})
	if err != nil {
		return TournamentResponse{}, fmt.Errorf("failed to clone tournament: %w", err)
	}

	// Clone divisions
	divisions, err := s.queries.ListDivisionsByTournament(ctx, source.ID)
	if err != nil {
		return TournamentResponse{}, fmt.Errorf("failed to list source divisions: %w", err)
	}

	for _, div := range divisions {
		divSlug := generateSlug(div.Name)
		newDiv, err := qtx.CreateDivision(ctx, generated.CreateDivisionParams{
			TournamentID:        newTournament.ID,
			Name:                div.Name,
			Slug:                divSlug,
			Format:              div.Format,
			GenderRestriction:   div.GenderRestriction,
			AgeRestriction:      div.AgeRestriction,
			SkillMin:            div.SkillMin,
			SkillMax:            div.SkillMax,
			RatingSystem:        div.RatingSystem,
			BracketFormat:       div.BracketFormat,
			ScoringFormat:       div.ScoringFormat,
			MaxTeams:            div.MaxTeams,
			MaxRosterSize:       div.MaxRosterSize,
			EntryFeeAmount:      div.EntryFeeAmount,
			EntryFeeCurrency:    div.EntryFeeCurrency,
			CheckInOpen:         div.CheckInOpen,
			AllowSelfCheckIn:    div.AllowSelfCheckIn,
			Status:              "draft",
			SeedMethod:          div.SeedMethod,
			SortOrder:           div.SortOrder,
			Notes:               div.Notes,
			AutoApprove:         div.AutoApprove,
			RegistrationMode:    div.RegistrationMode,
			AutoPromoteWaitlist: div.AutoPromoteWaitlist,
			GrandFinalsReset:    div.GrandFinalsReset,
			AdvancementCount:    div.AdvancementCount,
			CurrentPhase:        div.CurrentPhase,
			ReportToDupr:        div.ReportToDupr,
			ReportToVair:        div.ReportToVair,
			AllowRefPlayerAdd:   div.AllowRefPlayerAdd,
		})
		if err != nil {
			return TournamentResponse{}, fmt.Errorf("failed to clone division %q: %w", div.Name, err)
		}

		// Optionally clone only approved registrations
		if includeRegistrations {
			regs, err := qtx.ListRegistrationsByDivisionAndStatus(ctx, generated.ListRegistrationsByDivisionAndStatusParams{
				DivisionID: div.ID,
				Status:     "approved",
				Limit:      10000,
				Offset:     0,
			})
			if err != nil {
				return TournamentResponse{}, fmt.Errorf("failed to list registrations: %w", err)
			}

			for _, reg := range regs {
				_, err := qtx.CreateRegistration(ctx, generated.CreateRegistrationParams{
					DivisionID:         newDiv.ID,
					TeamID:             reg.TeamID,
					PlayerID:           reg.PlayerID,
					RegisteredByUserID: reg.RegisteredByUserID,
					Status:             "pending",
					Seed:               reg.Seed,
					RegistrationNotes:  reg.RegistrationNotes,
					AdminNotes:         reg.AdminNotes,
					SeekingPartner:     reg.SeekingPartner,
				})
				if err != nil {
					return TournamentResponse{}, fmt.Errorf("failed to clone registration: %w", err)
				}
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return TournamentResponse{}, fmt.Errorf("failed to commit clone transaction: %w", err)
	}

	return toTournamentResponse(newTournament), nil
}
