package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// MatchSeriesHandler handles match series HTTP requests.
type MatchSeriesHandler struct {
	seriesService *service.MatchSeriesService
}

// NewMatchSeriesHandler creates a new MatchSeriesHandler.
func NewMatchSeriesHandler(seriesService *service.MatchSeriesService) *MatchSeriesHandler {
	return &MatchSeriesHandler{seriesService: seriesService}
}

// Routes returns the match series routes.
func (h *MatchSeriesHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Post("/", h.Create)
	r.Get("/{seriesID}", h.Get)
	r.Get("/public/{publicID}", h.GetByPublicID)
	r.Post("/{seriesID}/start", h.Start)
	r.Post("/{seriesID}/record-result", h.RecordResult)
	r.Post("/{seriesID}/forfeit", h.Forfeit)
	r.Post("/{seriesID}/cancel", h.Cancel)
	r.Post("/{seriesID}/matches", h.CreateChildMatch)

	return r
}

// DivisionRoutes returns routes scoped to a division.
func (h *MatchSeriesHandler) DivisionRoutes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListByDivision)

	return r
}

// Create creates a new match series.
func (h *MatchSeriesHandler) Create(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	var body service.CreateSeriesInput
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		BadRequest(w, "invalid request body")
		return
	}

	resp, err := h.seriesService.Create(r.Context(), sess.UserID, body)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, resp)
}

// Get returns a match series by ID.
func (h *MatchSeriesHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "seriesID"), 10, 64)
	if err != nil {
		BadRequest(w, "invalid series ID")
		return
	}

	resp, err := h.seriesService.Get(r.Context(), id)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, resp)
}

// GetByPublicID returns a match series by public ID.
func (h *MatchSeriesHandler) GetByPublicID(w http.ResponseWriter, r *http.Request) {
	publicID := chi.URLParam(r, "publicID")

	resp, err := h.seriesService.GetByPublicID(r.Context(), publicID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, resp)
}

// ListByDivision returns paginated match series for a division.
func (h *MatchSeriesHandler) ListByDivision(w http.ResponseWriter, r *http.Request) {
	divisionID, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		BadRequest(w, "invalid division ID")
		return
	}

	limit, offset := parsePagination(r)

	results, total, err := h.seriesService.ListByDivision(r.Context(), divisionID, limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, results, total, int(limit), int(offset))
}

// Start starts a match series.
func (h *MatchSeriesHandler) Start(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "seriesID"), 10, 64)
	if err != nil {
		BadRequest(w, "invalid series ID")
		return
	}

	resp, err := h.seriesService.StartSeries(r.Context(), id, sess.UserID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, resp)
}

// RecordResult records the result of a child match.
func (h *MatchSeriesHandler) RecordResult(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	seriesID, err := strconv.ParseInt(chi.URLParam(r, "seriesID"), 10, 64)
	if err != nil {
		BadRequest(w, "invalid series ID")
		return
	}

	var body struct {
		MatchID      int64 `json:"match_id"`
		WinnerTeamID int64 `json:"winner_team_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		BadRequest(w, "invalid request body")
		return
	}

	resp, err := h.seriesService.RecordMatchResult(r.Context(), seriesID, body.MatchID, body.WinnerTeamID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, resp)
}

// Forfeit forfeits a series.
func (h *MatchSeriesHandler) Forfeit(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	seriesID, err := strconv.ParseInt(chi.URLParam(r, "seriesID"), 10, 64)
	if err != nil {
		BadRequest(w, "invalid series ID")
		return
	}

	var body struct {
		ForfeitingTeamID int64 `json:"forfeiting_team_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		BadRequest(w, "invalid request body")
		return
	}

	resp, err := h.seriesService.ForfeitSeries(r.Context(), seriesID, body.ForfeitingTeamID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, resp)
}

// Cancel cancels a series.
func (h *MatchSeriesHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	seriesID, err := strconv.ParseInt(chi.URLParam(r, "seriesID"), 10, 64)
	if err != nil {
		BadRequest(w, "invalid series ID")
		return
	}

	resp, err := h.seriesService.CancelSeries(r.Context(), seriesID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, resp)
}

// CreateChildMatch creates a child match in a series.
func (h *MatchSeriesHandler) CreateChildMatch(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	seriesID, err := strconv.ParseInt(chi.URLParam(r, "seriesID"), 10, 64)
	if err != nil {
		BadRequest(w, "invalid series ID")
		return
	}

	var body service.CreateSeriesInput
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		BadRequest(w, "invalid request body")
		return
	}

	resp, err := h.seriesService.CreateChildMatch(r.Context(), seriesID, sess.UserID, body)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, resp)
}
