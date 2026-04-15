// backend/handler/player.go
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

// PlayerHandler handles player profile HTTP requests.
type PlayerHandler struct {
	playerService *service.PlayerService
}

// NewPlayerHandler creates a new PlayerHandler.
func NewPlayerHandler(playerService *service.PlayerService) *PlayerHandler {
	return &PlayerHandler{playerService: playerService}
}

// Routes returns a chi.Router with all player routes mounted.
func (h *PlayerHandler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/search", h.SearchPlayers)
	r.Get("/me", h.GetMyProfile)
	r.Patch("/me", h.UpdateMyProfile)
	r.Post("/me/waiver", h.AcceptWaiver)
	r.Get("/{playerID}", h.GetPlayer)
	r.Get("/by-public-id/{publicID}", h.GetPlayerByPublicID)

	return r
}

// GetMyProfile returns the authenticated user's own profile.
func (h *PlayerHandler) GetMyProfile(w http.ResponseWriter, r *http.Request) {
	data := session.SessionData(r.Context())
	if data == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	profile, err := h.playerService.GetProfile(r.Context(), data.UserID, data.UserID, data.Role)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, profile)
}

// UpdateMyProfile updates the authenticated user's profile.
func (h *PlayerHandler) UpdateMyProfile(w http.ResponseWriter, r *http.Request) {
	data := session.SessionData(r.Context())
	if data == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	var body struct {
		DisplayName           *string `json:"display_name"`
		Gender                *string `json:"gender"`
		Handedness            *string `json:"handedness"`
		AvatarURL             *string `json:"avatar_url"`
		Bio                   *string `json:"bio"`
		City                  *string `json:"city"`
		StateProvince         *string `json:"state_province"`
		Country               *string `json:"country"`
		Phone                 *string `json:"phone"`
		PaddleBrand           *string `json:"paddle_brand"`
		PaddleModel           *string `json:"paddle_model"`
		DuprID                *string `json:"dupr_id"`
		VairID                *string `json:"vair_id"`
		EmergencyContactName  *string `json:"emergency_contact_name"`
		EmergencyContactPhone *string `json:"emergency_contact_phone"`
		MedicalNotes          *string `json:"medical_notes"`
		IsProfileHidden       *bool   `json:"is_profile_hidden"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	// Validate gender if provided
	if body.Gender != nil {
		valid := map[string]bool{"male": true, "female": true, "non_binary": true, "prefer_not_to_say": true}
		if !valid[*body.Gender] {
			WriteError(w, http.StatusBadRequest, "INVALID_GENDER", "Gender must be one of: male, female, non_binary, prefer_not_to_say")
			return
		}
	}

	// Validate handedness if provided
	if body.Handedness != nil {
		valid := map[string]bool{"right": true, "left": true, "ambidextrous": true}
		if !valid[*body.Handedness] {
			WriteError(w, http.StatusBadRequest, "INVALID_HANDEDNESS", "Handedness must be one of: right, left, ambidextrous")
			return
		}
	}

	params := generated.UpdatePlayerProfileParams{
		DisplayName:           body.DisplayName,
		Gender:                body.Gender,
		Handedness:            body.Handedness,
		AvatarUrl:             body.AvatarURL,
		Bio:                   body.Bio,
		City:                  body.City,
		StateProvince:         body.StateProvince,
		Country:               body.Country,
		Phone:                 body.Phone,
		PaddleBrand:           body.PaddleBrand,
		PaddleModel:           body.PaddleModel,
		DuprID:                body.DuprID,
		VairID:                body.VairID,
		EmergencyContactName:  body.EmergencyContactName,
		EmergencyContactPhone: body.EmergencyContactPhone,
		MedicalNotes:          body.MedicalNotes,
	}

	if body.IsProfileHidden != nil {
		params.IsProfileHidden = pgtype.Bool{Bool: *body.IsProfileHidden, Valid: true}
	}

	profile, err := h.playerService.UpdateProfile(r.Context(), data.UserID, params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, profile)
}

// AcceptWaiver records the user accepting the platform waiver.
func (h *PlayerHandler) AcceptWaiver(w http.ResponseWriter, r *http.Request) {
	data := session.SessionData(r.Context())
	if data == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	profile, err := h.playerService.AcceptWaiver(r.Context(), data.UserID)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, profile)
}

// GetPlayer retrieves a player profile by numeric ID.
func (h *PlayerHandler) GetPlayer(w http.ResponseWriter, r *http.Request) {
	data := session.SessionData(r.Context())
	if data == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	playerIDStr := chi.URLParam(r, "playerID")
	playerID, err := strconv.ParseInt(playerIDStr, 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid player ID")
		return
	}

	profile, err := h.playerService.GetProfile(r.Context(), playerID, data.UserID, data.Role)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, profile)
}

// GetPlayerByPublicID retrieves a player by public ID (CC-XXXXX).
func (h *PlayerHandler) GetPlayerByPublicID(w http.ResponseWriter, r *http.Request) {
	data := session.SessionData(r.Context())
	if data == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	publicID := chi.URLParam(r, "publicID")

	profile, err := h.playerService.GetProfileByPublicID(r.Context(), publicID, data.UserID, data.Role)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Success(w, profile)
}

// SearchPlayers searches for players with optional filters.
func (h *PlayerHandler) SearchPlayers(w http.ResponseWriter, r *http.Request) {
	data := session.SessionData(r.Context())
	if data == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Not authenticated")
		return
	}

	query := r.URL.Query()

	limit := int32(20)
	if l := query.Get("limit"); l != "" {
		if v, err := strconv.ParseInt(l, 10, 32); err == nil && v > 0 && v <= 100 {
			limit = int32(v)
		}
	}

	offset := int32(0)
	if o := query.Get("offset"); o != "" {
		if v, err := strconv.ParseInt(o, 10, 32); err == nil && v >= 0 {
			offset = int32(v)
		}
	}

	var queryParam, cityParam, stateParam, countryParam *string
	if q := query.Get("q"); q != "" {
		queryParam = &q
	}
	if c := query.Get("city"); c != "" {
		cityParam = &c
	}
	if s := query.Get("state"); s != "" {
		stateParam = &s
	}
	if c := query.Get("country"); c != "" {
		countryParam = &c
	}

	params := generated.SearchPlayersParams{
		Limit:         limit,
		Offset:        offset,
		Query:         queryParam,
		City:          cityParam,
		StateProvince: stateParam,
		Country:       countryParam,
	}

	profiles, total, err := h.playerService.SearchPlayers(r.Context(), params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}

	Paginated(w, profiles, total, int(limit), int(offset))
}
