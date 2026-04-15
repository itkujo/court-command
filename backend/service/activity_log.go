// backend/service/activity_log.go
package service

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/court-command/court-command/db/generated"
)

// ActivityLogService handles activity log business logic.
type ActivityLogService struct {
	queries *generated.Queries
}

// NewActivityLogService creates a new ActivityLogService.
func NewActivityLogService(queries *generated.Queries) *ActivityLogService {
	return &ActivityLogService{queries: queries}
}

// ActivityLogResponse is the public representation of an activity log entry.
type ActivityLogResponse struct {
	ID         int64           `json:"id"`
	UserID     int64           `json:"user_id"`
	Action     string          `json:"action"`
	EntityType string          `json:"entity_type"`
	EntityID   *int64          `json:"entity_id,omitempty"`
	Metadata   json.RawMessage `json:"metadata,omitempty"`
	IPAddress  *string         `json:"ip_address,omitempty"`
	CreatedAt  string          `json:"created_at"`
}

// toActivityLogResponse converts a generated ActivityLog to a response DTO.
func toActivityLogResponse(log generated.ActivityLog) ActivityLogResponse {
	resp := ActivityLogResponse{
		ID:         log.ID,
		UserID:     log.UserID,
		Action:     log.Action,
		EntityType: log.EntityType,
		IPAddress:  log.IpAddress,
		CreatedAt:  log.CreatedAt.Format(time.RFC3339),
	}
	if log.EntityID.Valid {
		resp.EntityID = &log.EntityID.Int64
	}
	if len(log.Metadata) > 0 {
		resp.Metadata = log.Metadata
	}
	return resp
}

// LogActivity creates a new activity log entry. It is intentionally fire-and-forget
// so that failures do not block the calling request.
func (s *ActivityLogService) LogActivity(ctx context.Context, userID int64, action, entityType string, entityID *int64, metadata interface{}, ipAddress string) {
	var metaBytes []byte
	if metadata != nil {
		b, err := json.Marshal(metadata)
		if err != nil {
			slog.Error("failed to marshal activity log metadata", "error", err)
		} else {
			metaBytes = b
		}
	}

	var eid pgtype.Int8
	if entityID != nil {
		eid = pgtype.Int8{Int64: *entityID, Valid: true}
	}

	var ip *string
	if ipAddress != "" {
		ip = &ipAddress
	}

	_, err := s.queries.CreateActivityLog(ctx, generated.CreateActivityLogParams{
		UserID:     userID,
		Action:     action,
		EntityType: entityType,
		EntityID:   eid,
		Metadata:   metaBytes,
		IpAddress:  ip,
	})
	if err != nil {
		slog.Error("failed to create activity log", "error", err, "action", action)
	}
}

// ListActivityLogs returns a paginated list of activity logs with optional filters.
func (s *ActivityLogService) ListActivityLogs(ctx context.Context, userID *int64, action, entityType *string, limit, offset int32) ([]ActivityLogResponse, int64, error) {
	var uid pgtype.Int8
	if userID != nil {
		uid = pgtype.Int8{Int64: *userID, Valid: true}
	}

	logs, err := s.queries.ListActivityLogs(ctx, generated.ListActivityLogsParams{
		Limit:      limit,
		Offset:     offset,
		UserID:     uid,
		Action:     action,
		EntityType: entityType,
	})
	if err != nil {
		return nil, 0, err
	}

	total, err := s.queries.CountActivityLogs(ctx, generated.CountActivityLogsParams{
		UserID:     uid,
		Action:     action,
		EntityType: entityType,
	})
	if err != nil {
		return nil, 0, err
	}

	result := make([]ActivityLogResponse, len(logs))
	for i, l := range logs {
		result[i] = toActivityLogResponse(l)
	}

	return result, total, nil
}
