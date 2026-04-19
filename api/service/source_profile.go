package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/court-command/court-command/db/generated"
)

// TestConnectionInput is the payload for SourceProfileService.TestConnection.
// It intentionally mirrors CreateSourceProfileParams so the editor can submit
// its in-progress form values without first persisting the profile.
type TestConnectionInput struct {
	SourceType    string          `json:"source_type"`
	APIURL        string          `json:"api_url"`
	WebhookSecret string          `json:"webhook_secret"`
	AuthType      string          `json:"auth_type"`
	AuthConfig    json.RawMessage `json:"auth_config"`
}

// TestConnectionResult is the response from SourceProfileService.TestConnection.
// discovered_paths is a sorted list of dot-separated JSON leaf paths, suitable
// for the FieldMapper dropdown. sample_payload is the decoded body echoed back
// for inspection. error is populated when success is false.
type TestConnectionResult struct {
	Success         bool        `json:"success"`
	StatusCode      int         `json:"status_code,omitempty"`
	DiscoveredPaths []string    `json:"discovered_paths,omitempty"`
	SamplePayload   interface{} `json:"sample_payload,omitempty"`
	Error           string      `json:"error,omitempty"`
}

// TestConnection pings the given source URL with the supplied auth and returns
// discovery metadata. Webhook sources short-circuit (no URL to call) and
// static sources are always considered "success" without a network hop.
func (s *SourceProfileService) TestConnection(ctx context.Context, input TestConnectionInput) TestConnectionResult {
	sourceType := input.SourceType
	if sourceType == "" {
		sourceType = "rest_api"
	}

	switch sourceType {
	case "webhook":
		// Webhooks can't be probed actively; the caller just needs to know
		// the secret is wired. Treat missing secret as a failure.
		if input.WebhookSecret == "" {
			return TestConnectionResult{Success: false, Error: "webhook_secret is required for webhook sources"}
		}
		return TestConnectionResult{Success: true}
	case "court_command":
		// Internal source — nothing to probe. Always OK.
		return TestConnectionResult{Success: true}
	case "rest_api":
		// fallthrough
	default:
		return TestConnectionResult{Success: false, Error: fmt.Sprintf("unsupported source_type: %q", sourceType)}
	}

	if strings.TrimSpace(input.APIURL) == "" {
		return TestConnectionResult{Success: false, Error: "api_url is required for rest_api sources"}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, input.APIURL, nil)
	if err != nil {
		return TestConnectionResult{Success: false, Error: fmt.Sprintf("invalid URL: %v", err)}
	}
	req.Header.Set("Accept", "application/json")
	if err := applyAuthHeader(req, input.AuthType, input.AuthConfig); err != nil {
		return TestConnectionResult{Success: false, Error: err.Error()}
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return TestConnectionResult{Success: false, Error: fmt.Sprintf("request failed: %v", err)}
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1 MB cap
	if err != nil {
		return TestConnectionResult{Success: false, StatusCode: resp.StatusCode, Error: fmt.Sprintf("failed to read response: %v", err)}
	}

	var payload interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		// Non-JSON bodies are a soft failure: we echo a truncated preview so the
		// caller can see what came back, but can't discover paths.
		preview := string(body)
		if len(preview) > 512 {
			preview = preview[:512] + "…"
		}
		return TestConnectionResult{
			Success:       false,
			StatusCode:    resp.StatusCode,
			SamplePayload: preview,
			Error:         fmt.Sprintf("response is not JSON: %v", err),
		}
	}

	paths := discoverJSONPaths(payload, "")
	sort.Strings(paths)

	success := resp.StatusCode >= 200 && resp.StatusCode < 300
	result := TestConnectionResult{
		Success:         success,
		StatusCode:      resp.StatusCode,
		DiscoveredPaths: paths,
		SamplePayload:   payload,
	}
	if !success {
		result.Error = fmt.Sprintf("upstream returned HTTP %d", resp.StatusCode)
	}
	return result
}

// applyAuthHeader wires auth_config into the outgoing request based on the
// declared auth_type. Unknown types are treated as "none".
func applyAuthHeader(req *http.Request, authType string, authConfig json.RawMessage) error {
	if authType == "" || authType == "none" {
		return nil
	}

	cfg := map[string]string{}
	if len(authConfig) > 0 {
		raw := map[string]interface{}{}
		if err := json.Unmarshal(authConfig, &raw); err != nil {
			return fmt.Errorf("invalid auth_config JSON: %v", err)
		}
		for k, v := range raw {
			if s, ok := v.(string); ok {
				cfg[k] = s
			}
		}
	}

	switch authType {
	case "bearer":
		token := cfg["token"]
		if token == "" {
			return fmt.Errorf("bearer auth requires auth_config.token")
		}
		req.Header.Set("Authorization", "Bearer "+token)
	case "api_key":
		header := cfg["header"]
		if header == "" {
			header = "X-API-Key"
		}
		key := cfg["key"]
		if key == "" {
			return fmt.Errorf("api_key auth requires auth_config.key")
		}
		req.Header.Set(header, key)
	case "basic":
		user := cfg["username"]
		pass := cfg["password"]
		if user == "" {
			return fmt.Errorf("basic auth requires auth_config.username")
		}
		creds := base64.StdEncoding.EncodeToString([]byte(user + ":" + pass))
		req.Header.Set("Authorization", "Basic "+creds)
	default:
		return fmt.Errorf("unsupported auth_type: %q", authType)
	}
	return nil
}

// discoverJSONPaths walks a parsed JSON value and returns leaf paths in
// dot-notation (arrays use [] — the first element is inspected). Maximum
// depth is 8 and maximum path count is 200 to keep responses bounded.
func discoverJSONPaths(v interface{}, prefix string) []string {
	const maxDepth = 8
	const maxPaths = 200
	out := []string{}
	var walk func(val interface{}, path string, depth int)
	walk = func(val interface{}, path string, depth int) {
		if len(out) >= maxPaths || depth > maxDepth {
			return
		}
		switch node := val.(type) {
		case map[string]interface{}:
			if len(node) == 0 && path != "" {
				out = append(out, path)
				return
			}
			keys := make([]string, 0, len(node))
			for k := range node {
				keys = append(keys, k)
			}
			sort.Strings(keys)
			for _, k := range keys {
				child := k
				if path != "" {
					child = path + "." + k
				}
				walk(node[k], child, depth+1)
			}
		case []interface{}:
			if len(node) == 0 {
				if path != "" {
					out = append(out, path+"[]")
				}
				return
			}
			// Inspect only the first element — arrays in API payloads are
			// generally homogeneous.
			walk(node[0], path+"[]", depth+1)
		default:
			if path != "" {
				out = append(out, path)
			}
		}
	}
	walk(v, prefix, 0)
	return out
}

// SourceProfileService handles Source Profile CRUD.
type SourceProfileService struct {
	queries *generated.Queries
}

// NewSourceProfileService creates a new SourceProfileService.
func NewSourceProfileService(queries *generated.Queries) *SourceProfileService {
	return &SourceProfileService{queries: queries}
}

// Create creates a new Source Profile.
func (s *SourceProfileService) Create(ctx context.Context, params generated.CreateSourceProfileParams) (generated.SourceProfile, error) {
	return s.queries.CreateSourceProfile(ctx, params)
}

// GetByID returns a Source Profile by ID.
func (s *SourceProfileService) GetByID(ctx context.Context, id int64) (generated.SourceProfile, error) {
	return s.queries.GetSourceProfileByID(ctx, id)
}

// ListByUser returns all Source Profiles created by a user.
func (s *SourceProfileService) ListByUser(ctx context.Context, userID int64) ([]generated.SourceProfile, error) {
	return s.queries.ListSourceProfilesByUser(ctx, userID)
}

// Update updates a Source Profile.
func (s *SourceProfileService) Update(ctx context.Context, params generated.UpdateSourceProfileParams) (generated.SourceProfile, error) {
	return s.queries.UpdateSourceProfile(ctx, params)
}

// Deactivate deactivates a Source Profile.
func (s *SourceProfileService) Deactivate(ctx context.Context, id int64) (generated.SourceProfile, error) {
	return s.queries.DeactivateSourceProfile(ctx, id)
}

// Delete deletes a Source Profile.
func (s *SourceProfileService) Delete(ctx context.Context, id int64) error {
	return s.queries.DeleteSourceProfile(ctx, id)
}

// UpdatePollStatus records the result of a poll attempt.
func (s *SourceProfileService) UpdatePollStatus(ctx context.Context, id int64, status string) error {
	return s.queries.UpdateSourceProfilePollStatus(ctx, generated.UpdateSourceProfilePollStatusParams{
		ID:             id,
		LastPollStatus: &status,
	})
}
