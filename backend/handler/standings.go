package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// StandingsHandler handles standings HTTP requests.
type StandingsHandler struct {
	standingsSvc *service.StandingsService
}

// NewStandingsHandler creates a new StandingsHandler.
func NewStandingsHandler(svc *service.StandingsService) *StandingsHandler {
	return &StandingsHandler{standingsSvc: svc}
}

// Routes returns a chi.Router with all standings routes mounted.
func (h *StandingsHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public read endpoints
	r.Get("/seasons/{seasonID}", h.ListStandingsBySeason)
	r.Get("/seasons/{seasonID}/divisions/{divisionID}", h.ListStandings)
	r.Get("/seasons/{seasonID}/divisions/{divisionID}/teams/{teamID}", h.GetStandingsEntry)

	// Authenticated write endpoints
	r.Post("/seasons/{seasonID}/divisions/{divisionID}/recompute", h.RecomputeStandings)
	r.Put("/seasons/{seasonID}/divisions/{divisionID}/teams/{teamID}/override", h.UpdateOverride)
	r.Delete("/seasons/{seasonID}/divisions/{divisionID}/teams/{teamID}/override", h.ClearOverride)
	r.Post("/seasons/{seasonID}/divisions/{divisionID}/teams/{teamID}/withdraw", h.MarkWithdrawn)

	return r
}

// parseStandingsIDs extracts seasonID and divisionID from the URL.
func parseStandingsIDs(r *http.Request) (seasonID, divisionID int64, err error) {
	seasonID, err = strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil {
		return 0, 0, err
	}
	divisionID, err = strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		return 0, 0, err
	}
	return seasonID, divisionID, nil
}

// ListStandingsBySeason returns all standings entries for a season.
func (h *StandingsHandler) ListStandingsBySeason(w http.ResponseWriter, r *http.Request) {
	seasonID, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season ID")
		return
	}

	entries, err := h.standingsSvc.ListBySeason(r.Context(), seasonID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, entries)
}

// ListStandings returns standings for a division within a season.
func (h *StandingsHandler) ListStandings(w http.ResponseWriter, r *http.Request) {
	seasonID, divisionID, err := parseStandingsIDs(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season or division ID")
		return
	}

	limit, offset := parsePagination(r)

	entries, total, err := h.standingsSvc.ListByDivision(r.Context(), seasonID, divisionID, limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, entries, total, int(limit), int(offset))
}

// GetStandingsEntry returns a single standings entry.
func (h *StandingsHandler) GetStandingsEntry(w http.ResponseWriter, r *http.Request) {
	seasonID, divisionID, err := parseStandingsIDs(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season or division ID")
		return
	}

	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	entry, err := h.standingsSvc.GetEntry(r.Context(), seasonID, divisionID, teamID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, entry)
}

// RecomputeStandings triggers a full recompute of standings for a division.
// Requires platform_admin role.
func (h *StandingsHandler) RecomputeStandings(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}
	if sess.Role != "platform_admin" {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Admin access required")
		return
	}

	seasonID, divisionID, err := parseStandingsIDs(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season or division ID")
		return
	}

	entries, err := h.standingsSvc.RecomputeStandings(r.Context(), seasonID, divisionID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, entries)
}

// UpdateOverride sets an admin points override on a standings entry.
// Requires platform_admin role.
func (h *StandingsHandler) UpdateOverride(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}
	if sess.Role != "platform_admin" {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Admin access required")
		return
	}

	seasonID, divisionID, err := parseStandingsIDs(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season or division ID")
		return
	}

	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	var body struct {
		Points int32   `json:"points"`
		Reason *string `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	entry, err := h.standingsSvc.UpdateOverride(r.Context(), seasonID, divisionID, teamID, body.Points, body.Reason)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, entry)
}

// ClearOverride removes the admin points override from a standings entry.
// Requires platform_admin role.
func (h *StandingsHandler) ClearOverride(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}
	if sess.Role != "platform_admin" {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Admin access required")
		return
	}

	seasonID, divisionID, err := parseStandingsIDs(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season or division ID")
		return
	}

	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	entry, err := h.standingsSvc.ClearOverride(r.Context(), seasonID, divisionID, teamID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, entry)
}

// MarkWithdrawn marks a team as withdrawn in the standings.
// Requires platform_admin role.
func (h *StandingsHandler) MarkWithdrawn(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}
	if sess.Role != "platform_admin" {
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Admin access required")
		return
	}

	seasonID, divisionID, err := parseStandingsIDs(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season or division ID")
		return
	}

	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	entry, err := h.standingsSvc.MarkWithdrawn(r.Context(), seasonID, divisionID, teamID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, entry)
}
