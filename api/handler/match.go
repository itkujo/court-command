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

// MatchHandler handles match HTTP requests.
type MatchHandler struct {
	service *service.MatchService
}

// NewMatchHandler creates a new MatchHandler.
func NewMatchHandler(service *service.MatchService) *MatchHandler {
	return &MatchHandler{service: service}
}

// Routes returns a chi.Router with top-level match routes.
// Routes returns the chi.Router for authenticated match endpoints.
// Public read endpoints (GET /public/{publicID}, GET /public/{publicID}/events)
// are NOT registered here; the router mounts them directly on /matches outside
// the RequireAuth middleware because the scoreboard and spectator match pages
// are unauthenticated. See router/router.go for the split.
func (h *MatchHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Post("/", h.Create)
	r.Get("/quick", h.ListQuickMatches)
	r.Get("/{matchID}", h.GetByID)
	r.Patch("/{matchID}/status", h.UpdateStatus)
	r.Post("/{matchID}/start", h.StartMatch)
	r.Post("/{matchID}/complete", h.CompleteMatch)
	r.Post("/{matchID}/events", h.RecordEvent)
	r.Get("/{matchID}/events", h.GetMatchEvents)
	r.Post("/{matchID}/undo", h.Undo)
	r.Patch("/{matchID}/court", h.AssignToCourt)
	r.Patch("/{matchID}/scoring-config", h.UpdateScoringConfig)
	r.Patch("/{matchID}/notes", h.UpdateNotes)
	r.Patch("/{matchID}/referee", h.UpdateReferee)
	r.Patch("/{matchID}/teams", h.UpdateTeams)
	r.Patch("/{matchID}/bracket-wiring", h.UpdateBracketWiring)

	// Scoring engine routes (by public ID) — write actions, authenticated.
	r.Post("/public/{publicID}/point", h.ScorePoint)
	r.Post("/public/{publicID}/sideout", h.HandleSideOut)
	r.Post("/public/{publicID}/remove-point", h.HandleRemovePoint)
	r.Post("/public/{publicID}/confirm-game", h.HandleConfirmGameOver)
	r.Post("/public/{publicID}/confirm-match", h.HandleConfirmMatchOver)
	r.Post("/public/{publicID}/timeout", h.HandleCallTimeout)
	r.Post("/public/{publicID}/pause", h.HandlePauseMatch)
	r.Post("/public/{publicID}/resume", h.HandleResumeMatch)
	r.Post("/public/{publicID}/forfeit", h.HandleDeclareForfeit)

	// PublicID-based control routes (write). The public GETs for
	// /public/{publicID} and /public/{publicID}/events live directly on the
	// router in router/router.go (outside RequireAuth).
	r.Post("/public/{publicID}/start", h.StartMatchByPublicID)
	r.Post("/public/{publicID}/undo", h.UndoByPublicID)
	r.Post("/public/{publicID}/override", h.OverrideScore)

	return r
}

// DivisionRoutes returns a chi.Router for division-scoped match routes.
func (h *MatchHandler) DivisionRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListByDivision)
	return r
}

// CourtRoutes returns a chi.Router for court-scoped match routes.
func (h *MatchHandler) CourtRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListByCourt)
	r.Get("/active", h.GetActiveMatchOnCourt)
	return r
}

// TeamRoutes returns a chi.Router for team-scoped match routes.
func (h *MatchHandler) TeamRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListByTeam)
	return r
}

// Create creates a new match.
func (h *MatchHandler) Create(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	var body struct {
		TournamentID       *int64  `json:"tournament_id"`
		DivisionID         *int64  `json:"division_id"`
		PodID              *int64  `json:"pod_id"`
		CourtID            *int64  `json:"court_id"`
		MatchType          string  `json:"match_type"`
		Round              *int32  `json:"round"`
		RoundName          *string `json:"round_name"`
		MatchNumber        *int32  `json:"match_number"`
		Team1ID            *int64  `json:"team1_id"`
		Team2ID            *int64  `json:"team2_id"`
		Team1Seed          *int32  `json:"team1_seed"`
		Team2Seed          *int32  `json:"team2_seed"`
		ScoringPresetID    *int64  `json:"scoring_preset_id"`
		GamesPerSet        *int32  `json:"games_per_set"`
		SetsToWin          *int32  `json:"sets_to_win"`
		PointsToWin        *int32  `json:"points_to_win"`
		WinBy              *int32  `json:"win_by"`
		MaxPoints          *int32  `json:"max_points"`
		RallyScoring       *bool   `json:"rally_scoring"`
		TimeoutsPerGame    *int32  `json:"timeouts_per_game"`
		TimeoutDurationSec *int32  `json:"timeout_duration_sec"`
		FreezeAt           *int32  `json:"freeze_at"`
		Status             *string `json:"status"`
		ScheduledAt        *string `json:"scheduled_at"`
		ExpiresAt          *string `json:"expires_at"`
		NextMatchID        *int64  `json:"next_match_id"`
		NextMatchSlot      *int32  `json:"next_match_slot"`
		LoserNextMatchID   *int64  `json:"loser_next_match_id"`
		LoserNextMatchSlot *int32  `json:"loser_next_match_slot"`
		RefereeUserID      *int64  `json:"referee_user_id"`
		Notes              *string `json:"notes"`
	}

	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	params := generated.CreateMatchParams{
		CreatedByUserID:    sess.UserID,
		MatchType:          body.MatchType,
		RoundName:          body.RoundName,
		Notes:              body.Notes,
		GamesPerSet:        1,
		SetsToWin:          1,
		PointsToWin:        11,
		WinBy:              2,
		TimeoutsPerGame:    0,
		TimeoutDurationSec: 60,
		Status:             "scheduled",
	}

	if body.TournamentID != nil {
		params.TournamentID = pgtype.Int8{Int64: *body.TournamentID, Valid: true}
	}
	if body.DivisionID != nil {
		params.DivisionID = pgtype.Int8{Int64: *body.DivisionID, Valid: true}
	}
	if body.PodID != nil {
		params.PodID = pgtype.Int8{Int64: *body.PodID, Valid: true}
	}
	if body.CourtID != nil {
		params.CourtID = pgtype.Int8{Int64: *body.CourtID, Valid: true}
	}
	if body.Round != nil {
		params.Round = pgtype.Int4{Int32: *body.Round, Valid: true}
	}
	if body.MatchNumber != nil {
		params.MatchNumber = pgtype.Int4{Int32: *body.MatchNumber, Valid: true}
	}
	if body.Team1ID != nil {
		params.Team1ID = pgtype.Int8{Int64: *body.Team1ID, Valid: true}
	}
	if body.Team2ID != nil {
		params.Team2ID = pgtype.Int8{Int64: *body.Team2ID, Valid: true}
	}
	if body.Team1Seed != nil {
		params.Team1Seed = pgtype.Int4{Int32: *body.Team1Seed, Valid: true}
	}
	if body.Team2Seed != nil {
		params.Team2Seed = pgtype.Int4{Int32: *body.Team2Seed, Valid: true}
	}
	if body.ScoringPresetID != nil {
		params.ScoringPresetID = pgtype.Int8{Int64: *body.ScoringPresetID, Valid: true}
	}
	if body.GamesPerSet != nil {
		params.GamesPerSet = *body.GamesPerSet
	}
	if body.SetsToWin != nil {
		params.SetsToWin = *body.SetsToWin
	}
	if body.PointsToWin != nil {
		params.PointsToWin = *body.PointsToWin
	}
	if body.WinBy != nil {
		params.WinBy = *body.WinBy
	}
	if body.MaxPoints != nil {
		params.MaxPoints = pgtype.Int4{Int32: *body.MaxPoints, Valid: true}
	}
	if body.RallyScoring != nil {
		params.RallyScoring = *body.RallyScoring
	}
	if body.TimeoutsPerGame != nil {
		params.TimeoutsPerGame = *body.TimeoutsPerGame
	}
	if body.TimeoutDurationSec != nil {
		params.TimeoutDurationSec = *body.TimeoutDurationSec
	}
	if body.FreezeAt != nil {
		params.FreezeAt = pgtype.Int4{Int32: *body.FreezeAt, Valid: true}
	}
	if body.Status != nil {
		params.Status = *body.Status
	}
	if body.NextMatchID != nil {
		params.NextMatchID = pgtype.Int8{Int64: *body.NextMatchID, Valid: true}
	}
	if body.NextMatchSlot != nil {
		params.NextMatchSlot = pgtype.Int4{Int32: *body.NextMatchSlot, Valid: true}
	}
	if body.LoserNextMatchID != nil {
		params.LoserNextMatchID = pgtype.Int8{Int64: *body.LoserNextMatchID, Valid: true}
	}
	if body.LoserNextMatchSlot != nil {
		params.LoserNextMatchSlot = pgtype.Int4{Int32: *body.LoserNextMatchSlot, Valid: true}
	}
	if body.RefereeUserID != nil {
		params.RefereeUserID = pgtype.Int8{Int64: *body.RefereeUserID, Valid: true}
	}

	// Parse time fields
	if body.ScheduledAt != nil {
		t, err := parseTimestamp(*body.ScheduledAt)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "INVALID_TIMESTAMP", "invalid scheduled_at format")
			return
		}
		params.ScheduledAt = pgtype.Timestamptz{Time: t, Valid: true}
	}
	if body.ExpiresAt != nil {
		t, err := parseTimestamp(*body.ExpiresAt)
		if err != nil {
			WriteError(w, http.StatusBadRequest, "INVALID_TIMESTAMP", "invalid expires_at format")
			return
		}
		params.ExpiresAt = pgtype.Timestamptz{Time: t, Valid: true}
	}

	match, err := h.service.Create(r.Context(), params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, match)
}

// GetByID retrieves a match by internal ID.
func (h *MatchHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid match ID")
		return
	}

	match, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, match)
}

// GetByPublicID retrieves a match by public ID.
func (h *MatchHandler) GetByPublicID(w http.ResponseWriter, r *http.Request) {
	publicID := chi.URLParam(r, "publicID")
	if publicID == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_ID", "public_id is required")
		return
	}

	match, err := h.service.GetByPublicID(r.Context(), publicID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, match)
}

// UpdateStatus transitions a match to a new status.
func (h *MatchHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid match ID")
		return
	}

	var body struct {
		Status string `json:"status"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	if body.Status == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "status is required")
		return
	}

	match, err := h.service.UpdateStatus(r.Context(), id, body.Status)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, match)
}

// startMatchBody is the optional request body accepted by both StartMatch
// handlers (numeric and public-ID). All fields are optional — an empty body
// is treated as all-nil.
type startMatchBody struct {
	ScoredByName         *string `json:"scored_by_name"`
	FirstServingTeam     *int32  `json:"first_serving_team"`
	FirstServingPlayerID *int64  `json:"first_serving_player_id"`
}

// decodeStartMatchInput parses the optional body for a start-match call,
// tolerating an entirely empty request body (returns zero-value input).
func decodeStartMatchInput(r *http.Request) (service.StartMatchInput, string) {
	var body startMatchBody
	// Only attempt to decode when we actually have a JSON body; otherwise
	// treat as "no overrides". DecodeJSON will return an error on missing body,
	// so we branch on ContentLength.
	if r.Body != nil && r.ContentLength != 0 {
		if errMsg := DecodeJSON(r, &body); errMsg != "" {
			return service.StartMatchInput{}, errMsg
		}
	}
	return service.StartMatchInput{
		ScoredByName:         body.ScoredByName,
		FirstServingTeam:     body.FirstServingTeam,
		FirstServingPlayerID: body.FirstServingPlayerID,
	}, ""
}

// StartMatch starts a match (transitions to in_progress with started_at).
func (h *MatchHandler) StartMatch(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid match ID")
		return
	}

	input, errMsg := decodeStartMatchInput(r)
	if errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	result, err := h.service.StartMatch(r.Context(), id, sess.UserID, input)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, result)
}

// CompleteMatch marks a match as completed with a result.
func (h *MatchHandler) CompleteMatch(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid match ID")
		return
	}

	var body struct {
		WinnerTeamID int64  `json:"winner_team_id"`
		LoserTeamID  int64  `json:"loser_team_id"`
		WinReason    string `json:"win_reason"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	if body.WinnerTeamID == 0 || body.LoserTeamID == 0 {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "winner_team_id and loser_team_id are required")
		return
	}

	if body.WinReason == "" {
		body.WinReason = "score"
	}

	match, err := h.service.CompleteMatch(r.Context(), id, body.WinnerTeamID, body.LoserTeamID, body.WinReason)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, match)
}

// RecordEvent records a scoring event for a match.
func (h *MatchHandler) RecordEvent(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid match ID")
		return
	}

	var body struct {
		EventType string          `json:"event_type"`
		Payload   json.RawMessage `json:"payload"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	if body.EventType == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "event_type is required")
		return
	}

	event, err := h.service.RecordEvent(r.Context(), id, body.EventType, body.Payload, sess.UserID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Created(w, event)
}

// GetMatchEvents returns all events for a match.
func (h *MatchHandler) GetMatchEvents(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid match ID")
		return
	}

	events, err := h.service.GetMatchEvents(r.Context(), id)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, events)
}

// Undo reverts the last event in a match.
func (h *MatchHandler) Undo(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid match ID")
		return
	}

	match, err := h.service.Undo(r.Context(), id, sess.UserID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, match)
}

// AssignToCourt assigns a match to a court.
func (h *MatchHandler) AssignToCourt(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid match ID")
		return
	}

	var body struct {
		CourtID int64 `json:"court_id"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	if body.CourtID == 0 {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "court_id is required")
		return
	}

	match, err := h.service.AssignToCourt(r.Context(), id, body.CourtID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, match)
}

// UpdateScoringConfig updates the scoring configuration for a match.
func (h *MatchHandler) UpdateScoringConfig(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid match ID")
		return
	}

	var body struct {
		GamesPerSet        int32  `json:"games_per_set"`
		SetsToWin          int32  `json:"sets_to_win"`
		PointsToWin        int32  `json:"points_to_win"`
		WinBy              int32  `json:"win_by"`
		MaxPoints          *int32 `json:"max_points"`
		RallyScoring       bool   `json:"rally_scoring"`
		TimeoutsPerGame    int32  `json:"timeouts_per_game"`
		TimeoutDurationSec int32  `json:"timeout_duration_sec"`
		FreezeAt           *int32 `json:"freeze_at"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	params := generated.UpdateMatchScoringConfigParams{
		GamesPerSet:        body.GamesPerSet,
		SetsToWin:          body.SetsToWin,
		PointsToWin:        body.PointsToWin,
		WinBy:              body.WinBy,
		RallyScoring:       body.RallyScoring,
		TimeoutsPerGame:    body.TimeoutsPerGame,
		TimeoutDurationSec: body.TimeoutDurationSec,
	}
	if body.MaxPoints != nil {
		params.MaxPoints = pgtype.Int4{Int32: *body.MaxPoints, Valid: true}
	}
	if body.FreezeAt != nil {
		params.FreezeAt = pgtype.Int4{Int32: *body.FreezeAt, Valid: true}
	}

	match, err := h.service.UpdateScoringConfig(r.Context(), id, params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, match)
}

// UpdateNotes updates the notes on a match.
func (h *MatchHandler) UpdateNotes(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid match ID")
		return
	}

	var body struct {
		Notes *string `json:"notes"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	match, err := h.service.UpdateNotes(r.Context(), id, body.Notes)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, match)
}

// UpdateReferee assigns or removes a referee from a match.
func (h *MatchHandler) UpdateReferee(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid match ID")
		return
	}

	var body struct {
		RefereeUserID *int64 `json:"referee_user_id"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	match, err := h.service.UpdateReferee(r.Context(), id, body.RefereeUserID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, match)
}

// UpdateTeams updates the teams on a match.
func (h *MatchHandler) UpdateTeams(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid match ID")
		return
	}

	var body struct {
		Team1ID   *int64 `json:"team1_id"`
		Team2ID   *int64 `json:"team2_id"`
		Team1Seed *int32 `json:"team1_seed"`
		Team2Seed *int32 `json:"team2_seed"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	params := generated.UpdateMatchTeamsParams{}
	if body.Team1ID != nil {
		params.Team1ID = pgtype.Int8{Int64: *body.Team1ID, Valid: true}
	}
	if body.Team2ID != nil {
		params.Team2ID = pgtype.Int8{Int64: *body.Team2ID, Valid: true}
	}
	if body.Team1Seed != nil {
		params.Team1Seed = pgtype.Int4{Int32: *body.Team1Seed, Valid: true}
	}
	if body.Team2Seed != nil {
		params.Team2Seed = pgtype.Int4{Int32: *body.Team2Seed, Valid: true}
	}

	match, err := h.service.UpdateTeams(r.Context(), id, params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, match)
}

// UpdateBracketWiring updates the bracket wiring on a match.
func (h *MatchHandler) UpdateBracketWiring(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	id, err := strconv.ParseInt(chi.URLParam(r, "matchID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid match ID")
		return
	}

	var body struct {
		NextMatchID        *int64 `json:"next_match_id"`
		NextMatchSlot      *int32 `json:"next_match_slot"`
		LoserNextMatchID   *int64 `json:"loser_next_match_id"`
		LoserNextMatchSlot *int32 `json:"loser_next_match_slot"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	params := generated.UpdateMatchBracketWiringParams{}
	if body.NextMatchID != nil {
		params.NextMatchID = pgtype.Int8{Int64: *body.NextMatchID, Valid: true}
	}
	if body.NextMatchSlot != nil {
		params.NextMatchSlot = pgtype.Int4{Int32: *body.NextMatchSlot, Valid: true}
	}
	if body.LoserNextMatchID != nil {
		params.LoserNextMatchID = pgtype.Int8{Int64: *body.LoserNextMatchID, Valid: true}
	}
	if body.LoserNextMatchSlot != nil {
		params.LoserNextMatchSlot = pgtype.Int4{Int32: *body.LoserNextMatchSlot, Valid: true}
	}

	match, err := h.service.UpdateBracketWiring(r.Context(), id, params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, match)
}

// ListByDivision lists matches for a division.
func (h *MatchHandler) ListByDivision(w http.ResponseWriter, r *http.Request) {
	divisionID, err := strconv.ParseInt(chi.URLParam(r, "divisionID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid division ID")
		return
	}

	limit, offset := parsePagination(r)

	matches, total, err := h.service.ListByDivision(r.Context(), divisionID, limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, matches, total, int(limit), int(offset))
}

// ListByCourt lists matches for a court.
func (h *MatchHandler) ListByCourt(w http.ResponseWriter, r *http.Request) {
	courtID, err := strconv.ParseInt(chi.URLParam(r, "courtID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	limit, offset := parsePagination(r)

	matches, err := h.service.ListByCourt(r.Context(), courtID, limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, matches)
}

// GetActiveMatchOnCourt returns the currently active match on a court.
func (h *MatchHandler) GetActiveMatchOnCourt(w http.ResponseWriter, r *http.Request) {
	courtID, err := strconv.ParseInt(chi.URLParam(r, "courtID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid court ID")
		return
	}

	match, err := h.service.GetActiveMatchOnCourt(r.Context(), courtID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	if match == nil {
		Success(w, nil)
		return
	}

	Success(w, match)
}

// ListByTeam lists matches for a team.
func (h *MatchHandler) ListByTeam(w http.ResponseWriter, r *http.Request) {
	teamID, err := strconv.ParseInt(chi.URLParam(r, "teamID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid team ID")
		return
	}

	limit, offset := parsePagination(r)

	matches, total, err := h.service.ListByTeam(r.Context(), teamID, limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, matches, total, int(limit), int(offset))
}

// ListQuickMatches lists quick matches for the current user.
func (h *MatchHandler) ListQuickMatches(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	limit, offset := parsePagination(r)

	matches, err := h.service.ListQuickMatches(r.Context(), sess.UserID, limit, offset)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, matches)
}

// parseTimestamp parses a timestamp string (RFC3339).
func parseTimestamp(s string) (time.Time, error) {
	return time.Parse(time.RFC3339, s)
}

// ---------------------------------------------------------------------------
// Scoring Engine Handlers
// ---------------------------------------------------------------------------

// resolveMatchByPublicID is a helper to get match internal ID from public ID.
func (h *MatchHandler) resolveMatchByPublicID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	publicID := chi.URLParam(r, "publicID")
	if publicID == "" {
		WriteError(w, http.StatusBadRequest, "MISSING_ID", "public_id is required")
		return 0, false
	}

	match, err := h.service.GetByPublicID(r.Context(), publicID)
	if err != nil {
		HandleServiceError(w, err)
		return 0, false
	}

	return match.ID, true
}

// requireSession extracts session and returns the user ID, or writes an error response.
func requireSession(w http.ResponseWriter, r *http.Request) (int64, bool) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return 0, false
	}
	return sess.UserID, true
}

// ScorePoint awards a point to a team.
func (h *MatchHandler) ScorePoint(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireSession(w, r)
	if !ok {
		return
	}

	matchID, ok := h.resolveMatchByPublicID(w, r)
	if !ok {
		return
	}

	var body struct {
		Team int32 `json:"team"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}
	if body.Team != 1 && body.Team != 2 {
		WriteError(w, http.StatusBadRequest, "INVALID_TEAM", "team must be 1 or 2")
		return
	}

	result, err := h.service.ScorePoint(r.Context(), matchID, body.Team, userID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, result)
}

// HandleSideOut processes a side-out (loss of serve).
func (h *MatchHandler) HandleSideOut(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireSession(w, r)
	if !ok {
		return
	}

	matchID, ok := h.resolveMatchByPublicID(w, r)
	if !ok {
		return
	}

	result, err := h.service.SideOut(r.Context(), matchID, userID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, result)
}

// HandleRemovePoint removes the last point scored.
func (h *MatchHandler) HandleRemovePoint(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireSession(w, r)
	if !ok {
		return
	}

	matchID, ok := h.resolveMatchByPublicID(w, r)
	if !ok {
		return
	}

	var body struct {
		Team int32 `json:"team"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}
	if body.Team != 1 && body.Team != 2 {
		WriteError(w, http.StatusBadRequest, "INVALID_TEAM", "team must be 1 or 2")
		return
	}

	result, err := h.service.RemovePoint(r.Context(), matchID, body.Team, userID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, result)
}

// HandleConfirmGameOver confirms the game is over and advances to the next game.
func (h *MatchHandler) HandleConfirmGameOver(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireSession(w, r)
	if !ok {
		return
	}

	matchID, ok := h.resolveMatchByPublicID(w, r)
	if !ok {
		return
	}

	result, err := h.service.ConfirmGameOver(r.Context(), matchID, userID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, result)
}

// HandleConfirmMatchOver confirms the match is over and records the winner.
func (h *MatchHandler) HandleConfirmMatchOver(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireSession(w, r)
	if !ok {
		return
	}

	matchID, ok := h.resolveMatchByPublicID(w, r)
	if !ok {
		return
	}

	var body struct {
		WinnerTeamID int64 `json:"winner_team_id"`
		LoserTeamID  int64 `json:"loser_team_id"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	result, err := h.service.ConfirmMatchOver(r.Context(), matchID, body.WinnerTeamID, body.LoserTeamID, userID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, result)
}

// HandleCallTimeout records a timeout.
func (h *MatchHandler) HandleCallTimeout(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireSession(w, r)
	if !ok {
		return
	}

	matchID, ok := h.resolveMatchByPublicID(w, r)
	if !ok {
		return
	}

	var body struct {
		Team int32 `json:"team"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}
	if body.Team != 1 && body.Team != 2 {
		WriteError(w, http.StatusBadRequest, "INVALID_TEAM", "team must be 1 or 2")
		return
	}

	result, err := h.service.CallTimeout(r.Context(), matchID, body.Team, userID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, result)
}

// HandlePauseMatch pauses a match.
func (h *MatchHandler) HandlePauseMatch(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireSession(w, r)
	if !ok {
		return
	}

	matchID, ok := h.resolveMatchByPublicID(w, r)
	if !ok {
		return
	}

	result, err := h.service.PauseMatch(r.Context(), matchID, userID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, result)
}

// HandleResumeMatch resumes a paused match.
func (h *MatchHandler) HandleResumeMatch(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireSession(w, r)
	if !ok {
		return
	}

	matchID, ok := h.resolveMatchByPublicID(w, r)
	if !ok {
		return
	}

	result, err := h.service.ResumeMatch(r.Context(), matchID, userID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, result)
}

// HandleDeclareForfeit declares a forfeit for a team.
func (h *MatchHandler) HandleDeclareForfeit(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireSession(w, r)
	if !ok {
		return
	}

	matchID, ok := h.resolveMatchByPublicID(w, r)
	if !ok {
		return
	}

	var body struct {
		ForfeitingTeam int32 `json:"forfeiting_team"`
		WinnerTeamID   int64 `json:"winner_team_id"`
		LoserTeamID    int64 `json:"loser_team_id"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}
	if body.ForfeitingTeam != 1 && body.ForfeitingTeam != 2 {
		WriteError(w, http.StatusBadRequest, "INVALID_TEAM", "forfeiting_team must be 1 or 2")
		return
	}

	result, err := h.service.DeclareForfeit(r.Context(), matchID, body.ForfeitingTeam, body.WinnerTeamID, body.LoserTeamID, userID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, result)
}

// ---------------------------------------------------------------------------
// PublicID-based control handlers (delegate to numeric-ID logic).
// ---------------------------------------------------------------------------

// StartMatchByPublicID resolves the match by public ID and starts it.
// Accepts an optional body: {scored_by_name?, first_serving_team?, first_serving_player_id?}.
func (h *MatchHandler) StartMatchByPublicID(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireSession(w, r)
	if !ok {
		return
	}

	matchID, ok := h.resolveMatchByPublicID(w, r)
	if !ok {
		return
	}

	input, errMsg := decodeStartMatchInput(r)
	if errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	result, err := h.service.StartMatch(r.Context(), matchID, userID, input)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, result)
}

// UndoByPublicID resolves the match by public ID and reverts the last event.
func (h *MatchHandler) UndoByPublicID(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireSession(w, r)
	if !ok {
		return
	}

	matchID, ok := h.resolveMatchByPublicID(w, r)
	if !ok {
		return
	}

	match, err := h.service.Undo(r.Context(), matchID, userID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, match)
}

// GetMatchEventsByPublicID resolves the match by public ID and returns its events.
func (h *MatchHandler) GetMatchEventsByPublicID(w http.ResponseWriter, r *http.Request) {
	matchID, ok := h.resolveMatchByPublicID(w, r)
	if !ok {
		return
	}

	events, err := h.service.GetMatchEvents(r.Context(), matchID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, events)
}

// OverrideScore directly updates the match scores (admin-only audited action).
//
// Accepts a multi-game payload mirroring the ScoreOverrideModal in the frontend:
//
//	{
//	  "games": [
//	    {"game_number": 1, "team_1_score": 11, "team_2_score": 7,  "winner": 1},
//	    {"game_number": 2, "team_1_score":  9, "team_2_score": 11, "winner": 2}
//	  ],
//	  "reason": "scorekeeper miscount in G2"
//	}
//
// Games with a non-null winner are stored as completed games; the entry whose
// winner is null (if any) becomes the live current-game score.
func (h *MatchHandler) OverrideScore(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	// Score overrides are privileged but not platform-admin-only:
	// tournament directors and head referees routinely need to correct
	// scorekeeper miscounts during an event. Keep the surface tight
	// but allow the operational roles that own the broom.
	switch sess.Role {
	case "platform_admin", "tournament_director", "head_referee":
		// allowed
	default:
		WriteError(w, http.StatusForbidden, "FORBIDDEN", "Only platform admins, tournament directors, or head referees can override scores")
		return
	}

	matchID, ok := h.resolveMatchByPublicID(w, r)
	if !ok {
		return
	}

	var body struct {
		Games []struct {
			GameNumber int32  `json:"game_number"`
			Team1Score int32  `json:"team_1_score"`
			Team2Score int32  `json:"team_2_score"`
			Winner     *int32 `json:"winner"`
		} `json:"games"`
		Reason string `json:"reason"`
	}
	if errMsg := DecodeJSON(r, &body); errMsg != "" {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", errMsg)
		return
	}

	if len(body.Games) == 0 {
		WriteError(w, http.StatusBadRequest, "MISSING_FIELDS", "at least one game is required")
		return
	}
	if len(body.Reason) < 10 {
		WriteError(w, http.StatusBadRequest, "INVALID_REASON", "reason must be at least 10 characters")
		return
	}

	games := make([]service.OverrideGameInput, len(body.Games))
	for i, g := range body.Games {
		if g.GameNumber < 1 {
			WriteError(w, http.StatusBadRequest, "INVALID_GAME", "game_number must be >= 1")
			return
		}
		if g.Team1Score < 0 || g.Team2Score < 0 {
			WriteError(w, http.StatusBadRequest, "INVALID_SCORE", "scores must be non-negative")
			return
		}
		if g.Winner != nil && *g.Winner != 1 && *g.Winner != 2 {
			WriteError(w, http.StatusBadRequest, "INVALID_WINNER", "winner must be 1, 2, or null")
			return
		}
		games[i] = service.OverrideGameInput{
			GameNumber: g.GameNumber,
			Team1Score: g.Team1Score,
			Team2Score: g.Team2Score,
			Winner:     g.Winner,
		}
	}

	match, err := h.service.OverrideScore(r.Context(), matchID, games, sess.UserID, body.Reason)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, match)
}
