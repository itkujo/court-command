package service

import "fmt"

// ValidationError represents a client-side validation failure (400).
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

// NotFoundError represents a resource not found (404).
type NotFoundError struct {
	Message string
}

func (e *NotFoundError) Error() string {
	return e.Message
}

// ConflictError represents a duplicate/conflict (409).
type ConflictError struct {
	Message string
}

func (e *ConflictError) Error() string {
	return e.Message
}

// NewValidation creates a new ValidationError.
func NewValidation(msg string) error {
	return &ValidationError{Message: msg}
}

// NewValidationf creates a new ValidationError with formatting.
func NewValidationf(format string, args ...any) error {
	return &ValidationError{Message: fmt.Sprintf(format, args...)}
}

// NewNotFound creates a new NotFoundError.
func NewNotFound(msg string) error {
	return &NotFoundError{Message: msg}
}

// NewConflict creates a new ConflictError.
func NewConflict(msg string) error {
	return &ConflictError{Message: msg}
}
