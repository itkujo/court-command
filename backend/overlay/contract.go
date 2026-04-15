// Package overlay contains the extraction-ready overlay subsystem.
// It imports from core packages but nothing outside imports from it.
package overlay

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
