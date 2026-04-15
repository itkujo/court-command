// backend/handler/division.go
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

// DivisionHandler handles division HTTP requests.
type DivisionHandler struct {
	divisionSvc *service.DivisionService
}

// NewDivisionHandler creates a new DivisionHandler.
func NewDivisionHandler(svc *service.DivisionService) *DivisionHandler {
	return &DivisionHandler{divisionSvc: svc}
}

// Routes returns a chi.Router with all division routes mounted.
// Expects to be mounted under /tournaments/{tournamentID}/divisions.
func (h *DivisionHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public routes
	r.Get("/", h.ListDivisions)
	r.Get("/{divisionID}", h.GetDivision)
	r.Get("/by-slug/{slug}", h.GetDivisionBySlug)

	// Authenticated routes
	r.Post("/", h.CreateDivision)
	r.Post("/from-template", h.CreateFromTemplate)
	r.Patch("/{divisionID}", h.UpdateDivision)
	r.Delete("/{divisionID}", h.DeleteDivision)
	r.Patch("/{divisionID}/status", h.UpdateDivisionStatus)

	return r
}

// parseTournamentID extracts the tournamentID from the URL.
func parseTournamentID(r *http.Request) (int64, error) {
	return strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
}

// CreateDivision creates a new division.
func (h *DivisionHandler) CreateDivision(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	tournamentID, err := parseTournamentID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}

	var body struct {
		Name              string   `json:"name"`
		Format            string   `json:"format"`
		BracketFormat     string   `json:"bracket_format"`
		GenderRestriction *string  `json:"gender_restriction"`
		RatingSystem      *string  `json:"rating_system"`
		ScoringFormat     *string  `json:"scoring_format"`
		SkillMin          *float64 `json:"skill_min"`
		SkillMax          *float64 `json:"skill_max"`
		MaxTeams          *int32   `json:"max_teams"`
		MaxRosterSize     *int32   `json:"max_roster_size"`
		EntryFeeCurrency  *string  `json:"entry_fee_currency"`
		SeedMethod        *string  `json:"seed_method"`
		RegistrationMode  *string  `json:"registration_mode"`
		Notes             *string  `json:"notes"`
		AutoApprove       *bool    `json:"auto_approve"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.CreateDivisionParams{
		TournamentID:      tournamentID,
		Name:              body.Name,
		Format:            body.Format,
		BracketFormat:     body.BracketFormat,
		GenderRestriction: body.GenderRestriction,
		RatingSystem:      body.RatingSystem,
		ScoringFormat:     body.ScoringFormat,
		EntryFeeCurrency:  body.EntryFeeCurrency,
		SeedMethod:        body.SeedMethod,
		RegistrationMode:  body.RegistrationMode,
		Notes:             body.Notes,
	}

	if body.SkillMin != nil {
		params.SkillMin = pgtype.Float8{Float64: *body.SkillMin, Valid: true}
	}
	if body.SkillMax != nil {
		params.SkillMax = pgtype.Float8{Float64: *body.SkillMax, Valid: true}
	}
	if body.MaxTeams != nil {
		params.MaxTeams = pgtype.Int4{Int32: *body.MaxTeams, Valid: true}
	}
	if body.MaxRosterSize != nil {
		params.MaxRosterSize = pgtype.Int4{Int32: *body.MaxRosterSize, Valid: true}
	}
	if body.AutoApprove != nil {
		params.AutoApprove = pgtype.Bool{Bool: *body.AutoApprove, Valid: true}
	}

	division, err := h.divisionSvc.Create(r.Context(), params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, division)
}

// GetDivision retrieves a division by ID.
func (h *DivisionHandler) GetDivision(w http.ResponseWriter, r *http.Request) {
	divisionID, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	division, err := h.divisionSvc.GetByID(r.Context(), divisionID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, division)
}

// GetDivisionBySlug retrieves a division by tournament-scoped slug.
func (h *DivisionHandler) GetDivisionBySlug(w http.ResponseWriter, r *http.Request) {
	tournamentID, err := parseTournamentID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}

	slug := chi.URLParam(r, "slug")

	division, err := h.divisionSvc.GetBySlug(r.Context(), tournamentID, slug)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, division)
}

// ListDivisions lists divisions for a tournament.
func (h *DivisionHandler) ListDivisions(w http.ResponseWriter, r *http.Request) {
	tournamentID, err := parseTournamentID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}

	divisions, total, err := h.divisionSvc.ListByTournament(r.Context(), tournamentID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, divisions, total, len(divisions), 0)
}

// UpdateDivision updates a division.
func (h *DivisionHandler) UpdateDivision(w http.ResponseWriter, r *http.Request) {
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

	var body struct {
		Name              *string  `json:"name"`
		Format            *string  `json:"format"`
		BracketFormat     *string  `json:"bracket_format"`
		GenderRestriction *string  `json:"gender_restriction"`
		RatingSystem      *string  `json:"rating_system"`
		ScoringFormat     *string  `json:"scoring_format"`
		SkillMin          *float64 `json:"skill_min"`
		SkillMax          *float64 `json:"skill_max"`
		MaxTeams          *int32   `json:"max_teams"`
		MaxRosterSize     *int32   `json:"max_roster_size"`
		EntryFeeCurrency  *string  `json:"entry_fee_currency"`
		SeedMethod        *string  `json:"seed_method"`
		RegistrationMode  *string  `json:"registration_mode"`
		Notes             *string  `json:"notes"`
		AutoApprove       *bool    `json:"auto_approve"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.UpdateDivisionParams{
		Name:              body.Name,
		Format:            body.Format,
		BracketFormat:     body.BracketFormat,
		GenderRestriction: body.GenderRestriction,
		RatingSystem:      body.RatingSystem,
		ScoringFormat:     body.ScoringFormat,
		EntryFeeCurrency:  body.EntryFeeCurrency,
		SeedMethod:        body.SeedMethod,
		RegistrationMode:  body.RegistrationMode,
		Notes:             body.Notes,
	}

	if body.SkillMin != nil {
		params.SkillMin = pgtype.Float8{Float64: *body.SkillMin, Valid: true}
	}
	if body.SkillMax != nil {
		params.SkillMax = pgtype.Float8{Float64: *body.SkillMax, Valid: true}
	}
	if body.MaxTeams != nil {
		params.MaxTeams = pgtype.Int4{Int32: *body.MaxTeams, Valid: true}
	}
	if body.MaxRosterSize != nil {
		params.MaxRosterSize = pgtype.Int4{Int32: *body.MaxRosterSize, Valid: true}
	}
	if body.AutoApprove != nil {
		params.AutoApprove = pgtype.Bool{Bool: *body.AutoApprove, Valid: true}
	}

	division, err := h.divisionSvc.Update(r.Context(), divisionID, params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, division)
}

// DeleteDivision soft-deletes a division.
func (h *DivisionHandler) DeleteDivision(w http.ResponseWriter, r *http.Request) {
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

	if err := h.divisionSvc.Delete(r.Context(), divisionID); err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, map[string]string{"message": "division deleted"})
}

// UpdateDivisionStatus transitions a division to a new status.
func (h *DivisionHandler) UpdateDivisionStatus(w http.ResponseWriter, r *http.Request) {
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

	division, err := h.divisionSvc.UpdateStatus(r.Context(), divisionID, body.Status)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, division)
}

// CreateFromTemplate creates a division from a template.
func (h *DivisionHandler) CreateFromTemplate(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	tournamentID, err := parseTournamentID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}

	var body struct {
		TemplateID int64 `json:"template_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.TemplateID == 0 {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "template_id is required")
		return
	}

	division, err := h.divisionSvc.CreateFromTemplate(r.Context(), tournamentID, body.TemplateID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, division)
}
