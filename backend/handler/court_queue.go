package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// CourtQueueHandler handles court queue HTTP requests.
type CourtQueueHandler struct {
	queueSvc *service.CourtQueueService
}

// NewCourtQueueHandler creates a new CourtQueueHandler.
func NewCourtQueueHandler(svc *service.CourtQueueService) *CourtQueueHandler {
	return &CourtQueueHandler{queueSvc: svc}
}

// Routes returns a chi.Router for court queue routes.
// Expected to be mounted under /courts/{courtID}/queue.
func (h *CourtQueueHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public: view queue
	r.Get("/", h.GetQueue)

	// Authenticated: manage queue
	r.Post("/", h.AssignMatch)
	r.Delete("/{matchID}", h.RemoveFromQueue)
	r.Put("/reorder", h.ReorderQueue)

	return r
}

// GetQueue returns the ordered match queue for a court.
// GET /courts/{courtID}/queue
func (h *CourtQueueHandler) GetQueue(w http.ResponseWriter, r *http.Request) {
	courtID, err := strconv.ParseInt(chi.URLParam(r, "courtID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	queue, err := h.queueSvc.GetQueue(r.Context(), courtID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, queue)
}

// AssignMatch assigns a match to this court's queue.
// POST /courts/{courtID}/queue
func (h *CourtQueueHandler) AssignMatch(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	courtID, err := strconv.ParseInt(chi.URLParam(r, "courtID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	var body struct {
		MatchID int64 `json:"match_id"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	if body.MatchID == 0 {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "match_id is required")
		return
	}

	match, err := h.queueSvc.AssignMatch(r.Context(), courtID, body.MatchID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, match)
}

// RemoveFromQueue removes a match from this court's queue.
// DELETE /courts/{courtID}/queue/{matchID}
func (h *CourtQueueHandler) RemoveFromQueue(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	courtID, err := strconv.ParseInt(chi.URLParam(r, "courtID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	matchID, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid match ID")
		return
	}

	if err := h.queueSvc.RemoveFromQueue(r.Context(), courtID, matchID); err != nil {
		HandleServiceError(w, err)
		return
	}

	NoContent(w)
}

// ReorderQueue updates the order of matches in this court's queue.
// PUT /courts/{courtID}/queue/reorder
func (h *CourtQueueHandler) ReorderQueue(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	courtID, err := strconv.ParseInt(chi.URLParam(r, "courtID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	var body struct {
		MatchIDs []int64 `json:"match_ids"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	if len(body.MatchIDs) == 0 {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "match_ids is required")
		return
	}

	if err := h.queueSvc.ReorderQueue(r.Context(), courtID, body.MatchIDs); err != nil {
		HandleServiceError(w, err)
		return
	}

	NoContent(w)
}
