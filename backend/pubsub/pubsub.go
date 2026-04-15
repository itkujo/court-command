package pubsub

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/redis/go-redis/v9"
)

// PubSub wraps Redis pub/sub for real-time match updates.
type PubSub struct {
	client *redis.Client
	logger *slog.Logger
}

// New creates a new PubSub instance backed by Redis.
func New(client *redis.Client, logger *slog.Logger) *PubSub {
	return &PubSub{client: client, logger: logger}
}

// Channel helpers — deterministic channel names for each entity type.
func MatchChannel(publicID string) string         { return fmt.Sprintf("match:%s", publicID) }
func CourtChannel(courtID int64) string           { return fmt.Sprintf("court:%d", courtID) }
func DivisionChannel(divisionID int64) string     { return fmt.Sprintf("division:%d", divisionID) }
func TournamentChannel(tournamentID int64) string { return fmt.Sprintf("tournament:%d", tournamentID) }
func LeagueChannel(leagueID int64) string         { return fmt.Sprintf("league:%d", leagueID) }
func OverlayChannel(courtID int64) string         { return fmt.Sprintf("overlay:%d", courtID) }

// Message is the envelope sent over Redis pub/sub channels.
type Message struct {
	Type    string          `json:"type"`
	Channel string          `json:"channel"`
	Data    json.RawMessage `json:"data"`
}

// Publish sends a typed message to a Redis channel.
func (ps *PubSub) Publish(ctx context.Context, channel string, msgType string, data interface{}) error {
	dataJSON, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal data: %w", err)
	}
	msg := Message{Type: msgType, Channel: channel, Data: dataJSON}
	msgJSON, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal message: %w", err)
	}
	if err := ps.client.Publish(ctx, channel, msgJSON).Err(); err != nil {
		ps.logger.Error("failed to publish", "channel", channel, "type", msgType, "error", err)
		return fmt.Errorf("publish to %s: %w", channel, err)
	}
	ps.logger.Debug("published message", "channel", channel, "type", msgType)
	return nil
}

// Subscribe listens on one or more Redis channels and returns a message channel.
// Call the returned cancel func to stop the subscription and release resources.
func (ps *PubSub) Subscribe(ctx context.Context, channels ...string) (<-chan Message, func(), error) {
	sub := ps.client.Subscribe(ctx, channels...)
	if _, err := sub.Receive(ctx); err != nil {
		sub.Close()
		return nil, nil, fmt.Errorf("subscribe to %v: %w", channels, err)
	}
	msgChan := make(chan Message, 64)
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
					ps.logger.Warn("failed to parse pub/sub message", "channel", redisMsg.Channel, "error", err)
					continue
				}
				select {
				case msgChan <- msg:
				default:
					ps.logger.Warn("dropping message, subscriber buffer full", "channel", redisMsg.Channel)
				}
			}
		}
	}()
	return msgChan, cancel, nil
}

// PublishMatchUpdate fans out a match update to all relevant channels:
// the match-specific channel, and optionally the court, overlay, and division channels.
func (ps *PubSub) PublishMatchUpdate(ctx context.Context, matchPublicID string, courtID *int64, divisionID *int64, matchData interface{}) {
	ps.Publish(ctx, MatchChannel(matchPublicID), "match_update", matchData)
	if courtID != nil {
		ps.Publish(ctx, CourtChannel(*courtID), "match_update", matchData)
		ps.Publish(ctx, OverlayChannel(*courtID), "match_update", matchData)
	}
	if divisionID != nil {
		ps.Publish(ctx, DivisionChannel(*divisionID), "match_update", matchData)
	}
}
