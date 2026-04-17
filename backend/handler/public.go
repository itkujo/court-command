// backend/handler/public.go
package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/db/generated"
)

// PublicHandler handles unauthenticated public directory endpoints.
type PublicHandler struct {
	queries *generated.Queries
}

// NewPublicHandler creates a new PublicHandler.
func NewPublicHandler(queries *generated.Queries) *PublicHandler {
	return &PublicHandler{queries: queries}
}

// Routes returns the Chi routes for public endpoints.
func (h *PublicHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Tournament directory
	r.Get("/tournaments", h.ListTournaments)
	r.Get("/tournaments/{slug}", h.GetTournamentBySlug)

	// League directory
	r.Get("/leagues", h.ListLeagues)
	r.Get("/leagues/{slug}", h.GetLeagueBySlug)

	// Venue directory
	r.Get("/venues", h.ListVenues)
	r.Get("/venues/{slug}", h.GetVenueBySlug)

	return r
}

// parseLimitOffset extracts limit and offset from query params with defaults.
func parseLimitOffset(r *http.Request, defaultLimit, maxLimit int32) (int32, int32) {
	limit, _ := strconv.ParseInt(r.URL.Query().Get("limit"), 10, 32)
	offset, _ := strconv.ParseInt(r.URL.Query().Get("offset"), 10, 32)

	if limit <= 0 || limit > int64(maxLimit) {
		limit = int64(defaultLimit)
	}
	if offset < 0 {
		offset = 0
	}

	return int32(limit), int32(offset)
}

// publicTournamentStatuses are the only statuses visible on the public directory.
var publicTournamentStatuses = map[string]bool{
	"published":           true,
	"registration_open":   true,
	"registration_closed": true,
	"in_progress":         true,
	"completed":           true,
}

// ListTournaments handles GET /api/v1/public/tournaments
// Filterable by status query param (only publicly visible statuses allowed).
func (h *PublicHandler) ListTournaments(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	limit, offset := parseLimitOffset(r, 20, 50)

	// If status provided, validate it's a public status
	if status != "" && !publicTournamentStatuses[status] {
		WriteError(w, http.StatusBadRequest, "INVALID_STATUS", "Invalid or non-public status filter")
		return
	}

	var tournaments []generated.Tournament
	var err error

	if status != "" {
		tournaments, err = h.queries.ListTournamentsByStatus(r.Context(), generated.ListTournamentsByStatusParams{
			Status: status,
			Limit:  limit,
			Offset: offset,
		})
	} else {
		// No filter: fetch all tournaments and keep only publicly visible ones.
		// Use a generous limit to compensate for post-filter reduction.
		all, fetchErr := h.queries.ListTournaments(r.Context(), generated.ListTournamentsParams{
			Limit:  limit + 50,
			Offset: offset,
		})
		err = fetchErr
		if err == nil {
			tournaments = make([]generated.Tournament, 0, len(all))
			for _, t := range all {
				if publicTournamentStatuses[t.Status] {
					tournaments = append(tournaments, t)
				}
			}
			// Respect the original limit after filtering
			if int32(len(tournaments)) > limit {
				tournaments = tournaments[:limit]
			}
		}
	}

	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list tournaments")
		return
	}

	if tournaments == nil {
		tournaments = []generated.Tournament{}
	}

	Success(w, tournaments)
}

// GetTournamentBySlug handles GET /api/v1/public/tournaments/{slug}
func (h *PublicHandler) GetTournamentBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	tournament, err := h.queries.GetTournamentBySlug(r.Context(), slug)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", "Tournament not found")
		return
	}

	// Only show non-draft tournaments publicly
	if tournament.Status == "draft" {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", "Tournament not found")
		return
	}

	Success(w, tournament)
}

// ListLeagues handles GET /api/v1/public/leagues
func (h *PublicHandler) ListLeagues(w http.ResponseWriter, r *http.Request) {
	limit, offset := parseLimitOffset(r, 20, 50)

	leagues, err := h.queries.ListLeagues(r.Context(), generated.ListLeaguesParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list leagues")
		return
	}

	if leagues == nil {
		leagues = []generated.League{}
	}

	Success(w, leagues)
}

// GetLeagueBySlug handles GET /api/v1/public/leagues/{slug}
func (h *PublicHandler) GetLeagueBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	league, err := h.queries.GetLeagueBySlug(r.Context(), slug)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", "League not found")
		return
	}

	if league.Status == "draft" {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", "League not found")
		return
	}

	Success(w, league)
}

// ListVenues handles GET /api/v1/public/venues
func (h *PublicHandler) ListVenues(w http.ResponseWriter, r *http.Request) {
	limit, offset := parseLimitOffset(r, 20, 50)

	// Only show published venues publicly
	published := "published"
	venues, err := h.queries.ListVenues(r.Context(), generated.ListVenuesParams{
		Limit:  limit,
		Offset: offset,
		Status: &published,
	})
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list venues")
		return
	}

	if venues == nil {
		venues = []generated.Venue{}
	}

	Success(w, venues)
}

// GetVenueBySlug handles GET /api/v1/public/venues/{slug}
func (h *PublicHandler) GetVenueBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	venue, err := h.queries.GetVenueBySlug(r.Context(), slug)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", "Venue not found")
		return
	}

	if venue.Status != "published" {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", "Venue not found")
		return
	}

	Success(w, venue)
}
