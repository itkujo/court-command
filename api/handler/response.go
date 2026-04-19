// api/handler/response.go
package handler

import (
	"encoding/json"
	"errors"
	"net/http"

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
func HandleServiceError(w http.ResponseWriter, err error) {
	var valErr *service.ValidationError
	var notFoundErr *service.NotFoundError
	var conflictErr *service.ConflictError
	var forbiddenErr *service.ForbiddenError

	switch {
	case errors.As(err, &valErr):
		WriteError(w, http.StatusBadRequest, "VALIDATION_ERROR", valErr.Message)
	case errors.As(err, &notFoundErr):
		WriteError(w, http.StatusNotFound, "NOT_FOUND", notFoundErr.Message)
	case errors.As(err, &conflictErr):
		WriteError(w, http.StatusConflict, "CONFLICT", conflictErr.Message)
	case errors.As(err, &forbiddenErr):
		WriteError(w, http.StatusForbidden, "FORBIDDEN", forbiddenErr.Message)
	default:
		WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "internal error")
	}
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
