// backend/service/organization.go
package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/court-command/court-command/db/generated"
)

// OrganizationService handles organization business logic.
type OrganizationService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

// NewOrganizationService creates a new OrganizationService.
func NewOrganizationService(queries *generated.Queries, pool *pgxpool.Pool) *OrganizationService {
	return &OrganizationService{queries: queries, pool: pool}
}

// OrgResponse is the public representation of an organization.
type OrgResponse struct {
	ID             int64    `json:"id"`
	Name           string   `json:"name"`
	Slug           string   `json:"slug"`
	LogoURL        *string  `json:"logo_url,omitempty"`
	PrimaryColor   *string  `json:"primary_color,omitempty"`
	SecondaryColor *string  `json:"secondary_color,omitempty"`
	WebsiteURL     *string  `json:"website_url,omitempty"`
	ContactEmail   *string  `json:"contact_email,omitempty"`
	ContactPhone   *string  `json:"contact_phone,omitempty"`
	City           *string  `json:"city,omitempty"`
	StateProvince  *string  `json:"state_province,omitempty"`
	Country        *string  `json:"country,omitempty"`
	PostalCode     *string  `json:"postal_code,omitempty"`
	AddressLine1   *string  `json:"address_line_1,omitempty"`
	AddressLine2   *string  `json:"address_line_2,omitempty"`
	Latitude       *float64 `json:"latitude,omitempty"`
	Longitude      *float64 `json:"longitude,omitempty"`
	Bio            *string  `json:"bio,omitempty"`
	FoundedYear    *int32   `json:"founded_year,omitempty"`
	CreatedAt      string   `json:"created_at"`
	UpdatedAt      string   `json:"updated_at"`
}

// OrgMemberResponse represents a member of an organization.
type OrgMemberResponse struct {
	PlayerID    int64   `json:"player_id"`
	PublicID    string  `json:"public_id"`
	FirstName   string  `json:"first_name"`
	LastName    string  `json:"last_name"`
	DisplayName *string `json:"display_name,omitempty"`
	AvatarURL   *string `json:"avatar_url,omitempty"`
	Email       *string `json:"email,omitempty"`
	Role        string  `json:"role"`
	JoinedAt    string  `json:"joined_at"`
	Status      string  `json:"status"`
}

func toOrgResponse(o generated.Organization) OrgResponse {
	var foundedYear *int32
	if o.FoundedYear.Valid {
		foundedYear = &o.FoundedYear.Int32
	}

	var lat, lng *float64
	if o.Latitude.Valid {
		lat = &o.Latitude.Float64
	}
	if o.Longitude.Valid {
		lng = &o.Longitude.Float64
	}

	return OrgResponse{
		ID:             o.ID,
		Name:           o.Name,
		Slug:           o.Slug,
		LogoURL:        o.LogoUrl,
		PrimaryColor:   o.PrimaryColor,
		SecondaryColor: o.SecondaryColor,
		WebsiteURL:     o.WebsiteUrl,
		ContactEmail:   o.ContactEmail,
		ContactPhone:   o.ContactPhone,
		City:           o.City,
		StateProvince:  o.StateProvince,
		Country:        o.Country,
		PostalCode:     o.PostalCode,
		AddressLine1:   o.AddressLine1,
		AddressLine2:   o.AddressLine2,
		Latitude:       lat,
		Longitude:      lng,
		Bio:            o.Bio,
		FoundedYear:    foundedYear,
		CreatedAt:      o.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      o.UpdatedAt.Format(time.RFC3339),
	}
}

// CreateOrg creates a new organization. The creator automatically becomes an admin member.
func (s *OrganizationService) CreateOrg(ctx context.Context, params generated.CreateOrganizationParams) (OrgResponse, error) {
	// Generate slug
	params.Slug = generateSlug(params.Name)

	// Check for slug collision
	slugFound := false
	for i := 0; i < 100; i++ {
		candidate := params.Slug
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", params.Slug, i)
		}
		count, err := s.queries.CheckOrgSlugExists(ctx, candidate)
		if err != nil {
			return OrgResponse{}, fmt.Errorf("failed to check slug: %w", err)
		}
		if count == 0 {
			params.Slug = candidate
			slugFound = true
			break
		}
	}
	if !slugFound {
		return OrgResponse{}, &ConflictError{Message: "unable to generate unique slug, try a different name"}
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return OrgResponse{}, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	txQueries := s.queries.WithTx(tx)

	org, err := txQueries.CreateOrganization(ctx, params)
	if err != nil {
		return OrgResponse{}, fmt.Errorf("failed to create organization: %w", err)
	}

	// Add creator as admin member
	_, err = txQueries.AddMemberToOrg(ctx, generated.AddMemberToOrgParams{
		OrgID:    org.ID,
		PlayerID: params.CreatedByUserID,
		Role:     "admin",
	})
	if err != nil {
		return OrgResponse{}, fmt.Errorf("failed to add creator as admin: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return OrgResponse{}, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return toOrgResponse(org), nil
}

// GetOrg retrieves an organization by ID.
func (s *OrganizationService) GetOrg(ctx context.Context, orgID int64) (OrgResponse, error) {
	org, err := s.queries.GetOrgByID(ctx, orgID)
	if err != nil {
		return OrgResponse{}, &NotFoundError{Message: "organization not found"}
	}
	return toOrgResponse(org), nil
}

// GetOrgBySlug retrieves an organization by slug.
func (s *OrganizationService) GetOrgBySlug(ctx context.Context, slug string) (OrgResponse, error) {
	org, err := s.queries.GetOrgBySlug(ctx, slug)
	if err != nil {
		return OrgResponse{}, &NotFoundError{Message: "organization not found"}
	}
	return toOrgResponse(org), nil
}

// UpdateOrg updates an organization's details. Requires admin role in the org.
func (s *OrganizationService) UpdateOrg(ctx context.Context, orgID int64, requesterID int64, requesterRole string, params generated.UpdateOrgParams) (OrgResponse, error) {
	if err := s.requireOrgAdmin(ctx, orgID, requesterID, requesterRole); err != nil {
		return OrgResponse{}, err
	}

	params.OrgID = orgID
	org, err := s.queries.UpdateOrg(ctx, params)
	if err != nil {
		return OrgResponse{}, fmt.Errorf("failed to update organization: %w", err)
	}
	return toOrgResponse(org), nil
}

// DeleteOrg soft-deletes an organization.
func (s *OrganizationService) DeleteOrg(ctx context.Context, orgID int64, requesterID int64, requesterRole string) error {
	if err := s.requireOrgAdmin(ctx, orgID, requesterID, requesterRole); err != nil {
		return err
	}
	return s.queries.SoftDeleteOrg(ctx, orgID)
}

// ListOrgs lists organizations with pagination.
func (s *OrganizationService) ListOrgs(ctx context.Context, limit, offset int32) ([]OrgResponse, int64, error) {
	orgs, err := s.queries.ListOrgs(ctx, generated.ListOrgsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list organizations: %w", err)
	}

	count, err := s.queries.CountOrgs(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count organizations: %w", err)
	}

	result := make([]OrgResponse, len(orgs))
	for i, o := range orgs {
		result[i] = toOrgResponse(o)
	}

	return result, count, nil
}

// SearchOrgs searches organizations with filters.
func (s *OrganizationService) SearchOrgs(ctx context.Context, params generated.SearchOrgsParams) ([]OrgResponse, error) {
	orgs, err := s.queries.SearchOrgs(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to search organizations: %w", err)
	}
	result := make([]OrgResponse, len(orgs))
	for i, o := range orgs {
		result[i] = toOrgResponse(o)
	}
	return result, nil
}

// CountSearchOrgs counts organizations matching search filters.
func (s *OrganizationService) CountSearchOrgs(ctx context.Context, params generated.CountSearchOrgsParams) (int64, error) {
	return s.queries.CountSearchOrgs(ctx, params)
}

// AddMember adds a player to an organization.
func (s *OrganizationService) AddMember(ctx context.Context, orgID, playerID int64, role string, requesterID int64, requesterRole string) (generated.OrgMembership, error) {
	if err := s.requireOrgAdmin(ctx, orgID, requesterID, requesterRole); err != nil {
		return generated.OrgMembership{}, err
	}

	// Check if player has blocked this org
	blocked, err := s.queries.IsOrgBlocked(ctx, generated.IsOrgBlockedParams{
		PlayerID: playerID,
		OrgID:    orgID,
	})
	if err != nil {
		return generated.OrgMembership{}, fmt.Errorf("failed to check block status: %w", err)
	}
	if blocked > 0 {
		return generated.OrgMembership{}, &ValidationError{Message: "this player is unavailable"}
	}

	// Check if already a member
	existing, err := s.queries.CheckMemberInOrg(ctx, generated.CheckMemberInOrgParams{
		OrgID:    orgID,
		PlayerID: playerID,
	})
	if err != nil {
		return generated.OrgMembership{}, fmt.Errorf("failed to check membership: %w", err)
	}
	if existing > 0 {
		return generated.OrgMembership{}, &ConflictError{Message: "player is already a member of this organization"}
	}

	validRoles := map[string]bool{"member": true, "admin": true}
	if !validRoles[role] {
		return generated.OrgMembership{}, &ValidationError{Message: "role must be one of: member, admin"}
	}

	member, err := s.queries.AddMemberToOrg(ctx, generated.AddMemberToOrgParams{
		OrgID:    orgID,
		PlayerID: playerID,
		Role:     role,
	})
	if err != nil {
		return generated.OrgMembership{}, fmt.Errorf("failed to add member: %w", err)
	}

	return member, nil
}

// RemoveMember removes a player from an organization.
// Also deactivates their roster entries on all teams in this org.
func (s *OrganizationService) RemoveMember(ctx context.Context, orgID, playerID int64, requesterID int64, requesterRole string) error {
	isSelf := requesterID == playerID
	if !isSelf {
		if err := s.requireOrgAdmin(ctx, orgID, requesterID, requesterRole); err != nil {
			return err
		}
	}

	// Deactivate team roster entries for this org
	if err := s.queries.DeactivatePlayerRostersForOrg(ctx, generated.DeactivatePlayerRostersForOrgParams{
		PlayerID: playerID,
		OrgID:    pgtype.Int8{Int64: orgID, Valid: true},
	}); err != nil {
		return fmt.Errorf("failed to deactivate roster entries: %w", err)
	}

	return s.queries.RemoveMemberFromOrg(ctx, generated.RemoveMemberFromOrgParams{
		OrgID:    orgID,
		PlayerID: playerID,
	})
}

// GetMembers returns all active members of an organization.
func (s *OrganizationService) GetMembers(ctx context.Context, orgID int64) ([]OrgMemberResponse, error) {
	rows, err := s.queries.GetOrgMembers(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("failed to get members: %w", err)
	}

	result := make([]OrgMemberResponse, len(rows))
	for i, r := range rows {
		result[i] = OrgMemberResponse{
			PlayerID:    r.PlayerID,
			PublicID:    r.PublicID,
			FirstName:   r.FirstName,
			LastName:    r.LastName,
			DisplayName: r.DisplayName,
			AvatarURL:   r.AvatarUrl,
			Email:       r.Email,
			Role:        r.Role,
			JoinedAt:    r.JoinedAt.Format(time.RFC3339),
			Status:      r.Status,
		}
	}

	return result, nil
}

// UpdateMemberRole updates a member's role in an organization.
func (s *OrganizationService) UpdateMemberRole(ctx context.Context, orgID, playerID int64, role string, requesterID int64, requesterRole string) (generated.OrgMembership, error) {
	if err := s.requireOrgAdmin(ctx, orgID, requesterID, requesterRole); err != nil {
		return generated.OrgMembership{}, err
	}

	validRoles := map[string]bool{"member": true, "admin": true}
	if !validRoles[role] {
		return generated.OrgMembership{}, &ValidationError{Message: "role must be one of: member, admin"}
	}

	member, err := s.queries.UpdateMemberRole(ctx, generated.UpdateMemberRoleParams{
		OrgID:    orgID,
		PlayerID: playerID,
		Role:     role,
	})
	if err != nil {
		return generated.OrgMembership{}, fmt.Errorf("failed to update member role: %w", err)
	}

	return member, nil
}

// BlockOrg allows a player to block an organization from adding them.
func (s *OrganizationService) BlockOrg(ctx context.Context, playerID, orgID int64) error {
	// Remove membership first if it exists (ignore "not found" since they may not be a member)
	if err := s.queries.RemoveMemberFromOrg(ctx, generated.RemoveMemberFromOrgParams{
		OrgID:    orgID,
		PlayerID: playerID,
	}); err != nil {
		// RemoveMemberFromOrg uses :exec, so no rows affected is not an error.
		// Only fail on actual DB errors.
		return fmt.Errorf("failed to remove membership: %w", err)
	}

	// Deactivate roster entries
	if err := s.queries.DeactivatePlayerRostersForOrg(ctx, generated.DeactivatePlayerRostersForOrgParams{
		PlayerID: playerID,
		OrgID:    pgtype.Int8{Int64: orgID, Valid: true},
	}); err != nil {
		return fmt.Errorf("failed to deactivate roster entries: %w", err)
	}

	_, err := s.queries.BlockOrg(ctx, generated.BlockOrgParams{
		PlayerID: playerID,
		OrgID:    orgID,
	})
	if err != nil {
		// BlockOrg uses ON CONFLICT DO NOTHING RETURNING * with :one.
		// If already blocked, no row is returned and pgx returns ErrNoRows.
		// Treat this as idempotent success.
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return fmt.Errorf("failed to block organization: %w", err)
	}

	return nil
}

// UnblockOrg removes an organization block.
func (s *OrganizationService) UnblockOrg(ctx context.Context, playerID, orgID int64) error {
	return s.queries.UnblockOrg(ctx, generated.UnblockOrgParams{
		PlayerID: playerID,
		OrgID:    orgID,
	})
}

// requireOrgAdmin checks if the requester is an admin of the org or a platform admin.
func (s *OrganizationService) requireOrgAdmin(ctx context.Context, orgID, requesterID int64, requesterRole string) error {
	if requesterRole == "platform_admin" {
		return nil
	}

	role, err := s.queries.GetMemberRole(ctx, generated.GetMemberRoleParams{
		OrgID:    orgID,
		PlayerID: requesterID,
	})
	if err != nil || role != "admin" {
		return &ForbiddenError{Message: "you must be an organization admin to perform this action"}
	}

	return nil
}

// MyOrgResponse extends OrgResponse with the user's membership role.
type MyOrgResponse struct {
	OrgResponse
	MembershipRole string `json:"membership_role"`
}

// ListByUser returns all organizations the given user is a member of.
func (s *OrganizationService) ListByUser(ctx context.Context, userID int64) ([]MyOrgResponse, error) {
	rows, err := s.queries.ListOrgsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("listing user orgs: %w", err)
	}

	results := make([]MyOrgResponse, 0, len(rows))
	for _, r := range rows {
		var foundedYear *int32
		if r.FoundedYear.Valid {
			foundedYear = &r.FoundedYear.Int32
		}
		results = append(results, MyOrgResponse{
			OrgResponse: OrgResponse{
				ID:             r.ID,
				Name:           r.Name,
				Slug:           r.Slug,
				LogoURL:        r.LogoUrl,
				PrimaryColor:   r.PrimaryColor,
				SecondaryColor: r.SecondaryColor,
				WebsiteURL:     r.WebsiteUrl,
				ContactEmail:   r.ContactEmail,
				ContactPhone:   r.ContactPhone,
				City:           r.City,
				StateProvince:  r.StateProvince,
				Country:        r.Country,
				Bio:            r.Bio,
				FoundedYear:    foundedYear,
				CreatedAt:      r.CreatedAt.Format(time.RFC3339),
				UpdatedAt:      r.UpdatedAt.Format(time.RFC3339),
			},
			MembershipRole: r.MembershipRole,
		})
	}
	return results, nil
}
