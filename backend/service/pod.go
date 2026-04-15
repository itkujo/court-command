package service

import (
	"context"
	"fmt"
	"time"

	"github.com/court-command/court-command/db/generated"
)

// PodService handles pod business logic.
type PodService struct {
	queries *generated.Queries
}

// NewPodService creates a new PodService.
func NewPodService(queries *generated.Queries) *PodService {
	return &PodService{queries: queries}
}

// PodResponse is the public representation of a pod.
type PodResponse struct {
	ID         int64  `json:"id"`
	DivisionID int64  `json:"division_id"`
	Name       string `json:"name"`
	SortOrder  *int32 `json:"sort_order,omitempty"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}

func toPodResponse(p generated.Pod) PodResponse {
	resp := PodResponse{
		ID:         p.ID,
		DivisionID: p.DivisionID,
		Name:       p.Name,
		CreatedAt:  p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:  p.UpdatedAt.Format(time.RFC3339),
	}

	if p.SortOrder.Valid {
		resp.SortOrder = &p.SortOrder.Int32
	}

	return resp
}

// Create creates a new pod.
func (s *PodService) Create(ctx context.Context, params generated.CreatePodParams) (PodResponse, error) {
	if params.Name == "" {
		return PodResponse{}, &ValidationError{Message: "name is required"}
	}

	pod, err := s.queries.CreatePod(ctx, params)
	if err != nil {
		return PodResponse{}, fmt.Errorf("failed to create pod: %w", err)
	}

	return toPodResponse(pod), nil
}

// GetByID retrieves a pod by ID.
func (s *PodService) GetByID(ctx context.Context, id int64) (PodResponse, error) {
	pod, err := s.queries.GetPodByID(ctx, id)
	if err != nil {
		return PodResponse{}, &NotFoundError{Message: "pod not found"}
	}
	return toPodResponse(pod), nil
}

// ListByDivision returns pods for a division.
func (s *PodService) ListByDivision(ctx context.Context, divisionID int64) ([]PodResponse, int64, error) {
	pods, err := s.queries.ListPodsByDivision(ctx, divisionID)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list pods: %w", err)
	}

	count, err := s.queries.CountPodsByDivision(ctx, divisionID)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count pods: %w", err)
	}

	result := make([]PodResponse, len(pods))
	for i, p := range pods {
		result[i] = toPodResponse(p)
	}

	return result, count, nil
}

// Update updates a pod.
func (s *PodService) Update(ctx context.Context, id int64, params generated.UpdatePodParams) (PodResponse, error) {
	params.ID = id

	pod, err := s.queries.UpdatePod(ctx, params)
	if err != nil {
		return PodResponse{}, &NotFoundError{Message: "pod not found"}
	}

	return toPodResponse(pod), nil
}

// Delete soft-deletes a pod.
func (s *PodService) Delete(ctx context.Context, id int64) error {
	return s.queries.SoftDeletePod(ctx, id)
}
