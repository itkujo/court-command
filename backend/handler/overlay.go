package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/overlay"
	"github.com/court-command/court-command/service"
	"github.com/go-chi/chi/v5"
)

// OverlayHandler handles overlay-related HTTP requests.
type OverlayHandler struct {
	overlayService       *service.OverlayService
	sourceProfileService *service.SourceProfileService
}

// NewOverlayHandler creates a new OverlayHandler.
func NewOverlayHandler(overlayService *service.OverlayService, sourceProfileService *service.SourceProfileService) *OverlayHandler {
	return &OverlayHandler{
		overlayService:       overlayService,
		sourceProfileService: sourceProfileService,
	}
}

func (h *OverlayHandler) parseCourtID(r *http.Request) (int64, error) {
	return strconv.ParseInt(chi.URLParam(r, "courtID"), 10, 64)
}

// GetOverlayData handles GET /api/v1/overlay/court/{courtID}/data
// Public endpoint (token-validated if configured).
func (h *OverlayHandler) GetOverlayData(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	// Validate overlay token if present
	token := r.URL.Query().Get("token")
	if err := h.overlayService.ValidateToken(r.Context(), courtID, token); err != nil {
		WriteError(w, http.StatusForbidden, "INVALID_TOKEN", err.Error())
		return
	}

	useDemoData := r.URL.Query().Get("demo") == "true"

	data, err := h.overlayService.GetOverlayData(r.Context(), courtID, useDemoData)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "RESOLVE_FAILED", err.Error())
		return
	}

	Success(w, data)
}

// GetConfig handles GET /api/v1/overlay/court/{courtID}/config
func (h *OverlayHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	config, err := h.overlayService.GetOrCreateConfig(r.Context(), courtID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "GET_FAILED", err.Error())
		return
	}

	Success(w, config)
}

// UpdateTheme handles PUT /api/v1/overlay/court/{courtID}/config/theme
func (h *OverlayHandler) UpdateTheme(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	var req struct {
		ThemeID        string          `json:"theme_id"`
		ColorOverrides json.RawMessage `json:"color_overrides"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	if req.ThemeID == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELD", "theme_id is required")
		return
	}

	config, err := h.overlayService.UpdateTheme(r.Context(), courtID, req.ThemeID, req.ColorOverrides)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}

	Success(w, config)
}

// UpdateElements handles PUT /api/v1/overlay/court/{courtID}/config/elements
func (h *OverlayHandler) UpdateElements(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	var req struct {
		Elements json.RawMessage `json:"elements"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	config, err := h.overlayService.UpdateElements(r.Context(), courtID, req.Elements)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}

	Success(w, config)
}

// GenerateToken handles POST /api/v1/overlay/court/{courtID}/config/token/generate
func (h *OverlayHandler) GenerateToken(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	config, err := h.overlayService.GenerateToken(r.Context(), courtID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "TOKEN_FAILED", err.Error())
		return
	}

	Success(w, config)
}

// RevokeToken handles DELETE /api/v1/overlay/court/{courtID}/config/token
func (h *OverlayHandler) RevokeToken(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	config, err := h.overlayService.RevokeToken(r.Context(), courtID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "REVOKE_FAILED", err.Error())
		return
	}

	Success(w, config)
}

// SetSourceProfile handles PUT /api/v1/overlay/court/{courtID}/config/source-profile
func (h *OverlayHandler) SetSourceProfile(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	var req struct {
		SourceProfileID *int64 `json:"source_profile_id"` // null to clear
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body")
		return
	}

	config, err := h.overlayService.SetSourceProfile(r.Context(), courtID, req.SourceProfileID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}

	Success(w, config)
}

// ListThemes handles GET /api/v1/overlay/themes
func (h *OverlayHandler) ListThemes(w http.ResponseWriter, r *http.Request) {
	Success(w, overlay.AllThemes)
}

// GetTheme handles GET /api/v1/overlay/themes/{themeID}
func (h *OverlayHandler) GetTheme(w http.ResponseWriter, r *http.Request) {
	themeID := chi.URLParam(r, "themeID")
	theme := overlay.GetTheme(themeID)
	Success(w, theme)
}

// GetDemoData handles GET /api/v1/overlay/demo-data
func (h *OverlayHandler) GetDemoData(w http.ResponseWriter, r *http.Request) {
	Success(w, overlay.DemoData())
}

// ReceiveWebhook handles POST /api/v1/overlay/webhook/{courtID}
func (h *OverlayHandler) ReceiveWebhook(w http.ResponseWriter, r *http.Request) {
	courtID, err := h.parseCourtID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	// Get overlay config to find source profile
	config, err := h.overlayService.GetOrCreateConfig(r.Context(), courtID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "CONFIG_ERROR", "Failed to get overlay config")
		return
	}

	if !config.SourceProfileID.Valid {
		WriteError(w, http.StatusBadRequest, "NO_SOURCE", "No source profile configured for this court")
		return
	}

	// Get source profile for webhook secret and field mapping
	profile, err := h.sourceProfileService.GetByID(r.Context(), config.SourceProfileID.Int64)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "PROFILE_ERROR", "Source profile not found")
		return
	}

	if profile.SourceType != "webhook" {
		WriteError(w, http.StatusBadRequest, "WRONG_TYPE", "Source profile is not configured for webhooks")
		return
	}

	// Read and validate webhook body
	body, err := overlay.ReadWebhookBody(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "READ_FAILED", "Failed to read webhook body")
		return
	}

	// Validate signature
	signature := r.Header.Get("X-Webhook-Signature")
	webhookSecret := ""
	if profile.WebhookSecret != nil {
		webhookSecret = *profile.WebhookSecret
	}
	if err := overlay.ValidateWebhookSignature(body, signature, webhookSecret); err != nil {
		WriteError(w, http.StatusForbidden, "INVALID_SIGNATURE", err.Error())
		return
	}

	// Apply field mapping to transform external data into canonical format
	overlayData, err := overlay.ApplyFieldMapping(json.RawMessage(body), profile.FieldMapping)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "MAPPING_FAILED", err.Error())
		return
	}

	// Broadcast the transformed data to the overlay WS channel
	h.overlayService.BroadcastOverlayData(r.Context(), courtID, overlayData)

	Success(w, map[string]string{"status": "accepted"})
}
