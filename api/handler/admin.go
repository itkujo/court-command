// api/handler/admin.go
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

// AdminHandler handles platform admin endpoints.
type AdminHandler struct {
	queries        *generated.Queries
	activityLogSvc *service.ActivityLogService
	apiKeySvc      *service.ApiKeyService
	sessionStore   *session.Store
	uploadSvc      *service.UploadService
}

// NewAdminHandler creates a new AdminHandler.
func NewAdminHandler(
	queries *generated.Queries,
	activityLogSvc *service.ActivityLogService,
	apiKeySvc *service.ApiKeyService,
	sessionStore *session.Store,
	uploadSvc *service.UploadService,
) *AdminHandler {
	return &AdminHandler{
		queries:        queries,
		activityLogSvc: activityLogSvc,
		apiKeySvc:      apiKeySvc,
		sessionStore:   sessionStore,
		uploadSvc:      uploadSvc,
	}
}

// Routes returns a chi.Router with all admin routes mounted.
func (h *AdminHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// User management
	r.Get("/users", h.SearchUsers)
	r.Post("/users/create-player", h.CreateUnclaimedPlayer)
	r.Get("/users/{userID}", h.GetUser)
	r.Patch("/users/{userID}/role", h.UpdateUserRole)
	r.Patch("/users/{userID}/status", h.UpdateUserStatus)

	// Venue management
	r.Get("/venues/pending", h.ListPendingVenues)
	r.Patch("/venues/{venueID}/status", h.UpdateVenueStatus)

	// System stats
	r.Get("/stats", h.GetSystemStats)

	// Activity logs
	r.Get("/activity-logs", h.ListActivityLogs)

	// API keys (admin can manage their own keys)
	r.Get("/api-keys", h.ListApiKeys)
	r.Post("/api-keys", h.CreateApiKey)
	r.Delete("/api-keys/{keyID}", h.RevokeApiKey)

	// Impersonation (start only — stop is registered outside admin group in router.go)
	r.Post("/impersonate/{userID}", h.StartImpersonation)

	// Upload cleanup
	r.Post("/uploads/cleanup", h.CleanOrphanedUploads)

	return r
}

// --- Admin user response DTO ---

type adminUserResponse struct {
	ID          int64   `json:"id"`
	PublicID    string  `json:"public_id"`
	Email       *string `json:"email"`
	FirstName   string  `json:"first_name"`
	LastName    string  `json:"last_name"`
	DisplayName *string `json:"display_name,omitempty"`
	Status      string  `json:"status"`
	Role        string  `json:"role"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

func toAdminUserResponse(u generated.User) adminUserResponse {
	return adminUserResponse{
		ID:          u.ID,
		PublicID:    u.PublicID,
		Email:       u.Email,
		FirstName:   u.FirstName,
		LastName:    u.LastName,
		DisplayName: u.DisplayName,
		Status:      u.Status,
		Role:        u.Role,
		CreatedAt:   u.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   u.UpdatedAt.Format(time.RFC3339),
	}
}

// --- User Management ---

// SearchUsers handles GET /api/v1/admin/users?q=&role=&status=&limit=&offset=
func (h *AdminHandler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	limit, offset := parsePagination(r)

	q := r.URL.Query().Get("q")
	role := r.URL.Query().Get("role")
	status := r.URL.Query().Get("status")

	var qPtr, rolePtr, statusPtr *string
	if q != "" {
		qPtr = &q
	}
	if role != "" {
		rolePtr = &role
	}
	if status != "" {
		statusPtr = &status
	}

	users, err := h.queries.SearchUsers(r.Context(), generated.SearchUsersParams{
		Limit:  limit,
		Offset: offset,
		Query:  qPtr,
		Role:   rolePtr,
		Status: statusPtr,
	})
	if err != nil {
		InternalError(w, "failed to search users")
		return
	}

	total, err := h.queries.CountSearchUsers(r.Context(), generated.CountSearchUsersParams{
		Query:  qPtr,
		Role:   rolePtr,
		Status: statusPtr,
	})
	if err != nil {
		InternalError(w, "failed to count users")
		return
	}

	result := make([]adminUserResponse, len(users))
	for i, u := range users {
		result[i] = toAdminUserResponse(u)
	}

	h.activityLogSvc.LogActivity(r.Context(), sess.UserID, "admin_search_users", "user", nil, map[string]string{"query": q}, r.RemoteAddr)

	Paginated(w, result, total, int(limit), int(offset))
}

// resolveUserParam resolves a URL parameter to a user — accepts numeric ID or public_id (e.g. "CC-10295").
func (h *AdminHandler) resolveUserParam(w http.ResponseWriter, r *http.Request) (generated.User, bool) {
	param := chi.URLParam(r, "userID")

	// Try numeric ID first
	if userID, err := strconv.ParseInt(param, 10, 64); err == nil {
		user, err := h.queries.GetUserByID(r.Context(), userID)
		if err != nil {
			NotFound(w, "user not found")
			return generated.User{}, false
		}
		return user, true
	}

	// Fall back to public_id lookup
	user, err := h.queries.GetUserByPublicID(r.Context(), param)
	if err != nil {
		NotFound(w, "user not found")
		return generated.User{}, false
	}
	return user, true
}

// GetUser handles GET /api/v1/admin/users/{userID}
func (h *AdminHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	user, ok := h.resolveUserParam(w, r)
	if !ok {
		return
	}
	Success(w, toAdminUserResponse(user))
}

// UpdateUserRole handles PATCH /api/v1/admin/users/{userID}/role
func (h *AdminHandler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	target, ok := h.resolveUserParam(w, r)
	if !ok {
		return
	}

	var body struct {
		Role string `json:"role"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		BadRequest(w, errMsg)
		return
	}

	// Values MUST match CHECK constraint in api/db/migrations/00030_expand_user_roles.sql
	validRoles := map[string]bool{
		"player": true, "platform_admin": true, "tournament_director": true,
		"head_referee": true, "referee": true, "scorekeeper": true,
		"broadcast_operator": true, "league_admin": true, "organization_admin": true,
		"team_coach": true, "api_readonly": true,
	}
	if !validRoles[body.Role] {
		BadRequest(w, "invalid role")
		return
	}

	user, err := h.queries.UpdateUserRole(r.Context(), generated.UpdateUserRoleParams{
		ID:   target.ID,
		Role: body.Role,
	})
	if err != nil {
		InternalError(w, "failed to update user role")
		return
	}

	h.activityLogSvc.LogActivity(r.Context(), sess.UserID, "admin_update_user_role", "user", &target.ID, map[string]string{"new_role": body.Role}, r.RemoteAddr)

	Success(w, toAdminUserResponse(user))
}

// UpdateUserStatus handles PATCH /api/v1/admin/users/{userID}/status
func (h *AdminHandler) UpdateUserStatus(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	target, ok := h.resolveUserParam(w, r)
	if !ok {
		return
	}

	var body struct {
		Status string  `json:"status"`
		Reason *string `json:"reason"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		BadRequest(w, errMsg)
		return
	}

	validStatuses := map[string]bool{"active": true, "suspended": true, "banned": true}
	if !validStatuses[body.Status] {
		BadRequest(w, "invalid status; must be 'active', 'suspended', or 'banned'")
		return
	}

	user, err := h.queries.UpdateUserStatus(r.Context(), generated.UpdateUserStatusParams{
		ID:     target.ID,
		Status: body.Status,
	})
	if err != nil {
		InternalError(w, "failed to update user status")
		return
	}

	// If suspending or banning, revoke all sessions
	if body.Status == "suspended" || body.Status == "banned" {
		_ = h.sessionStore.DeleteAllForUser(r.Context(), target.ID)
	}

	activityMeta := map[string]string{"new_status": body.Status}
	if body.Reason != nil && *body.Reason != "" {
		activityMeta["reason"] = *body.Reason
	}
	h.activityLogSvc.LogActivity(r.Context(), sess.UserID, "admin_update_user_status", "user", &target.ID, activityMeta, r.RemoteAddr)

	Success(w, toAdminUserResponse(user))
}

// --- Venue Management ---

// pendingVenueResponse is the DTO for the admin venue approval queue.
// It enriches the base venue row with owner_email and court_count so the
// admin UI can render each card without extra round-trips.
type pendingVenueResponse struct {
	ID               int64   `json:"id"`
	Name             string  `json:"name"`
	Slug             string  `json:"slug"`
	Status           string  `json:"status"`
	City             *string `json:"city"`
	StateProvince    *string `json:"state_province"`
	Country          *string `json:"country"`
	FormattedAddress *string `json:"formatted_address"`
	OwnerID          int64   `json:"owner_id"`
	OwnerEmail       *string `json:"owner_email"`
	CourtCount       int64   `json:"court_count"`
	CreatedAt        string  `json:"created_at"`
	UpdatedAt        string  `json:"updated_at"`
}

// ListPendingVenues handles GET /api/v1/admin/venues/pending
func (h *AdminHandler) ListPendingVenues(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	venues, err := h.queries.ListPendingVenues(r.Context(), generated.ListPendingVenuesParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		InternalError(w, "failed to list pending venues")
		return
	}

	total, err := h.queries.CountPendingVenues(r.Context())
	if err != nil {
		InternalError(w, "failed to count pending venues")
		return
	}

	// Enrich each venue with owner email + court count. The pending queue is
	// small (admin-only, typically <20 rows per page) so N+1 lookups are fine.
	items := make([]pendingVenueResponse, len(venues))
	for i, v := range venues {
		courtCount, cErr := h.queries.GetVenueCourtCount(r.Context(), pgtype.Int8{Int64: v.ID, Valid: true})
		if cErr != nil {
			// Log but don't fail the list — default to 0.
			courtCount = 0
		}

		var ownerEmail *string
		if owner, oErr := h.queries.GetUserByID(r.Context(), v.CreatedByUserID); oErr == nil {
			ownerEmail = owner.Email
		}

		items[i] = pendingVenueResponse{
			ID:               v.ID,
			Name:             v.Name,
			Slug:             v.Slug,
			Status:           v.Status,
			City:             v.City,
			StateProvince:    v.StateProvince,
			Country:          v.Country,
			FormattedAddress: v.FormattedAddress,
			OwnerID:          v.CreatedByUserID,
			OwnerEmail:       ownerEmail,
			CourtCount:       courtCount,
			CreatedAt:        v.CreatedAt.Format(time.RFC3339),
			UpdatedAt:        v.UpdatedAt.Format(time.RFC3339),
		}
	}

	Paginated(w, items, total, int(limit), int(offset))
}

// UpdateVenueStatus handles PATCH /api/v1/admin/venues/{venueID}/status
func (h *AdminHandler) UpdateVenueStatus(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	venueID, err := strconv.ParseInt(chi.URLParam(r, "venueID"), 10, 64)
	if err != nil {
		BadRequest(w, "invalid venue ID")
		return
	}

	var body struct {
		Status   string  `json:"status"`
		Feedback *string `json:"feedback"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		BadRequest(w, errMsg)
		return
	}

	// Values MUST match CHECK constraint in api/db/migrations/00005_create_venues.sql
	validStatuses := map[string]bool{"draft": true, "pending_review": true, "published": true, "archived": true}
	if !validStatuses[body.Status] {
		BadRequest(w, "invalid status; must be 'draft', 'pending_review', 'published', or 'archived'")
		return
	}

	venue, err := h.queries.UpdateVenueStatus(r.Context(), generated.UpdateVenueStatusParams{
		ID:     venueID,
		Status: body.Status,
	})
	if err != nil {
		InternalError(w, "failed to update venue status")
		return
	}

	activityMeta := map[string]string{"new_status": body.Status}
	if body.Feedback != nil && *body.Feedback != "" {
		activityMeta["feedback"] = *body.Feedback
	}
	h.activityLogSvc.LogActivity(r.Context(), sess.UserID, "admin_update_venue_status", "venue", &venue.ID, activityMeta, r.RemoteAddr)

	Success(w, venue)
}

// --- System Stats ---

// GetSystemStats handles GET /api/v1/admin/stats
func (h *AdminHandler) GetSystemStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	users, err := h.queries.CountUsers(ctx)
	if err != nil {
		InternalError(w, "failed to count users")
		return
	}

	tournaments, err := h.queries.CountTournaments(ctx)
	if err != nil {
		InternalError(w, "failed to count tournaments")
		return
	}

	leagues, err := h.queries.CountLeagues(ctx)
	if err != nil {
		InternalError(w, "failed to count leagues")
		return
	}

	matches, err := h.queries.CountMatches(ctx)
	if err != nil {
		InternalError(w, "failed to count matches")
		return
	}

	var noStatusFilter *string
	venues, err := h.queries.CountVenues(ctx, noStatusFilter)
	if err != nil {
		InternalError(w, "failed to count venues")
		return
	}

	courts, err := h.queries.CountCourts(ctx)
	if err != nil {
		InternalError(w, "failed to count courts")
		return
	}

	teams, err := h.queries.CountTeams(ctx)
	if err != nil {
		InternalError(w, "failed to count teams")
		return
	}

	orgs, err := h.queries.CountOrgs(ctx)
	if err != nil {
		InternalError(w, "failed to count organizations")
		return
	}

	// Count pending venues
	pendingStatus := "pending_review"
	pendingVenues, err := h.queries.CountVenues(ctx, &pendingStatus)
	if err != nil {
		pendingVenues = 0
	}

	// Count active matches
	activeMatches, err := h.queries.CountMatchesByStatus(ctx, "in_progress")
	if err != nil {
		activeMatches = 0
	}

	Success(w, map[string]int64{
		"total_users":         users,
		"total_tournaments":   tournaments,
		"total_leagues":       leagues,
		"total_matches":       matches,
		"total_venues":        venues,
		"total_courts":        courts,
		"total_teams":         teams,
		"total_organizations": orgs,
		"pending_venues":      pendingVenues,
		"active_matches":      activeMatches,
	})
}

// --- Activity Logs ---

// ListActivityLogs handles GET /api/v1/admin/activity-logs
func (h *AdminHandler) ListActivityLogs(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	var userIDPtr *int64
	if uid := r.URL.Query().Get("user_id"); uid != "" {
		parsed, err := strconv.ParseInt(uid, 10, 64)
		if err != nil {
			BadRequest(w, "invalid user_id")
			return
		}
		userIDPtr = &parsed
	}

	action := r.URL.Query().Get("action")
	entityType := r.URL.Query().Get("entity_type")

	var actionPtr, entityTypePtr *string
	if action != "" {
		actionPtr = &action
	}
	if entityType != "" {
		entityTypePtr = &entityType
	}

	logs, total, err := h.activityLogSvc.ListActivityLogs(r.Context(), userIDPtr, actionPtr, entityTypePtr, limit, offset)
	if err != nil {
		InternalError(w, "failed to list activity logs")
		return
	}

	Paginated(w, logs, total, int(limit), int(offset))
}

// --- API Keys ---

// ListApiKeys handles GET /api/v1/admin/api-keys
func (h *AdminHandler) ListApiKeys(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	keys, err := h.apiKeySvc.ListApiKeys(r.Context(), sess.UserID)
	if err != nil {
		InternalError(w, "failed to list api keys")
		return
	}

	Success(w, keys)
}

// CreateApiKey handles POST /api/v1/admin/api-keys
func (h *AdminHandler) CreateApiKey(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	var body struct {
		Name      string   `json:"name"`
		Scopes    []string `json:"scopes"`
		ExpiresIn *string  `json:"expires_in"` // e.g. "720h" for 30 days
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		BadRequest(w, errMsg)
		return
	}

	var expiresIn *time.Duration
	if body.ExpiresIn != nil && *body.ExpiresIn != "" {
		d, err := time.ParseDuration(*body.ExpiresIn)
		if err != nil {
			BadRequest(w, "invalid expires_in duration format")
			return
		}
		expiresIn = &d
	}

	result, err := h.apiKeySvc.CreateApiKey(r.Context(), sess.UserID, body.Name, body.Scopes, expiresIn)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	h.activityLogSvc.LogActivity(r.Context(), sess.UserID, "create_api_key", "api_key", nil, map[string]string{"name": body.Name}, r.RemoteAddr)

	Created(w, result)
}

// RevokeApiKey handles DELETE /api/v1/admin/api-keys/{keyID}
func (h *AdminHandler) RevokeApiKey(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "authentication required")
		return
	}

	keyID, err := strconv.ParseInt(chi.URLParam(r, "keyID"), 10, 64)
	if err != nil {
		BadRequest(w, "invalid key ID")
		return
	}

	if err := h.apiKeySvc.RevokeApiKey(r.Context(), keyID, sess.UserID); err != nil {
		InternalError(w, "failed to revoke api key")
		return
	}

	h.activityLogSvc.LogActivity(r.Context(), sess.UserID, "revoke_api_key", "api_key", &keyID, nil, r.RemoteAddr)

	NoContent(w)
}

// CreateUnclaimedPlayer creates a placeholder player account that can be claimed later.
func (h *AdminHandler) CreateUnclaimedPlayer(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "Not authenticated")
		return
	}

	var body struct {
		FirstName   string `json:"first_name"`
		LastName    string `json:"last_name"`
		DateOfBirth string `json:"date_of_birth"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		BadRequest(w, "Invalid request body")
		return
	}

	if body.FirstName == "" || body.LastName == "" || body.DateOfBirth == "" {
		BadRequest(w, "first_name, last_name, and date_of_birth are required")
		return
	}

	dob, err := time.Parse("2006-01-02", body.DateOfBirth)
	if err != nil {
		BadRequest(w, "date_of_birth must be YYYY-MM-DD format")
		return
	}

	user, err := h.queries.CreateUnclaimedUser(r.Context(), generated.CreateUnclaimedUserParams{
		FirstName:   body.FirstName,
		LastName:    body.LastName,
		DateOfBirth: dob,
	})
	if err != nil {
		InternalError(w, "Failed to create player")
		return
	}

	h.activityLogSvc.LogActivity(r.Context(), sess.UserID, "create_unclaimed_player", "user", &user.ID, nil, r.RemoteAddr)

	Created(w, adminUserResponse{
		ID:        user.ID,
		PublicID:  user.PublicID,
		Email:     user.Email,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Role:      user.Role,
		Status:    user.Status,
		CreatedAt: user.CreatedAt.Format(time.RFC3339),
		UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
	})
}

// StartImpersonation handles POST /admin/impersonate/{userID}.
// Creates a new session as the target user with impersonator metadata.
func (h *AdminHandler) StartImpersonation(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "not authenticated")
		return
	}

	// Don't allow nested impersonation
	if sess.IsImpersonating() {
		WriteError(w, http.StatusBadRequest, "ALREADY_IMPERSONATING", "stop current impersonation first")
		return
	}

	targetUser, ok := h.resolveUserParam(w, r)
	if !ok {
		return
	}

	// Don't impersonate yourself
	if targetUser.ID == sess.UserID {
		WriteError(w, http.StatusBadRequest, "SELF_IMPERSONATION", "cannot impersonate yourself")
		return
	}

	// Get admin's current session token so we can restore it later
	adminCookie, err := r.Cookie(session.SessionCookieName)
	if err != nil {
		InternalError(w, "failed to read session cookie")
		return
	}

	// Create an impersonation session as the target user
	impersonationData := &session.Data{
		UserID: targetUser.ID,
		Email: func() string {
			if targetUser.Email != nil {
				return *targetUser.Email
			}
			return ""
		}(),
		Role:                 targetUser.Role,
		PublicID:             targetUser.PublicID,
		ImpersonatorID:       sess.UserID,
		ImpersonatorPublicID: sess.PublicID,
		ImpersonatorToken:    adminCookie.Value,
	}

	token, err := h.sessionStore.Create(r.Context(), impersonationData)
	if err != nil {
		InternalError(w, "failed to create impersonation session")
		return
	}

	h.activityLogSvc.LogActivity(r.Context(), sess.UserID, "start_impersonation", "user", &targetUser.ID, map[string]interface{}{
		"target_user_public_id": targetUser.PublicID,
	}, r.RemoteAddr)

	// Set the new impersonation session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     session.SessionCookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int((4 * time.Hour).Seconds()), // shorter TTL for impersonation
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	Success(w, map[string]interface{}{
		"impersonating": map[string]interface{}{
			"user_id":   targetUser.ID,
			"public_id": targetUser.PublicID,
			"name":      targetUser.FirstName + " " + targetUser.LastName,
			"role":      targetUser.Role,
		},
	})
}

// StopImpersonation handles POST /admin/stop-impersonation.
// Restores the admin's original session.
func (h *AdminHandler) StopImpersonation(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		Unauthorized(w, "not authenticated")
		return
	}

	if !sess.IsImpersonating() {
		WriteError(w, http.StatusBadRequest, "NOT_IMPERSONATING", "not currently impersonating anyone")
		return
	}

	// Delete the impersonation session
	currentCookie, err := r.Cookie(session.SessionCookieName)
	if err == nil {
		_ = h.sessionStore.Delete(r.Context(), currentCookie.Value)
	}

	h.activityLogSvc.LogActivity(r.Context(), sess.ImpersonatorID, "stop_impersonation", "user", &sess.UserID, nil, r.RemoteAddr)

	// Restore the admin's original session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     session.SessionCookieName,
		Value:    sess.ImpersonatorToken,
		Path:     "/",
		MaxAge:   int((30 * 24 * time.Hour).Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	Success(w, map[string]interface{}{
		"restored": true,
	})
}

// CleanOrphanedUploads deletes upload files not referenced by any entity.
func (h *AdminHandler) CleanOrphanedUploads(w http.ResponseWriter, r *http.Request) {
	if h.uploadSvc == nil {
		WriteError(w, http.StatusInternalServerError, "SERVICE_UNAVAILABLE", "Upload service not configured")
		return
	}

	count, err := h.uploadSvc.CleanOrphanedUploads(r.Context(), 0) // 0 = clean all orphans regardless of age
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "CLEANUP_FAILED", "Failed to clean orphaned uploads")
		return
	}

	Success(w, map[string]interface{}{
		"deleted": count,
	})
}

// NOTE: parsePagination is defined in team.go within the same package.
