// api/handler/season.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// SeasonHandler handles season HTTP requests.
type SeasonHandler struct {
	seasonSvc *service.SeasonService
}

// NewSeasonHandler creates a new SeasonHandler.
func NewSeasonHandler(svc *service.SeasonService) *SeasonHandler {
	return &SeasonHandler{seasonSvc: svc}
}

// Routes returns a chi.Router with all season routes mounted.
// Expects to be mounted under /leagues/{leagueID}/seasons.
func (h *SeasonHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public routes
	r.Get("/", h.ListSeasons)
	r.Get("/{seasonID}", h.GetSeason)
	r.Get("/by-slug/{slug}", h.GetSeasonBySlug)

	// Authenticated routes
	r.Post("/", h.CreateSeason)
	r.Patch("/{seasonID}", h.UpdateSeason)
	r.Delete("/{seasonID}", h.DeleteSeason)
	r.Patch("/{seasonID}/status", h.UpdateSeasonStatus)

	return r
}

// parseLeagueID extracts the leagueID from the URL.
func parseLeagueID(r *http.Request) (int64, error) {
	return strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
}

// CreateSeason creates a new season.
func (h *SeasonHandler) CreateSeason(w http.ResponseWriter, r *http.Request) {
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
		Name            string  `json:"name"`
		StartDate       *string `json:"start_date"`
		EndDate         *string `json:"end_date"`
		Description     *string `json:"description"`
		Notes           *string `json:"notes"`
		StandingsMethod *string `json:"standings_method"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.CreateSeasonParams{
		Name:            body.Name,
		LeagueID:        leagueID,
		Description:     body.Description,
		Notes:           body.Notes,
		StandingsMethod: body.StandingsMethod,
	}

	if body.StartDate != nil {
		d, err := time.Parse("2006-01-02", *body.StartDate)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "INVALID_DATE", "start_date must be YYYY-MM-DD")
			return
		}
		params.StartDate = pgtype.Date{Time: d, Valid: true}
	}
	if body.EndDate != nil {
		d, err := time.Parse("2006-01-02", *body.EndDate)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "INVALID_DATE", "end_date must be YYYY-MM-DD")
			return
		}
		params.EndDate = pgtype.Date{Time: d, Valid: true}
	}

	seasonResp, err := h.seasonSvc.Create(r.Context(), params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, seasonResp)
}

// GetSeason retrieves a season by ID.
func (h *SeasonHandler) GetSeason(w http.ResponseWriter, r *http.Request) {
	seasonID, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season ID")
		return
	}

	seasonResp, err := h.seasonSvc.GetByID(r.Context(), seasonID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, seasonResp)
}

// GetSeasonBySlug retrieves a season by league-scoped slug.
func (h *SeasonHandler) GetSeasonBySlug(w http.ResponseWriter, r *http.Request) {
	leagueID, err := parseLeagueID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	slug := chi.URLParam(r, "slug")

	seasonResp, err := h.seasonSvc.GetBySlug(r.Context(), leagueID, slug)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, seasonResp)
}

// ListSeasons lists seasons for a league.
func (h *SeasonHandler) ListSeasons(w http.ResponseWriter, r *http.Request) {
	leagueID, err := parseLeagueID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	limit, offset := parsePagination(r)

	seasons, total, err := h.seasonSvc.ListByLeague(r.Context(), leagueID, limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, seasons, total, int(limit), int(offset))
}

// UpdateSeason updates a season.
func (h *SeasonHandler) UpdateSeason(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	seasonID, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season ID")
		return
	}

	var body struct {
		Name            *string `json:"name"`
		StartDate       *string `json:"start_date"`
		EndDate         *string `json:"end_date"`
		Description     *string `json:"description"`
		Notes           *string `json:"notes"`
		StandingsMethod *string `json:"standings_method"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.UpdateSeasonParams{
		Name:            body.Name,
		Description:     body.Description,
		Notes:           body.Notes,
		StandingsMethod: body.StandingsMethod,
	}

	if body.StartDate != nil {
		d, err := time.Parse("2006-01-02", *body.StartDate)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "INVALID_DATE", "start_date must be YYYY-MM-DD")
			return
		}
		params.StartDate = pgtype.Date{Time: d, Valid: true}
	}
	if body.EndDate != nil {
		d, err := time.Parse("2006-01-02", *body.EndDate)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "INVALID_DATE", "end_date must be YYYY-MM-DD")
			return
		}
		params.EndDate = pgtype.Date{Time: d, Valid: true}
	}

	seasonResp, err := h.seasonSvc.Update(r.Context(), seasonID, params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, seasonResp)
}

// DeleteSeason soft-deletes a season.
func (h *SeasonHandler) DeleteSeason(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	seasonID, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season ID")
		return
	}

	if err := h.seasonSvc.Delete(r.Context(), seasonID); err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, map[string]string{"message": "season deleted"})
}

// UpdateSeasonStatus transitions a season to a new status.
func (h *SeasonHandler) UpdateSeasonStatus(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	seasonID, err := strconv.ParseInt(chi.URLParam(r, "seasonID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid season ID")
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

	seasonResp, err := h.seasonSvc.UpdateStatus(r.Context(), seasonID, body.Status)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, seasonResp)
}
