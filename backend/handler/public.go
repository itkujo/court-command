// backend/handler/public.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/service"
)

// rawOrEmptyObj converts a []byte JSONB value to json.RawMessage, defaulting to "{}".
func rawOrEmptyObj(b []byte) json.RawMessage {
	if len(b) > 0 {
		return json.RawMessage(b)
	}
	return json.RawMessage("{}")
}

// rawOrEmptyArr converts a []byte JSONB value to json.RawMessage, defaulting to "[]".
func rawOrEmptyArr(b []byte) json.RawMessage {
	if len(b) > 0 {
		return json.RawMessage(b)
	}
	return json.RawMessage("[]")
}

// publicTournament wraps generated.Tournament with properly serialized JSONB fields.
type publicTournament struct {
	generated.Tournament
	SocialLinks json.RawMessage `json:"social_links"`
	SponsorInfo json.RawMessage `json:"sponsor_info"`
}

func toPublicTournament(t generated.Tournament) publicTournament {
	return publicTournament{
		Tournament:  t,
		SocialLinks: rawOrEmptyObj(t.SocialLinks),
		SponsorInfo: rawOrEmptyArr(t.SponsorInfo),
	}
}

func toPublicTournaments(ts []generated.Tournament) []publicTournament {
	result := make([]publicTournament, len(ts))
	for i, t := range ts {
		result[i] = toPublicTournament(t)
	}
	return result
}

// publicLeague wraps generated.League with properly serialized JSONB fields.
type publicLeague struct {
	generated.League
	SocialLinks json.RawMessage `json:"social_links"`
	SponsorInfo json.RawMessage `json:"sponsor_info"`
}

func toPublicLeague(l generated.League) publicLeague {
	return publicLeague{
		League:      l,
		SocialLinks: rawOrEmptyObj(l.SocialLinks),
		SponsorInfo: rawOrEmptyArr(l.SponsorInfo),
	}
}

func toPublicLeagues(ls []generated.League) []publicLeague {
	result := make([]publicLeague, len(ls))
	for i, l := range ls {
		result[i] = toPublicLeague(l)
	}
	return result
}

// publicVenue wraps generated.Venue with properly serialized JSONB fields.
type publicVenue struct {
	generated.Venue
	SurfaceTypes json.RawMessage `json:"surface_types"`
	Amenities    json.RawMessage `json:"amenities"`
}

func toPublicVenue(v generated.Venue) publicVenue {
	return publicVenue{
		Venue:        v,
		SurfaceTypes: rawOrEmptyArr(v.SurfaceTypes),
		Amenities:    rawOrEmptyArr(v.Amenities),
	}
}

func toPublicVenues(vs []generated.Venue) []publicVenue {
	result := make([]publicVenue, len(vs))
	for i, v := range vs {
		result[i] = toPublicVenue(v)
	}
	return result
}

// PublicHandler handles unauthenticated public directory endpoints.
type PublicHandler struct {
	queries     *generated.Queries
	matchSvc    *service.MatchService
	divisionSvc *service.DivisionService
	venueSvc    *service.VenueService
	seasonSvc   *service.SeasonService
	tournSvc    *service.TournamentService
}

// NewPublicHandler creates a new PublicHandler.
func NewPublicHandler(queries *generated.Queries) *PublicHandler {
	return &PublicHandler{queries: queries}
}

// SetMatchService injects the MatchService for live match endpoints.
func (h *PublicHandler) SetMatchService(svc *service.MatchService) {
	h.matchSvc = svc
}

// SetDivisionService injects the DivisionService for tournament division endpoints.
func (h *PublicHandler) SetDivisionService(svc *service.DivisionService) {
	h.divisionSvc = svc
}

// SetVenueService injects the VenueService for court endpoints.
func (h *PublicHandler) SetVenueService(svc *service.VenueService) {
	h.venueSvc = svc
}

// SetSeasonService injects the SeasonService for league season endpoints.
func (h *PublicHandler) SetSeasonService(svc *service.SeasonService) {
	h.seasonSvc = svc
}

// SetTournamentService injects the TournamentService for league tournament endpoints.
func (h *PublicHandler) SetTournamentService(svc *service.TournamentService) {
	h.tournSvc = svc
}

// Routes returns the Chi routes for public endpoints.
func (h *PublicHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Tournament directory
	r.Get("/tournaments", h.ListTournaments)
	r.Get("/tournaments/{slug}", h.GetTournamentBySlug)
	r.Get("/tournaments/{slug}/divisions", h.ListTournamentDivisions)
	r.Get("/tournaments/{slug}/matches", h.ListTournamentMatches)
	r.Get("/tournaments/{slug}/courts", h.ListTournamentCourts)

	// League directory
	r.Get("/leagues", h.ListLeagues)
	r.Get("/leagues/{slug}", h.GetLeagueBySlug)
	r.Get("/leagues/{slug}/seasons", h.ListLeagueSeasons)
	r.Get("/leagues/{slug}/tournaments", h.ListLeagueTournaments)

	// Venue directory
	r.Get("/venues", h.ListVenues)
	r.Get("/venues/{slug}", h.GetVenueBySlug)
	r.Get("/venues/{slug}/courts", h.ListVenueCourts)

	// Live matches
	r.Get("/live", h.ListLiveMatches)

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

	total, _ := h.queries.CountTournaments(r.Context())
	Paginated(w, toPublicTournaments(tournaments), total, int(limit), int(offset))
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

	Success(w, toPublicTournament(tournament))
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

	total, _ := h.queries.CountLeagues(r.Context())
	Paginated(w, toPublicLeagues(leagues), total, int(limit), int(offset))
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

	Success(w, toPublicLeague(league))
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

	total, _ := h.queries.CountVenues(r.Context(), &published)
	Paginated(w, toPublicVenues(venues), total, int(limit), int(offset))
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

	Success(w, toPublicVenue(venue))
}

// ListLiveMatches handles GET /api/v1/public/live
// Returns all currently active matches (warmup, in_progress, paused) with enriched data.
func (h *PublicHandler) ListLiveMatches(w http.ResponseWriter, r *http.Request) {
	if h.matchSvc == nil {
		WriteError(w, http.StatusInternalServerError, "NOT_CONFIGURED", "Live matches not available")
		return
	}

	limit, offset := parseLimitOffset(r, 50, 100)

	matches, total, err := h.matchSvc.ListLive(r.Context(), limit, offset)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list live matches")
		return
	}

	Paginated(w, matches, total, int(limit), int(offset))
}

// --- Tournament sub-resources ---

// resolveTournamentBySlug looks up a tournament by slug and validates it's publicly visible.
func (h *PublicHandler) resolveTournamentBySlug(w http.ResponseWriter, r *http.Request) (generated.Tournament, bool) {
	slug := chi.URLParam(r, "slug")
	tournament, err := h.queries.GetTournamentBySlug(r.Context(), slug)
	if err != nil || tournament.Status == "draft" {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", "Tournament not found")
		return generated.Tournament{}, false
	}
	return tournament, true
}

// ListTournamentDivisions handles GET /api/v1/public/tournaments/{slug}/divisions
func (h *PublicHandler) ListTournamentDivisions(w http.ResponseWriter, r *http.Request) {
	if h.divisionSvc == nil {
		WriteError(w, http.StatusInternalServerError, "NOT_CONFIGURED", "Divisions not available")
		return
	}

	tournament, ok := h.resolveTournamentBySlug(w, r)
	if !ok {
		return
	}

	divisions, count, err := h.divisionSvc.ListByTournament(r.Context(), tournament.ID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list divisions")
		return
	}

	Paginated(w, divisions, count, int(count), 0)
}

// ListTournamentMatches handles GET /api/v1/public/tournaments/{slug}/matches
func (h *PublicHandler) ListTournamentMatches(w http.ResponseWriter, r *http.Request) {
	if h.matchSvc == nil {
		WriteError(w, http.StatusInternalServerError, "NOT_CONFIGURED", "Matches not available")
		return
	}

	tournament, ok := h.resolveTournamentBySlug(w, r)
	if !ok {
		return
	}

	limit, offset := parseLimitOffset(r, 50, 200)

	matches, err := h.matchSvc.ListByTournament(r.Context(), tournament.ID, limit, offset)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list matches")
		return
	}

	// ListByTournament doesn't return a total count; use slice length as total
	Paginated(w, matches, int64(len(matches)), int(limit), int(offset))
}

// ListTournamentCourts handles GET /api/v1/public/tournaments/{slug}/courts
func (h *PublicHandler) ListTournamentCourts(w http.ResponseWriter, r *http.Request) {
	if h.venueSvc == nil {
		WriteError(w, http.StatusInternalServerError, "NOT_CONFIGURED", "Courts not available")
		return
	}

	tournament, ok := h.resolveTournamentBySlug(w, r)
	if !ok {
		return
	}

	courts, err := h.venueSvc.ListCourtsByTournament(r.Context(), tournament.ID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list courts")
		return
	}

	Success(w, courts)
}

// --- League sub-resources ---

// resolveLeagueBySlug looks up a league by slug and validates it's publicly visible.
func (h *PublicHandler) resolveLeagueBySlug(w http.ResponseWriter, r *http.Request) (generated.League, bool) {
	slug := chi.URLParam(r, "slug")
	league, err := h.queries.GetLeagueBySlug(r.Context(), slug)
	if err != nil || league.Status == "draft" {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", "League not found")
		return generated.League{}, false
	}
	return league, true
}

// ListLeagueSeasons handles GET /api/v1/public/leagues/{slug}/seasons
func (h *PublicHandler) ListLeagueSeasons(w http.ResponseWriter, r *http.Request) {
	if h.seasonSvc == nil {
		WriteError(w, http.StatusInternalServerError, "NOT_CONFIGURED", "Seasons not available")
		return
	}

	league, ok := h.resolveLeagueBySlug(w, r)
	if !ok {
		return
	}

	limit, offset := parseLimitOffset(r, 20, 50)

	seasons, total, err := h.seasonSvc.ListByLeague(r.Context(), league.ID, limit, offset)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list seasons")
		return
	}

	Paginated(w, seasons, total, int(limit), int(offset))
}

// ListLeagueTournaments handles GET /api/v1/public/leagues/{slug}/tournaments
func (h *PublicHandler) ListLeagueTournaments(w http.ResponseWriter, r *http.Request) {
	if h.tournSvc == nil {
		WriteError(w, http.StatusInternalServerError, "NOT_CONFIGURED", "Tournaments not available")
		return
	}

	league, ok := h.resolveLeagueBySlug(w, r)
	if !ok {
		return
	}

	limit, offset := parseLimitOffset(r, 20, 50)

	tournaments, total, err := h.tournSvc.ListByLeague(r.Context(), league.ID, limit, offset)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list tournaments")
		return
	}

	Paginated(w, tournaments, total, int(limit), int(offset))
}

// --- Venue sub-resources ---

// resolveVenueBySlug looks up a venue by slug and validates it's published.
func (h *PublicHandler) resolveVenueBySlug(w http.ResponseWriter, r *http.Request) (generated.Venue, bool) {
	slug := chi.URLParam(r, "slug")
	venue, err := h.queries.GetVenueBySlug(r.Context(), slug)
	if err != nil || venue.Status != "published" {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", "Venue not found")
		return generated.Venue{}, false
	}
	return venue, true
}

// ListVenueCourts handles GET /api/v1/public/venues/{slug}/courts
func (h *PublicHandler) ListVenueCourts(w http.ResponseWriter, r *http.Request) {
	if h.venueSvc == nil {
		WriteError(w, http.StatusInternalServerError, "NOT_CONFIGURED", "Courts not available")
		return
	}

	venue, ok := h.resolveVenueBySlug(w, r)
	if !ok {
		return
	}

	courts, err := h.venueSvc.ListCourtsByVenue(r.Context(), venue.ID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", "Failed to list courts")
		return
	}

	Success(w, courts)
}
