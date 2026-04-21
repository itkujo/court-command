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

// AnnouncementService handles announcement business logic.
type AnnouncementService struct {
	queries *generated.Queries
}

// NewAnnouncementService creates a new AnnouncementService.
func NewAnnouncementService(queries *generated.Queries) *AnnouncementService {
	return &AnnouncementService{queries: queries}
}

// AnnouncementResponse is the public representation of an announcement.
type AnnouncementResponse struct {
	ID              int64  `json:"id"`
	TournamentID    *int64 `json:"tournament_id,omitempty"`
	LeagueID        *int64 `json:"league_id,omitempty"`
	DivisionID      *int64 `json:"division_id,omitempty"`
	Title           string `json:"title"`
	Body            string `json:"body"`
	IsPinned        bool   `json:"is_pinned"`
	CreatedByUserID int64  `json:"created_by_user_id"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
}

func toAnnouncementResponse(a generated.Announcement) AnnouncementResponse {
	resp := AnnouncementResponse{
		ID:              a.ID,
		Title:           a.Title,
		Body:            a.Body,
		CreatedByUserID: a.CreatedByUserID,
		CreatedAt:       a.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       a.UpdatedAt.Format(time.RFC3339),
	}

	if a.IsPinned.Valid {
		resp.IsPinned = a.IsPinned.Bool
	}
	if a.TournamentID.Valid {
		resp.TournamentID = &a.TournamentID.Int64
	}
	if a.LeagueID.Valid {
		resp.LeagueID = &a.LeagueID.Int64
	}
	if a.DivisionID.Valid {
		resp.DivisionID = &a.DivisionID.Int64
	}

	return resp
}

// Create creates a new announcement. At least one scope (tournament_id, league_id, division_id) must be set.
func (s *AnnouncementService) Create(ctx context.Context, params generated.CreateAnnouncementParams) (AnnouncementResponse, error) {
	if params.Title == "" {
		return AnnouncementResponse{}, &ValidationError{Message: "title is required"}
	}
	if params.Body == "" {
		return AnnouncementResponse{}, &ValidationError{Message: "body is required"}
	}

	// Validate at least one scope is set
	hasScope := params.TournamentID.Valid || params.LeagueID.Valid || params.DivisionID.Valid
	if !hasScope {
		return AnnouncementResponse{}, &ValidationError{Message: "at least one of tournament_id, league_id, or division_id is required"}
	}

	announcement, err := s.queries.CreateAnnouncement(ctx, params)
	if err != nil {
		return AnnouncementResponse{}, fmt.Errorf("failed to create announcement: %w", err)
	}

	return toAnnouncementResponse(announcement), nil
}

// GetByID retrieves an announcement by ID.
func (s *AnnouncementService) GetByID(ctx context.Context, id int64) (AnnouncementResponse, error) {
	announcement, err := s.queries.GetAnnouncementByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AnnouncementResponse{}, &NotFoundError{Message: "announcement not found"}
		}
		return AnnouncementResponse{}, fmt.Errorf("get announcement by id: %w", err)
	}
	return toAnnouncementResponse(announcement), nil
}

// ListByTournament returns announcements for a tournament. If divisionID is
// non-nil, the list is further filtered to that division only (useful for a
// division feed); nil returns every announcement in the tournament.
func (s *AnnouncementService) ListByTournament(ctx context.Context, tournamentID int64, divisionID *int64, limit, offset int32) ([]AnnouncementResponse, int64, error) {
	tid := pgtype.Int8{Int64: tournamentID, Valid: true}
	did := pgtype.Int8{}
	if divisionID != nil {
		did = pgtype.Int8{Int64: *divisionID, Valid: true}
	}
	announcements, err := s.queries.ListAnnouncementsByTournament(ctx, generated.ListAnnouncementsByTournamentParams{
		TournamentID: tid,
		DivisionID:   did,
		PageLimit:    limit,
		PageOffset:   offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list announcements: %w", err)
	}

	count, err := s.queries.CountAnnouncementsByTournament(ctx, generated.CountAnnouncementsByTournamentParams{
		TournamentID: tid,
		DivisionID:   did,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count announcements: %w", err)
	}

	result := make([]AnnouncementResponse, len(announcements))
	for i, a := range announcements {
		result[i] = toAnnouncementResponse(a)
	}

	return result, count, nil
}

// ListByDivision returns announcements targeted at a specific division.
func (s *AnnouncementService) ListByDivision(ctx context.Context, divisionID int64, limit, offset int32) ([]AnnouncementResponse, int64, error) {
	did := pgtype.Int8{Int64: divisionID, Valid: true}
	announcements, err := s.queries.ListAnnouncementsByDivision(ctx, generated.ListAnnouncementsByDivisionParams{
		DivisionID: did,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list division announcements: %w", err)
	}

	count, err := s.queries.CountAnnouncementsByDivision(ctx, did)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count division announcements: %w", err)
	}

	result := make([]AnnouncementResponse, len(announcements))
	for i, a := range announcements {
		result[i] = toAnnouncementResponse(a)
	}

	return result, count, nil
}

// ListByLeague returns announcements for a league.
func (s *AnnouncementService) ListByLeague(ctx context.Context, leagueID int64, limit, offset int32) ([]AnnouncementResponse, int64, error) {
	lid := pgtype.Int8{Int64: leagueID, Valid: true}
	announcements, err := s.queries.ListAnnouncementsByLeague(ctx, generated.ListAnnouncementsByLeagueParams{
		LeagueID: lid,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list announcements: %w", err)
	}

	count, err := s.queries.CountAnnouncementsByLeague(ctx, lid)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count announcements: %w", err)
	}

	result := make([]AnnouncementResponse, len(announcements))
	for i, a := range announcements {
		result[i] = toAnnouncementResponse(a)
	}

	return result, count, nil
}

// Update updates an announcement.
func (s *AnnouncementService) Update(ctx context.Context, id int64, params generated.UpdateAnnouncementParams) (AnnouncementResponse, error) {
	params.ID = id

	announcement, err := s.queries.UpdateAnnouncement(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AnnouncementResponse{}, &NotFoundError{Message: "announcement not found"}
		}
		return AnnouncementResponse{}, fmt.Errorf("update announcement: %w", err)
	}

	return toAnnouncementResponse(announcement), nil
}

// Delete soft-deletes an announcement.
func (s *AnnouncementService) Delete(ctx context.Context, id int64) error {
	return s.queries.SoftDeleteAnnouncement(ctx, id)
}
