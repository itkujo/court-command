// api/service/dashboard.go
package service

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/court-command/court-command/db/generated"
)

// DashboardData holds all data for the player dashboard.
type DashboardData struct {
	UpcomingMatches     []generated.Match                              `json:"upcoming_matches"`
	ActiveRegistrations []generated.GetActiveRegistrationsForPlayerRow `json:"active_registrations"`
	RecentResults       []generated.Match                              `json:"recent_results"`
	Stats               generated.GetPlayerStatsAggregateRow           `json:"stats"`
	Announcements       []generated.Announcement                       `json:"announcements"`
	Teams               []generated.GetDashboardPlayerTeamsRow         `json:"teams"`
}

// DashboardService aggregates data for the player dashboard.
type DashboardService struct {
	queries *generated.Queries
}

// NewDashboardService creates a new DashboardService.
func NewDashboardService(queries *generated.Queries) *DashboardService {
	return &DashboardService{queries: queries}
}

// GetDashboard returns the full player dashboard data.
func (s *DashboardService) GetDashboard(ctx context.Context, userID int64) (DashboardData, error) {
	var data DashboardData

	playerInt8 := pgtype.Int8{Int64: userID, Valid: true}

	// Upcoming matches (limit 10)
	upcoming, err := s.queries.GetUpcomingMatchesForPlayer(ctx, generated.GetUpcomingMatchesForPlayerParams{
		PlayerID: userID,
		Limit:    10,
	})
	if err != nil {
		slog.Warn("dashboard: failed to load upcoming matches", "user_id", userID, "error", err)
	} else {
		data.UpcomingMatches = upcoming
	}
	if data.UpcomingMatches == nil {
		data.UpcomingMatches = []generated.Match{}
	}

	// Active tournament registrations
	active, err := s.queries.GetActiveRegistrationsForPlayer(ctx, playerInt8)
	if err != nil {
		slog.Warn("dashboard: failed to load active registrations", "user_id", userID, "error", err)
	} else {
		data.ActiveRegistrations = active
	}
	if data.ActiveRegistrations == nil {
		data.ActiveRegistrations = []generated.GetActiveRegistrationsForPlayerRow{}
	}

	// Recent match results (limit 20)
	recent, err := s.queries.GetRecentMatchResultsForPlayer(ctx, generated.GetRecentMatchResultsForPlayerParams{
		PlayerID: userID,
		Limit:    20,
	})
	if err != nil {
		slog.Warn("dashboard: failed to load recent results", "user_id", userID, "error", err)
	} else {
		data.RecentResults = recent
	}
	if data.RecentResults == nil {
		data.RecentResults = []generated.Match{}
	}

	// Stats aggregate
	stats, err := s.queries.GetPlayerStatsAggregate(ctx, userID)
	if err != nil {
		slog.Warn("dashboard: failed to load stats", "user_id", userID, "error", err)
	} else {
		data.Stats = stats
	}

	// Announcements from registered tournaments/leagues (limit 20)
	announcements, err := s.queries.GetAnnouncementsForPlayer(ctx, generated.GetAnnouncementsForPlayerParams{
		PlayerID: playerInt8,
		Limit:    20,
	})
	if err != nil {
		slog.Warn("dashboard: failed to load announcements", "user_id", userID, "error", err)
	} else {
		data.Announcements = announcements
	}
	if data.Announcements == nil {
		data.Announcements = []generated.Announcement{}
	}

	// Player's teams
	teams, err := s.queries.GetDashboardPlayerTeams(ctx, userID)
	if err != nil {
		slog.Warn("dashboard: failed to load teams", "user_id", userID, "error", err)
	} else {
		data.Teams = teams
	}
	if data.Teams == nil {
		data.Teams = []generated.GetDashboardPlayerTeamsRow{}
	}

	return data, nil
}
