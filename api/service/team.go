// api/service/team.go
package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/court-command/court-command/db/generated"
)

// TeamService handles team and roster business logic.
type TeamService struct {
	queries *generated.Queries
}

// NewTeamService creates a new TeamService.
func NewTeamService(queries *generated.Queries) *TeamService {
	return &TeamService{queries: queries}
}

// TeamResponse is the public representation of a team.
type TeamResponse struct {
	ID             int64   `json:"id"`
	Name           string  `json:"name"`
	ShortName      string  `json:"short_name"`
	Slug           string  `json:"slug"`
	LogoURL        *string `json:"logo_url,omitempty"`
	PrimaryColor   *string `json:"primary_color,omitempty"`
	SecondaryColor *string `json:"secondary_color,omitempty"`
	OrgID          *int64  `json:"org_id,omitempty"`
	OrgName        *string `json:"org_name,omitempty"`
	OrgSlug        *string `json:"org_slug,omitempty"`
	City           *string `json:"city,omitempty"`
	FoundedYear    *int32  `json:"founded_year,omitempty"`
	Bio            *string `json:"bio,omitempty"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
}

// RosterEntryResponse represents a player on a team roster.
type RosterEntryResponse struct {
	PlayerID     int64   `json:"player_id"`
	PublicID     string  `json:"public_id"`
	FirstName    string  `json:"first_name"`
	LastName     string  `json:"last_name"`
	DisplayName  *string `json:"display_name,omitempty"`
	AvatarURL    *string `json:"avatar_url,omitempty"`
	Role         string  `json:"role"`
	JerseyNumber *int32  `json:"jersey_number,omitempty"`
	JoinedAt     string  `json:"joined_at"`
	Status       string  `json:"status"`
}

func toTeamResponse(t generated.Team) TeamResponse {
	resp := TeamResponse{
		ID:             t.ID,
		Name:           t.Name,
		ShortName:      t.ShortName,
		Slug:           t.Slug,
		LogoURL:        t.LogoUrl,
		PrimaryColor:   t.PrimaryColor,
		SecondaryColor: t.SecondaryColor,
		City:           t.City,
		Bio:            t.Bio,
		CreatedAt:      t.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      t.UpdatedAt.Format(time.RFC3339),
	}

	if t.OrgID.Valid {
		resp.OrgID = &t.OrgID.Int64
	}
	if t.FoundedYear.Valid {
		resp.FoundedYear = &t.FoundedYear.Int32
	}

	return resp
}

// enrichTeamWithOrg looks up the org name/slug for a team that has an org_id.
func (s *TeamService) enrichTeamWithOrg(ctx context.Context, resp *TeamResponse) {
	if resp.OrgID == nil {
		return
	}
	org, err := s.queries.GetOrgByID(ctx, *resp.OrgID)
	if err != nil {
		return // best-effort
	}
	resp.OrgName = &org.Name
	resp.OrgSlug = &org.Slug
}

// ListTeamsByOrg returns all teams belonging to a specific organization.
func (s *TeamService) ListTeamsByOrg(ctx context.Context, orgID int64, limit, offset int32) ([]TeamResponse, int64, error) {
	params := generated.ListTeamsByOrgParams{
		OrgID:  pgtype.Int8{Int64: orgID, Valid: true},
		Limit:  limit,
		Offset: offset,
	}
	teams, err := s.queries.ListTeamsByOrg(ctx, params)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list teams by org: %w", err)
	}
	total, err := s.queries.CountTeamsByOrg(ctx, pgtype.Int8{Int64: orgID, Valid: true})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count teams by org: %w", err)
	}

	result := make([]TeamResponse, len(teams))
	for i, t := range teams {
		result[i] = toTeamResponse(t)
		// Org name is already known since all teams share the same org
	}
	return result, total, nil
}

// CreateTeam creates a new team.
func (s *TeamService) CreateTeam(ctx context.Context, params generated.CreateTeamParams) (TeamResponse, error) {
	// Validate short_name length
	if len(params.ShortName) < 2 || len(params.ShortName) > 4 {
		return TeamResponse{}, &ValidationError{Message: "short_name must be 2-4 characters"}
	}
	params.ShortName = strings.ToUpper(params.ShortName)

	// Generate slug
	params.Slug = generateSlug(params.Name)

	// Check for slug collision and append number if needed
	slugFound := false
	for i := 0; i < 100; i++ {
		candidate := params.Slug
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", params.Slug, i)
		}
		count, err := s.queries.CheckTeamSlugExists(ctx, candidate)
		if err != nil {
			return TeamResponse{}, fmt.Errorf("failed to check slug: %w", err)
		}
		if count == 0 {
			params.Slug = candidate
			slugFound = true
			break
		}
	}
	if !slugFound {
		return TeamResponse{}, &ConflictError{Message: "unable to generate unique slug, try a different name"}
	}

	team, err := s.queries.CreateTeam(ctx, params)
	if err != nil {
		return TeamResponse{}, fmt.Errorf("failed to create team: %w", err)
	}

	return toTeamResponse(team), nil
}

// GetTeam retrieves a team by ID.
func (s *TeamService) GetTeam(ctx context.Context, teamID int64) (TeamResponse, error) {
	team, err := s.queries.GetTeamByID(ctx, teamID)
	if err != nil {
		return TeamResponse{}, &NotFoundError{Message: "team not found"}
	}
	resp := toTeamResponse(team)
	s.enrichTeamWithOrg(ctx, &resp)
	return resp, nil
}

// GetTeamBySlug retrieves a team by slug.
func (s *TeamService) GetTeamBySlug(ctx context.Context, slug string) (TeamResponse, error) {
	team, err := s.queries.GetTeamBySlug(ctx, slug)
	if err != nil {
		return TeamResponse{}, &NotFoundError{Message: "team not found"}
	}
	resp := toTeamResponse(team)
	s.enrichTeamWithOrg(ctx, &resp)
	return resp, nil
}

// UpdateTeam updates a team's details.
func (s *TeamService) UpdateTeam(ctx context.Context, teamID int64, params generated.UpdateTeamParams) (TeamResponse, error) {
	params.TeamID = teamID

	// Validate short_name if provided
	if params.ShortName != nil {
		if len(*params.ShortName) < 2 || len(*params.ShortName) > 4 {
			return TeamResponse{}, &ValidationError{Message: "short_name must be 2-4 characters"}
		}
		upper := strings.ToUpper(*params.ShortName)
		params.ShortName = &upper
	}

	team, err := s.queries.UpdateTeam(ctx, params)
	if err != nil {
		return TeamResponse{}, fmt.Errorf("failed to update team: %w", err)
	}
	return toTeamResponse(team), nil
}

// DeleteTeam soft-deletes a team.
func (s *TeamService) DeleteTeam(ctx context.Context, teamID int64) error {
	return s.queries.SoftDeleteTeam(ctx, teamID)
}

// ListTeams lists teams with pagination.
func (s *TeamService) ListTeams(ctx context.Context, limit, offset int32) ([]TeamResponse, int64, error) {
	teams, err := s.queries.ListTeams(ctx, generated.ListTeamsParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list teams: %w", err)
	}

	count, err := s.queries.CountTeams(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count teams: %w", err)
	}

	result := make([]TeamResponse, len(teams))
	for i, t := range teams {
		result[i] = toTeamResponse(t)
	}
	s.enrichTeamsWithOrg(ctx, result)

	return result, count, nil
}

// SearchTeams searches teams with filters.
func (s *TeamService) SearchTeams(ctx context.Context, params generated.SearchTeamsParams) ([]TeamResponse, int64, error) {
	teams, err := s.queries.SearchTeams(ctx, params)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search teams: %w", err)
	}

	count, err := s.queries.CountSearchTeams(ctx, generated.CountSearchTeamsParams{
		Query: params.Query,
		OrgID: params.OrgID,
		City:  params.City,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count teams: %w", err)
	}

	result := make([]TeamResponse, len(teams))
	for i, t := range teams {
		result[i] = toTeamResponse(t)
	}
	s.enrichTeamsWithOrg(ctx, result)

	return result, count, nil
}

// enrichTeamsWithOrg batch-enriches a slice of teams with org names.
// Uses a map to avoid N+1 queries when multiple teams share the same org.
func (s *TeamService) enrichTeamsWithOrg(ctx context.Context, teams []TeamResponse) {
	orgCache := make(map[int64]*generated.Organization)
	for i := range teams {
		if teams[i].OrgID == nil {
			continue
		}
		orgID := *teams[i].OrgID
		org, ok := orgCache[orgID]
		if !ok {
			fetched, err := s.queries.GetOrgByID(ctx, orgID)
			if err != nil {
				continue // best-effort
			}
			org = &fetched
			orgCache[orgID] = org
		}
		teams[i].OrgName = &org.Name
		teams[i].OrgSlug = &org.Slug
	}
}

// AddPlayerToTeam adds a player to a team's roster.
func (s *TeamService) AddPlayerToTeam(ctx context.Context, teamID, playerID int64, role string, jerseyNumber pgtype.Int4) (generated.TeamRoster, error) {
	// Validate role
	validRoles := map[string]bool{"player": true, "captain": true, "substitute": true}
	if !validRoles[role] {
		return generated.TeamRoster{}, &ValidationError{Message: "role must be one of: player, captain, substitute"}
	}

	// Check if player is already on team
	count, err := s.queries.CheckPlayerOnTeam(ctx, generated.CheckPlayerOnTeamParams{
		TeamID:   teamID,
		PlayerID: playerID,
	})
	if err != nil {
		return generated.TeamRoster{}, fmt.Errorf("failed to check roster: %w", err)
	}
	if count > 0 {
		return generated.TeamRoster{}, &ConflictError{Message: "player is already on this team"}
	}

	entry, err := s.queries.AddPlayerToTeam(ctx, generated.AddPlayerToTeamParams{
		TeamID:       teamID,
		PlayerID:     playerID,
		Role:         role,
		JerseyNumber: jerseyNumber,
	})
	if err != nil {
		return generated.TeamRoster{}, fmt.Errorf("failed to add player to team: %w", err)
	}

	return entry, nil
}

// RemovePlayerFromTeam removes a player from a team's roster (soft-delete via left_at).
func (s *TeamService) RemovePlayerFromTeam(ctx context.Context, teamID, playerID int64) error {
	return s.queries.RemovePlayerFromTeam(ctx, generated.RemovePlayerFromTeamParams{
		TeamID:   teamID,
		PlayerID: playerID,
	})
}

// GetRoster returns the active roster for a team.
func (s *TeamService) GetRoster(ctx context.Context, teamID int64) ([]RosterEntryResponse, error) {
	rows, err := s.queries.GetActiveRoster(ctx, teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to get roster: %w", err)
	}

	result := make([]RosterEntryResponse, len(rows))
	for i, r := range rows {
		entry := RosterEntryResponse{
			PlayerID:    r.PlayerID,
			PublicID:    r.PublicID,
			FirstName:   r.FirstName,
			LastName:    r.LastName,
			DisplayName: r.DisplayName,
			AvatarURL:   r.AvatarUrl,
			Role:        r.Role,
			JoinedAt:    r.JoinedAt.Format(time.RFC3339),
			Status:      r.Status,
		}
		if r.JerseyNumber.Valid {
			entry.JerseyNumber = &r.JerseyNumber.Int32
		}
		result[i] = entry
	}

	return result, nil
}
