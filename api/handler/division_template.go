// api/handler/division_template.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/session"
)

// DivisionTemplateHandler handles division template HTTP requests.
// Uses *generated.Queries directly (no service layer).
type DivisionTemplateHandler struct {
	queries *generated.Queries
}

// NewDivisionTemplateHandler creates a new DivisionTemplateHandler.
func NewDivisionTemplateHandler(queries *generated.Queries) *DivisionTemplateHandler {
	return &DivisionTemplateHandler{queries: queries}
}

// DivisionTemplateResponse is the public representation of a division template.
type DivisionTemplateResponse struct {
	ID                  int64    `json:"id"`
	LeagueID            int64    `json:"league_id"`
	Name                string   `json:"name"`
	Format              string   `json:"format"`
	GenderRestriction   *string  `json:"gender_restriction,omitempty"`
	SkillMin            *float64 `json:"skill_min,omitempty"`
	SkillMax            *float64 `json:"skill_max,omitempty"`
	RatingSystem        *string  `json:"rating_system,omitempty"`
	BracketFormat       string   `json:"bracket_format"`
	ScoringFormat       *string  `json:"scoring_format,omitempty"`
	MaxTeams            *int32   `json:"max_teams,omitempty"`
	MaxRosterSize       *int32   `json:"max_roster_size,omitempty"`
	EntryFeeCurrency    *string  `json:"entry_fee_currency,omitempty"`
	SeedMethod          *string  `json:"seed_method,omitempty"`
	RegistrationMode    *string  `json:"registration_mode,omitempty"`
	AutoApprove         bool     `json:"auto_approve"`
	AutoPromoteWaitlist bool     `json:"auto_promote_waitlist"`
	SortOrder           *int32   `json:"sort_order,omitempty"`
	Notes               *string  `json:"notes,omitempty"`
	CreatedAt           string   `json:"created_at"`
	UpdatedAt           string   `json:"updated_at"`
}

func toDivisionTemplateResponse(t generated.DivisionTemplate) DivisionTemplateResponse {
	resp := DivisionTemplateResponse{
		ID:                t.ID,
		LeagueID:          t.LeagueID,
		Name:              t.Name,
		Format:            t.Format,
		GenderRestriction: t.GenderRestriction,
		RatingSystem:      t.RatingSystem,
		BracketFormat:     t.BracketFormat,
		ScoringFormat:     t.ScoringFormat,
		EntryFeeCurrency:  t.EntryFeeCurrency,
		SeedMethod:        t.SeedMethod,
		RegistrationMode:  t.RegistrationMode,
		Notes:             t.Notes,
		CreatedAt:         t.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         t.UpdatedAt.Format(time.RFC3339),
	}

	if t.SkillMin.Valid {
		resp.SkillMin = &t.SkillMin.Float64
	}
	if t.SkillMax.Valid {
		resp.SkillMax = &t.SkillMax.Float64
	}
	if t.MaxTeams.Valid {
		resp.MaxTeams = &t.MaxTeams.Int32
	}
	if t.MaxRosterSize.Valid {
		resp.MaxRosterSize = &t.MaxRosterSize.Int32
	}
	if t.SortOrder.Valid {
		resp.SortOrder = &t.SortOrder.Int32
	}
	if t.AutoApprove.Valid {
		resp.AutoApprove = t.AutoApprove.Bool
	}
	if t.AutoPromoteWaitlist.Valid {
		resp.AutoPromoteWaitlist = t.AutoPromoteWaitlist.Bool
	}

	return resp
}

// Routes returns a chi.Router with all division template routes mounted.
// Expects to be mounted under /leagues/{leagueID}/division-templates.
func (h *DivisionTemplateHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListTemplates)
	r.Get("/{templateID}", h.GetTemplate)
	r.Post("/", h.CreateTemplate)
	r.Patch("/{templateID}", h.UpdateTemplate)
	r.Delete("/{templateID}", h.DeleteTemplate)

	return r
}

// CreateTemplate creates a new division template.
func (h *DivisionTemplateHandler) CreateTemplate(w http.ResponseWriter, r *http.Request) {
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
		AutoApprove       *bool    `json:"auto_approve"`
		AutoPromoteWait   *bool    `json:"auto_promote_waitlist"`
		SortOrder         *int32   `json:"sort_order"`
		Notes             *string  `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.Name == "" || body.Format == "" || body.BracketFormat == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "name, format, and bracket_format are required")
		return
	}

	params := generated.CreateDivisionTemplateParams{
		LeagueID:          leagueID,
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
	if body.AutoPromoteWait != nil {
		params.AutoPromoteWaitlist = pgtype.Bool{Bool: *body.AutoPromoteWait, Valid: true}
	}
	if body.SortOrder != nil {
		params.SortOrder = pgtype.Int4{Int32: *body.SortOrder, Valid: true}
	}

	tmpl, err := h.queries.CreateDivisionTemplate(r.Context(), params)
	if err != nil {
		InternalError(w, "failed to create division template")
		return
	}

	Created(w, toDivisionTemplateResponse(tmpl))
}

// GetTemplate retrieves a division template by ID.
func (h *DivisionTemplateHandler) GetTemplate(w http.ResponseWriter, r *http.Request) {
	templateID, err := strconv.ParseInt(chi.URLParam(r, "templateID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid template ID")
		return
	}

	tmpl, err := h.queries.GetDivisionTemplateByID(r.Context(), templateID)
	if err != nil {
		NotFound(w, "division template not found")
		return
	}

	Success(w, toDivisionTemplateResponse(tmpl))
}

// ListTemplates lists division templates for a league.
func (h *DivisionTemplateHandler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	leagueID, err := parseLeagueID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	templates, err := h.queries.ListDivisionTemplatesByLeague(r.Context(), leagueID)
	if err != nil {
		InternalError(w, "failed to list division templates")
		return
	}

	result := make([]DivisionTemplateResponse, len(templates))
	for i, t := range templates {
		result[i] = toDivisionTemplateResponse(t)
	}

	Success(w, result)
}

// UpdateTemplate updates a division template.
func (h *DivisionTemplateHandler) UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	templateID, err := strconv.ParseInt(chi.URLParam(r, "templateID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid template ID")
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
		AutoApprove       *bool    `json:"auto_approve"`
		AutoPromoteWait   *bool    `json:"auto_promote_waitlist"`
		SortOrder         *int32   `json:"sort_order"`
		Notes             *string  `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.UpdateDivisionTemplateParams{
		ID:                templateID,
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
	if body.AutoPromoteWait != nil {
		params.AutoPromoteWaitlist = pgtype.Bool{Bool: *body.AutoPromoteWait, Valid: true}
	}
	if body.SortOrder != nil {
		params.SortOrder = pgtype.Int4{Int32: *body.SortOrder, Valid: true}
	}

	tmpl, err := h.queries.UpdateDivisionTemplate(r.Context(), params)
	if err != nil {
		NotFound(w, "division template not found")
		return
	}

	Success(w, toDivisionTemplateResponse(tmpl))
}

// DeleteTemplate soft-deletes a division template.
func (h *DivisionTemplateHandler) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	templateID, err := strconv.ParseInt(chi.URLParam(r, "templateID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid template ID")
		return
	}

	if err := h.queries.SoftDeleteDivisionTemplate(r.Context(), templateID); err != nil {
		NotFound(w, "division template not found")
		return
	}

	Success(w, map[string]string{"message": "division template deleted"})
}
