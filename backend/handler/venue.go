// backend/handler/venue.go
package handler

import (
	"encoding/json"
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
	r.Get("/search", h.SearchVenues)
	r.Get("/my", h.ListMyVenues)
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

	// Manager sub-routes
	r.Get("/{venueID}/managers", h.ListManagers)
	r.Post("/{venueID}/managers", h.AddManager)
	r.Delete("/{venueID}/managers/{userID}", h.RemoveManager)
	r.Patch("/{venueID}/managers/{userID}", h.UpdateManagerRole)

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

	// Permission check: only venue managers, creators, or platform admins can edit
	canManage, err := h.venueService.CanManageVenue(r.Context(), venueID, sess.UserID, sess.Role)
	if err != nil {
		HandleServiceError(w, err)
		return
	}
	if !canManage {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "You do not have permission to edit this venue")
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

	// Permission check: only venue admins, creators, or platform admins can delete
	canAdmin, err := h.venueService.CanAdminVenue(r.Context(), venueID, sess.UserID, sess.Role)
	if err != nil {
		HandleServiceError(w, err)
		return
	}
	if !canAdmin {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "You do not have permission to delete this venue")
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

// SearchVenues searches venues with filters.
func (h *VenueHandler) SearchVenues(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)
	query := r.URL.Query()

	params := generated.SearchVenuesParams{
		Limit:  limit,
		Offset: offset,
	}
	if q := query.Get("q"); q != "" {
		params.Query = &q
	}
	if c := query.Get("city"); c != "" {
		params.City = &c
	}
	if s := query.Get("state_province"); s != "" {
		params.StateProvince = &s
	}
	if c := query.Get("country"); c != "" {
		params.Country = &c
	}

	venues, err := h.venueService.SearchVenues(r.Context(), params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	countParams := generated.CountSearchVenuesParams{
		Query:         params.Query,
		City:          params.City,
		StateProvince: params.StateProvince,
		Country:       params.Country,
	}
	total, err := h.venueService.CountSearchVenues(r.Context(), countParams)
	if err != nil {
		HandleServiceError(w, err)
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

	// Permission check: only venue managers can submit for review
	canManage, err := h.venueService.CanManageVenue(r.Context(), venueID, sess.UserID, sess.Role)
	if err != nil {
		HandleServiceError(w, err)
		return
	}
	if !canManage {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "You do not have permission to submit this venue for review")
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

	// Permission check: only venue managers can add courts
	canManage, err := h.venueService.CanManageVenue(r.Context(), venueID, sess.UserID, sess.Role)
	if err != nil {
		HandleServiceError(w, err)
		return
	}
	if !canManage {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "You do not have permission to add courts to this venue")
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

// handleServiceError is a local alias for HandleServiceError for backward compatibility.
func handleServiceError(w http.ResponseWriter, err error) {
	HandleServiceError(w, err)
}

// --- Venue Manager Handlers ---

// ListManagers returns all managers for a venue.
func (h *VenueHandler) ListManagers(w http.ResponseWriter, r *http.Request) {
	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid venue ID")
		return
	}

	managers, err := h.venueService.ListVenueManagers(r.Context(), venueID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, managers)
}

// AddManager adds a user as a manager for a venue.
func (h *VenueHandler) AddManager(w http.ResponseWriter, r *http.Request) {
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

	// Only venue admins, creators, or platform admins can add managers
	canAdmin, err := h.venueService.CanAdminVenue(r.Context(), venueID, sess.UserID, sess.Role)
	if err != nil {
		HandleServiceError(w, err)
		return
	}
	if !canAdmin {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Only venue admins can manage managers")
		return
	}

	var body struct {
		UserID int64  `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.UserID == 0 {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELD", "user_id is required")
		return
	}
	if body.Role == "" {
		body.Role = "manager"
	}

	manager, err := h.venueService.AddVenueManager(r.Context(), venueID, body.UserID, body.Role, sess.UserID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, manager)
}

// RemoveManager removes a user from a venue's managers.
func (h *VenueHandler) RemoveManager(w http.ResponseWriter, r *http.Request) {
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

	targetUserID, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid user ID")
		return
	}

	// Only venue admins, creators, or platform admins can remove managers
	canAdmin, err := h.venueService.CanAdminVenue(r.Context(), venueID, sess.UserID, sess.Role)
	if err != nil {
		HandleServiceError(w, err)
		return
	}
	if !canAdmin {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Only venue admins can manage managers")
		return
	}

	// Prevent removing yourself if you're the last admin
	if targetUserID == sess.UserID {
		WriteError(w, http.StatusBadRequest, "CANNOT_REMOVE_SELF", "Cannot remove yourself as a manager. Transfer admin role first.")
		return
	}

	if err := h.venueService.RemoveVenueManager(r.Context(), venueID, targetUserID); err != nil {
		HandleServiceError(w, err)
		return
	}

	NoContent(w)
}

// UpdateManagerRole updates a venue manager's role.
func (h *VenueHandler) UpdateManagerRole(w http.ResponseWriter, r *http.Request) {
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

	targetUserID, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid user ID")
		return
	}

	// Only venue admins, creators, or platform admins can change roles
	canAdmin, err := h.venueService.CanAdminVenue(r.Context(), venueID, sess.UserID, sess.Role)
	if err != nil {
		HandleServiceError(w, err)
		return
	}
	if !canAdmin {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Only venue admins can manage managers")
		return
	}

	var body struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if err := h.venueService.UpdateVenueManagerRole(r.Context(), venueID, targetUserID, body.Role); err != nil {
		HandleServiceError(w, err)
		return
	}

	NoContent(w)
}

// ListMyVenues lists venues the authenticated user manages.
func (h *VenueHandler) ListMyVenues(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	venues, err := h.venueService.ListVenuesByManager(r.Context(), sess.UserID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, venues)
}
