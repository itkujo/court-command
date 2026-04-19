package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// BracketHandler handles bracket generation HTTP requests.
type BracketHandler struct {
	bracketSvc *service.BracketService
}

// NewBracketHandler creates a new BracketHandler.
func NewBracketHandler(svc *service.BracketService) *BracketHandler {
	return &BracketHandler{bracketSvc: svc}
}

// Routes returns a chi.Router for bracket routes.
// Expected to be mounted under /divisions/{divisionID}/bracket.
func (h *BracketHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Post("/generate", h.GenerateBracket)
	return r
}

// GenerateBracket generates a bracket for a division.
// POST /divisions/{divisionID}/bracket/generate
func (h *BracketHandler) GenerateBracket(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	divisionID, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	result, err := h.bracketSvc.GenerateBracket(r.Context(), divisionID, sess.UserID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, result)
}
