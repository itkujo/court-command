// api/handler/response_test.go
package handler

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

// decodeError unmarshals the ErrorResponse written to the recorder.
func decodeError(t *testing.T, rec *httptest.ResponseRecorder) ErrorResponse {
	t.Helper()
	var got ErrorResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatalf("decoding error response: %v", err)
	}
	return got
}

func TestHandlePgError_CheckViolation(t *testing.T) {
	rec := httptest.NewRecorder()
	handlePgError(rec, &pgconn.PgError{
		Code:           "23514",
		ConstraintName: "divisions_registration_mode_check",
		TableName:      "divisions",
		ColumnName:     "registration_mode",
		Message:        "new row for relation \"divisions\" violates check constraint \"divisions_registration_mode_check\"",
	})

	if rec.Code != 400 {
		t.Fatalf("want 400, got %d", rec.Code)
	}
	got := decodeError(t, rec)
	if got.Error.Code != "CHECK_VIOLATION" {
		t.Errorf("want code CHECK_VIOLATION, got %q", got.Error.Code)
	}
	if !strings.Contains(got.Error.Message, "divisions_registration_mode_check") {
		t.Errorf("message missing constraint name: %q", got.Error.Message)
	}
	// Hint should surface the allowed values.
	if !strings.Contains(got.Error.Message, "invite_only") {
		t.Errorf("message should include a hint for known constraint: %q", got.Error.Message)
	}
}

func TestHandlePgError_UniqueViolation(t *testing.T) {
	rec := httptest.NewRecorder()
	handlePgError(rec, &pgconn.PgError{
		Code:           "23505",
		ConstraintName: "users_email_key",
		TableName:      "users",
		Detail:         "Key (email)=(foo@bar.com) already exists.",
		Message:        "duplicate key value violates unique constraint \"users_email_key\"",
	})

	if rec.Code != 409 {
		t.Fatalf("want 409, got %d", rec.Code)
	}
	got := decodeError(t, rec)
	if got.Error.Code != "UNIQUE_VIOLATION" {
		t.Errorf("want UNIQUE_VIOLATION, got %q", got.Error.Code)
	}
	// trimPgDetail should strip the "Key (..)=(..) " prefix and trailing period.
	if !strings.Contains(got.Error.Message, "already exists") {
		t.Errorf("expected trimmed detail, got %q", got.Error.Message)
	}
	if strings.Contains(got.Error.Message, "Key (") {
		t.Errorf("expected noisy prefix to be trimmed, got %q", got.Error.Message)
	}
}

func TestHandlePgError_ForeignKeyViolation(t *testing.T) {
	rec := httptest.NewRecorder()
	handlePgError(rec, &pgconn.PgError{
		Code:           "23503",
		ConstraintName: "registrations_team_id_fkey",
		TableName:      "registrations",
		Detail:         "Key (team_id)=(999) is not present in table \"teams\".",
		Message:        "insert or update on table \"registrations\" violates foreign key constraint \"registrations_team_id_fkey\"",
	})

	if rec.Code != 400 {
		t.Fatalf("want 400, got %d", rec.Code)
	}
	got := decodeError(t, rec)
	if got.Error.Code != "FK_VIOLATION" {
		t.Errorf("want FK_VIOLATION, got %q", got.Error.Code)
	}
}

func TestHandlePgError_NotNullViolation(t *testing.T) {
	rec := httptest.NewRecorder()
	handlePgError(rec, &pgconn.PgError{
		Code:       "23502",
		TableName:  "divisions",
		ColumnName: "name",
		Message:    "null value in column \"name\" of relation \"divisions\" violates not-null constraint",
	})

	if rec.Code != 400 {
		t.Fatalf("want 400, got %d", rec.Code)
	}
	got := decodeError(t, rec)
	if got.Error.Code != "NOT_NULL_VIOLATION" {
		t.Errorf("want NOT_NULL_VIOLATION, got %q", got.Error.Code)
	}
	if !strings.Contains(got.Error.Message, "name") {
		t.Errorf("message missing column name: %q", got.Error.Message)
	}
}

func TestHandlePgError_UnknownCodeFallsTo500(t *testing.T) {
	rec := httptest.NewRecorder()
	handlePgError(rec, &pgconn.PgError{
		Code:    "42P01", // undefined_table
		Message: "relation does not exist",
	})

	if rec.Code != 500 {
		t.Fatalf("want 500, got %d", rec.Code)
	}
	got := decodeError(t, rec)
	if got.Error.Code != "INTERNAL_ERROR" {
		t.Errorf("want INTERNAL_ERROR, got %q", got.Error.Code)
	}
}

func TestHandleServiceError_WrapsPgError(t *testing.T) {
	// Service code often returns a wrapped error like
	//   fmt.Errorf("failed to create division: %w", err)
	// where the underlying cause is a *pgconn.PgError. HandleServiceError
	// must detect the PgError via errors.As and produce a 4xx, not a 500.
	inner := &pgconn.PgError{
		Code:           "23514",
		ConstraintName: "divisions_registration_mode_check",
		TableName:      "divisions",
	}
	wrapped := fmt.Errorf("failed to create division: %w", inner)

	rec := httptest.NewRecorder()
	HandleServiceError(rec, wrapped)

	if rec.Code != 400 {
		t.Fatalf("want 400 from wrapped PgError, got %d", rec.Code)
	}
	got := decodeError(t, rec)
	if got.Error.Code != "CHECK_VIOLATION" {
		t.Errorf("want CHECK_VIOLATION on wrapped error, got %q", got.Error.Code)
	}
}

func TestTrimPgDetail(t *testing.T) {
	tests := []struct {
		name, in, want string
	}{
		{
			"unique violation detail",
			"Key (email)=(foo@bar.com) already exists.",
			"already exists",
		},
		{
			"fk violation detail",
			"Key (team_id)=(999) is not present in table \"teams\".",
			"is not present in table \"teams\"",
		},
		{
			"no prefix",
			"some plain error",
			"some plain error",
		},
		{
			"empty",
			"",
			"",
		},
	}
	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			if got := trimPgDetail(tt.in); got != tt.want {
				t.Errorf("trimPgDetail(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}
