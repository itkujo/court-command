package handler

import (
	"encoding/json"
	"net/http"

	"github.com/court-command/court-command/service"
)

// SettingsHandler handles site settings API endpoints.
type SettingsHandler struct {
	svc *service.SettingsService
}

// NewSettingsHandler creates a new SettingsHandler.
func NewSettingsHandler(svc *service.SettingsService) *SettingsHandler {
	return &SettingsHandler{svc: svc}
}

// GetAll returns all settings (admin only).
func (h *SettingsHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	settings, err := h.svc.GetAll(r.Context())
	if err != nil {
		InternalError(w, "failed to load settings")
		return
	}
	Success(w, map[string]any{"settings": settings})
}

// Update updates one or more settings (admin only).
func (h *SettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	var body map[string]string
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		BadRequest(w, "invalid request body")
		return
	}
	if len(body) == 0 {
		BadRequest(w, "no settings to update")
		return
	}

	if err := h.svc.Update(r.Context(), body); err != nil {
		HandleServiceError(w, err)
		return
	}

	// Return updated settings
	settings, err := h.svc.GetAll(r.Context())
	if err != nil {
		InternalError(w, "failed to load settings after update")
		return
	}
	Success(w, map[string]any{"settings": settings})
}

// GetGhostConfig returns Ghost-related settings (public, no auth).
func (h *SettingsHandler) GetGhostConfig(w http.ResponseWriter, r *http.Request) {
	config, err := h.svc.GetGhostConfig(r.Context())
	if err != nil {
		InternalError(w, "failed to load ghost config")
		return
	}
	Success(w, config)
}

// GetGoogleMapsConfig returns the Google Maps API key (public, no auth).
func (h *SettingsHandler) GetGoogleMapsConfig(w http.ResponseWriter, r *http.Request) {
	config, err := h.svc.GetGoogleMapsConfig(r.Context())
	if err != nil {
		InternalError(w, "failed to load google maps config")
		return
	}
	Success(w, config)
}
