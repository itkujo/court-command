# Phase 4C: WebSocket Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the real-time WebSocket infrastructure that broadcasts match, court, division, tournament, league, and overlay state changes to connected clients via Redis Pub/Sub.

**Architecture:** A central `PubSub` service wraps Redis pub/sub. When any state-changing service method commits, it publishes a message to the appropriate Redis channel(s). A WebSocket upgrade handler in the HTTP layer accepts WS connections, subscribes to the requested channel, and forwards messages. The 6 channels are: `match:{public_id}`, `court:{court_id}`, `division:{division_id}`, `tournament:{tournament_id}`, `league:{league_id}`, `overlay:{court_id}`.

**Tech Stack:** Go 1.24+, Chi v5, gorilla/websocket, redis/v9

**Depends on:** Phase 4A (Match/MatchEvent entities), Phase 4B (scoring engine methods)

---

## File Structure

```
backend/
├── pubsub/
│   └── pubsub.go               # Redis pub/sub wrapper
├── ws/
│   └── handler.go              # WebSocket upgrade + subscription handler
├── service/
│   └── match.go                # Modified: add broadcast calls after state changes
└── router/
    └── router.go               # Modified: mount WS routes
```

---

## Task 1: Redis Pub/Sub Service

**Files:**
- Create: `backend/pubsub/pubsub.go`

- [ ] **Step 1: Write the pub/sub service**

```go
// backend/pubsub/pubsub.go
package pubsub

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/redis/go-redis/v9"
)

// PubSub wraps Redis pub/sub for broadcasting real-time updates.
type PubSub struct {
	client *redis.Client
	logger *slog.Logger
}

// New creates a new PubSub instance.
func New(client *redis.Client, logger *slog.Logger) *PubSub {
	return &PubSub{client: client, logger: logger}
}

// Channel name constructors

func MatchChannel(publicID string) string {
	return fmt.Sprintf("match:%s", publicID)
}

func CourtChannel(courtID int64) string {
	return fmt.Sprintf("court:%d", courtID)
}

func DivisionChannel(divisionID int64) string {
	return fmt.Sprintf("division:%d", divisionID)
}

func TournamentChannel(tournamentID int64) string {
	return fmt.Sprintf("tournament:%d", tournamentID)
}

func LeagueChannel(leagueID int64) string {
	return fmt.Sprintf("league:%d", leagueID)
}

func OverlayChannel(courtID int64) string {
	return fmt.Sprintf("overlay:%d", courtID)
}

// Message is the envelope published to channels.
type Message struct {
	Type    string          `json:"type"`    // e.g., "match_update", "court_update", "overlay_config_update"
	Channel string          `json:"channel"` // the channel name
	Data    json.RawMessage `json:"data"`    // the payload
}

// Publish sends a message to the specified channel.
func (ps *PubSub) Publish(ctx context.Context, channel string, msgType string, data interface{}) error {
	dataJSON, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal data: %w", err)
	}

	msg := Message{
		Type:    msgType,
		Channel: channel,
		Data:    dataJSON,
	}

	msgJSON, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal message: %w", err)
	}

	if err := ps.client.Publish(ctx, channel, msgJSON).Err(); err != nil {
		ps.logger.Error("failed to publish",
			"channel", channel,
			"type", msgType,
			"error", err,
		)
		return fmt.Errorf("publish to %s: %w", channel, err)
	}

	ps.logger.Debug("published message",
		"channel", channel,
		"type", msgType,
	)
	return nil
}

// Subscribe creates a Redis subscription and returns a channel of messages.
// The caller is responsible for calling cancel to stop the subscription.
func (ps *PubSub) Subscribe(ctx context.Context, channels ...string) (<-chan Message, func(), error) {
	sub := ps.client.Subscribe(ctx, channels...)

	// Wait for subscription confirmation
	if _, err := sub.Receive(ctx); err != nil {
		sub.Close()
		return nil, nil, fmt.Errorf("subscribe to %v: %w", channels, err)
	}

	msgChan := make(chan Message, 64) // buffered to avoid blocking
	cancelCtx, cancel := context.WithCancel(ctx)

	go func() {
		defer close(msgChan)
		defer sub.Close()

		ch := sub.Channel()
		for {
			select {
			case <-cancelCtx.Done():
				return
			case redisMsg, ok := <-ch:
				if !ok {
					return
				}
				var msg Message
				if err := json.Unmarshal([]byte(redisMsg.Payload), &msg); err != nil {
					ps.logger.Warn("failed to parse pub/sub message",
						"channel", redisMsg.Channel,
						"error", err,
					)
					continue
				}
				select {
				case msgChan <- msg:
				default:
					ps.logger.Warn("dropping message, subscriber buffer full",
						"channel", redisMsg.Channel,
					)
				}
			}
		}
	}()

	return msgChan, cancel, nil
}

// PublishMatchUpdate publishes a match update to all relevant channels.
func (ps *PubSub) PublishMatchUpdate(ctx context.Context, matchPublicID string, courtID *int64, divisionID *int64, matchData interface{}) {
	// Always publish to match channel
	ps.Publish(ctx, MatchChannel(matchPublicID), "match_update", matchData)

	// Publish to court channel if assigned
	if courtID != nil {
		ps.Publish(ctx, CourtChannel(*courtID), "match_update", matchData)
		ps.Publish(ctx, OverlayChannel(*courtID), "match_update", matchData)
	}

	// Publish to division channel if assigned
	if divisionID != nil {
		ps.Publish(ctx, DivisionChannel(*divisionID), "match_update", matchData)
	}
}
```

- [ ] **Step 2: Install redis dependency**

Run: `cd backend && go get github.com/redis/go-redis/v9`
Expected: Added to go.mod.

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/pubsub/pubsub.go backend/go.mod backend/go.sum
git commit -m "feat: add Redis pub/sub service with 6 channel types"
```

---

## Task 2: WebSocket Handler

**Files:**
- Create: `backend/ws/handler.go`

- [ ] **Step 1: Write the WebSocket handler**

```go
// backend/ws/handler.go
package ws

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"

	"github.com/court-command/court-command/backend/pubsub"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TODO: tighten in production via config
		return true
	},
}

// Handler manages WebSocket connections.
type Handler struct {
	ps     *pubsub.PubSub
	logger *slog.Logger
}

// NewHandler creates a new WebSocket handler.
func NewHandler(ps *pubsub.PubSub, logger *slog.Logger) *Handler {
	return &Handler{ps: ps, logger: logger}
}

// Routes returns WebSocket routes.
func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()

	r.Get("/match/{matchPublicID}", h.HandleMatchWS)
	r.Get("/court/{courtID}", h.HandleCourtWS)
	r.Get("/division/{divisionID}", h.HandleDivisionWS)
	r.Get("/tournament/{tournamentID}", h.HandleTournamentWS)
	r.Get("/league/{leagueID}", h.HandleLeagueWS)
	r.Get("/overlay/{courtID}", h.HandleOverlayWS)

	return r
}

// HandleMatchWS subscribes to match updates.
func (h *Handler) HandleMatchWS(w http.ResponseWriter, r *http.Request) {
	matchPublicID := chi.URLParam(r, "matchPublicID")
	channel := pubsub.MatchChannel(matchPublicID)
	h.handleSubscription(w, r, channel)
}

// HandleCourtWS subscribes to court updates.
func (h *Handler) HandleCourtWS(w http.ResponseWriter, r *http.Request) {
	courtIDStr := chi.URLParam(r, "courtID")
	courtID, err := strconv.ParseInt(courtIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid court ID", http.StatusBadRequest)
		return
	}
	channel := pubsub.CourtChannel(courtID)
	h.handleSubscription(w, r, channel)
}

// HandleDivisionWS subscribes to division updates.
func (h *Handler) HandleDivisionWS(w http.ResponseWriter, r *http.Request) {
	divisionIDStr := chi.URLParam(r, "divisionID")
	divisionID, err := strconv.ParseInt(divisionIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid division ID", http.StatusBadRequest)
		return
	}
	channel := pubsub.DivisionChannel(divisionID)
	h.handleSubscription(w, r, channel)
}

// HandleTournamentWS subscribes to tournament updates.
func (h *Handler) HandleTournamentWS(w http.ResponseWriter, r *http.Request) {
	tournamentIDStr := chi.URLParam(r, "tournamentID")
	tournamentID, err := strconv.ParseInt(tournamentIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid tournament ID", http.StatusBadRequest)
		return
	}
	channel := pubsub.TournamentChannel(tournamentID)
	h.handleSubscription(w, r, channel)
}

// HandleLeagueWS subscribes to league updates.
func (h *Handler) HandleLeagueWS(w http.ResponseWriter, r *http.Request) {
	leagueIDStr := chi.URLParam(r, "leagueID")
	leagueID, err := strconv.ParseInt(leagueIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid league ID", http.StatusBadRequest)
		return
	}
	channel := pubsub.LeagueChannel(leagueID)
	h.handleSubscription(w, r, channel)
}

// HandleOverlayWS subscribes to overlay config updates.
func (h *Handler) HandleOverlayWS(w http.ResponseWriter, r *http.Request) {
	courtIDStr := chi.URLParam(r, "courtID")
	courtID, err := strconv.ParseInt(courtIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid court ID", http.StatusBadRequest)
		return
	}
	channel := pubsub.OverlayChannel(courtID)
	h.handleSubscription(w, r, channel)
}

// handleSubscription upgrades to WebSocket and pipes Redis pub/sub messages.
func (h *Handler) handleSubscription(w http.ResponseWriter, r *http.Request, channel string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.logger.Error("websocket upgrade failed", "error", err)
		return
	}
	defer conn.Close()

	h.logger.Info("websocket connected", "channel", channel, "remote", r.RemoteAddr)

	// Subscribe to Redis channel
	msgChan, cancel, err := h.ps.Subscribe(r.Context(), channel)
	if err != nil {
		h.logger.Error("redis subscribe failed", "channel", channel, "error", err)
		conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "subscription failed"))
		return
	}
	defer cancel()

	// Set up ping/pong for keepalive
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	// Read pump (drains client messages, detects disconnect)
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
		}
	}()

	// Write pump (sends Redis messages + pings)
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case msg, ok := <-msgChan:
			if !ok {
				return
			}
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteJSON(msg); err != nil {
				h.logger.Debug("websocket write failed", "channel", channel, "error", err)
				return
			}

		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}

		case <-done:
			h.logger.Info("websocket disconnected", "channel", channel, "remote", r.RemoteAddr)
			return
		}
	}
}
```

- [ ] **Step 2: Install gorilla/websocket**

Run: `cd backend && go get github.com/gorilla/websocket`
Expected: Added to go.mod.

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/ws/handler.go backend/go.mod backend/go.sum
git commit -m "feat: add WebSocket handler with 6 subscription channels"
```

---

## Task 3: Wire Pub/Sub into Match Service

**Files:**
- Modify: `backend/service/match.go`

- [ ] **Step 1: Add PubSub to MatchService and broadcast after state changes**

Update `MatchService` to accept a `*pubsub.PubSub` parameter:

```go
// Update the struct and constructor:
type MatchService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
	ps      *pubsub.PubSub
}

func NewMatchService(queries *generated.Queries, pool *pgxpool.Pool, ps *pubsub.PubSub) *MatchService {
	return &MatchService{queries: queries, pool: pool, ps: ps}
}
```

Add a broadcast helper:

```go
// broadcastMatchUpdate publishes a match update to all relevant channels.
func (s *MatchService) broadcastMatchUpdate(ctx context.Context, match generated.Match) {
	if s.ps == nil {
		return
	}
	s.ps.PublishMatchUpdate(ctx, match.PublicID.String(), match.CourtID, match.DivisionID, match)
}
```

Add `s.broadcastMatchUpdate(ctx, match)` as the last line before returning in these methods:
- `StartMatch`
- `applyEngineResult` (covers all scoring actions: ScorePoint, SideOut, RemovePoint, ConfirmGameOver, ConfirmMatchOver, CallTimeout, PauseMatch, ResumeMatch, DeclareForfeit)
- `Undo`
- `UpdateStatus`

Example for `applyEngineResult`, add before the final return:

```go
	// Broadcast update
	s.broadcastMatchUpdate(ctx, match)

	return match, event, nil
```

- [ ] **Step 2: Update main.go to create PubSub and pass it**

In `main.go`, after creating the Redis client:

```go
ps := pubsub.New(redisClient, logger)
matchSvc := service.NewMatchService(queries, pool, ps)
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/service/match.go backend/main.go
git commit -m "feat: broadcast match updates via Redis pub/sub after all state changes"
```

---

## Task 4: Mount WebSocket Routes

**Files:**
- Modify: `backend/router/router.go`
- Modify: `backend/main.go`

- [ ] **Step 1: Mount WS routes in the router**

Add to router setup:

```go
// WebSocket routes (no /api/v1 prefix — WS clients connect directly)
r.Route("/ws", func(r chi.Router) {
    r.Mount("/", wsHandler.Routes())
})
```

- [ ] **Step 2: Create WS handler in main.go**

```go
wsHandler := ws.NewHandler(ps, logger)
```

Pass `wsHandler` to the router setup function.

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && go build ./...`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add backend/router/router.go backend/main.go
git commit -m "feat: mount WebSocket routes at /ws/"
```

---

## Task 5: Smoke Test

- [ ] **Step 1: Start services**

Run: `docker compose up -d && cd backend && go run main.go`

- [ ] **Step 2: Test WebSocket connection with wscat**

Install wscat if needed: `npm install -g wscat`

Run: `wscat -c "ws://localhost:8080/ws/court/1"`
Expected: Connection established. Keep it open.

- [ ] **Step 3: In another terminal, create and start a match on court 1, then score a point**

Register user, create match with court_id=1, start it, score a point. The wscat terminal should show the match update JSON messages in real-time.

- [ ] **Step 4: Verify all 6 WS channels accept connections**

```bash
wscat -c "ws://localhost:8080/ws/match/some-uuid"
wscat -c "ws://localhost:8080/ws/court/1"
wscat -c "ws://localhost:8080/ws/division/1"
wscat -c "ws://localhost:8080/ws/tournament/1"
wscat -c "ws://localhost:8080/ws/league/1"
wscat -c "ws://localhost:8080/ws/overlay/1"
```
Expected: All 6 connections upgrade successfully.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Phase 4C complete — WebSocket infrastructure with 6 channels via Redis pub/sub"
```

---

## WebSocket Endpoints

| Path | Channel | Purpose |
|---|---|---|
| `ws://host/ws/match/{publicID}` | `match:{publicID}` | Live match scoring updates |
| `ws://host/ws/court/{courtID}` | `court:{courtID}` | Court state changes (active match, queue) |
| `ws://host/ws/division/{divisionID}` | `division:{divisionID}` | All match updates within a division |
| `ws://host/ws/tournament/{tournamentID}` | `tournament:{tournamentID}` | All match updates within a tournament |
| `ws://host/ws/league/{leagueID}` | `league:{leagueID}` | All match updates within a league |
| `ws://host/ws/overlay/{courtID}` | `overlay:{courtID}` | Overlay config + match updates for a court |
