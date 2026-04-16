// backend/handler/tournament.go
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// TournamentHandler handles tournament HTTP requests.
type TournamentHandler struct {
	tournamentSvc *service.TournamentService
}

// NewTournamentHandler creates a new TournamentHandler.
func NewTournamentHandler(svc *service.TournamentService) *TournamentHandler {
	return &TournamentHandler{tournamentSvc: svc}
}

// Routes returns a chi.Router with all tournament routes mounted.
func (h *TournamentHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// Public routes
	r.Get("/", h.ListTournaments)
	r.Get("/search", h.SearchTournaments)
	r.Get("/{tournamentID}", h.GetTournament)
	r.Get("/by-slug/{slug}", h.GetTournamentBySlug)
	r.Get("/by-public-id/{publicID}", h.GetTournamentByPublicID)

	// Authenticated routes
	r.Post("/", h.CreateTournament)
	r.Patch("/{tournamentID}", h.UpdateTournament)
	r.Delete("/{tournamentID}", h.DeleteTournament)
	r.Patch("/{tournamentID}/status", h.UpdateTournamentStatus)
	r.Post("/{tournamentID}/clone", h.CloneTournament)
	r.Get("/my", h.ListMyTournaments)

	return r
}

// CreateTournament creates a new tournament.
func (h *TournamentHandler) CreateTournament(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	var body struct {
		Name             string          `json:"name"`
		StartDate        string          `json:"start_date"`
		EndDate          string          `json:"end_date"`
		VenueID          *int64          `json:"venue_id"`
		LeagueID         *int64          `json:"league_id"`
		SeasonID         *int64          `json:"season_id"`
		Description      *string         `json:"description"`
		LogoURL          *string         `json:"logo_url"`
		BannerURL        *string         `json:"banner_url"`
		ContactEmail     *string         `json:"contact_email"`
		ContactPhone     *string         `json:"contact_phone"`
		WebsiteURL       *string         `json:"website_url"`
		MaxParticipants  *int32          `json:"max_participants"`
		RulesDocumentURL *string         `json:"rules_document_url"`
		Notes            *string         `json:"notes"`
		TdUserID         *int64          `json:"td_user_id"`
		SocialLinks      json.RawMessage `json:"social_links"`
		SponsorInfo      json.RawMessage `json:"sponsor_info"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.Name == "" || body.StartDate == "" || body.EndDate == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "name, start_date, and end_date are required")
		return
	}

	startDate, err := time.Parse("2006-01-02", body.StartDate)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_DATE", "start_date must be YYYY-MM-DD")
		return
	}

	endDate, err := time.Parse("2006-01-02", body.EndDate)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_DATE", "end_date must be YYYY-MM-DD")
		return
	}

	params := generated.CreateTournamentParams{
		Name:             body.Name,
		StartDate:        startDate,
		EndDate:          endDate,
		Description:      body.Description,
		LogoUrl:          body.LogoURL,
		BannerUrl:        body.BannerURL,
		ContactEmail:     body.ContactEmail,
		ContactPhone:     body.ContactPhone,
		WebsiteUrl:       body.WebsiteURL,
		RulesDocumentUrl: body.RulesDocumentURL,
		Notes:            body.Notes,
		SocialLinks:      body.SocialLinks,
		SponsorInfo:      body.SponsorInfo,
		CreatedByUserID:  sess.UserID,
	}

	if body.VenueID != nil {
		params.VenueID = pgtype.Int8{Int64: *body.VenueID, Valid: true}
	}
	if body.LeagueID != nil {
		params.LeagueID = pgtype.Int8{Int64: *body.LeagueID, Valid: true}
	}
	if body.SeasonID != nil {
		params.SeasonID = pgtype.Int8{Int64: *body.SeasonID, Valid: true}
	}
	if body.MaxParticipants != nil {
		params.MaxParticipants = pgtype.Int4{Int32: *body.MaxParticipants, Valid: true}
	}
	if body.TdUserID != nil {
		params.TdUserID = pgtype.Int8{Int64: *body.TdUserID, Valid: true}
	}

	tournament, err := h.tournamentSvc.Create(r.Context(), params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, tournament)
}

// GetTournament retrieves a tournament by ID.
func (h *TournamentHandler) GetTournament(w http.ResponseWriter, r *http.Request) {
	tournamentID, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}

	tournament, err := h.tournamentSvc.GetByID(r.Context(), tournamentID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, tournament)
}

// GetTournamentBySlug retrieves a tournament by slug.
func (h *TournamentHandler) GetTournamentBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	tournament, err := h.tournamentSvc.GetBySlug(r.Context(), slug)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, tournament)
}

// GetTournamentByPublicID retrieves a tournament by public ID.
func (h *TournamentHandler) GetTournamentByPublicID(w http.ResponseWriter, r *http.Request) {
	publicID := chi.URLParam(r, "publicID")

	tournament, err := h.tournamentSvc.GetByPublicID(r.Context(), publicID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, tournament)
}

// UpdateTournament updates a tournament.
func (h *TournamentHandler) UpdateTournament(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	tournamentID, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}

	var body struct {
		Name               *string         `json:"name"`
		StartDate          *string         `json:"start_date"`
		EndDate            *string         `json:"end_date"`
		VenueID            *int64          `json:"venue_id"`
		LeagueID           *int64          `json:"league_id"`
		SeasonID           *int64          `json:"season_id"`
		Description        *string         `json:"description"`
		LogoURL            *string         `json:"logo_url"`
		BannerURL          *string         `json:"banner_url"`
		ContactEmail       *string         `json:"contact_email"`
		ContactPhone       *string         `json:"contact_phone"`
		WebsiteURL         *string         `json:"website_url"`
		MaxParticipants    *int32          `json:"max_participants"`
		RulesDocumentURL   *string         `json:"rules_document_url"`
		CancellationReason *string         `json:"cancellation_reason"`
		Notes              *string         `json:"notes"`
		TdUserID           *int64          `json:"td_user_id"`
		SocialLinks        json.RawMessage `json:"social_links"`
		SponsorInfo        json.RawMessage `json:"sponsor_info"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.UpdateTournamentParams{
		Name:               body.Name,
		Description:        body.Description,
		LogoUrl:            body.LogoURL,
		BannerUrl:          body.BannerURL,
		ContactEmail:       body.ContactEmail,
		ContactPhone:       body.ContactPhone,
		WebsiteUrl:         body.WebsiteURL,
		RulesDocumentUrl:   body.RulesDocumentURL,
		CancellationReason: body.CancellationReason,
		Notes:              body.Notes,
		SocialLinks:        body.SocialLinks,
		SponsorInfo:        body.SponsorInfo,
	}

	if body.StartDate != nil {
		d, err := time.Parse("2006-01-02", *body.StartDate)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "INVALID_DATE", "start_date must be YYYY-MM-DD")
			return
		}
		params.StartDate = pgtype.Date{Time: d, Valid: true}
	}
	if body.EndDate != nil {
		d, err := time.Parse("2006-01-02", *body.EndDate)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "INVALID_DATE", "end_date must be YYYY-MM-DD")
			return
		}
		params.EndDate = pgtype.Date{Time: d, Valid: true}
	}
	if body.VenueID != nil {
		params.VenueID = pgtype.Int8{Int64: *body.VenueID, Valid: true}
	}
	if body.LeagueID != nil {
		params.LeagueID = pgtype.Int8{Int64: *body.LeagueID, Valid: true}
	}
	if body.SeasonID != nil {
		params.SeasonID = pgtype.Int8{Int64: *body.SeasonID, Valid: true}
	}
	if body.MaxParticipants != nil {
		params.MaxParticipants = pgtype.Int4{Int32: *body.MaxParticipants, Valid: true}
	}
	if body.TdUserID != nil {
		params.TdUserID = pgtype.Int8{Int64: *body.TdUserID, Valid: true}
	}

	tournament, err := h.tournamentSvc.Update(r.Context(), tournamentID, params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, tournament)
}

// DeleteTournament soft-deletes a tournament.
func (h *TournamentHandler) DeleteTournament(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	tournamentID, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}

	if err := h.tournamentSvc.Delete(r.Context(), tournamentID); err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, map[string]string{"message": "tournament deleted"})
}

// ListTournaments lists tournaments with pagination.
func (h *TournamentHandler) ListTournaments(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	// Check for league_id filter
	if lid := r.URL.Query().Get("league_id"); lid != "" {
		leagueID, err := strconv.ParseInt(lid, 10, 64)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league_id")
			return
		}

		tournaments, total, err := h.tournamentSvc.ListByLeague(r.Context(), leagueID, limit, offset)
		if err != nil {
			HandleServiceError(w, err)
			return
		}

		Paginated(w, tournaments, total, int(limit), int(offset))
		return
	}

	tournaments, total, err := h.tournamentSvc.List(r.Context(), limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, tournaments, total, int(limit), int(offset))
}

// SearchTournaments searches tournaments by query term.
func (h *TournamentHandler) SearchTournaments(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)
	term := r.URL.Query().Get("q")

	if term == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_QUERY", "q parameter is required")
		return
	}

	tournaments, total, err := h.tournamentSvc.Search(r.Context(), term, limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, tournaments, total, int(limit), int(offset))
}

// UpdateTournamentStatus transitions a tournament to a new status.
func (h *TournamentHandler) UpdateTournamentStatus(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	tournamentID, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
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

	tournament, err := h.tournamentSvc.UpdateStatus(r.Context(), tournamentID, body.Status)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, tournament)
}

// CloneTournament creates a copy of a tournament.
func (h *TournamentHandler) CloneTournament(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	tournamentID, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}

	var body struct {
		Name                 string `json:"name"`
		IncludeRegistrations bool   `json:"include_registrations"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.Name == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "name is required")
		return
	}

	tournament, err := h.tournamentSvc.Clone(r.Context(), tournamentID, body.Name, sess.UserID, body.IncludeRegistrations)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, tournament)
}

// ListMyTournaments lists tournaments created by the authenticated user.
func (h *TournamentHandler) ListMyTournaments(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	limit, offset := parsePagination(r)

	tournaments, total, err := h.tournamentSvc.ListByCreator(r.Context(), sess.UserID, limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, tournaments, total, int(limit), int(offset))
}
