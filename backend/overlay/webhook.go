package overlay

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
)

// WebhookPayload is the expected shape of incoming webhook data.
// The actual fields are mapped via the Source Profile's field_mapping config.
type WebhookPayload struct {
	RawData json.RawMessage `json:"data"`
}

// ValidateWebhookSignature checks the HMAC-SHA256 signature of the webhook body.
// The signature should be in the X-Webhook-Signature header.
func ValidateWebhookSignature(body []byte, signature string, secret string) error {
	if secret == "" {
		// No secret configured — accept all, but log a warning
		slog.Warn("webhook: accepting unvalidated webhook data — no webhook_secret configured on source profile")
		return nil
	}
	if signature == "" {
		return errors.New("missing webhook signature")
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(expected), []byte(signature)) {
		return errors.New("invalid webhook signature")
	}

	return nil
}

// ReadWebhookBody reads and returns the webhook request body, limited to 1MB.
func ReadWebhookBody(r *http.Request) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1MB limit
	if err != nil {
		return nil, err
	}
	return body, nil
}

// ApplyFieldMapping transforms raw external data into canonical OverlayData
// using the field_mapping configuration from a Source Profile.
// The mapping is a JSON object where keys are canonical field names and values
// are flat top-level keys in the raw data (e.g., "home_score" -> team_1_score).
// Nested dot-path resolution is not supported in v2.
func ApplyFieldMapping(rawData json.RawMessage, fieldMapping []byte) (OverlayData, error) {
	var data OverlayData
	var raw map[string]interface{}
	var mapping map[string]string

	if err := json.Unmarshal(rawData, &raw); err != nil {
		return data, errors.New("invalid raw data JSON")
	}
	if err := json.Unmarshal(fieldMapping, &mapping); err != nil {
		return data, errors.New("invalid field mapping JSON")
	}

	// Apply simple top-level mappings
	// For v2, we support flat key mappings only (no nested dot-path resolution)
	for canonical, sourcePath := range mapping {
		val, ok := raw[sourcePath]
		if !ok {
			continue
		}

		switch canonical {
		case "match_status":
			if s, ok := val.(string); ok {
				data.MatchStatus = s
			}
		case "team_1_name":
			if s, ok := val.(string); ok {
				data.Team1.Name = s
			}
		case "team_1_short_name":
			if s, ok := val.(string); ok {
				data.Team1.ShortName = s
			}
		case "team_1_score":
			if f, ok := val.(float64); ok {
				data.Team1.Score = int(f)
			}
		case "team_1_color":
			if s, ok := val.(string); ok {
				data.Team1.Color = s
			}
		case "team_1_logo_url":
			if s, ok := val.(string); ok {
				data.Team1.LogoURL = s
			}
		case "team_2_name":
			if s, ok := val.(string); ok {
				data.Team2.Name = s
			}
		case "team_2_short_name":
			if s, ok := val.(string); ok {
				data.Team2.ShortName = s
			}
		case "team_2_score":
			if f, ok := val.(float64); ok {
				data.Team2.Score = int(f)
			}
		case "team_2_color":
			if s, ok := val.(string); ok {
				data.Team2.Color = s
			}
		case "team_2_logo_url":
			if s, ok := val.(string); ok {
				data.Team2.LogoURL = s
			}
		case "serving_team":
			if f, ok := val.(float64); ok {
				data.ServingTeam = int(f)
			}
		case "server_number":
			if f, ok := val.(float64); ok {
				data.ServerNumber = int(f)
			}
		case "current_game":
			if f, ok := val.(float64); ok {
				data.CurrentGame = int(f)
			}
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
		}
	}

	// Ensure slices are initialized
	if data.CompletedGames == nil {
		data.CompletedGames = []GameResult{}
	}
	if data.SponsorLogos == nil {
		data.SponsorLogos = []SponsorLogo{}
	}
	if data.Team1.Players == nil {
		data.Team1.Players = []PlayerBrief{}
	}
	if data.Team2.Players == nil {
		data.Team2.Players = []PlayerBrief{}
	}

	return data, nil
}
