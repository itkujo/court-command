// backend/handler/organization.go
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

// OrgHandler handles organization HTTP requests.
type OrgHandler struct {
	orgService *service.OrganizationService
}

// NewOrgHandler creates a new OrgHandler.
func NewOrgHandler(orgService *service.OrganizationService) *OrgHandler {
	return &OrgHandler{orgService: orgService}
}

// Routes returns a chi.Router with all organization routes mounted.
func (h *OrgHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/", h.ListOrgs)
	r.Post("/", h.CreateOrg)
	r.Get("/{orgID}", h.GetOrg)
	r.Get("/by-slug/{slug}", h.GetOrgBySlug)
	r.Patch("/{orgID}", h.UpdateOrg)
	r.Delete("/{orgID}", h.DeleteOrg)

	// Member sub-routes
	r.Get("/{orgID}/members", h.GetMembers)
	r.Post("/{orgID}/members", h.AddMember)
	r.Delete("/{orgID}/members/{playerID}", h.RemoveMember)
	r.Patch("/{orgID}/members/{playerID}/role", h.UpdateMemberRole)

	// Player self-service
	r.Post("/{orgID}/leave", h.LeaveSelf)
	r.Post("/{orgID}/block", h.BlockOrg)
	r.Delete("/{orgID}/block", h.UnblockOrg)

	return r
}

// CreateOrg creates a new organization. The creator becomes the Org Admin.
func (h *OrgHandler) CreateOrg(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	var body struct {
		Name           string  `json:"name"`
		LogoURL        *string `json:"logo_url"`
		PrimaryColor   *string `json:"primary_color"`
		SecondaryColor *string `json:"secondary_color"`
		WebsiteURL     *string `json:"website_url"`
		ContactEmail   *string `json:"contact_email"`
		ContactPhone   *string `json:"contact_phone"`
		City           *string `json:"city"`
		StateProvince  *string `json:"state_province"`
		Country        *string `json:"country"`
		Bio            *string `json:"bio"`
		FoundedYear    *int32  `json:"founded_year"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.Name == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "name is required")
		return
	}

	var foundedYear pgtype.Int4
	if body.FoundedYear != nil {
		foundedYear = pgtype.Int4{Int32: *body.FoundedYear, Valid: true}
	}

	params := generated.CreateOrganizationParams{
		Name:            body.Name,
		LogoUrl:         body.LogoURL,
		PrimaryColor:    body.PrimaryColor,
		SecondaryColor:  body.SecondaryColor,
		WebsiteUrl:      body.WebsiteURL,
		ContactEmail:    body.ContactEmail,
		ContactPhone:    body.ContactPhone,
		City:            body.City,
		StateProvince:   body.StateProvince,
		Country:         body.Country,
		Bio:             body.Bio,
		FoundedYear:     foundedYear,
		CreatedByUserID: sess.UserID,
	}

	org, err := h.orgService.CreateOrg(r.Context(), params)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}

	Created(w, org)
}

// GetOrg retrieves an organization by ID.
func (h *OrgHandler) GetOrg(w http.ResponseWriter, r *http.Request) {
	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	org, err := h.orgService.GetOrg(r.Context(), orgID)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	Success(w, org)
}

// GetOrgBySlug retrieves an organization by slug.
func (h *OrgHandler) GetOrgBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")

	org, err := h.orgService.GetOrgBySlug(r.Context(), slug)
	if err != nil {
		WriteError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	Success(w, org)
}

// UpdateOrg updates an organization.
func (h *OrgHandler) UpdateOrg(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	var body struct {
		Name           *string `json:"name"`
		LogoURL        *string `json:"logo_url"`
		PrimaryColor   *string `json:"primary_color"`
		SecondaryColor *string `json:"secondary_color"`
		WebsiteURL     *string `json:"website_url"`
		ContactEmail   *string `json:"contact_email"`
		ContactPhone   *string `json:"contact_phone"`
		City           *string `json:"city"`
		StateProvince  *string `json:"state_province"`
		Country        *string `json:"country"`
		Bio            *string `json:"bio"`
		FoundedYear    *int32  `json:"founded_year"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	var foundedYear pgtype.Int4
	if body.FoundedYear != nil {
		foundedYear = pgtype.Int4{Int32: *body.FoundedYear, Valid: true}
	}

	params := generated.UpdateOrgParams{
		Name:           body.Name,
		LogoUrl:        body.LogoURL,
		PrimaryColor:   body.PrimaryColor,
		SecondaryColor: body.SecondaryColor,
		WebsiteUrl:     body.WebsiteURL,
		ContactEmail:   body.ContactEmail,
		ContactPhone:   body.ContactPhone,
		City:           body.City,
		StateProvince:  body.StateProvince,
		Country:        body.Country,
		Bio:            body.Bio,
		FoundedYear:    foundedYear,
	}

	org, err := h.orgService.UpdateOrg(r.Context(), orgID, sess.UserID, sess.Role, params)
	if err != nil {
		WriteError(w, http.StatusForbidden, "UPDATE_FAILED", err.Error())
		return
	}

	Success(w, org)
}

// DeleteOrg soft-deletes an organization.
func (h *OrgHandler) DeleteOrg(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	if err := h.orgService.DeleteOrg(r.Context(), orgID, sess.UserID, sess.Role); err != nil {
		WriteError(w, http.StatusForbidden, "DELETE_FAILED", err.Error())
		return
	}

	Success(w, map[string]string{"message": "organization deleted"})
}

// ListOrgs lists organizations with pagination.
func (h *OrgHandler) ListOrgs(w http.ResponseWriter, r *http.Request) {
	limit, offset := parsePagination(r)

	orgs, total, err := h.orgService.ListOrgs(r.Context(), limit, offset)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	Paginated(w, orgs, total, int(limit), int(offset))
}

// GetMembers returns all active members of an organization.
func (h *OrgHandler) GetMembers(w http.ResponseWriter, r *http.Request) {
	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	members, err := h.orgService.GetMembers(r.Context(), orgID)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "MEMBERS_FAILED", err.Error())
		return
	}

	Success(w, members)
}

// AddMember adds a player to an organization.
func (h *OrgHandler) AddMember(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	var body struct {
		PlayerID int64  `json:"player_id"`
		Role     string `json:"role"`
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
		body.Role = "member"
	}

	member, err := h.orgService.AddMember(r.Context(), orgID, body.PlayerID, body.Role, sess.UserID, sess.Role)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "ADD_FAILED", err.Error())
		return
	}

	Created(w, member)
}

// RemoveMember removes a player from an organization.
func (h *OrgHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	playerID, err := strconv.ParseInt(chi.URLParam(r, "playerID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid player ID")
		return
	}

	if err := h.orgService.RemoveMember(r.Context(), orgID, playerID, sess.UserID, sess.Role); err != nil {
		WriteError(w, http.StatusForbidden, "REMOVE_FAILED", err.Error())
		return
	}

	Success(w, map[string]string{"message": "member removed"})
}

// UpdateMemberRole updates a member's role in an organization.
func (h *OrgHandler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	playerID, err := strconv.ParseInt(chi.URLParam(r, "playerID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid player ID")
		return
	}

	var body struct {
		Role string `json:"role"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	member, err := h.orgService.UpdateMemberRole(r.Context(), orgID, playerID, body.Role, sess.UserID, sess.Role)
	if err != nil {
		WriteError(w, http.StatusForbidden, "UPDATE_FAILED", err.Error())
		return
	}

	Success(w, member)
}

// LeaveSelf allows a player to leave an organization voluntarily.
func (h *OrgHandler) LeaveSelf(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	if err := h.orgService.RemoveMember(r.Context(), orgID, sess.UserID, sess.UserID, sess.Role); err != nil {
		WriteError(w, http.StatusInternalServerError, "LEAVE_FAILED", err.Error())
		return
	}

	Success(w, map[string]string{"message": "left organization"})
}

// BlockOrg allows a player to block an organization.
func (h *OrgHandler) BlockOrg(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	if err := h.orgService.BlockOrg(r.Context(), sess.UserID, orgID); err != nil {
		WriteError(w, http.StatusInternalServerError, "BLOCK_FAILED", err.Error())
		return
	}

	Success(w, map[string]string{"message": "organization blocked"})
}

// UnblockOrg removes an organization block.
func (h *OrgHandler) UnblockOrg(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	orgID, err := strconv.ParseInt(chi.URLParam(r, "orgID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid organization ID")
		return
	}

	if err := h.orgService.UnblockOrg(r.Context(), sess.UserID, orgID); err != nil {
		WriteError(w, http.StatusInternalServerError, "UNBLOCK_FAILED", err.Error())
		return
	}

	Success(w, map[string]string{"message": "organization unblocked"})
}
