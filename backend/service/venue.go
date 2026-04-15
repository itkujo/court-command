// backend/service/venue.go
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/court-command/court-command/db/generated"
)

// VenueService handles venue and court business logic.
type VenueService struct {
	queries *generated.Queries
}

// NewVenueService creates a new VenueService.
func NewVenueService(queries *generated.Queries) *VenueService {
	return &VenueService{queries: queries}
}

// VenueResponse is the public representation of a venue.
type VenueResponse struct {
	ID              int64           `json:"id"`
	Name            string          `json:"name"`
	Slug            string          `json:"slug"`
	Status          string          `json:"status"`
	AddressLine1    *string         `json:"address_line_1,omitempty"`
	AddressLine2    *string         `json:"address_line_2,omitempty"`
	City            *string         `json:"city,omitempty"`
	StateProvince   *string         `json:"state_province,omitempty"`
	Country         *string         `json:"country,omitempty"`
	PostalCode      *string         `json:"postal_code,omitempty"`
	Latitude        *float64        `json:"latitude,omitempty"`
	Longitude       *float64        `json:"longitude,omitempty"`
	Timezone        *string         `json:"timezone,omitempty"`
	WebsiteURL      *string         `json:"website_url,omitempty"`
	ContactEmail    *string         `json:"contact_email,omitempty"`
	ContactPhone    *string         `json:"contact_phone,omitempty"`
	LogoURL         *string         `json:"logo_url,omitempty"`
	PhotoURL        *string         `json:"photo_url,omitempty"`
	VenueMapURL     *string         `json:"venue_map_url,omitempty"`
	Description     *string         `json:"description,omitempty"`
	SurfaceTypes    json.RawMessage `json:"surface_types"`
	Amenities       json.RawMessage `json:"amenities"`
	OrgID           *int64          `json:"org_id,omitempty"`
	ManagedByUserID *int64          `json:"managed_by_user_id,omitempty"`
	Bio             *string         `json:"bio,omitempty"`
	Notes           *string         `json:"notes,omitempty"`
	CreatedByUserID int64           `json:"created_by_user_id"`
	CourtCount      int64           `json:"court_count"`
	CreatedAt       string          `json:"created_at"`
	UpdatedAt       string          `json:"updated_at"`
}

// CourtResponse is the public representation of a court.
type CourtResponse struct {
	ID              int64   `json:"id"`
	Name            string  `json:"name"`
	Slug            string  `json:"slug"`
	VenueID         *int64  `json:"venue_id,omitempty"`
	SurfaceType     *string `json:"surface_type,omitempty"`
	IsShowCourt     bool    `json:"is_show_court"`
	IsActive        bool    `json:"is_active"`
	IsTemporary     bool    `json:"is_temporary"`
	SortOrder       int32   `json:"sort_order"`
	Notes           *string `json:"notes,omitempty"`
	StreamURL       *string `json:"stream_url,omitempty"`
	StreamType      *string `json:"stream_type,omitempty"`
	StreamIsLive    bool    `json:"stream_is_live"`
	StreamTitle     *string `json:"stream_title,omitempty"`
	CreatedByUserID *int64  `json:"created_by_user_id,omitempty"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

func toVenueResponse(v generated.Venue, courtCount int64) VenueResponse {
	resp := VenueResponse{
		ID:              v.ID,
		Name:            v.Name,
		Slug:            v.Slug,
		Status:          v.Status,
		AddressLine1:    v.AddressLine1,
		AddressLine2:    v.AddressLine2,
		City:            v.City,
		StateProvince:   v.StateProvince,
		Country:         v.Country,
		PostalCode:      v.PostalCode,
		Timezone:        v.Timezone,
		WebsiteURL:      v.WebsiteUrl,
		ContactEmail:    v.ContactEmail,
		ContactPhone:    v.ContactPhone,
		LogoURL:         v.LogoUrl,
		PhotoURL:        v.PhotoUrl,
		VenueMapURL:     v.VenueMapUrl,
		Description:     v.Description,
		Bio:             v.Bio,
		Notes:           v.Notes,
		CreatedByUserID: v.CreatedByUserID,
		CourtCount:      courtCount,
		CreatedAt:       v.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       v.UpdatedAt.Format(time.RFC3339),
	}

	if v.Latitude.Valid {
		resp.Latitude = &v.Latitude.Float64
	}
	if v.Longitude.Valid {
		resp.Longitude = &v.Longitude.Float64
	}
	if v.OrgID.Valid {
		resp.OrgID = &v.OrgID.Int64
	}
	if v.ManagedByUserID.Valid {
		resp.ManagedByUserID = &v.ManagedByUserID.Int64
	}

	// JSONB fields: use raw bytes or default to []
	if len(v.SurfaceTypes) > 0 {
		resp.SurfaceTypes = json.RawMessage(v.SurfaceTypes)
	} else {
		resp.SurfaceTypes = json.RawMessage("[]")
	}
	if len(v.Amenities) > 0 {
		resp.Amenities = json.RawMessage(v.Amenities)
	} else {
		resp.Amenities = json.RawMessage("[]")
	}

	return resp
}

func toCourtResponse(c generated.Court) CourtResponse {
	resp := CourtResponse{
		ID:           c.ID,
		Name:         c.Name,
		Slug:         c.Slug,
		SurfaceType:  c.SurfaceType,
		IsShowCourt:  c.IsShowCourt,
		IsActive:     c.IsActive,
		IsTemporary:  c.IsTemporary,
		SortOrder:    c.SortOrder,
		Notes:        c.Notes,
		StreamURL:    c.StreamUrl,
		StreamType:   c.StreamType,
		StreamIsLive: c.StreamIsLive,
		StreamTitle:  c.StreamTitle,
		CreatedAt:    c.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    c.UpdatedAt.Format(time.RFC3339),
	}

	if c.VenueID.Valid {
		resp.VenueID = &c.VenueID.Int64
	}
	if c.CreatedByUserID.Valid {
		resp.CreatedByUserID = &c.CreatedByUserID.Int64
	}

	return resp
}

// DetectStreamType returns the stream type based on the URL.
func DetectStreamType(url string) string {
	lower := strings.ToLower(url)
	switch {
	case strings.Contains(lower, "youtube.com") || strings.Contains(lower, "youtu.be"):
		return "youtube"
	case strings.Contains(lower, "twitch.tv"):
		return "twitch"
	case strings.Contains(lower, "vimeo.com"):
		return "vimeo"
	case strings.HasSuffix(lower, ".m3u8") || strings.Contains(lower, "/hls/"):
		return "hls"
	default:
		return "other"
	}
}

// CreateVenue creates a new venue in draft status.
func (s *VenueService) CreateVenue(ctx context.Context, params generated.CreateVenueParams) (VenueResponse, error) {
	if params.Name == "" {
		return VenueResponse{}, &ValidationError{Message: "name is required"}
	}

	// Force draft status on creation
	params.Status = "draft"

	// Generate slug with collision check
	baseSlug := generateSlug(params.Name)
	params.Slug = baseSlug

	slugFound := false
	for i := 0; i < 100; i++ {
		candidate := baseSlug
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", baseSlug, i)
		}
		count, err := s.queries.CheckVenueSlugExists(ctx, candidate)
		if err != nil {
			return VenueResponse{}, fmt.Errorf("failed to check slug: %w", err)
		}
		if count == 0 {
			params.Slug = candidate
			slugFound = true
			break
		}
	}
	if !slugFound {
		return VenueResponse{}, &ConflictError{Message: "unable to generate unique slug, try a different name"}
	}

	venue, err := s.queries.CreateVenue(ctx, params)
	if err != nil {
		return VenueResponse{}, fmt.Errorf("failed to create venue: %w", err)
	}

	return toVenueResponse(venue, 0), nil
}

// GetVenue retrieves a venue by ID with court count.
func (s *VenueService) GetVenue(ctx context.Context, venueID int64) (VenueResponse, error) {
	venue, err := s.queries.GetVenueByID(ctx, venueID)
	if err != nil {
		return VenueResponse{}, &NotFoundError{Message: "venue not found"}
	}

	courtCount, err := s.queries.GetVenueCourtCount(ctx, pgtype.Int8{Int64: venueID, Valid: true})
	if err != nil {
		return VenueResponse{}, fmt.Errorf("failed to get court count: %w", err)
	}

	return toVenueResponse(venue, courtCount), nil
}

// UpdateVenue updates a venue's details.
func (s *VenueService) UpdateVenue(ctx context.Context, venueID int64, params generated.UpdateVenueParams) (VenueResponse, error) {
	params.VenueID = venueID

	venue, err := s.queries.UpdateVenue(ctx, params)
	if err != nil {
		return VenueResponse{}, &NotFoundError{Message: "venue not found"}
	}

	courtCount, err := s.queries.GetVenueCourtCount(ctx, pgtype.Int8{Int64: venueID, Valid: true})
	if err != nil {
		return VenueResponse{}, fmt.Errorf("failed to get court count: %w", err)
	}

	return toVenueResponse(venue, courtCount), nil
}

// DeleteVenue soft-deletes a venue.
func (s *VenueService) DeleteVenue(ctx context.Context, venueID int64) error {
	return s.queries.SoftDeleteVenue(ctx, venueID)
}

// ListVenues lists venues with pagination and optional status filter.
func (s *VenueService) ListVenues(ctx context.Context, limit, offset int32, status *string) ([]VenueResponse, int64, error) {
	venues, err := s.queries.ListVenues(ctx, generated.ListVenuesParams{
		Limit:  limit,
		Offset: offset,
		Status: status,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list venues: %w", err)
	}

	count, err := s.queries.CountVenues(ctx, status)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count venues: %w", err)
	}

	result := make([]VenueResponse, len(venues))
	for i, v := range venues {
		result[i] = toVenueResponse(v, 0)
	}

	return result, count, nil
}

// SubmitVenueForReview transitions a venue from draft to pending_review.
// Only the creator can submit.
func (s *VenueService) SubmitVenueForReview(ctx context.Context, venueID int64, requesterID int64) (VenueResponse, error) {
	venue, err := s.queries.GetVenueByID(ctx, venueID)
	if err != nil {
		return VenueResponse{}, &NotFoundError{Message: "venue not found"}
	}

	if venue.CreatedByUserID != requesterID {
		return VenueResponse{}, &ValidationError{Message: "only the venue creator can submit for review"}
	}

	if venue.Status != "draft" {
		return VenueResponse{}, &ValidationError{Message: "only draft venues can be submitted for review"}
	}

	updated, err := s.queries.UpdateVenueStatus(ctx, generated.UpdateVenueStatusParams{
		ID:     venueID,
		Status: "pending_review",
	})
	if err != nil {
		return VenueResponse{}, fmt.Errorf("failed to update venue status: %w", err)
	}

	courtCount, err := s.queries.GetVenueCourtCount(ctx, pgtype.Int8{Int64: venueID, Valid: true})
	if err != nil {
		return VenueResponse{}, fmt.Errorf("failed to get court count: %w", err)
	}

	return toVenueResponse(updated, courtCount), nil
}

// ApproveVenue transitions a venue from pending_review to published.
func (s *VenueService) ApproveVenue(ctx context.Context, venueID int64) (VenueResponse, error) {
	venue, err := s.queries.GetVenueByID(ctx, venueID)
	if err != nil {
		return VenueResponse{}, &NotFoundError{Message: "venue not found"}
	}

	if venue.Status != "pending_review" {
		return VenueResponse{}, &ValidationError{Message: "only pending_review venues can be approved"}
	}

	updated, err := s.queries.UpdateVenueStatus(ctx, generated.UpdateVenueStatusParams{
		ID:     venueID,
		Status: "published",
	})
	if err != nil {
		return VenueResponse{}, fmt.Errorf("failed to approve venue: %w", err)
	}

	courtCount, err := s.queries.GetVenueCourtCount(ctx, pgtype.Int8{Int64: venueID, Valid: true})
	if err != nil {
		return VenueResponse{}, fmt.Errorf("failed to get court count: %w", err)
	}

	return toVenueResponse(updated, courtCount), nil
}

// RejectVenue transitions a venue from pending_review back to draft.
func (s *VenueService) RejectVenue(ctx context.Context, venueID int64) (VenueResponse, error) {
	venue, err := s.queries.GetVenueByID(ctx, venueID)
	if err != nil {
		return VenueResponse{}, &NotFoundError{Message: "venue not found"}
	}

	if venue.Status != "pending_review" {
		return VenueResponse{}, &ValidationError{Message: "only pending_review venues can be rejected"}
	}

	updated, err := s.queries.UpdateVenueStatus(ctx, generated.UpdateVenueStatusParams{
		ID:     venueID,
		Status: "draft",
	})
	if err != nil {
		return VenueResponse{}, fmt.Errorf("failed to reject venue: %w", err)
	}

	courtCount, err := s.queries.GetVenueCourtCount(ctx, pgtype.Int8{Int64: venueID, Valid: true})
	if err != nil {
		return VenueResponse{}, fmt.Errorf("failed to get court count: %w", err)
	}

	return toVenueResponse(updated, courtCount), nil
}

// CreateCourt creates a new court, optionally attached to a venue.
func (s *VenueService) CreateCourt(ctx context.Context, params generated.CreateCourtParams) (CourtResponse, error) {
	if params.Name == "" {
		return CourtResponse{}, &ValidationError{Message: "name is required"}
	}

	// Generate slug
	baseSlug := generateSlug(params.Name)
	params.Slug = baseSlug

	// Auto-detect stream type if stream_url is provided
	if params.StreamUrl != nil && *params.StreamUrl != "" {
		detected := DetectStreamType(*params.StreamUrl)
		params.StreamType = &detected
	}

	// Check slug collision (venue-scoped or global)
	slugFound := false
	for i := 0; i < 100; i++ {
		candidate := baseSlug
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", baseSlug, i)
		}

		var count int64
		var err error

		if params.VenueID.Valid {
			count, err = s.queries.CheckCourtSlugInVenue(ctx, generated.CheckCourtSlugInVenueParams{
				Slug:    candidate,
				VenueID: params.VenueID,
			})
		} else {
			count, err = s.queries.CheckFloatingCourtSlug(ctx, candidate)
		}
		if err != nil {
			return CourtResponse{}, fmt.Errorf("failed to check court slug: %w", err)
		}
		if count == 0 {
			params.Slug = candidate
			slugFound = true
			break
		}
	}
	if !slugFound {
		return CourtResponse{}, &ConflictError{Message: "unable to generate unique slug, try a different name"}
	}

	court, err := s.queries.CreateCourt(ctx, params)
	if err != nil {
		return CourtResponse{}, fmt.Errorf("failed to create court: %w", err)
	}

	return toCourtResponse(court), nil
}

// GetCourt retrieves a court by ID.
func (s *VenueService) GetCourt(ctx context.Context, courtID int64) (CourtResponse, error) {
	court, err := s.queries.GetCourtByID(ctx, courtID)
	if err != nil {
		return CourtResponse{}, &NotFoundError{Message: "court not found"}
	}
	return toCourtResponse(court), nil
}

// ListCourtsByVenue lists all courts for a venue.
func (s *VenueService) ListCourtsByVenue(ctx context.Context, venueID int64) ([]CourtResponse, error) {
	courts, err := s.queries.ListCourtsByVenue(ctx, pgtype.Int8{Int64: venueID, Valid: true})
	if err != nil {
		return nil, fmt.Errorf("failed to list courts: %w", err)
	}

	result := make([]CourtResponse, len(courts))
	for i, c := range courts {
		result[i] = toCourtResponse(c)
	}

	return result, nil
}

// UpdateCourt updates a court's details.
func (s *VenueService) UpdateCourt(ctx context.Context, courtID int64, params generated.UpdateCourtParams) (CourtResponse, error) {
	params.CourtID = courtID

	// Auto-detect stream type if stream_url is being updated
	if params.StreamUrl != nil && *params.StreamUrl != "" {
		detected := DetectStreamType(*params.StreamUrl)
		params.StreamType = &detected
	}

	court, err := s.queries.UpdateCourt(ctx, params)
	if err != nil {
		return CourtResponse{}, &NotFoundError{Message: "court not found"}
	}
	return toCourtResponse(court), nil
}

// DeleteCourt soft-deletes a court.
func (s *VenueService) DeleteCourt(ctx context.Context, courtID int64) error {
	return s.queries.SoftDeleteCourt(ctx, courtID)
}
