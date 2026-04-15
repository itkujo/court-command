package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/court-command/court-command/db/generated"
	"github.com/court-command/court-command/overlay"
	"github.com/court-command/court-command/pubsub"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OverlayService manages overlay configurations.
type OverlayService struct {
	pool     *pgxpool.Pool
	queries  *generated.Queries
	resolver *overlay.Resolver
	ps       *pubsub.PubSub
}

// NewOverlayService creates a new OverlayService.
func NewOverlayService(pool *pgxpool.Pool, queries *generated.Queries, resolver *overlay.Resolver, ps *pubsub.PubSub) *OverlayService {
	return &OverlayService{pool: pool, queries: queries, resolver: resolver, ps: ps}
}

// GetOrCreateConfig returns the overlay config for a court, creating a default one if it doesn't exist.
func (s *OverlayService) GetOrCreateConfig(ctx context.Context, courtID int64) (generated.CourtOverlayConfig, error) {
	config, err := s.queries.GetOverlayConfigByCourtID(ctx, courtID)
	if err == nil {
		return config, nil
	}

	// Create default config
	defaultElements, _ := json.Marshal(map[string]interface{}{
		"scoreboard":       map[string]interface{}{"visible": true, "auto_animate": true},
		"lower_third":      map[string]interface{}{"visible": false, "auto_animate": true},
		"player_card":      map[string]interface{}{"visible": false, "auto_animate": true, "auto_dismiss_seconds": 10},
		"team_card":        map[string]interface{}{"visible": false, "auto_animate": true, "auto_dismiss_seconds": 10},
		"sponsor_bug":      map[string]interface{}{"visible": false, "auto_animate": true, "rotation_seconds": 15, "logos": []interface{}{}},
		"tournament_bug":   map[string]interface{}{"visible": true, "auto_animate": true},
		"coming_up_next":   map[string]interface{}{"visible": false, "auto_animate": true},
		"match_result":     map[string]interface{}{"visible": false, "auto_animate": true, "auto_show_delay_seconds": 5, "auto_dismiss_seconds": 30},
		"custom_text":      map[string]interface{}{"visible": false, "auto_animate": true, "text": "", "auto_dismiss_seconds": 0},
		"bracket_snapshot": map[string]interface{}{"visible": false, "auto_animate": true},
		"pool_standings":   map[string]interface{}{"visible": false, "auto_animate": true},
		"series_score":     map[string]interface{}{"visible": false, "auto_animate": true},
	})

	config, err = s.queries.CreateOverlayConfig(ctx, generated.CreateOverlayConfigParams{
		CourtID:                 courtID,
		ThemeID:                 "classic",
		ColorOverrides:          []byte("{}"),
		Elements:                defaultElements,
		ShowBranding:            true,
		MatchResultDelaySeconds: 30,
		IdleDisplay:             "court_name",
	})
	if err != nil {
		return generated.CourtOverlayConfig{}, fmt.Errorf("create default overlay config: %w", err)
	}

	return config, nil
}

// UpdateTheme updates the theme and color overrides for a court's overlay.
func (s *OverlayService) UpdateTheme(ctx context.Context, courtID int64, themeID string, colorOverrides json.RawMessage) (generated.CourtOverlayConfig, error) {
	// Validate theme exists (GetTheme returns classic as fallback, which is fine)
	_ = overlay.GetTheme(themeID)

	if colorOverrides == nil {
		colorOverrides = []byte("{}")
	}

	config, err := s.queries.UpdateOverlayTheme(ctx, generated.UpdateOverlayThemeParams{
		CourtID:        courtID,
		ThemeID:        themeID,
		ColorOverrides: colorOverrides,
	})
	if err != nil {
		return generated.CourtOverlayConfig{}, fmt.Errorf("update theme: %w", err)
	}

	// Broadcast config change
	s.broadcastConfigChange(ctx, courtID, config)

	return config, nil
}

// UpdateElements updates the element visibility/settings for a court's overlay.
func (s *OverlayService) UpdateElements(ctx context.Context, courtID int64, elements json.RawMessage) (generated.CourtOverlayConfig, error) {
	config, err := s.queries.UpdateOverlayElements(ctx, generated.UpdateOverlayElementsParams{
		CourtID:  courtID,
		Elements: elements,
	})
	if err != nil {
		return generated.CourtOverlayConfig{}, fmt.Errorf("update elements: %w", err)
	}

	s.broadcastConfigChange(ctx, courtID, config)

	return config, nil
}

// GenerateToken generates a new overlay access token for a court.
func (s *OverlayService) GenerateToken(ctx context.Context, courtID int64) (generated.CourtOverlayConfig, error) {
	token, err := generateSecureToken()
	if err != nil {
		return generated.CourtOverlayConfig{}, fmt.Errorf("generate token: %w", err)
	}

	config, err := s.queries.UpdateOverlayToken(ctx, generated.UpdateOverlayTokenParams{
		CourtID:      courtID,
		OverlayToken: &token,
	})
	if err != nil {
		return generated.CourtOverlayConfig{}, fmt.Errorf("update token: %w", err)
	}

	return config, nil
}

// RevokeToken removes the overlay access token for a court (makes overlay fully public).
func (s *OverlayService) RevokeToken(ctx context.Context, courtID int64) (generated.CourtOverlayConfig, error) {
	config, err := s.queries.UpdateOverlayToken(ctx, generated.UpdateOverlayTokenParams{
		CourtID:      courtID,
		OverlayToken: nil,
	})
	if err != nil {
		return generated.CourtOverlayConfig{}, fmt.Errorf("revoke token: %w", err)
	}

	return config, nil
}

// ValidateToken checks if the provided token matches the court's overlay token.
// Returns nil if valid, error if invalid. If no token is set on the config, any access is allowed.
func (s *OverlayService) ValidateToken(ctx context.Context, courtID int64, token string) error {
	config, err := s.queries.GetOverlayConfigByCourtID(ctx, courtID)
	if err != nil {
		// No config means no token restriction — allow access
		return nil
	}

	// If no token set, overlay is public
	if config.OverlayToken == nil {
		return nil
	}

	// Token required but not provided
	if token == "" {
		return errors.New("overlay token required")
	}

	// Compare
	if *config.OverlayToken != token {
		return errors.New("invalid overlay token")
	}

	return nil
}

// SetSourceProfile links a source profile to a court's overlay config.
func (s *OverlayService) SetSourceProfile(ctx context.Context, courtID int64, sourceProfileID *int64) (generated.CourtOverlayConfig, error) {
	var spID pgtype.Int8
	if sourceProfileID != nil {
		spID = pgtype.Int8{Int64: *sourceProfileID, Valid: true}
	}

	config, err := s.queries.UpdateOverlaySourceProfile(ctx, generated.UpdateOverlaySourceProfileParams{
		CourtID:         courtID,
		SourceProfileID: spID,
	})
	if err != nil {
		return generated.CourtOverlayConfig{}, fmt.Errorf("set source profile: %w", err)
	}

	s.broadcastConfigChange(ctx, courtID, config)

	return config, nil
}

// GetOverlayData returns the canonical overlay data for a court.
// If the court has an active match, resolves from match data.
// Otherwise returns idle data or demo data.
func (s *OverlayService) GetOverlayData(ctx context.Context, courtID int64, useDemoData bool) (overlay.OverlayData, error) {
	// Check for active match on this court using GetActiveMatchOnCourt
	match, err := s.queries.GetActiveMatchOnCourt(ctx, pgtype.Int8{Int64: courtID, Valid: true})
	if err == nil {
		return s.resolver.ResolveFromMatch(ctx, match)
	}

	// No active match
	if useDemoData {
		return overlay.DemoData(), nil
	}

	return s.resolver.ResolveIdle(ctx, courtID), nil
}

// BroadcastOverlayData broadcasts overlay data to the overlay WS channel for a court.
func (s *OverlayService) BroadcastOverlayData(ctx context.Context, courtID int64, data overlay.OverlayData) {
	if s.ps == nil {
		return
	}
	channel := pubsub.OverlayChannel(courtID)
	_ = s.ps.Publish(ctx, channel, "overlay_data", data)
}

func (s *OverlayService) broadcastConfigChange(ctx context.Context, courtID int64, config generated.CourtOverlayConfig) {
	if s.ps == nil {
		return
	}
	channel := pubsub.OverlayChannel(courtID)
	_ = s.ps.Publish(ctx, channel, "config_update", config)
}

func generateSecureToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
