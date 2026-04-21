// api/handler/response.go
package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/court-command/court-command/service"
)

// ErrorResponse is the structured error format returned by all API endpoints.
type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail contains the error code, message, and optional details.
type ErrorDetail struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

// PaginatedResponse wraps a list response with pagination metadata.
type PaginatedResponse struct {
	Data       interface{}        `json:"data"`
	Pagination PaginationMetadata `json:"pagination"`
}

// PaginationMetadata contains pagination cursor information.
type PaginationMetadata struct {
	Total  int64 `json:"total"`
	Limit  int   `json:"limit"`
	Offset int   `json:"offset"`
}

// JSON writes a JSON response with the given status code.
func JSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

// Success writes a 200 OK JSON response.
func Success(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusOK, data)
}

// Created writes a 201 Created JSON response.
func Created(w http.ResponseWriter, data interface{}) {
	JSON(w, http.StatusCreated, data)
}

// NoContent writes a 204 No Content response.
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

// Paginated writes a paginated JSON response.
func Paginated(w http.ResponseWriter, data interface{}, total int64, limit, offset int) {
	JSON(w, http.StatusOK, PaginatedResponse{
		Data: data,
		Pagination: PaginationMetadata{
			Total:  total,
			Limit:  limit,
			Offset: offset,
		},
	})
}

// WriteError writes a structured error response.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	JSON(w, status, ErrorResponse{
		Error: ErrorDetail{
			Code:    code,
			Message: message,
		},
	})
}

// BadRequest writes a 400 error response.
func BadRequest(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusBadRequest, "bad_request", message)
}

// Unauthorized writes a 401 error response.
func Unauthorized(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusUnauthorized, "unauthorized", message)
}

// Forbidden writes a 403 error response.
func Forbidden(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusForbidden, "forbidden", message)
}

// NotFound writes a 404 error response.
func NotFound(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusNotFound, "not_found", message)
}

// Conflict writes a 409 error response.
func Conflict(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusConflict, "conflict", message)
}

// InternalError writes a 500 error response.
func InternalError(w http.ResponseWriter, message string) {
	WriteError(w, http.StatusInternalServerError, "internal_error", message)
}

// HandleServiceError maps service-layer typed errors to HTTP responses.
//
// In addition to the typed service errors (Validation, NotFound, Conflict,
// Forbidden), it also detects Postgres constraint violations (*pgconn.PgError)
// and maps them to 4xx responses with constraint context. This exists so that
// an accidental frontend/DB schema mismatch (e.g. an enum value the DB CHECK
// constraint rejects) surfaces as an actionable 400 response with the
// constraint name rather than a generic 500 "internal error".
//
// The complete Postgres SQLSTATE reference is at
// https://www.postgresql.org/docs/current/errcodes-appendix.html.
// We handle the most useful class-23 codes:
//   - 23514 check_violation       \u2192 400 CHECK_VIOLATION
//   - 23505 unique_violation      \u2192 409 UNIQUE_VIOLATION
//   - 23503 foreign_key_violation \u2192 400 FK_VIOLATION
//   - 23502 not_null_violation    \u2192 400 NOT_NULL_VIOLATION
//
// Other PgError codes fall through to the generic 500 path but the constraint
// details are still logged server-side for operators.
func HandleServiceError(w http.ResponseWriter, err error) {
	var valErr *service.ValidationError
	var notFoundErr *service.NotFoundError
	var conflictErr *service.ConflictError
	var forbiddenErr *service.ForbiddenError
	var pgErr *pgconn.PgError

	switch {
	case errors.As(err, &valErr):
		WriteError(w, http.StatusBadRequest, "VALIDATION_ERROR", valErr.Message)
	case errors.As(err, &notFoundErr):
		WriteError(w, http.StatusNotFound, "NOT_FOUND", notFoundErr.Message)
	case errors.As(err, &conflictErr):
		WriteError(w, http.StatusConflict, "CONFLICT", conflictErr.Message)
	case errors.As(err, &forbiddenErr):
		WriteError(w, http.StatusForbidden, "FORBIDDEN", forbiddenErr.Message)
	case errors.As(err, &pgErr):
		handlePgError(w, pgErr)
	default:
		slog.Error("unhandled service error", "error", err)
		WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error")
	}
}

// handlePgError maps common Postgres class-23 SQLSTATE codes to 4xx responses
// carrying enough context (constraint name, column, table) for a client to
// fix the request without server-side debugging.
func handlePgError(w http.ResponseWriter, pgErr *pgconn.PgError) {
	slog.Warn("postgres constraint error",
		"code", pgErr.Code,
		"constraint", pgErr.ConstraintName,
		"column", pgErr.ColumnName,
		"table", pgErr.TableName,
		"detail", pgErr.Detail,
		"message", pgErr.Message,
	)

	switch pgErr.Code {
	case "23514": // check_violation
		msg := fmt.Sprintf("value violates check constraint %q on %s",
			pgErr.ConstraintName, formatTable(pgErr))
		if hint := checkConstraintHint(pgErr.ConstraintName); hint != "" {
			msg += " \u2014 " + hint
		}
		JSON(w, http.StatusBadRequest, ErrorResponse{
			Error: ErrorDetail{
				Code:    "CHECK_VIOLATION",
				Message: msg,
				Details: map[string]string{
					"constraint": pgErr.ConstraintName,
					"table":      pgErr.TableName,
					"column":     pgErr.ColumnName,
				},
			},
		})
	case "23505": // unique_violation
		msg := fmt.Sprintf("value already exists (%s)", pgErr.ConstraintName)
		if pgErr.Detail != "" {
			msg = trimPgDetail(pgErr.Detail)
		}
		JSON(w, http.StatusConflict, ErrorResponse{
			Error: ErrorDetail{
				Code:    "UNIQUE_VIOLATION",
				Message: msg,
				Details: map[string]string{
					"constraint": pgErr.ConstraintName,
					"table":      pgErr.TableName,
				},
			},
		})
	case "23503": // foreign_key_violation
		// FK violations mean the caller referenced a row that doesn't exist
		// (insert/update) OR tried to delete a row that's still referenced
		// (delete). Return 400 either way; 409 could also be defensible for
		// delete-restrict cases but 400 is simpler.
		msg := fmt.Sprintf("referenced record does not exist (%s)", pgErr.ConstraintName)
		if pgErr.Detail != "" {
			msg = trimPgDetail(pgErr.Detail)
		}
		JSON(w, http.StatusBadRequest, ErrorResponse{
			Error: ErrorDetail{
				Code:    "FK_VIOLATION",
				Message: msg,
				Details: map[string]string{
					"constraint": pgErr.ConstraintName,
					"table":      pgErr.TableName,
				},
			},
		})
	case "23502": // not_null_violation
		msg := fmt.Sprintf("column %q is required on %s", pgErr.ColumnName, formatTable(pgErr))
		JSON(w, http.StatusBadRequest, ErrorResponse{
			Error: ErrorDetail{
				Code:    "NOT_NULL_VIOLATION",
				Message: msg,
				Details: map[string]string{
					"table":  pgErr.TableName,
					"column": pgErr.ColumnName,
				},
			},
		})
	default:
		// Unknown PgError \u2014 treat as 500 but the details are already logged.
		WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error")
	}
}

func formatTable(pgErr *pgconn.PgError) string {
	if pgErr.TableName != "" {
		return pgErr.TableName
	}
	return "table"
}

// trimPgDetail strips the noisy "Key (col)=(val) already exists" / "is not
// present in table" prefix from Postgres Detail strings when possible,
// returning a shorter phrase. Falls back to the raw detail.
func trimPgDetail(detail string) string {
	// Typical formats:
	//   Key (email)=(foo@bar.com) already exists.
	//   Key (team_id)=(123) is not present in table "teams".
	if idx := strings.Index(detail, ") "); idx >= 0 {
		return strings.TrimRight(detail[idx+2:], ".")
	}
	return strings.TrimRight(detail, ".")
}

// checkConstraintHint returns a human-friendly hint for well-known CHECK
// constraint names when the PG error code alone isn't enough context. The
// constraint names here come from api/db/migrations; keep them in sync if
// the migrations are renamed.
func checkConstraintHint(constraint string) string {
	switch constraint {
	case "divisions_format_check":
		return "format must be one of: singles, doubles, mixed_doubles, team_match"
	case "divisions_gender_restriction_check":
		return "gender_restriction must be one of: open, mens, womens, mixed"
	case "divisions_bracket_format_check":
		return "bracket_format must be one of: single_elimination, double_elimination, round_robin, pool_play, pool_to_bracket"
	case "divisions_registration_mode_check":
		return "registration_mode must be one of: open, invite_only"
	case "divisions_status_check":
		return "status must be one of: draft, registration_open, registration_closed, seeding, in_progress, completed"
	case "tournaments_status_check":
		return "status must be one of: draft, published, registration_open, registration_closed, in_progress, completed, archived, cancelled"
	case "matches_status_check":
		return "status must be one of: scheduled, warmup, in_progress, paused, completed, cancelled, forfeited"
	case "matches_match_type_check":
		return "match_type must be one of: tournament, quick, pickup, practice, league"
	case "matches_win_reason_check":
		return "win_reason must be one of: score, forfeit, retirement, dq, bye"
	case "venues_status_check":
		return "status must be one of: draft, pending_review, published, archived"
	case "users_role_check":
		return "role must be one of: player, platform_admin, tournament_director, head_referee, referee, scorekeeper, broadcast_operator, league_admin, organization_admin, team_coach, api_readonly"
	case "users_status_check":
		return "status must be one of: active, suspended, banned, unclaimed, merged"
	}
	return ""
}

// DecodeJSON reads and decodes a JSON request body into the given target.
// Returns an error message string if decoding fails, or empty string on success.
func DecodeJSON(r *http.Request, target interface{}) string {
	if r.Body == nil {
		return "request body is required"
	}

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(target); err != nil {
		return "invalid JSON: " + err.Error()
	}

	return ""
}
