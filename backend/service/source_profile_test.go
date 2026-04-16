package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestDiscoverJSONPaths_Primitive confirms that scalar roots produce no paths.
func TestDiscoverJSONPaths_Primitive(t *testing.T) {
	if got := discoverJSONPaths("hello", ""); len(got) != 0 {
		t.Fatalf("expected no paths for scalar root, got %v", got)
	}
}

// TestDiscoverJSONPaths_NestedObject confirms dot-notation traversal.
func TestDiscoverJSONPaths_NestedObject(t *testing.T) {
	payload := map[string]interface{}{
		"team_1": map[string]interface{}{
			"name":  "Falcons",
			"score": 11,
		},
		"match_info": "Round 3",
	}
	got := discoverJSONPaths(payload, "")
	want := map[string]bool{
		"team_1.name":  true,
		"team_1.score": true,
		"match_info":   true,
	}
	if len(got) != len(want) {
		t.Fatalf("path count mismatch: got %v, want %v", got, want)
	}
	for _, p := range got {
		if !want[p] {
			t.Fatalf("unexpected path %q; want subset of %v", p, want)
		}
	}
}

// TestDiscoverJSONPaths_Array confirms the [] suffix is applied and the first
// element is inspected.
func TestDiscoverJSONPaths_Array(t *testing.T) {
	payload := map[string]interface{}{
		"players": []interface{}{
			map[string]interface{}{"name": "Alice"},
			map[string]interface{}{"name": "Bob"},
		},
	}
	got := discoverJSONPaths(payload, "")
	found := false
	for _, p := range got {
		if p == "players[].name" {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected players[].name in %v", got)
	}
}

// TestTestConnection_Webhook_SuccessWhenSecretPresent exercises the webhook
// short-circuit.
func TestTestConnection_Webhook_SuccessWhenSecretPresent(t *testing.T) {
	svc := &SourceProfileService{}
	res := svc.TestConnection(context.Background(), TestConnectionInput{
		SourceType:    "webhook",
		WebhookSecret: "supersecret",
	})
	if !res.Success {
		t.Fatalf("expected success=true for webhook with secret, got %+v", res)
	}
}

// TestTestConnection_Webhook_FailsWhenSecretMissing guards against silent
// webhook success.
func TestTestConnection_Webhook_FailsWhenSecretMissing(t *testing.T) {
	svc := &SourceProfileService{}
	res := svc.TestConnection(context.Background(), TestConnectionInput{SourceType: "webhook"})
	if res.Success {
		t.Fatalf("expected success=false for webhook without secret, got %+v", res)
	}
}

// TestTestConnection_CourtCommand_AlwaysSuccess — internal sources have no
// URL to probe.
func TestTestConnection_CourtCommand_AlwaysSuccess(t *testing.T) {
	svc := &SourceProfileService{}
	res := svc.TestConnection(context.Background(), TestConnectionInput{SourceType: "court_command"})
	if !res.Success {
		t.Fatalf("expected success=true for court_command, got %+v", res)
	}
}

// TestTestConnection_RestAPI_Success hits a test server and asserts paths
// are discovered.
func TestTestConnection_RestAPI_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer test-token" {
			t.Fatalf("expected bearer token header, got %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"score":11,"team":{"name":"Falcons"}}`))
	}))
	defer srv.Close()

	svc := &SourceProfileService{}
	res := svc.TestConnection(context.Background(), TestConnectionInput{
		SourceType: "rest_api",
		APIURL:     srv.URL,
		AuthType:   "bearer",
		AuthConfig: json.RawMessage(`{"token":"test-token"}`),
	})
	if !res.Success {
		t.Fatalf("expected success=true, got %+v", res)
	}
	if res.StatusCode != 200 {
		t.Fatalf("expected status 200, got %d", res.StatusCode)
	}
	foundScore := false
	foundTeamName := false
	for _, p := range res.DiscoveredPaths {
		if p == "score" {
			foundScore = true
		}
		if p == "team.name" {
			foundTeamName = true
		}
	}
	if !foundScore || !foundTeamName {
		t.Fatalf("expected score + team.name in discovered paths, got %v", res.DiscoveredPaths)
	}
}

// TestTestConnection_RestAPI_NonJSON records the body as a preview string
// and reports failure.
func TestTestConnection_RestAPI_NonJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`not json at all`))
	}))
	defer srv.Close()

	svc := &SourceProfileService{}
	res := svc.TestConnection(context.Background(), TestConnectionInput{
		SourceType: "rest_api",
		APIURL:     srv.URL,
	})
	if res.Success {
		t.Fatalf("expected success=false for non-JSON response, got %+v", res)
	}
	if res.Error == "" {
		t.Fatalf("expected error message, got empty")
	}
}

// TestTestConnection_RestAPI_HTTPError propagates upstream status codes.
func TestTestConnection_RestAPI_HTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
		_, _ = w.Write([]byte(`{"error":"nope"}`))
	}))
	defer srv.Close()

	svc := &SourceProfileService{}
	res := svc.TestConnection(context.Background(), TestConnectionInput{
		SourceType: "rest_api",
		APIURL:     srv.URL,
	})
	if res.Success {
		t.Fatalf("expected success=false for 418 response, got %+v", res)
	}
	if res.StatusCode != http.StatusTeapot {
		t.Fatalf("expected status 418, got %d", res.StatusCode)
	}
}

// TestTestConnection_RestAPI_MissingURL returns an error without a network
// call.
func TestTestConnection_RestAPI_MissingURL(t *testing.T) {
	svc := &SourceProfileService{}
	res := svc.TestConnection(context.Background(), TestConnectionInput{SourceType: "rest_api"})
	if res.Success {
		t.Fatalf("expected success=false, got %+v", res)
	}
	if res.Error == "" {
		t.Fatalf("expected error message, got empty")
	}
}

// TestTestConnection_UnsupportedSourceType rejects unknown types.
func TestTestConnection_UnsupportedSourceType(t *testing.T) {
	svc := &SourceProfileService{}
	res := svc.TestConnection(context.Background(), TestConnectionInput{SourceType: "carrier_pigeon"})
	if res.Success {
		t.Fatalf("expected success=false for unknown type, got %+v", res)
	}
}
