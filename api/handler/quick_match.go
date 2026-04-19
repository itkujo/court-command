package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// QuickMatchHandler handles quick match HTTP requests.
type QuickMatchHandler struct {
	matchService *service.MatchService
}

// NewQuickMatchHandler creates a new QuickMatchHandler.
func NewQuickMatchHandler(matchService *service.MatchService) *QuickMatchHandler {
	return &QuickMatchHandler{matchService: matchService}
}

// Routes returns the quick match routes.
func (h *QuickMatchHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Post("/", h.Create)
	r.Get("/", h.List)

	return r
}

// Create creates a new quick match.
func (h *QuickMatchHandler) Create(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	var body service.QuickMatchInput
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		BadRequest(w, "invalid request body")
		return
	}

	resp, err := h.matchService.CreateQuickMatch(r.Context(), sess.UserID, body)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, resp)
}

// List returns the current user's quick matches.
func (h *QuickMatchHandler) List(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	limit, offset := parsePagination(r)

	results, err := h.matchService.ListQuickMatchesByUser(r.Context(), sess.UserID, limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, results)
}
