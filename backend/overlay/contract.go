// Package overlay contains the extraction-ready overlay subsystem.
// It imports from core packages but nothing outside imports from it.
package overlay

import "encoding/json"

// ApplyDataOverrides applies per-court field-level overrides to resolved overlay data.
// Keys match canonical OverlayData JSON field names (e.g. "team_1_name", "division_name").
// Only non-empty string values are applied. Numeric overrides use their JSON field names
// (e.g. "team_1_score", "serving_team").
func ApplyDataOverrides(data *OverlayData, overrides json.RawMessage) {
	if len(overrides) == 0 || string(overrides) == "{}" {
		return
	}

	var m map[string]interface{}
	if err := json.Unmarshal(overrides, &m); err != nil {
		return
	}

	for key, val := range m {
		switch key {
		// Team 1 fields
		case "team_1_name":
			if s, ok := val.(string); ok {
				data.Team1.Name = s
			}
		case "team_1_short_name":
			if s, ok := val.(string); ok {
				data.Team1.ShortName = s
			}
		case "team_1_score":
			if n, ok := val.(float64); ok {
				data.Team1.Score = int(n)
			}
		case "team_1_color":
			if s, ok := val.(string); ok {
				data.Team1.Color = s
			}
		case "team_1_logo_url":
			if s, ok := val.(string); ok {
				data.Team1.LogoURL = s
			}
		case "team_1_game_wins":
			if n, ok := val.(float64); ok {
				data.Team1.GameWins = int(n)
			}
		case "team_1_player_1_name":
			if s, ok := val.(string); ok {
				setPlayerName(&data.Team1, 0, s)
			}
		case "team_1_player_2_name":
			if s, ok := val.(string); ok {
				setPlayerName(&data.Team1, 1, s)
			}
		// Team 2 fields
		case "team_2_name":
			if s, ok := val.(string); ok {
				data.Team2.Name = s
			}
		case "team_2_short_name":
			if s, ok := val.(string); ok {
				data.Team2.ShortName = s
			}
		case "team_2_score":
			if n, ok := val.(float64); ok {
				data.Team2.Score = int(n)
			}
		case "team_2_color":
			if s, ok := val.(string); ok {
				data.Team2.Color = s
			}
		case "team_2_logo_url":
			if s, ok := val.(string); ok {
				data.Team2.LogoURL = s
			}
		case "team_2_game_wins":
			if n, ok := val.(float64); ok {
				data.Team2.GameWins = int(n)
			}
		case "team_2_player_1_name":
			if s, ok := val.(string); ok {
				setPlayerName(&data.Team2, 0, s)
			}
		case "team_2_player_2_name":
			if s, ok := val.(string); ok {
				setPlayerName(&data.Team2, 1, s)
			}
		// Match context fields
		case "division_name":
			if s, ok := val.(string); ok {
				data.DivisionName = s
			}
		case "tournament_name":
			if s, ok := val.(string); ok {
				data.TournamentName = s
			}
		case "league_name":
			if s, ok := val.(string); ok {
				data.LeagueName = s
			}
		case "round_label":
			if s, ok := val.(string); ok {
				data.RoundLabel = s
			}
		case "match_info":
			if s, ok := val.(string); ok {
				data.MatchInfo = s
			}
		case "court_name":
			if s, ok := val.(string); ok {
				data.CourtName = s
			}
		case "tournament_logo_url":
			if s, ok := val.(string); ok {
				data.TournamentLogoURL = s
			}
		case "league_logo_url":
			if s, ok := val.(string); ok {
				data.LeagueLogoURL = s
			}
		case "match_status":
			if s, ok := val.(string); ok {
				data.MatchStatus = s
			}
		case "serving_team":
			if n, ok := val.(float64); ok {
				data.ServingTeam = int(n)
			}
		case "server_number":
			if n, ok := val.(float64); ok {
				data.ServerNumber = int(n)
			}
		case "current_game":
			if n, ok := val.(float64); ok {
				data.CurrentGame = int(n)
			}
		}
	}
}

// setPlayerName assigns a player-slot name on the given team, growing the
// Players slice with blank entries as needed so the target index is always
// valid. Used by ApplyDataOverrides for team_N_player_M_name keys.
func setPlayerName(team *OverlayTeamData, index int, name string) {
	for len(team.Players) <= index {
		team.Players = append(team.Players, PlayerBrief{})
	}
	team.Players[index].Name = name
}

// OverlayData is the canonical data contract that all overlay renderers consume.
// Whether data comes from Court Command's own match system or a third-party API,
// it gets normalized into this structure before reaching the overlay.
type OverlayData struct {
	MatchStatus        string           `json:"match_status"` // scheduled, in_progress, completed, bye, forfeit, cancelled, idle
	Team1              OverlayTeamData  `json:"team_1"`
	Team2              OverlayTeamData  `json:"team_2"`
	ServingTeam        int              `json:"serving_team"`  // 1 or 2
	ServerNumber       int              `json:"server_number"` // 1 or 2
	CurrentGame        int              `json:"current_game"`
	CompletedGames     []GameResult     `json:"completed_games"`
	TimeoutsRemaining1 int              `json:"timeouts_remaining_1"`
	TimeoutsRemaining2 int              `json:"timeouts_remaining_2"`
	DivisionName       string           `json:"division_name"`
	TournamentName     string           `json:"tournament_name"`
	LeagueName         string           `json:"league_name"`
	RoundLabel         string           `json:"round_label"`
	MatchInfo          string           `json:"match_info"`
	SponsorLogos       []SponsorLogo    `json:"sponsor_logos"`
	TournamentLogoURL  string           `json:"tournament_logo_url"`
	LeagueLogoURL      string           `json:"league_logo_url"`
	IsPaused           bool             `json:"is_paused"`
	SeriesScore        *SeriesScoreData `json:"series_score,omitempty"` // Only set for series matches
	NextMatch          *NextMatchData   `json:"next_match,omitempty"`   // From court queue
	CourtName          string           `json:"court_name"`
}

// OverlayTeamData represents one team's data for overlay rendering.
type OverlayTeamData struct {
	Name      string        `json:"name"`
	ShortName string        `json:"short_name"`
	Score     int           `json:"score"`
	Color     string        `json:"color"` // hex, e.g. "#3b82f6"
	LogoURL   string        `json:"logo_url"`
	Players   []PlayerBrief `json:"players"`
	GameWins  int           `json:"game_wins"`
}

// PlayerBrief is minimal player info for overlay display.
type PlayerBrief struct {
	Name string `json:"name"`
}

// GameResult holds per-game scores.
type GameResult struct {
	GameNum    int `json:"game_num"`
	ScoreTeam1 int `json:"score_team_1"`
	ScoreTeam2 int `json:"score_team_2"`
	Winner     int `json:"winner"` // 1 or 2
}

// SponsorLogo represents a sponsor for overlay display.
type SponsorLogo struct {
	Name    string `json:"name"`
	LogoURL string `json:"logo_url"`
	LinkURL string `json:"link_url"`
	Tier    string `json:"tier"`
}

// SeriesScoreData is the MLP-style series tally.
type SeriesScoreData struct {
	Team1Wins int `json:"team_1_wins"`
	Team2Wins int `json:"team_2_wins"`
	BestOf    int `json:"best_of"`
}

// NextMatchData is the "coming up next" info from the court queue.
type NextMatchData struct {
	Team1Name    string `json:"team_1_name"`
	Team2Name    string `json:"team_2_name"`
	DivisionName string `json:"division_name"`
	RoundLabel   string `json:"round_label"`
}

// DemoData returns a hardcoded sample OverlayData for preview rendering
// when no live match is active.
func DemoData() OverlayData {
	return OverlayData{
		MatchStatus: "in_progress",
		Team1: OverlayTeamData{
			Name:      "Fire Aces",
			ShortName: "FIRE",
			Score:     7,
			Color:     "#dc2626",
			LogoURL:   "",
			Players:   []PlayerBrief{{Name: "Alex Johnson"}, {Name: "Sam Rivera"}},
			GameWins:  1,
		},
		Team2: OverlayTeamData{
			Name:      "Thunder Smash",
			ShortName: "THDR",
			Score:     5,
			Color:     "#2563eb",
			LogoURL:   "",
			Players:   []PlayerBrief{{Name: "Jordan Lee"}, {Name: "Casey Morgan"}},
			GameWins:  0,
		},
		ServingTeam:        1,
		ServerNumber:       2,
		CurrentGame:        2,
		CompletedGames:     []GameResult{{GameNum: 1, ScoreTeam1: 11, ScoreTeam2: 9, Winner: 1}},
		TimeoutsRemaining1: 1,
		TimeoutsRemaining2: 2,
		DivisionName:       "Open Doubles",
		TournamentName:     "Summer Slam 2026",
		LeagueName:         "Metro Pickleball League",
		RoundLabel:         "Semifinal",
		MatchInfo:          "Court 3 · Best of 3",
		SponsorLogos:       []SponsorLogo{{Name: "JOOLA", LogoURL: "", Tier: "title"}},
		TournamentLogoURL:  "",
		LeagueLogoURL:      "",
		IsPaused:           false,
		CourtName:          "Court 3",
	}
}
