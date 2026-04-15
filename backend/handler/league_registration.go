// backend/handler/league_registration.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/session"
)

// LeagueRegistrationHandler handles league registration HTTP requests.
// Uses *generated.Queries directly (no service layer).
type LeagueRegistrationHandler struct {
	queries *generated.Queries
}

// NewLeagueRegistrationHandler creates a new LeagueRegistrationHandler.
func NewLeagueRegistrationHandler(queries *generated.Queries) *LeagueRegistrationHandler {
	return &LeagueRegistrationHandler{queries: queries}
}

// LeagueRegistrationResponse is the public representation of a league registration.
type LeagueRegistrationResponse struct {
	ID           int64   `json:"id"`
	LeagueID     int64   `json:"league_id"`
	OrgID        int64   `json:"org_id"`
	Status       string  `json:"status"`
	RegisteredAt string  `json:"registered_at"`
	ApprovedAt   *string `json:"approved_at,omitempty"`
	Notes        *string `json:"notes,omitempty"`
}

func toLeagueRegistrationResponse(lr generated.LeagueRegistration) LeagueRegistrationResponse {
	resp := LeagueRegistrationResponse{
		ID:           lr.ID,
		LeagueID:     lr.LeagueID,
		OrgID:        lr.OrgID,
		Status:       lr.Status,
		RegisteredAt: lr.RegisteredAt.Format(time.RFC3339),
		Notes:        lr.Notes,
	}

	if lr.ApprovedAt.Valid {
		s := lr.ApprovedAt.Time.Format(time.RFC3339)
		resp.ApprovedAt = &s
	}

	return resp
}

// Routes returns a chi.Router with all league registration routes mounted.
// Expects to be mounted under /leagues/{leagueID}/registrations.
func (h *LeagueRegistrationHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListRegistrations)
	r.Get("/{registrationID}", h.GetRegistration)
	r.Post("/", h.CreateRegistration)
	r.Patch("/{registrationID}/status", h.UpdateStatus)

	return r
}

// CreateRegistration creates a new league registration.
func (h *LeagueRegistrationHandler) CreateRegistration(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	leagueID, err := parseLeagueID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	var body struct {
		OrgID int64   `json:"org_id"`
		Notes *string `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.OrgID == 0 {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "org_id is required")
		return
	}

	params := generated.CreateLeagueRegistrationParams{
		LeagueID: leagueID,
		OrgID:    body.OrgID,
		Status:   "pending",
		Notes:    body.Notes,
	}

	lr, err := h.queries.CreateLeagueRegistration(r.Context(), params)
	if err != nil {
		InternalError(w, "failed to create league registration")
		return
	}

	Created(w, toLeagueRegistrationResponse(lr))
}

// GetRegistration retrieves a league registration by ID.
func (h *LeagueRegistrationHandler) GetRegistration(w http.ResponseWriter, r *http.Request) {
	regID, err := strconv.ParseInt(chi.URLParam(r, "registrationID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid registration ID")
		return
	}

	lr, err := h.queries.GetLeagueRegistrationByID(r.Context(), regID)
	if err != nil {
		NotFound(w, "league registration not found")
		return
	}

	Success(w, toLeagueRegistrationResponse(lr))
}

// ListRegistrations lists league registrations for a league.
func (h *LeagueRegistrationHandler) ListRegistrations(w http.ResponseWriter, r *http.Request) {
	leagueID, err := parseLeagueID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	limit, offset := parsePagination(r)

	regs, err := h.queries.ListLeagueRegistrationsByLeague(r.Context(), generated.ListLeagueRegistrationsByLeagueParams{
		LeagueID: leagueID,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		InternalError(w, "failed to list league registrations")
		return
	}

	count, err := h.queries.CountLeagueRegistrationsByLeague(r.Context(), leagueID)
	if err != nil {
		InternalError(w, "failed to count league registrations")
		return
	}

	result := make([]LeagueRegistrationResponse, len(regs))
	for i, lr := range regs {
		result[i] = toLeagueRegistrationResponse(lr)
	}

	Paginated(w, result, count, int(limit), int(offset))
}

// UpdateStatus updates a league registration's status.
func (h *LeagueRegistrationHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	regID, err := strconv.ParseInt(chi.URLParam(r, "registrationID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid registration ID")
		return
	}

	var body struct {
		Status string `json:"status"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.Status == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "status is required")
		return
	}

	lr, err := h.queries.UpdateLeagueRegistrationStatus(r.Context(), generated.UpdateLeagueRegistrationStatusParams{
		ID:     regID,
		Status: body.Status,
	})
	if err != nil {
		NotFound(w, "league registration not found")
		return
	}

	Success(w, toLeagueRegistrationResponse(lr))
}
