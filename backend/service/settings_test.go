package service_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"

	"github.com/court-command/court-command/db"
	"github.com/court-command/court-command/service"
	"github.com/jackc/pgx/v5/pgxpool"
)

// testPool returns a connected pgxpool.Pool for integration tests.
// It runs migrations and registers cleanup to close the pool.
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://courtcommand:courtcommand@localhost:5432/courtcommand_test?sslmode=disable"
	}
	ctx := context.Background()
	if err := db.RunMigrations(ctx, databaseURL); err != nil {
		t.Fatalf("running migrations: %v", err)
	}
	pool, err := db.Connect(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connecting to database: %v", err)
	}
	t.Cleanup(func() { pool.Close() })
	return pool
}

// cleanTable truncates a table with CASCADE for test isolation.
func cleanTable(t *testing.T, pool *pgxpool.Pool, table string) {
	t.Helper()
	_, err := pool.Exec(context.Background(), fmt.Sprintf("TRUNCATE TABLE %s CASCADE", table))
	if err != nil {
		t.Fatalf("truncating table %s: %v", table, err)
	}
}

func TestSettingsService_GetAll(t *testing.T) {
	pool := testPool(t)
	cleanTable(t, pool, "site_settings")

	// Re-seed defaults after cleaning
	_, err := pool.Exec(context.Background(),
		`INSERT INTO site_settings (key, value) VALUES ('ghost_url', ''), ('ghost_content_api_key', '')`)
	if err != nil {
		t.Fatalf("seed site_settings: %v", err)
	}

	svc := service.NewSettingsService(pool)
	settings, err := svc.GetAll(context.Background())
	if err != nil {
		t.Fatalf("GetAll: %v", err)
	}

	if len(settings) != 2 {
		t.Fatalf("expected 2 settings, got %d", len(settings))
	}
	if settings["ghost_url"] != "" {
		t.Errorf("expected empty ghost_url, got %q", settings["ghost_url"])
	}
	if settings["ghost_content_api_key"] != "" {
		t.Errorf("expected empty ghost_content_api_key, got %q", settings["ghost_content_api_key"])
	}
}

func TestSettingsService_Update(t *testing.T) {
	pool := testPool(t)
	cleanTable(t, pool, "site_settings")

	_, err := pool.Exec(context.Background(),
		`INSERT INTO site_settings (key, value) VALUES ('ghost_url', ''), ('ghost_content_api_key', '')`)
	if err != nil {
		t.Fatalf("seed site_settings: %v", err)
	}

	svc := service.NewSettingsService(pool)

	// Update ghost_url
	err = svc.Update(context.Background(), map[string]string{
		"ghost_url": "https://news.courtcommand.com",
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}

	// Verify
	settings, err := svc.GetAll(context.Background())
	if err != nil {
		t.Fatalf("GetAll after update: %v", err)
	}
	if settings["ghost_url"] != "https://news.courtcommand.com" {
		t.Errorf("expected updated ghost_url, got %q", settings["ghost_url"])
	}
}

func TestSettingsService_Update_UnknownKey(t *testing.T) {
	pool := testPool(t)
	cleanTable(t, pool, "site_settings")

	_, err := pool.Exec(context.Background(),
		`INSERT INTO site_settings (key, value) VALUES ('ghost_url', ''), ('ghost_content_api_key', '')`)
	if err != nil {
		t.Fatalf("seed site_settings: %v", err)
	}

	svc := service.NewSettingsService(pool)

	err = svc.Update(context.Background(), map[string]string{
		"nonexistent_key": "value",
	})
	if err == nil {
		t.Fatal("expected error for unknown key, got nil")
	}

	var ve *service.ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("expected ValidationError, got %T: %v", err, err)
	}
}

func TestSettingsService_GetGhostConfig(t *testing.T) {
	pool := testPool(t)
	cleanTable(t, pool, "site_settings")

	_, err := pool.Exec(context.Background(),
		`INSERT INTO site_settings (key, value) VALUES ('ghost_url', 'https://news.example.com'), ('ghost_content_api_key', 'abc123')`)
	if err != nil {
		t.Fatalf("seed site_settings: %v", err)
	}

	svc := service.NewSettingsService(pool)
	config, err := svc.GetGhostConfig(context.Background())
	if err != nil {
		t.Fatalf("GetGhostConfig: %v", err)
	}
	if config["ghost_url"] != "https://news.example.com" {
		t.Errorf("ghost_url = %q, want %q", config["ghost_url"], "https://news.example.com")
	}
	if config["ghost_content_api_key"] != "abc123" {
		t.Errorf("ghost_content_api_key = %q, want %q", config["ghost_content_api_key"], "abc123")
	}
}
