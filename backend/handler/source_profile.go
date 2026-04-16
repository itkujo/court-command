package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// SourceProfileHandler handles Source Profile CRUD.
type SourceProfileHandler struct {
	service *service.SourceProfileService
}

// NewSourceProfileHandler creates a new SourceProfileHandler.
func NewSourceProfileHandler(service *service.SourceProfileService) *SourceProfileHandler {
	return &SourceProfileHandler{service: service}
}

// Routes returns the Chi routes for source profiles.
func (h *SourceProfileHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListMine)
	r.Post("/", h.Create)
	r.Post("/test", h.TestConnection)
	r.Get("/{profileID}", h.GetByID)
	r.Put("/{profileID}", h.Update)
	r.Delete("/{profileID}", h.Delete)
	r.Post("/{profileID}/deactivate", h.Deactivate)

	return r
}

// TestConnection handles POST /api/v1/source-profiles/test.
//
// Accepts a partial SourceProfileInput and returns discovery metadata
// (discovered_paths, sample_payload, status_code, error). Used by the
// Source Profile editor's Test Connection button before persisting.
func (h *SourceProfileHandler) TestConnection(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	var req struct {
		SourceType    string          `json:"source_type"`
		ApiURL        string          `json:"api_url"`
		WebhookSecret string          `json:"webhook_secret"`
		AuthType      string          `json:"auth_type"`
		AuthConfig    json.RawMessage `json:"auth_config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	result := h.service.TestConnection(r.Context(), service.TestConnectionInput{
		SourceType:    req.SourceType,
		APIURL:        req.ApiURL,
		WebhookSecret: req.WebhookSecret,
		AuthType:      req.AuthType,
		AuthConfig:    req.AuthConfig,
	})

	Success(w, result)
}

func (h *SourceProfileHandler) parseProfileID(r *http.Request) (int64, error) {
	return strconv.ParseInt(chi.URLParam(r, "profileID"), 10, 64)
}

// ListMine handles GET /api/v1/source-profiles
func (h *SourceProfileHandler) ListMine(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	profiles, err := h.service.ListByUser(r.Context(), sess.UserID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list source profiles")
		return
	}

	Success(w, service.ToSourceProfileResponses(profiles))
}

// Create handles POST /api/v1/source-profiles
func (h *SourceProfileHandler) Create(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	var req struct {
		Name                string          `json:"name"`
		SourceType          string          `json:"source_type"`
		ApiURL              *string         `json:"api_url"`
		WebhookSecret       *string         `json:"webhook_secret"`
		AuthType            string          `json:"auth_type"`
		AuthConfig          json.RawMessage `json:"auth_config"`
		PollIntervalSeconds *int32          `json:"poll_interval_seconds"`
		FieldMapping        json.RawMessage `json:"field_mapping"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	if req.Name == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELD", "name is required")
		return
	}

	params := generated.CreateSourceProfileParams{
		Name:            req.Name,
		CreatedByUserID: sess.UserID,
		SourceType:      req.SourceType,
		AuthType:        req.AuthType,
	}

	if params.SourceType == "" {
		params.SourceType = "court_command"
	}
	validSourceTypes := map[string]bool{"court_command": true, "rest_api": true, "webhook": true}
	if !validSourceTypes[params.SourceType] {
		WriteError(w, http.StatusBadRequest, "INVALID_FIELD", "source_type must be one of: court_command, rest_api, webhook")
		return
	}
	if params.AuthType == "" {
		params.AuthType = "none"
	}
	validAuthTypes := map[string]bool{"none": true, "api_key": true, "bearer": true, "basic": true}
	if !validAuthTypes[params.AuthType] {
		WriteError(w, http.StatusBadRequest, "INVALID_FIELD", "auth_type must be one of: none, api_key, bearer, basic")
		return
	}

	params.ApiUrl = req.ApiURL
	params.WebhookSecret = req.WebhookSecret

	if req.AuthConfig != nil {
		params.AuthConfig = req.AuthConfig
	} else {
		params.AuthConfig = []byte("{}")
	}
	if req.PollIntervalSeconds != nil {
		params.PollIntervalSeconds = pgtype.Int4{Int32: *req.PollIntervalSeconds, Valid: true}
	}
	if req.FieldMapping != nil {
		params.FieldMapping = req.FieldMapping
	} else {
		params.FieldMapping = []byte("{}")
	}

	profile, err := h.service.Create(r.Context(), params)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "CREATE_FAILED", err.Error())
		return
	}

	Created(w, service.ToSourceProfileResponse(profile))
}

// GetByID handles GET /api/v1/source-profiles/{profileID}
func (h *SourceProfileHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	profileID, err := h.parseProfileID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid profile ID")
		return
	}

	profile, err := h.service.GetByID(r.Context(), profileID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", "Source profile not found")
		return
	}

	// Ownership check — only the creator or platform admin can view
	if profile.CreatedByUserID != sess.UserID && sess.Role != "platform_admin" {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Access denied")
		return
	}

	Success(w, service.ToSourceProfileResponse(profile))
}

// Update handles PUT /api/v1/source-profiles/{profileID}
func (h *SourceProfileHandler) Update(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	profileID, err := h.parseProfileID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid profile ID")
		return
	}

	// Ownership check
	existing, err := h.service.GetByID(r.Context(), profileID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", "Source profile not found")
		return
	}
	if existing.CreatedByUserID != sess.UserID && sess.Role != "platform_admin" {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Access denied")
		return
	}

	var req struct {
		Name                string          `json:"name"`
		SourceType          string          `json:"source_type"`
		ApiURL              *string         `json:"api_url"`
		WebhookSecret       *string         `json:"webhook_secret"`
		AuthType            string          `json:"auth_type"`
		AuthConfig          json.RawMessage `json:"auth_config"`
		PollIntervalSeconds *int32          `json:"poll_interval_seconds"`
		FieldMapping        json.RawMessage `json:"field_mapping"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	params := generated.UpdateSourceProfileParams{
		ID:         profileID,
		Name:       req.Name,
		SourceType: req.SourceType,
		AuthType:   req.AuthType,
	}

	params.ApiUrl = req.ApiURL
	params.WebhookSecret = req.WebhookSecret

	if req.AuthConfig != nil {
		params.AuthConfig = req.AuthConfig
	} else {
		params.AuthConfig = []byte("{}")
	}
	if req.PollIntervalSeconds != nil {
		params.PollIntervalSeconds = pgtype.Int4{Int32: *req.PollIntervalSeconds, Valid: true}
	}
	if req.FieldMapping != nil {
		params.FieldMapping = req.FieldMapping
	} else {
		params.FieldMapping = []byte("{}")
	}

	profile, err := h.service.Update(r.Context(), params)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}

	Success(w, service.ToSourceProfileResponse(profile))
}

// Delete handles DELETE /api/v1/source-profiles/{profileID}
func (h *SourceProfileHandler) Delete(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	profileID, err := h.parseProfileID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid profile ID")
		return
	}

	// Ownership check
	existing, err := h.service.GetByID(r.Context(), profileID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", "Source profile not found")
		return
	}
	if existing.CreatedByUserID != sess.UserID && sess.Role != "platform_admin" {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Access denied")
		return
	}

	if err := h.service.Delete(r.Context(), profileID); err != nil {
		WriteError(w, http.StatusInternalServerError, "DELETE_FAILED", "Failed to delete source profile")
		return
	}

	Success(w, map[string]string{"status": "deleted"})
}

// Deactivate handles POST /api/v1/source-profiles/{profileID}/deactivate
func (h *SourceProfileHandler) Deactivate(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	profileID, err := h.parseProfileID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid profile ID")
		return
	}

	// Ownership check
	existing, err := h.service.GetByID(r.Context(), profileID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", "Source profile not found")
		return
	}
	if existing.CreatedByUserID != sess.UserID && sess.Role != "platform_admin" {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Access denied")
		return
	}

	profile, err := h.service.Deactivate(r.Context(), profileID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "DEACTIVATE_FAILED", "Failed to deactivate source profile")
		return
	}

	Success(w, service.ToSourceProfileResponse(profile))
}
