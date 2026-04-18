package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/service"
	"github.com/court-command/court-command/session"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type AdHandler struct {
	service *service.AdService
}

func NewAdHandler(svc *service.AdService) *AdHandler {
	return &AdHandler{service: svc}
}

// PublicRoutes returns routes accessible without auth (active ads only)
func (h *AdHandler) PublicRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListActiveAds)
	return r
}

// AdminRoutes returns routes for admin ad management
func (h *AdHandler) AdminRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.ListAllAds)
	r.Post("/", h.CreateAd)
	r.Get("/{adID}", h.GetAd)
	r.Put("/{adID}", h.UpdateAd)
	r.Delete("/{adID}", h.DeleteAd)
	r.Put("/{adID}/toggle", h.ToggleActive)
	return r
}

func (h *AdHandler) ListActiveAds(w http.ResponseWriter, r *http.Request) {
	ads, err := h.service.ListActive(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "FETCH_FAILED", "Failed to load ads")
		return
	}
	Success(w, ads)
}

func (h *AdHandler) ListAllAds(w http.ResponseWriter, r *http.Request) {
	ads, err := h.service.ListAll(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "FETCH_FAILED", "Failed to load ads")
		return
	}
	Success(w, ads)
}

func (h *AdHandler) GetAd(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "adID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid ad ID")
		return
	}
	ad, svcErr := h.service.GetByID(r.Context(), id)
	if svcErr != nil {
		HandleServiceError(w, svcErr)
		return
	}
	Success(w, ad)
}

func (h *AdHandler) CreateAd(w http.ResponseWriter, r *http.Request) {
	sess := session.SessionData(r.Context())
	if sess == nil {
		WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	var body struct {
		Name               string   `json:"name"`
		SlotName           string   `json:"slot_name"`
		AdType             string   `json:"ad_type"`
		ImageURL           *string  `json:"image_url"`
		LinkURL            *string  `json:"link_url"`
		AltText            *string  `json:"alt_text"`
		EmbedCode          *string  `json:"embed_code"`
		IsActive           bool     `json:"is_active"`
		SortOrder          int32    `json:"sort_order"`
		Sizes              []string `json:"sizes"`
		DisplayDurationSec int32    `json:"display_duration_sec"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	if body.Sizes == nil {
		body.Sizes = []string{}
	}
	if body.DisplayDurationSec <= 0 {
		body.DisplayDurationSec = 8
	}

	params := generated.CreateAdParams{
		Name:               body.Name,
		SlotName:           body.SlotName,
		AdType:             body.AdType,
		ImageUrl:           body.ImageURL,
		LinkUrl:            body.LinkURL,
		AltText:            body.AltText,
		EmbedCode:          body.EmbedCode,
		IsActive:           body.IsActive,
		SortOrder:          body.SortOrder,
		Sizes:              body.Sizes,
		DisplayDurationSec: body.DisplayDurationSec,
		CreatedByUserID:    pgtype.Int8{Int64: sess.UserID, Valid: true},
	}

	ad, err := h.service.Create(r.Context(), params)
	if err != nil {
		HandleServiceError(w, err)
		return
	}
	Created(w, ad)
}

func (h *AdHandler) UpdateAd(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "adID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid ad ID")
		return
	}

	var body struct {
		Name               *string  `json:"name"`
		SlotName           *string  `json:"slot_name"`
		AdType             *string  `json:"ad_type"`
		ImageURL           *string  `json:"image_url"`
		LinkURL            *string  `json:"link_url"`
		AltText            *string  `json:"alt_text"`
		EmbedCode          *string  `json:"embed_code"`
		IsActive           *bool    `json:"is_active"`
		SortOrder          *int32   `json:"sort_order"`
		Sizes              []string `json:"sizes"`
		DisplayDurationSec *int32   `json:"display_duration_sec"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	params := generated.UpdateAdParams{ID: id}
	if body.SlotName != nil {
		params.SlotName = body.SlotName
	}
	if body.AdType != nil {
		params.AdType = body.AdType
	}
	if body.ImageURL != nil {
		params.ImageUrl = body.ImageURL
	}
	if body.LinkURL != nil {
		params.LinkUrl = body.LinkURL
	}
	if body.AltText != nil {
		params.AltText = body.AltText
	}
	if body.EmbedCode != nil {
		params.EmbedCode = body.EmbedCode
	}
	if body.IsActive != nil {
		params.IsActive = pgtype.Bool{Bool: *body.IsActive, Valid: true}
	}
	if body.SortOrder != nil {
		params.SortOrder = pgtype.Int4{Int32: *body.SortOrder, Valid: true}
	}
	if body.Sizes != nil {
		params.Sizes = body.Sizes
	}
	if body.DisplayDurationSec != nil {
		params.DisplayDurationSec = pgtype.Int4{Int32: *body.DisplayDurationSec, Valid: true}
	}
	if body.Name != nil {
		params.Name = body.Name
	}

	ad, svcErr := h.service.Update(r.Context(), id, params)
	if svcErr != nil {
		HandleServiceError(w, svcErr)
		return
	}
	Success(w, ad)
}

func (h *AdHandler) DeleteAd(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "adID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid ad ID")
		return
	}
	if err := h.service.Delete(r.Context(), id); err != nil {
		HandleServiceError(w, err)
		return
	}
	NoContent(w)
}

func (h *AdHandler) ToggleActive(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "adID"), 10, 64)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_ID", "Invalid ad ID")
		return
	}

	var body struct {
		IsActive bool `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "INVALID_BODY", "Invalid request body")
		return
	}

	ad, svcErr := h.service.ToggleActive(r.Context(), id, body.IsActive)
	if svcErr != nil {
		HandleServiceError(w, svcErr)
		return
	}
	Success(w, ad)
}
