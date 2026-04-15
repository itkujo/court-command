// backend/handler/search.go
package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/service"
)

// SearchHandler handles global search requests.
type SearchHandler struct {
	searchSvc *service.SearchService
}

// NewSearchHandler creates a new SearchHandler.
func NewSearchHandler(svc *service.SearchService) *SearchHandler {
	return &SearchHandler{searchSvc: svc}
}

// Routes returns the Chi routes for search.
func (h *SearchHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.Search)
	return r
}

// Search handles GET /api/v1/search?q={query}
func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_QUERY", "q parameter is required")
		return
	}

	if len(query) < 2 {
		WriteError(w, http.StatusBadRequest, "QUERY_TOO_SHORT", "Query must be at least 2 characters")
		return
	}

	results, err := h.searchSvc.Search(r.Context(), query)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "SEARCH_FAILED", "Search failed")
		return
	}

	Success(w, results)
}
