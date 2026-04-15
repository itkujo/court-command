// backend/handler/venue.go
package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// VenueHandler handles venue HTTP requests.
type VenueHandler struct {
	venueService *service.VenueService
}

// NewVenueHandler creates a new VenueHandler.
func NewVenueHandler(venueService *service.VenueService) *VenueHandler {
	return &VenueHandler{venueService: venueService}
}

// Routes returns a chi.Router with all venue routes mounted.
func (h *VenueHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListVenues)
	r.Post("/", h.CreateVenue)
	r.Get("/{venueID}", h.GetVenue)
	r.Patch("/{venueID}", h.UpdateVenue)
	r.Delete("/{venueID}", h.DeleteVenue)

	// Approval workflow
	r.Post("/{venueID}/submit-for-review", h.SubmitForReview)
	r.Post("/{venueID}/approve", h.ApproveVenue)
	r.Post("/{venueID}/reject", h.RejectVenue)

	// Court sub-routes (venue-scoped)
	r.Get("/{venueID}/courts", h.ListCourts)
	r.Post("/{venueID}/courts", h.CreateCourtForVenue)

	return r
}

// CreateVenue creates a new venue.
func (h *VenueHandler) CreateVenue(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	var body struct {
		Name            string          `json:"name"`
		AddressLine1    *string         `json:"address_line_1"`
		AddressLine2    *string         `json:"address_line_2"`
		City            *string         `json:"city"`
		StateProvince   *string         `json:"state_province"`
		Country         *string         `json:"country"`
		PostalCode      *string         `json:"postal_code"`
		Latitude        *float64        `json:"latitude"`
		Longitude       *float64        `json:"longitude"`
		Timezone        *string         `json:"timezone"`
		WebsiteURL      *string         `json:"website_url"`
		ContactEmail    *string         `json:"contact_email"`
		ContactPhone    *string         `json:"contact_phone"`
		LogoURL         *string         `json:"logo_url"`
		PhotoURL        *string         `json:"photo_url"`
		VenueMapURL     *string         `json:"venue_map_url"`
		Description     *string         `json:"description"`
		SurfaceTypes    json.RawMessage `json:"surface_types"`
		Amenities       json.RawMessage `json:"amenities"`
		OrgID           *int64          `json:"org_id"`
		ManagedByUserID *int64          `json:"managed_by_user_id"`
		Bio             *string         `json:"bio"`
		Notes           *string         `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.Name == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "name is required")
		return
	}

	params := generated.CreateVenueParams{
		Name:            body.Name,
		AddressLine1:    body.AddressLine1,
		AddressLine2:    body.AddressLine2,
		City:            body.City,
		StateProvince:   body.StateProvince,
		Country:         body.Country,
		PostalCode:      body.PostalCode,
		Timezone:        body.Timezone,
		WebsiteUrl:      body.WebsiteURL,
		ContactEmail:    body.ContactEmail,
		ContactPhone:    body.ContactPhone,
		LogoUrl:         body.LogoURL,
		PhotoUrl:        body.PhotoURL,
		VenueMapUrl:     body.VenueMapURL,
		Description:     body.Description,
		Bio:             body.Bio,
		Notes:           body.Notes,
		CreatedByUserID: sess.UserID,
	}

	if body.Latitude != nil {
		params.Latitude = pgtype.Float8{Float64: *body.Latitude, Valid: true}
	}
	if body.Longitude != nil {
		params.Longitude = pgtype.Float8{Float64: *body.Longitude, Valid: true}
	}
	if body.OrgID != nil {
		params.OrgID = pgtype.Int8{Int64: *body.OrgID, Valid: true}
	}
	if body.ManagedByUserID != nil {
		params.ManagedByUserID = pgtype.Int8{Int64: *body.ManagedByUserID, Valid: true}
	}

	// JSONB fields
	if len(body.SurfaceTypes) > 0 {
		params.SurfaceTypes = []byte(body.SurfaceTypes)
	} else {
		params.SurfaceTypes = []byte("[]")
	}
	if len(body.Amenities) > 0 {
		params.Amenities = []byte(body.Amenities)
	} else {
		params.Amenities = []byte("[]")
	}

	venue, err := h.venueService.CreateVenue(r.Context(), params)
	if err != nil {
		handleServiceError(w, err)
		return
	}

	Created(w, venue)
}

// GetVenue retrieves a venue by ID.
func (h *VenueHandler) GetVenue(w http.ResponseWriter, r *http.Request) {
	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	venue, err := h.venueService.GetVenue(r.Context(), venueID)
	if err != nil {
		handleServiceError(w, err)
		return
	}

	Success(w, venue)
}

// UpdateVenue updates a venue.
func (h *VenueHandler) UpdateVenue(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	var body struct {
		Name            *string         `json:"name"`
		AddressLine1    *string         `json:"address_line_1"`
		AddressLine2    *string         `json:"address_line_2"`
		City            *string         `json:"city"`
		StateProvince   *string         `json:"state_province"`
		Country         *string         `json:"country"`
		PostalCode      *string         `json:"postal_code"`
		Latitude        *float64        `json:"latitude"`
		Longitude       *float64        `json:"longitude"`
		Timezone        *string         `json:"timezone"`
		WebsiteURL      *string         `json:"website_url"`
		ContactEmail    *string         `json:"contact_email"`
		ContactPhone    *string         `json:"contact_phone"`
		LogoURL         *string         `json:"logo_url"`
		PhotoURL        *string         `json:"photo_url"`
		VenueMapURL     *string         `json:"venue_map_url"`
		Description     *string         `json:"description"`
		SurfaceTypes    json.RawMessage `json:"surface_types"`
		Amenities       json.RawMessage `json:"amenities"`
		OrgID           *int64          `json:"org_id"`
		ManagedByUserID *int64          `json:"managed_by_user_id"`
		Bio             *string         `json:"bio"`
		Notes           *string         `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.UpdateVenueParams{
		VenueID:       venueID,
		Name:          body.Name,
		AddressLine1:  body.AddressLine1,
		AddressLine2:  body.AddressLine2,
		City:          body.City,
		StateProvince: body.StateProvince,
		Country:       body.Country,
		PostalCode:    body.PostalCode,
		Timezone:      body.Timezone,
		WebsiteUrl:    body.WebsiteURL,
		ContactEmail:  body.ContactEmail,
		ContactPhone:  body.ContactPhone,
		LogoUrl:       body.LogoURL,
		PhotoUrl:      body.PhotoURL,
		VenueMapUrl:   body.VenueMapURL,
		Description:   body.Description,
		Bio:           body.Bio,
		Notes:         body.Notes,
	}

	if body.Latitude != nil {
		params.Latitude = pgtype.Float8{Float64: *body.Latitude, Valid: true}
	}
	if body.Longitude != nil {
		params.Longitude = pgtype.Float8{Float64: *body.Longitude, Valid: true}
	}
	if body.OrgID != nil {
		params.OrgID = pgtype.Int8{Int64: *body.OrgID, Valid: true}
	}
	if body.ManagedByUserID != nil {
		params.ManagedByUserID = pgtype.Int8{Int64: *body.ManagedByUserID, Valid: true}
	}
	if len(body.SurfaceTypes) > 0 {
		params.SurfaceTypes = []byte(body.SurfaceTypes)
	}
	if len(body.Amenities) > 0 {
		params.Amenities = []byte(body.Amenities)
	}

	venue, err := h.venueService.UpdateVenue(r.Context(), venueID, params)
	if err != nil {
		handleServiceError(w, err)
		return
	}

	Success(w, venue)
}

// DeleteVenue soft-deletes a venue.
func (h *VenueHandler) DeleteVenue(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	if err := h.venueService.DeleteVenue(r.Context(), venueID); err != nil {
		handleServiceError(w, err)
		return
	}

	Success(w, map[string]string{"message": "venue deleted"})
}

// ListVenues lists venues with pagination and optional status filter.
func (h *VenueHandler) ListVenues(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	var status *string
	if s := r.URL.Query().Get("status"); s != "" {
		status = &s
	}

	venues, total, err := h.venueService.ListVenues(r.Context(), limit, offset, status)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	Paginated(w, venues, total, int(limit), int(offset))
}

// SubmitForReview transitions a venue from draft to pending_review.
func (h *VenueHandler) SubmitForReview(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	venue, err := h.venueService.SubmitVenueForReview(r.Context(), venueID, sess.UserID)
	if err != nil {
		handleServiceError(w, err)
		return
	}

	Success(w, venue)
}

// ApproveVenue approves a pending venue (platform_admin only).
func (h *VenueHandler) ApproveVenue(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	if sess.Role != "platform_admin" {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Only platform admins can approve venues")
		return
	}

	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	venue, err := h.venueService.ApproveVenue(r.Context(), venueID)
	if err != nil {
		handleServiceError(w, err)
		return
	}

	Success(w, venue)
}

// RejectVenue rejects a pending venue (platform_admin only).
func (h *VenueHandler) RejectVenue(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	if sess.Role != "platform_admin" {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Only platform admins can reject venues")
		return
	}

	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	venue, err := h.venueService.RejectVenue(r.Context(), venueID)
	if err != nil {
		handleServiceError(w, err)
		return
	}

	Success(w, venue)
}

// ListCourts lists all courts for a venue.
func (h *VenueHandler) ListCourts(w http.ResponseWriter, r *http.Request) {
	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	courts, err := h.venueService.ListCourtsByVenue(r.Context(), venueID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	Success(w, courts)
}

// CreateCourtForVenue creates a court attached to a venue.
func (h *VenueHandler) CreateCourtForVenue(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	var body struct {
		Name        string  `json:"name"`
		SurfaceType *string `json:"surface_type"`
		IsShowCourt *bool   `json:"is_show_court"`
		IsActive    *bool   `json:"is_active"`
		IsTemporary *bool   `json:"is_temporary"`
		SortOrder   *int32  `json:"sort_order"`
		Notes       *string `json:"notes"`
		StreamURL   *string `json:"stream_url"`
		StreamTitle *string `json:"stream_title"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.Name == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "name is required")
		return
	}

	params := generated.CreateCourtParams{
		Name:            body.Name,
		VenueID:         pgtype.Int8{Int64: venueID, Valid: true},
		SurfaceType:     body.SurfaceType,
		IsActive:        true,
		Notes:           body.Notes,
		StreamUrl:       body.StreamURL,
		StreamTitle:     body.StreamTitle,
		CreatedByUserID: pgtype.Int8{Int64: sess.UserID, Valid: true},
	}

	if body.IsShowCourt != nil {
		params.IsShowCourt = *body.IsShowCourt
	}
	if body.IsActive != nil {
		params.IsActive = *body.IsActive
	}
	if body.IsTemporary != nil {
		params.IsTemporary = *body.IsTemporary
	}
	if body.SortOrder != nil {
		params.SortOrder = *body.SortOrder
	}

	court, err := h.venueService.CreateCourt(r.Context(), params)
	if err != nil {
		handleServiceError(w, err)
		return
	}

	Created(w, court)
}

// handleServiceError maps service-layer errors to HTTP responses.
func handleServiceError(w http.ResponseWriter, err error) {
	var valErr *service.ValidationError
	var notFoundErr *service.NotFoundError
	var conflictErr *service.ConflictError

	switch {
	case errors.As(err, &valErr):
		WriteError(w, http.StatusBadRequest, "VALIDATION_ERROR", valErr.Message)
	case errors.As(err, &notFoundErr):
		WriteError(w, http.StatusNotFound, "NOT_FOUND", notFoundErr.Message)
	case errors.As(err, &conflictErr):
		WriteError(w, http.StatusConflict, "CONFLICT", conflictErr.Message)
	default:
		WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error")
	}
}
