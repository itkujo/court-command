// backend/handler/auth.go
package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
)

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	authService  *service.AuthService
	secureCookie bool
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(authService *service.AuthService, secureCookie bool) *AuthHandler {
	return &AuthHandler{
		authService:  authService,
		secureCookie: secureCookie,
	}
}

// Register handles POST /api/v1/auth/register.
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var input service.RegisterInput
	if errMsg := DecodeJSON(r, &input); errMsg != "" {
		BadRequest(w, errMsg)
		return
	}

	user, token, err := h.authService.Register(r.Context(), &input)
	if err != nil {
		var validationErr *service.ValidationError
		var conflictErr *service.ConflictError
		if errors.As(err, &validationErr) {
			BadRequest(w, validationErr.Message)
			return
		}
		if errors.As(err, &conflictErr) {
			Conflict(w, conflictErr.Message)
			return
		}
		InternalError(w, "registration failed")
		return
	}

	h.setSessionCookie(w, token)
	Created(w, user)
}

// Login handles POST /api/v1/auth/login.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var input service.LoginInput
	if errMsg := DecodeJSON(r, &input); errMsg != "" {
		BadRequest(w, errMsg)
		return
	}

	user, token, err := h.authService.Login(r.Context(), &input)
	if err != nil {
		var validationErr *service.ValidationError
		if errors.As(err, &validationErr) {
			BadRequest(w, validationErr.Message)
			return
		}
		InternalError(w, "login failed")
		return
	}

	h.setSessionCookie(w, token)
	Success(w, user)
}

// Logout handles POST /api/v1/auth/logout.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(session.SessionCookieName)
	if err != nil {
		NoContent(w)
		return
	}

	_ = h.authService.Logout(r.Context(), cookie.Value)

	http.SetCookie(w, &http.Cookie{
		Name:     session.SessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
	})

	NoContent(w)
}

// MeResponse wraps the user with optional impersonation metadata.
type MeResponse struct {
	*service.UserResponse
	Impersonation *ImpersonationInfo `json:"impersonation,omitempty"`
}

// ImpersonationInfo describes who is impersonating whom.
type ImpersonationInfo struct {
	Active         bool   `json:"active"`
	ImpersonatorID string `json:"impersonator_id"`
}

// Me handles GET /api/v1/auth/me.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	sessionData := session.SessionData(r.Context())
	if sessionData == nil {
		Unauthorized(w, "not authenticated")
		return
	}

	user, err := h.authService.GetCurrentUser(r.Context(), sessionData)
	if err != nil {
		var notFoundErr *service.NotFoundError
		if errors.As(err, &notFoundErr) {
			NotFound(w, notFoundErr.Message)
			return
		}
		InternalError(w, "failed to fetch user")
		return
	}

	resp := &MeResponse{UserResponse: user}

	if sessionData.IsImpersonating() {
		resp.Impersonation = &ImpersonationInfo{
			Active:         true,
			ImpersonatorID: sessionData.ImpersonatorPublicID,
		}
	}

	Success(w, resp)
}

// MyTournamentStaff handles GET /api/v1/auth/me/tournament-staff.
func (h *AuthHandler) MyTournamentStaff(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	assignment, err := h.authService.GetMyTournamentStaff(r.Context(), sess.UserID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, assignment)
}

// setSessionCookie writes the session token as an HTTP-only cookie.
func (h *AuthHandler) setSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     session.SessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int((30 * 24 * time.Hour).Seconds()), // 30 days
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
	})
}
