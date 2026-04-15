package overlay

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Poller periodically fetches data from external APIs configured in Source Profiles.
type Poller struct {
	client *http.Client
}

// NewPoller creates a new Poller with sensible defaults.
func NewPoller() *Poller {
	return &Poller{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// PollResult holds the result of a single poll attempt.
type PollResult struct {
	Data   json.RawMessage
	Status string // "ok", "error", "timeout"
	Error  error
}

// Poll fetches data from an external API using the provided configuration.
func (p *Poller) Poll(ctx context.Context, apiURL string, authType string, authConfig []byte) PollResult {
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return PollResult{Status: "error", Error: fmt.Errorf("create request: %w", err)}
	}

	// Apply authentication
	if err := p.applyAuth(req, authType, authConfig); err != nil {
		return PollResult{Status: "error", Error: fmt.Errorf("apply auth: %w", err)}
	}

	req.Header.Set("Accept", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return PollResult{Status: "timeout", Error: fmt.Errorf("request failed: %w", err)}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return PollResult{Status: "error", Error: fmt.Errorf("unexpected status: %d", resp.StatusCode)}
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1MB limit
	if err != nil {
		return PollResult{Status: "error", Error: fmt.Errorf("read body: %w", err)}
	}

	return PollResult{Data: json.RawMessage(body), Status: "ok"}
}

func (p *Poller) applyAuth(req *http.Request, authType string, authConfig []byte) error {
	switch authType {
	case "none":
		return nil
	case "api_key":
		var config struct {
			HeaderName string `json:"header_name"`
			Key        string `json:"key"`
		}
		if err := json.Unmarshal(authConfig, &config); err != nil {
			return err
		}
		if config.HeaderName == "" {
			config.HeaderName = "X-API-Key"
		}
		req.Header.Set(config.HeaderName, config.Key)
	case "bearer":
		var config struct {
			Token string `json:"token"`
		}
		if err := json.Unmarshal(authConfig, &config); err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+config.Token)
	case "basic":
		var config struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.Unmarshal(authConfig, &config); err != nil {
			return err
		}
		req.SetBasicAuth(config.Username, config.Password)
	}
	return nil
}
