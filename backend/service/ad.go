package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/court-command/court-command/db/generated"
)

type AdService struct {
	queries *generated.Queries
}

func NewAdService(queries *generated.Queries) *AdService {
	return &AdService{queries: queries}
}

type AdResponse struct {
	ID                 int64    `json:"id"`
	SlotName           string   `json:"slot_name"`
	AdType             string   `json:"ad_type"`
	ImageURL           *string  `json:"image_url,omitempty"`
	LinkURL            *string  `json:"link_url,omitempty"`
	AltText            *string  `json:"alt_text,omitempty"`
	EmbedCode          *string  `json:"embed_code,omitempty"`
	IsActive           bool     `json:"is_active"`
	SortOrder          int32    `json:"sort_order"`
	Sizes              []string `json:"sizes"`
	Name               string   `json:"name"`
	DisplayDurationSec int32    `json:"display_duration_sec"`
	CreatedAt          string   `json:"created_at"`
	UpdatedAt          string   `json:"updated_at"`
}

func toAdResponse(a generated.AdConfig) AdResponse {
	return AdResponse{
		ID:                 a.ID,
		SlotName:           a.SlotName,
		AdType:             a.AdType,
		ImageURL:           a.ImageUrl,
		LinkURL:            a.LinkUrl,
		AltText:            a.AltText,
		EmbedCode:          a.EmbedCode,
		IsActive:           a.IsActive,
		SortOrder:          a.SortOrder,
		Sizes:              a.Sizes,
		Name:               a.Name,
		DisplayDurationSec: a.DisplayDurationSec,
		CreatedAt:          a.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:          a.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func (s *AdService) ListActive(ctx context.Context) ([]AdResponse, error) {
	ads, err := s.queries.ListActiveAds(ctx)
	if err != nil {
		return nil, err
	}
	results := make([]AdResponse, 0, len(ads))
	for _, a := range ads {
		results = append(results, toAdResponse(a))
	}
	return results, nil
}

func (s *AdService) ListAll(ctx context.Context) ([]AdResponse, error) {
	ads, err := s.queries.ListAllAds(ctx)
	if err != nil {
		return nil, err
	}
	results := make([]AdResponse, 0, len(ads))
	for _, a := range ads {
		results = append(results, toAdResponse(a))
	}
	return results, nil
}

func (s *AdService) GetByID(ctx context.Context, id int64) (AdResponse, error) {
	a, err := s.queries.GetAdByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AdResponse{}, &NotFoundError{Message: "ad not found"}
		}
		return AdResponse{}, fmt.Errorf("get ad by id: %w", err)
	}
	return toAdResponse(a), nil
}

func (s *AdService) Create(ctx context.Context, params generated.CreateAdParams) (AdResponse, error) {
	if params.Name == "" {
		return AdResponse{}, &ValidationError{Message: "name is required"}
	}
	if params.AdType != "image" && params.AdType != "embed" {
		return AdResponse{}, &ValidationError{Message: "ad_type must be 'image' or 'embed'"}
	}
	a, err := s.queries.CreateAd(ctx, params)
	if err != nil {
		return AdResponse{}, err
	}
	return toAdResponse(a), nil
}

func (s *AdService) Update(ctx context.Context, id int64, params generated.UpdateAdParams) (AdResponse, error) {
	params.ID = id
	a, err := s.queries.UpdateAd(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AdResponse{}, &NotFoundError{Message: "ad not found"}
		}
		return AdResponse{}, fmt.Errorf("update ad: %w", err)
	}
	return toAdResponse(a), nil
}

func (s *AdService) Delete(ctx context.Context, id int64) error {
	return s.queries.DeleteAd(ctx, id)
}

func (s *AdService) ToggleActive(ctx context.Context, id int64, active bool) (AdResponse, error) {
	a, err := s.queries.UpdateAd(ctx, generated.UpdateAdParams{
		ID:       id,
		IsActive: pgtype.Bool{Bool: active, Valid: true},
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AdResponse{}, &NotFoundError{Message: "ad not found"}
		}
		return AdResponse{}, fmt.Errorf("toggle ad active: %w", err)
	}
	return toAdResponse(a), nil
}
