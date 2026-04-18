package testutil

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/court-command/court-command/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TestDB connects to a test database, runs migrations, and returns a pool.
// The pool is closed automatically when the test finishes.
func TestDB(t *testing.T) *pgxpool.Pool {
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

	t.Cleanup(func() {
		pool.Close()
	})

	return pool
}

// CleanTable truncates the given table (with CASCADE) for test isolation.
func CleanTable(t *testing.T, pool *pgxpool.Pool, table string) {
	t.Helper()
	_, err := pool.Exec(context.Background(), fmt.Sprintf("TRUNCATE TABLE %s CASCADE", table))
	if err != nil {
		t.Fatalf("truncating table %s: %v", table, err)
	}
}
