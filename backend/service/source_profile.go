package service

import (
	"context"

	"github.com/court-command/court-command/db/generated"
)

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
