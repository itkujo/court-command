package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/court-command/court-command/db/generated"
)

// LeagueService handles league business logic.
type LeagueService struct {
	queries *generated.Queries
}

// NewLeagueService creates a new LeagueService.
func NewLeagueService(queries *generated.Queries) *LeagueService {
	return &LeagueService{queries: queries}
}

// LeagueResponse is the public representation of a league.
type LeagueResponse struct {
	ID               int64           `json:"id"`
	PublicID         string          `json:"public_id"`
	Name             string          `json:"name"`
	Slug             string          `json:"slug"`
	Status           string          `json:"status"`
	LogoURL          *string         `json:"logo_url,omitempty"`
	BannerURL        *string         `json:"banner_url,omitempty"`
	Description      *string         `json:"description,omitempty"`
	WebsiteURL       *string         `json:"website_url,omitempty"`
	ContactEmail     *string         `json:"contact_email,omitempty"`
	ContactPhone     *string         `json:"contact_phone,omitempty"`
	City             *string         `json:"city,omitempty"`
	StateProvince    *string         `json:"state_province,omitempty"`
	Country          *string         `json:"country,omitempty"`
	RulesDocumentURL *string         `json:"rules_document_url,omitempty"`
	SocialLinks      json.RawMessage `json:"social_links"`
	SponsorInfo      json.RawMessage `json:"sponsor_info"`
	Notes            *string         `json:"notes,omitempty"`
	CreatedByUserID  int64           `json:"created_by_user_id"`
	CreatedAt        string          `json:"created_at"`
	UpdatedAt        string          `json:"updated_at"`
}

func toLeagueResponse(l generated.League) LeagueResponse {
	resp := LeagueResponse{
		ID:               l.ID,
		PublicID:         l.PublicID,
		Name:             l.Name,
		Slug:             l.Slug,
		Status:           l.Status,
		LogoURL:          l.LogoUrl,
		BannerURL:        l.BannerUrl,
		Description:      l.Description,
		WebsiteURL:       l.WebsiteUrl,
		ContactEmail:     l.ContactEmail,
		ContactPhone:     l.ContactPhone,
		City:             l.City,
		StateProvince:    l.StateProvince,
		Country:          l.Country,
		RulesDocumentURL: l.RulesDocumentUrl,
		Notes:            l.Notes,
		CreatedByUserID:  l.CreatedByUserID,
		CreatedAt:        l.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        l.UpdatedAt.Format(time.RFC3339),
	}

	if len(l.SocialLinks) > 0 {
		resp.SocialLinks = json.RawMessage(l.SocialLinks)
	} else {
		resp.SocialLinks = json.RawMessage("[]")
	}
	if len(l.SponsorInfo) > 0 {
		resp.SponsorInfo = json.RawMessage(l.SponsorInfo)
	} else {
		resp.SponsorInfo = json.RawMessage("[]")
	}

	return resp
}

// generateUniqueSlug generates a unique slug for a league.
func (s *LeagueService) generateUniqueSlug(ctx context.Context, name string) (string, error) {
	base := generateSlug(name)
	for i := 0; i < 100; i++ {
		candidate := base
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", base, i)
		}
		exists, err := s.queries.SlugExistsLeague(ctx, candidate)
		if err != nil {
			return "", fmt.Errorf("failed to check slug: %w", err)
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", &ConflictError{Message: "unable to generate unique slug, try a different name"}
}

// Create creates a new league.
func (s *LeagueService) Create(ctx context.Context, params generated.CreateLeagueParams) (LeagueResponse, error) {
	if params.Name == "" {
		return LeagueResponse{}, &ValidationError{Message: "name is required"}
	}

	slug, err := s.generateUniqueSlug(ctx, params.Name)
	if err != nil {
		return LeagueResponse{}, err
	}
	params.Slug = slug
	params.Status = "draft"

	league, err := s.queries.CreateLeague(ctx, params)
	if err != nil {
		return LeagueResponse{}, fmt.Errorf("failed to create league: %w", err)
	}

	return toLeagueResponse(league), nil
}

// GetByID retrieves a league by ID.
func (s *LeagueService) GetByID(ctx context.Context, id int64) (LeagueResponse, error) {
	league, err := s.queries.GetLeagueByID(ctx, id)
	if err != nil {
		return LeagueResponse{}, &NotFoundError{Message: "league not found"}
	}
	return toLeagueResponse(league), nil
}

// GetBySlug retrieves a league by slug.
func (s *LeagueService) GetBySlug(ctx context.Context, slug string) (LeagueResponse, error) {
	league, err := s.queries.GetLeagueBySlug(ctx, slug)
	if err != nil {
		return LeagueResponse{}, &NotFoundError{Message: "league not found"}
	}
	return toLeagueResponse(league), nil
}

// GetByPublicID retrieves a league by public ID.
func (s *LeagueService) GetByPublicID(ctx context.Context, publicID string) (LeagueResponse, error) {
	league, err := s.queries.GetLeagueByPublicID(ctx, publicID)
	if err != nil {
		return LeagueResponse{}, &NotFoundError{Message: "league not found"}
	}
	return toLeagueResponse(league), nil
}

// List returns paginated leagues.
func (s *LeagueService) List(ctx context.Context, limit, offset int32) ([]LeagueResponse, int64, error) {
	leagues, err := s.queries.ListLeagues(ctx, generated.ListLeaguesParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list leagues: %w", err)
	}

	count, err := s.queries.CountLeagues(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count leagues: %w", err)
	}

	result := make([]LeagueResponse, len(leagues))
	for i, l := range leagues {
		result[i] = toLeagueResponse(l)
	}

	return result, count, nil
}

// Search searches leagues by term.
func (s *LeagueService) Search(ctx context.Context, term string, limit, offset int32) ([]LeagueResponse, int64, error) {
	leagues, err := s.queries.SearchLeagues(ctx, generated.SearchLeaguesParams{
		SearchTerm: term,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search leagues: %w", err)
	}

	count, err := s.queries.CountSearchLeagues(ctx, term)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count search results: %w", err)
	}

	result := make([]LeagueResponse, len(leagues))
	for i, l := range leagues {
		result[i] = toLeagueResponse(l)
	}

	return result, count, nil
}

// Update updates a league.
func (s *LeagueService) Update(ctx context.Context, id int64, params generated.UpdateLeagueParams) (LeagueResponse, error) {
	params.ID = id

	league, err := s.queries.UpdateLeague(ctx, params)
	if err != nil {
		return LeagueResponse{}, &NotFoundError{Message: "league not found"}
	}

	return toLeagueResponse(league), nil
}

// Delete soft-deletes a league.
func (s *LeagueService) Delete(ctx context.Context, id int64) error {
	return s.queries.SoftDeleteLeague(ctx, id)
}

// validLeagueTransitions defines allowed status transitions for leagues.
var validLeagueTransitions = map[string][]string{
	"draft":     {"published"},
	"published": {"active", "cancelled"},
	"active":    {"archived", "cancelled"},
}

// UpdateStatus transitions a league to a new status.
func (s *LeagueService) UpdateStatus(ctx context.Context, id int64, newStatus string) (LeagueResponse, error) {
	league, err := s.queries.GetLeagueByID(ctx, id)
	if err != nil {
		return LeagueResponse{}, &NotFoundError{Message: "league not found"}
	}

	allowed, ok := validLeagueTransitions[league.Status]
	if !ok {
		return LeagueResponse{}, &ValidationError{Message: fmt.Sprintf("no transitions allowed from status %q", league.Status)}
	}

	valid := false
	for _, s := range allowed {
		if s == newStatus {
			valid = true
			break
		}
	}
	if !valid {
		return LeagueResponse{}, &ValidationError{Message: fmt.Sprintf("cannot transition from %q to %q", league.Status, newStatus)}
	}

	updated, err := s.queries.UpdateLeague(ctx, generated.UpdateLeagueParams{
		ID:     id,
		Status: &newStatus,
	})
	if err != nil {
		return LeagueResponse{}, fmt.Errorf("failed to update league status: %w", err)
	}

	return toLeagueResponse(updated), nil
}

// ListByCreator returns leagues created by a specific user.
func (s *LeagueService) ListByCreator(ctx context.Context, userID int64, limit, offset int32) ([]LeagueResponse, int64, error) {
	leagues, err := s.queries.ListLeaguesByCreator(ctx, generated.ListLeaguesByCreatorParams{
		CreatedByUserID: userID,
		Limit:           limit,
		Offset:          offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list leagues: %w", err)
	}

	count, err := s.queries.CountLeaguesByCreator(ctx, userID)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count leagues: %w", err)
	}

	result := make([]LeagueResponse, len(leagues))
	for i, l := range leagues {
		result[i] = toLeagueResponse(l)
	}

	return result, count, nil
}
