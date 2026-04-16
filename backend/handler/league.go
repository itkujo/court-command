// backend/handler/league.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// LeagueHandler handles league HTTP requests.
type LeagueHandler struct {
	leagueSvc *service.LeagueService
}

// NewLeagueHandler creates a new LeagueHandler.
func NewLeagueHandler(svc *service.LeagueService) *LeagueHandler {
	return &LeagueHandler{leagueSvc: svc}
}

// Routes returns a chi.Router with all league routes mounted.
func (h *LeagueHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public routes
	r.Get("/", h.ListLeagues)
	r.Get("/search", h.SearchLeagues)
	r.Get("/{leagueID}", h.GetLeague)
	r.Get("/by-slug/{slug}", h.GetLeagueBySlug)
	r.Get("/by-public-id/{publicID}", h.GetLeagueByPublicID)

	// Authenticated routes
	r.Post("/", h.CreateLeague)
	r.Patch("/{leagueID}", h.UpdateLeague)
	r.Delete("/{leagueID}", h.DeleteLeague)
	r.Patch("/{leagueID}/status", h.UpdateLeagueStatus)
	r.Get("/my", h.ListMyLeagues)

	return r
}

// CreateLeague creates a new league.
func (h *LeagueHandler) CreateLeague(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	var body struct {
		Name             string          `json:"name"`
		LogoURL          *string         `json:"logo_url"`
		BannerURL        *string         `json:"banner_url"`
		Description      *string         `json:"description"`
		WebsiteURL       *string         `json:"website_url"`
		ContactEmail     *string         `json:"contact_email"`
		ContactPhone     *string         `json:"contact_phone"`
		City             *string         `json:"city"`
		StateProvince    *string         `json:"state_province"`
		Country          *string         `json:"country"`
		RulesDocumentURL *string         `json:"rules_document_url"`
		Notes            *string         `json:"notes"`
		SocialLinks      json.RawMessage `json:"social_links"`
		SponsorInfo      json.RawMessage `json:"sponsor_info"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.CreateLeagueParams{
		Name:             body.Name,
		LogoUrl:          body.LogoURL,
		BannerUrl:        body.BannerURL,
		Description:      body.Description,
		WebsiteUrl:       body.WebsiteURL,
		ContactEmail:     body.ContactEmail,
		ContactPhone:     body.ContactPhone,
		City:             body.City,
		StateProvince:    body.StateProvince,
		Country:          body.Country,
		RulesDocumentUrl: body.RulesDocumentURL,
		Notes:            body.Notes,
		SocialLinks:      body.SocialLinks,
		SponsorInfo:      body.SponsorInfo,
		CreatedByUserID:  sess.UserID,
	}

	league, err := h.leagueSvc.Create(r.Context(), params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, league)
}

// GetLeague retrieves a league by ID.
func (h *LeagueHandler) GetLeague(w http.ResponseWriter, r *http.Request) {
	leagueID, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	league, err := h.leagueSvc.GetByID(r.Context(), leagueID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, league)
}

// GetLeagueBySlug retrieves a league by slug.
func (h *LeagueHandler) GetLeagueBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	league, err := h.leagueSvc.GetBySlug(r.Context(), slug)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, league)
}

// GetLeagueByPublicID retrieves a league by public ID.
func (h *LeagueHandler) GetLeagueByPublicID(w http.ResponseWriter, r *http.Request) {
	publicID := chi.URLParam(r, "publicID")

	league, err := h.leagueSvc.GetByPublicID(r.Context(), publicID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, league)
}

// UpdateLeague updates a league.
func (h *LeagueHandler) UpdateLeague(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	leagueID, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	var body struct {
		Name             *string         `json:"name"`
		LogoURL          *string         `json:"logo_url"`
		BannerURL        *string         `json:"banner_url"`
		Description      *string         `json:"description"`
		WebsiteURL       *string         `json:"website_url"`
		ContactEmail     *string         `json:"contact_email"`
		ContactPhone     *string         `json:"contact_phone"`
		City             *string         `json:"city"`
		StateProvince    *string         `json:"state_province"`
		Country          *string         `json:"country"`
		RulesDocumentURL *string         `json:"rules_document_url"`
		Notes            *string         `json:"notes"`
		SocialLinks      json.RawMessage `json:"social_links"`
		SponsorInfo      json.RawMessage `json:"sponsor_info"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.UpdateLeagueParams{
		Name:             body.Name,
		LogoUrl:          body.LogoURL,
		BannerUrl:        body.BannerURL,
		Description:      body.Description,
		WebsiteUrl:       body.WebsiteURL,
		ContactEmail:     body.ContactEmail,
		ContactPhone:     body.ContactPhone,
		City:             body.City,
		StateProvince:    body.StateProvince,
		Country:          body.Country,
		RulesDocumentUrl: body.RulesDocumentURL,
		Notes:            body.Notes,
		SocialLinks:      body.SocialLinks,
		SponsorInfo:      body.SponsorInfo,
	}

	league, err := h.leagueSvc.Update(r.Context(), leagueID, params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, league)
}

// DeleteLeague soft-deletes a league.
func (h *LeagueHandler) DeleteLeague(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	leagueID, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	if err := h.leagueSvc.Delete(r.Context(), leagueID); err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, map[string]string{"message": "league deleted"})
}

// ListLeagues lists leagues with pagination.
func (h *LeagueHandler) ListLeagues(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	leagues, total, err := h.leagueSvc.List(r.Context(), limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, leagues, total, int(limit), int(offset))
}

// SearchLeagues searches leagues by query term.
func (h *LeagueHandler) SearchLeagues(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)
	term := r.URL.Query().Get("q")

	if term == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_QUERY", "q parameter is required")
		return
	}

	leagues, total, err := h.leagueSvc.Search(r.Context(), term, limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, leagues, total, int(limit), int(offset))
}

// UpdateLeagueStatus transitions a league to a new status.
func (h *LeagueHandler) UpdateLeagueStatus(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	leagueID, err := strconv.ParseInt(chi.URLParam(r, "leagueID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
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

	league, err := h.leagueSvc.UpdateStatus(r.Context(), leagueID, body.Status)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, league)
}

// ListMyLeagues lists leagues created by the authenticated user.
func (h *LeagueHandler) ListMyLeagues(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	limit, offset := parsePagination(r)

	leagues, total, err := h.leagueSvc.ListByCreator(r.Context(), sess.UserID, limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, leagues, total, int(limit), int(offset))
}
