package service

import (
	"encoding/json"
	"time"

	"github.com/court-command/court-command/db/generated"
	"github.com/jackc/pgx/v5/pgtype"
)

// CourtOverlayConfigResponse is the JSON-serializable shape of a court's overlay config.
//
// The generated.CourtOverlayConfig struct stores color_overrides, elements,
// and data_overrides as []byte, which Go's default json.Marshal encodes as
// base64 strings. Frontend expects these as structured JSON objects, so we
// convert []byte -> json.RawMessage at the response boundary. RawMessage's
// MarshalJSON passes the bytes through verbatim.
//
// This type MUST be used by every handler that returns a CourtOverlayConfig
// and by every pubsub message carrying a config payload. See CR-9.
type CourtOverlayConfigResponse struct {
	ID                      int64           `json:"id"`
	CourtID                 int64           `json:"court_id"`
	ThemeID                 string          `json:"theme_id"`
	ColorOverrides          json.RawMessage `json:"color_overrides"`
	Elements                json.RawMessage `json:"elements"`
	SourceProfileID         pgtype.Int8     `json:"source_profile_id"`
	OverlayToken            *string         `json:"overlay_token"`
	ShowBranding            bool            `json:"show_branding"`
	MatchResultDelaySeconds int32           `json:"match_result_delay_seconds"`
	IdleDisplay             string          `json:"idle_display"`
	DataOverrides           json.RawMessage `json:"data_overrides"`
	CreatedAt               time.Time       `json:"created_at"`
	UpdatedAt               time.Time       `json:"updated_at"`
}

// ToOverlayConfigResponse converts a generated row to its JSON-safe response shape.
func ToOverlayConfigResponse(c generated.CourtOverlayConfig) CourtOverlayConfigResponse {
	return CourtOverlayConfigResponse{
		ID:                      c.ID,
		CourtID:                 c.CourtID,
		ThemeID:                 c.ThemeID,
		ColorOverrides:          rawOrEmpty(c.ColorOverrides),
		Elements:                rawOrEmpty(c.Elements),
		SourceProfileID:         c.SourceProfileID,
		OverlayToken:            c.OverlayToken,
		ShowBranding:            c.ShowBranding,
		MatchResultDelaySeconds: c.MatchResultDelaySeconds,
		IdleDisplay:             c.IdleDisplay,
		DataOverrides:           rawOrEmpty(c.DataOverrides),
		CreatedAt:               c.CreatedAt,
		UpdatedAt:               c.UpdatedAt,
	}
}

// SourceProfileResponse is the JSON-serializable shape of a source profile row.
//
// Same reasoning as CourtOverlayConfigResponse: auth_config and field_mapping
// are []byte in the generated row and need json.RawMessage framing to be
// emitted as structured JSON instead of base64 strings.
type SourceProfileResponse struct {
	ID                  int64              `json:"id"`
	Name                string             `json:"name"`
	CreatedByUserID     int64              `json:"created_by_user_id"`
	SourceType          string             `json:"source_type"`
	ApiUrl              *string            `json:"api_url"`
	WebhookSecret       *string            `json:"webhook_secret"`
	AuthType            string             `json:"auth_type"`
	AuthConfig          json.RawMessage    `json:"auth_config"`
	PollIntervalSeconds pgtype.Int4        `json:"poll_interval_seconds"`
	FieldMapping        json.RawMessage    `json:"field_mapping"`
	IsActive            bool               `json:"is_active"`
	LastPollAt          pgtype.Timestamptz `json:"last_poll_at"`
	LastPollStatus      *string            `json:"last_poll_status"`
	CreatedAt           time.Time          `json:"created_at"`
	UpdatedAt           time.Time          `json:"updated_at"`
}

// ToSourceProfileResponse converts a generated row to its JSON-safe response shape.
func ToSourceProfileResponse(p generated.SourceProfile) SourceProfileResponse {
	return SourceProfileResponse{
		ID:                  p.ID,
		Name:                p.Name,
		CreatedByUserID:     p.CreatedByUserID,
		SourceType:          p.SourceType,
		ApiUrl:              p.ApiUrl,
		WebhookSecret:       p.WebhookSecret,
		AuthType:            p.AuthType,
		AuthConfig:          rawOrEmpty(p.AuthConfig),
		PollIntervalSeconds: p.PollIntervalSeconds,
		FieldMapping:        rawOrEmpty(p.FieldMapping),
		IsActive:            p.IsActive,
		LastPollAt:          p.LastPollAt,
		LastPollStatus:      p.LastPollStatus,
		CreatedAt:           p.CreatedAt,
		UpdatedAt:           p.UpdatedAt,
	}
}

// ToSourceProfileResponses converts a slice of rows.
func ToSourceProfileResponses(profiles []generated.SourceProfile) []SourceProfileResponse {
	out := make([]SourceProfileResponse, len(profiles))
	for i, p := range profiles {
		out[i] = ToSourceProfileResponse(p)
	}
	return out
}

// rawOrEmpty returns b as json.RawMessage, falling back to {} when empty.
// Prevents emitting `null` for unset byte columns.
func rawOrEmpty(b []byte) json.RawMessage {
	if len(b) == 0 {
		return json.RawMessage("{}")
	}
	return json.RawMessage(b)
}
