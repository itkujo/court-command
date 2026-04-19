// api/handler/announcement.go
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

// AnnouncementHandler handles announcement HTTP requests.
type AnnouncementHandler struct {
	announceSvc *service.AnnouncementService
}

// NewAnnouncementHandler creates a new AnnouncementHandler.
func NewAnnouncementHandler(svc *service.AnnouncementService) *AnnouncementHandler {
	return &AnnouncementHandler{announceSvc: svc}
}

// TournamentAnnouncementRoutes returns routes scoped to a tournament.
// Expects to be mounted under /tournaments/{tournamentID}/announcements.
func (h *AnnouncementHandler) TournamentAnnouncementRoutes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListTournamentAnnouncements)
	r.Get("/{announcementID}", h.GetAnnouncement)
	r.Post("/", h.CreateTournamentAnnouncement)
	r.Patch("/{announcementID}", h.UpdateAnnouncement)
	r.Delete("/{announcementID}", h.DeleteAnnouncement)

	return r
}

// LeagueAnnouncementRoutes returns routes scoped to a league.
// Expects to be mounted under /leagues/{leagueID}/announcements.
func (h *AnnouncementHandler) LeagueAnnouncementRoutes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListLeagueAnnouncements)
	r.Get("/{announcementID}", h.GetAnnouncement)
	r.Post("/", h.CreateLeagueAnnouncement)
	r.Patch("/{announcementID}", h.UpdateAnnouncement)
	r.Delete("/{announcementID}", h.DeleteAnnouncement)

	return r
}

// CreateTournamentAnnouncement creates an announcement for a tournament.
func (h *AnnouncementHandler) CreateTournamentAnnouncement(w http.ResponseWriter, r *http.Request) {
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
		Title    string `json:"title"`
		Body     string `json:"body"`
		IsPinned *bool  `json:"is_pinned"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.CreateAnnouncementParams{
		TournamentID:    pgtype.Int8{Int64: tournamentID, Valid: true},
		Title:           body.Title,
		Body:            body.Body,
		CreatedByUserID: sess.UserID,
	}

	if body.IsPinned != nil {
		params.IsPinned = pgtype.Bool{Bool: *body.IsPinned, Valid: true}
	}

	announcement, err := h.announceSvc.Create(r.Context(), params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, announcement)
}

// CreateLeagueAnnouncement creates an announcement for a league.
func (h *AnnouncementHandler) CreateLeagueAnnouncement(w http.ResponseWriter, r *http.Request) {
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
		Title    string `json:"title"`
		Body     string `json:"body"`
		IsPinned *bool  `json:"is_pinned"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.CreateAnnouncementParams{
		LeagueID:        pgtype.Int8{Int64: leagueID, Valid: true},
		Title:           body.Title,
		Body:            body.Body,
		CreatedByUserID: sess.UserID,
	}

	if body.IsPinned != nil {
		params.IsPinned = pgtype.Bool{Bool: *body.IsPinned, Valid: true}
	}

	announcement, err := h.announceSvc.Create(r.Context(), params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, announcement)
}

// GetAnnouncement retrieves an announcement by ID.
func (h *AnnouncementHandler) GetAnnouncement(w http.ResponseWriter, r *http.Request) {
	announcementID, err := strconv.ParseInt(chi.URLParam(r, "announcementID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid announcement ID")
		return
	}

	announcement, err := h.announceSvc.GetByID(r.Context(), announcementID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, announcement)
}

// ListTournamentAnnouncements lists announcements for a tournament.
func (h *AnnouncementHandler) ListTournamentAnnouncements(w http.ResponseWriter, r *http.Request) {
	tournamentID, err := parseTournamentID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid tournament ID")
		return
	}

	limit, offset := parsePagination(r)

	announcements, total, err := h.announceSvc.ListByTournament(r.Context(), tournamentID, limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, announcements, total, int(limit), int(offset))
}

// ListLeagueAnnouncements lists announcements for a league.
func (h *AnnouncementHandler) ListLeagueAnnouncements(w http.ResponseWriter, r *http.Request) {
	leagueID, err := parseLeagueID(r)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid league ID")
		return
	}

	limit, offset := parsePagination(r)

	announcements, total, err := h.announceSvc.ListByLeague(r.Context(), leagueID, limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, announcements, total, int(limit), int(offset))
}

// UpdateAnnouncement updates an announcement.
func (h *AnnouncementHandler) UpdateAnnouncement(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	announcementID, err := strconv.ParseInt(chi.URLParam(r, "announcementID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid announcement ID")
		return
	}

	var body struct {
		Title    *string `json:"title"`
		Body     *string `json:"body"`
		IsPinned *bool   `json:"is_pinned"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.UpdateAnnouncementParams{
		Title: body.Title,
		Body:  body.Body,
	}

	if body.IsPinned != nil {
		params.IsPinned = pgtype.Bool{Bool: *body.IsPinned, Valid: true}
	}

	announcement, err := h.announceSvc.Update(r.Context(), announcementID, params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, announcement)
}

// DeleteAnnouncement soft-deletes an announcement.
func (h *AnnouncementHandler) DeleteAnnouncement(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	announcementID, err := strconv.ParseInt(chi.URLParam(r, "announcementID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid announcement ID")
		return
	}

	if err := h.announceSvc.Delete(r.Context(), announcementID); err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, map[string]string{"message": "announcement deleted"})
}
