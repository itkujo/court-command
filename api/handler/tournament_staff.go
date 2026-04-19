package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

type TournamentStaffHandler struct {
	staffSvc      *service.TournamentStaffService
	tournamentSvc *service.TournamentService
}

func NewTournamentStaffHandler(staffSvc *service.TournamentStaffService, tournamentSvc *service.TournamentService) *TournamentStaffHandler {
	return &TournamentStaffHandler{staffSvc: staffSvc, tournamentSvc: tournamentSvc}
}

func (h *TournamentStaffHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.GetStaff)
	r.Post("/regenerate/{role}", h.RegeneratePassword)
	return r
}

func (h *TournamentStaffHandler) GetStaff(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	tournamentID, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		BadRequest(w, "invalid tournament ID")
		return
	}

	// Only TD or platform_admin can view staff credentials
	isTD, err := h.tournamentSvc.IsTD(r.Context(), tournamentID, sess.UserID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}
	if !isTD && sess.Role != "platform_admin" {
		Forbidden(w, "only tournament directors and admins can view staff accounts")
		return
	}

	staff, err := h.staffSvc.GetStaff(r.Context(), tournamentID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, staff)
}

func (h *TournamentStaffHandler) RegeneratePassword(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	tournamentID, err := strconv.ParseInt(chi.URLParam(r, "tournamentID"), 10, 64)
	if err != nil {
		BadRequest(w, "invalid tournament ID")
		return
	}

	role := chi.URLParam(r, "role")

	// Only TD or platform_admin can regenerate passwords
	isTD, err := h.tournamentSvc.IsTD(r.Context(), tournamentID, sess.UserID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}
	if !isTD && sess.Role != "platform_admin" {
		Forbidden(w, "only tournament directors and admins can regenerate staff passwords")
		return
	}

	updated, err := h.staffSvc.RegeneratePassword(r.Context(), tournamentID, role)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, updated)
}
