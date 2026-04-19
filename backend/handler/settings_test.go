package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/court-command/court-command/testutil"
)

func TestGetAdminSettings(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	testutil.CleanTable(t, pool, "site_settings")

	_, err := pool.Exec(context.Background(),
		`INSERT INTO site_settings (key, value) VALUES ('ghost_url', ''), ('ghost_content_api_key', '')`)
	if err != nil {
		t.Fatalf("seed site_settings: %v", err)
	}

	ts, adminCookie := testutil.TestServerWithAdmin(t, pool)
	defer ts.Close()

	req, _ := http.NewRequest("GET", ts.URL+"/api/v1/admin/settings", nil)
	req.Header.Set("Cookie", adminCookie)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET /admin/settings: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var body struct {
		Settings map[string]string `json:"settings"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if _, ok := body.Settings["ghost_url"]; !ok {
		t.Error("expected ghost_url key in settings")
	}
	if _, ok := body.Settings["ghost_content_api_key"]; !ok {
		t.Error("expected ghost_content_api_key key in settings")
	}
}

func TestUpdateAdminSettings(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	testutil.CleanTable(t, pool, "site_settings")

	_, err := pool.Exec(context.Background(),
		`INSERT INTO site_settings (key, value) VALUES ('ghost_url', ''), ('ghost_content_api_key', '')`)
	if err != nil {
		t.Fatalf("seed site_settings: %v", err)
	}

	ts, adminCookie := testutil.TestServerWithAdmin(t, pool)
	defer ts.Close()

	payload := `{"ghost_url":"https://news.courtcommand.app","ghost_content_api_key":"abc123"}`
	req, _ := http.NewRequest("PUT", ts.URL+"/api/v1/admin/settings", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Cookie", adminCookie)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PUT /admin/settings: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var body struct {
		Settings map[string]string `json:"settings"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Settings["ghost_url"] != "https://news.courtcommand.app" {
		t.Errorf("ghost_url = %q, want %q", body.Settings["ghost_url"], "https://news.courtcommand.app")
	}
	if body.Settings["ghost_content_api_key"] != "abc123" {
		t.Errorf("ghost_content_api_key = %q, want %q", body.Settings["ghost_content_api_key"], "abc123")
	}
}

func TestGetGhostConfig_Public(t *testing.T) {
	pool := testutil.TestDB(t)
	testutil.CleanTable(t, pool, "users")
	testutil.CleanTable(t, pool, "site_settings")

	_, err := pool.Exec(context.Background(),
		`INSERT INTO site_settings (key, value) VALUES ('ghost_url', 'https://news.courtcommand.app'), ('ghost_content_api_key', 'abc123')`)
	if err != nil {
		t.Fatalf("seed site_settings: %v", err)
	}

	// We still need a test server (but not the admin cookie for this test)
	ts, _ := testutil.TestServerWithAdmin(t, pool)
	defer ts.Close()

	// No auth cookie — public endpoint
	resp, err := http.Get(ts.URL + "/api/v1/settings/ghost")
	if err != nil {
		t.Fatalf("GET /settings/ghost: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["ghost_url"] != "https://news.courtcommand.app" {
		t.Errorf("ghost_url = %q", body["ghost_url"])
	}
	if body["ghost_content_api_key"] != "abc123" {
		t.Errorf("ghost_content_api_key = %q", body["ghost_content_api_key"])
	}
}
