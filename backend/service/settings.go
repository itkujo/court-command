package service

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SettingsService manages key-value site settings.
type SettingsService struct {
	pool *pgxpool.Pool
}

// NewSettingsService creates a new SettingsService.
func NewSettingsService(pool *pgxpool.Pool) *SettingsService {
	return &SettingsService{pool: pool}
}

// GetAll returns all settings as a map.
func (s *SettingsService) GetAll(ctx context.Context) (map[string]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT key, value FROM site_settings ORDER BY key`)
	if err != nil {
		return nil, fmt.Errorf("query site_settings: %w", err)
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, fmt.Errorf("scan site_settings row: %w", err)
		}
		settings[k] = v
	}
	return settings, rows.Err()
}

// GetGhostConfig returns only Ghost-related settings.
func (s *SettingsService) GetGhostConfig(ctx context.Context) (map[string]string, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT key, value FROM site_settings WHERE key IN ('ghost_url', 'ghost_content_api_key') ORDER BY key`)
	if err != nil {
		return nil, fmt.Errorf("query ghost config: %w", err)
	}
	defer rows.Close()

	config := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, fmt.Errorf("scan ghost config row: %w", err)
		}
		config[k] = v
	}
	return config, rows.Err()
}

// GetGoogleMapsConfig returns the Google Maps API key setting.
func (s *SettingsService) GetGoogleMapsConfig(ctx context.Context) (map[string]string, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT key, value FROM site_settings WHERE key = 'google_maps_api_key'`)
	if err != nil {
		return nil, fmt.Errorf("query google maps config: %w", err)
	}
	defer rows.Close()

	config := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, fmt.Errorf("scan google maps config row: %w", err)
		}
		config[k] = v
	}
	return config, rows.Err()
}

// Update updates one or more settings. Returns an error if any key does not exist.
func (s *SettingsService) Update(ctx context.Context, updates map[string]string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	for k, v := range updates {
		tag, err := tx.Exec(ctx,
			`UPDATE site_settings SET value = $1, updated_at = NOW() WHERE key = $2`, v, k)
		if err != nil {
			return fmt.Errorf("update setting %q: %w", k, err)
		}
		if tag.RowsAffected() == 0 {
			return &ValidationError{Message: fmt.Sprintf("unknown setting key: %s", k)}
		}
	}

	return tx.Commit(ctx)
}
