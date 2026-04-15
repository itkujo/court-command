// backend/handler/team.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// TeamHandler handles team HTTP requests.
type TeamHandler struct {
	teamService *service.TeamService
}

// NewTeamHandler creates a new TeamHandler.
func NewTeamHandler(teamService *service.TeamService) *TeamHandler {
	return &TeamHandler{teamService: teamService}
}

// Routes returns a chi.Router with all team routes mounted.
func (h *TeamHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListTeams)
	r.Get("/search", h.SearchTeams)
	r.Post("/", h.CreateTeam)
	r.Get("/{teamID}", h.GetTeam)
	r.Get("/by-slug/{slug}", h.GetTeamBySlug)
	r.Patch("/{teamID}", h.UpdateTeam)
	r.Delete("/{teamID}", h.DeleteTeam)

	// Roster sub-routes
	r.Get("/{teamID}/roster", h.GetRoster)
	r.Post("/{teamID}/roster", h.AddPlayerToTeam)
	r.Delete("/{teamID}/roster/{playerID}", h.RemovePlayerFromTeam)

	return r
}

// CreateTeam creates a new team.
func (h *TeamHandler) CreateTeam(w http.ResponseWriter, r *http.Request) {
	data := session.SessionData(r.Context())
	if data == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	var body struct {
		Name           string  `json:"name"`
		ShortName      string  `json:"short_name"`
		LogoURL        *string `json:"logo_url"`
		PrimaryColor   *string `json:"primary_color"`
		SecondaryColor *string `json:"secondary_color"`
		OrgID          *int64  `json:"org_id"`
		City           *string `json:"city"`
		FoundedYear    *int32  `json:"founded_year"`
		Bio            *string `json:"bio"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.Name == "" || body.ShortName == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "name and short_name are required")
		return
	}

	params := generated.CreateTeamParams{
		Name:           body.Name,
		ShortName:      body.ShortName,
		LogoUrl:        body.LogoURL,
		PrimaryColor:   body.PrimaryColor,
		SecondaryColor: body.SecondaryColor,
		City:           body.City,
		Bio:            body.Bio,
	}

	if body.OrgID != nil {
		params.OrgID = pgtype.Int8{Int64: *body.OrgID, Valid: true}
	}
	if body.FoundedYear != nil {
		params.FoundedYear = pgtype.Int4{Int32: *body.FoundedYear, Valid: true}
	}

	team, err := h.teamService.CreateTeam(r.Context(), params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, team)
}

// GetTeam retrieves a team by ID.
func (h *TeamHandler) GetTeam(w http.ResponseWriter, r *http.Request) {
	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	team, err := h.teamService.GetTeam(r.Context(), teamID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, team)
}

// GetTeamBySlug retrieves a team by slug.
func (h *TeamHandler) GetTeamBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	team, err := h.teamService.GetTeamBySlug(r.Context(), slug)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, team)
}

// UpdateTeam updates a team.
func (h *TeamHandler) UpdateTeam(w http.ResponseWriter, r *http.Request) {
	data := session.SessionData(r.Context())
	if data == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	var body struct {
		Name           *string `json:"name"`
		ShortName      *string `json:"short_name"`
		LogoURL        *string `json:"logo_url"`
		PrimaryColor   *string `json:"primary_color"`
		SecondaryColor *string `json:"secondary_color"`
		City           *string `json:"city"`
		FoundedYear    *int32  `json:"founded_year"`
		Bio            *string `json:"bio"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.UpdateTeamParams{
		TeamID:         teamID,
		Name:           body.Name,
		ShortName:      body.ShortName,
		LogoUrl:        body.LogoURL,
		PrimaryColor:   body.PrimaryColor,
		SecondaryColor: body.SecondaryColor,
		City:           body.City,
		Bio:            body.Bio,
	}

	if body.FoundedYear != nil {
		params.FoundedYear = pgtype.Int4{Int32: *body.FoundedYear, Valid: true}
	}

	team, err := h.teamService.UpdateTeam(r.Context(), teamID, params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, team)
}

// DeleteTeam soft-deletes a team.
func (h *TeamHandler) DeleteTeam(w http.ResponseWriter, r *http.Request) {
	data := session.SessionData(r.Context())
	if data == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	if err := h.teamService.DeleteTeam(r.Context(), teamID); err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, map[string]string{"message": "team deleted"})
}

// ListTeams lists teams with pagination.
func (h *TeamHandler) ListTeams(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	teams, total, err := h.teamService.ListTeams(r.Context(), limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, teams, total, int(limit), int(offset))
}

// SearchTeams searches teams with filters.
func (h *TeamHandler) SearchTeams(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)
	query := r.URL.Query()

	var queryParam, cityParam *string
	if q := query.Get("q"); q != "" {
		queryParam = &q
	}
	if c := query.Get("city"); c != "" {
		cityParam = &c
	}

	params := generated.SearchTeamsParams{
		Limit:  limit,
		Offset: offset,
		Query:  queryParam,
		City:   cityParam,
	}

	if o := query.Get("org_id"); o != "" {
		if v, err := strconv.ParseInt(o, 10, 64); err == nil {
			params.OrgID = pgtype.Int8{Int64: v, Valid: true}
		}
	}

	teams, total, err := h.teamService.SearchTeams(r.Context(), params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, teams, total, int(limit), int(offset))
}

// GetRoster returns the active roster for a team.
func (h *TeamHandler) GetRoster(w http.ResponseWriter, r *http.Request) {
	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	roster, err := h.teamService.GetRoster(r.Context(), teamID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, roster)
}

// AddPlayerToTeam adds a player to a team's roster.
func (h *TeamHandler) AddPlayerToTeam(w http.ResponseWriter, r *http.Request) {
	data := session.SessionData(r.Context())
	if data == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	var body struct {
		PlayerID     int64  `json:"player_id"`
		Role         string `json:"role"`
		JerseyNumber *int32 `json:"jersey_number"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.PlayerID == 0 {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "player_id is required")
		return
	}

	if body.Role == "" {
		body.Role = "player"
	}

	var jerseyNumber pgtype.Int4
	if body.JerseyNumber != nil {
		jerseyNumber = pgtype.Int4{Int32: *body.JerseyNumber, Valid: true}
	}

	entry, err := h.teamService.AddPlayerToTeam(r.Context(), teamID, body.PlayerID, body.Role, jerseyNumber)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, entry)
}

// RemovePlayerFromTeam removes a player from a team's roster.
func (h *TeamHandler) RemovePlayerFromTeam(w http.ResponseWriter, r *http.Request) {
	data := session.SessionData(r.Context())
	if data == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	playerID, err := strconv.ParseInt(chi.URLParam(r, "playerID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid player ID")
		return
	}

	if err := h.teamService.RemovePlayerFromTeam(r.Context(), teamID, playerID); err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, map[string]string{"message": "player removed from team"})
}

// parsePagination extracts limit and offset from query parameters.
func parsePagination(r *http.Request) (int32, int32) {
	query := r.URL.Query()

	limit := int32(20)
	if l := query.Get("limit"); l != "" {
		if v, err := strconv.ParseInt(l, 10, 32); err == nil && v > 0 && v <= 100 {
			limit = int32(v)
		}
	}

	offset := int32(0)
	if o := query.Get("offset"); o != "" {
		if v, err := strconv.ParseInt(o, 10, 32); err == nil && v >= 0 {
			offset = int32(v)
		}
	}

	return limit, offset
}
