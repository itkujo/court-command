// backend/service/search.go
package service

import (
	"context"

	"github.com/court-command/court-command/db/generated"
)

// SearchResults holds grouped search results.
type SearchResults struct {
	Players       []generated.SearchPlayersGlobalRow       `json:"players"`
	Teams         []generated.SearchTeamsGlobalRow         `json:"teams"`
	Organizations []generated.SearchOrganizationsGlobalRow `json:"organizations"`
	Tournaments   []generated.SearchTournamentsGlobalRow   `json:"tournaments"`
	Leagues       []generated.SearchLeaguesGlobalRow       `json:"leagues"`
	Venues        []generated.SearchVenuesGlobalRow        `json:"venues"`
}

// SearchService handles global search across all entity types.
type SearchService struct {
	queries *generated.Queries
}

// NewSearchService creates a new SearchService.
func NewSearchService(queries *generated.Queries) *SearchService {
	return &SearchService{queries: queries}
}

// Search performs a global search across all entity types.
// Returns top 5 results per type.
func (s *SearchService) Search(ctx context.Context, query string) (SearchResults, error) {
	var results SearchResults
	var limit int32 = 5

	players, err := s.queries.SearchPlayersGlobal(ctx, generated.SearchPlayersGlobalParams{
		Query: query,
		Limit: limit,
	})
	if err == nil {
		results.Players = players
	}
	if results.Players == nil {
		results.Players = []generated.SearchPlayersGlobalRow{}
	}

	teams, err := s.queries.SearchTeamsGlobal(ctx, generated.SearchTeamsGlobalParams{
		Query: query,
		Limit: limit,
	})
	if err == nil {
		results.Teams = teams
	}
	if results.Teams == nil {
		results.Teams = []generated.SearchTeamsGlobalRow{}
	}

	orgs, err := s.queries.SearchOrganizationsGlobal(ctx, generated.SearchOrganizationsGlobalParams{
		Query: query,
		Limit: limit,
	})
	if err == nil {
		results.Organizations = orgs
	}
	if results.Organizations == nil {
		results.Organizations = []generated.SearchOrganizationsGlobalRow{}
	}

	tournaments, err := s.queries.SearchTournamentsGlobal(ctx, generated.SearchTournamentsGlobalParams{
		Query: query,
		Limit: limit,
	})
	if err == nil {
		results.Tournaments = tournaments
	}
	if results.Tournaments == nil {
		results.Tournaments = []generated.SearchTournamentsGlobalRow{}
	}

	leagues, err := s.queries.SearchLeaguesGlobal(ctx, generated.SearchLeaguesGlobalParams{
		Query: query,
		Limit: limit,
	})
	if err == nil {
		results.Leagues = leagues
	}
	if results.Leagues == nil {
		results.Leagues = []generated.SearchLeaguesGlobalRow{}
	}

	venues, err := s.queries.SearchVenuesGlobal(ctx, generated.SearchVenuesGlobalParams{
		Query: query,
		Limit: limit,
	})
	if err == nil {
		results.Venues = venues
	}
	if results.Venues == nil {
		results.Venues = []generated.SearchVenuesGlobalRow{}
	}

	return results, nil
}
