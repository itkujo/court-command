// backend/service/player.go
package service

import (
	"context"
	"fmt"

	"github.com/court-command/court-command/db/generated"
)

// PlayerService handles player profile business logic.
type PlayerService struct {
	queries *generated.Queries
}

// NewPlayerService creates a new PlayerService.
func NewPlayerService(queries *generated.Queries) *PlayerService {
	return &PlayerService{queries: queries}
}

// PlayerProfileResponse is the public representation of a player profile.
type PlayerProfileResponse struct {
	PublicID        string   `json:"public_id"`
	Email           *string  `json:"email,omitempty"`
	FirstName       string   `json:"first_name"`
	LastName        string   `json:"last_name"`
	DisplayName     *string  `json:"display_name,omitempty"`
	Gender          *string  `json:"gender,omitempty"`
	Handedness      *string  `json:"handedness,omitempty"`
	AvatarURL       *string  `json:"avatar_url,omitempty"`
	Bio             *string  `json:"bio,omitempty"`
	City            *string  `json:"city,omitempty"`
	StateProvince   *string  `json:"state_province,omitempty"`
	Country         *string  `json:"country,omitempty"`
	PostalCode      *string  `json:"postal_code,omitempty"`
	AddressLine1    *string  `json:"address_line_1,omitempty"`
	AddressLine2    *string  `json:"address_line_2,omitempty"`
	Latitude        *float64 `json:"latitude,omitempty"`
	Longitude       *float64 `json:"longitude,omitempty"`
	PaddleBrand     *string  `json:"paddle_brand,omitempty"`
	PaddleModel     *string  `json:"paddle_model,omitempty"`
	DuprID          *string  `json:"dupr_id,omitempty"`
	VairID          *string  `json:"vair_id,omitempty"`
	IsProfileHidden bool     `json:"is_profile_hidden"`
}

// PrivatePlayerProfileResponse includes sensitive fields visible only to admins/self.
type PrivatePlayerProfileResponse struct {
	PlayerProfileResponse
	DateOfBirth           string  `json:"date_of_birth"`
	Phone                 *string `json:"phone,omitempty"`
	EmergencyContactName  *string `json:"emergency_contact_name,omitempty"`
	EmergencyContactPhone *string `json:"emergency_contact_phone,omitempty"`
	MedicalNotes          *string `json:"medical_notes,omitempty"`
	WaiverAcceptedAt      *string `json:"waiver_accepted_at,omitempty"`
	Status                string  `json:"status"`
	CreatedAt             string  `json:"created_at"`
	UpdatedAt             string  `json:"updated_at"`
}

// toPublicProfile converts a database user row to a public profile response.
func toPublicProfile(u generated.User) PlayerProfileResponse {
	var lat, lng *float64
	if u.Latitude.Valid {
		lat = &u.Latitude.Float64
	}
	if u.Longitude.Valid {
		lng = &u.Longitude.Float64
	}

	return PlayerProfileResponse{
		PublicID:        u.PublicID,
		FirstName:       u.FirstName,
		LastName:        u.LastName,
		DisplayName:     u.DisplayName,
		Gender:          u.Gender,
		Handedness:      u.Handedness,
		AvatarURL:       u.AvatarUrl,
		Bio:             u.Bio,
		City:            u.City,
		StateProvince:   u.StateProvince,
		Country:         u.Country,
		PostalCode:      u.PostalCode,
		AddressLine1:    u.AddressLine1,
		AddressLine2:    u.AddressLine2,
		Latitude:        lat,
		Longitude:       lng,
		PaddleBrand:     u.PaddleBrand,
		PaddleModel:     u.PaddleModel,
		DuprID:          u.DuprID,
		VairID:          u.VairID,
		IsProfileHidden: u.IsProfileHidden,
	}
}

// toPrivateProfile converts a database user row to a private profile response.
func toPrivateProfile(u generated.User) PrivatePlayerProfileResponse {
	var waiverAt *string
	if u.WaiverAcceptedAt.Valid {
		s := u.WaiverAcceptedAt.Time.Format("2006-01-02T15:04:05Z07:00")
		waiverAt = &s
	}

	return PrivatePlayerProfileResponse{
		PlayerProfileResponse: toPublicProfile(u),
		DateOfBirth:           u.DateOfBirth.Format("2006-01-02"),
		Phone:                 u.Phone,
		EmergencyContactName:  u.EmergencyContactName,
		EmergencyContactPhone: u.EmergencyContactPhone,
		MedicalNotes:          u.MedicalNotes,
		WaiverAcceptedAt:      waiverAt,
		Status:                u.Status,
		CreatedAt:             u.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:             u.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// GetProfile retrieves a player profile by ID.
// If the requester is the player themselves or an admin, returns full private profile.
// Otherwise returns public profile (or error if hidden).
func (s *PlayerService) GetProfile(ctx context.Context, playerID int64, requesterID int64, requesterRole string) (interface{}, error) {
	user, err := s.queries.GetPlayerProfile(ctx, playerID)
	if err != nil {
		return nil, &NotFoundError{Message: "player not found"}
	}

	isSelf := requesterID == user.ID
	isAdmin := requesterRole == "platform_admin"

	if isSelf || isAdmin {
		return toPrivateProfile(user), nil
	}

	if user.IsProfileHidden {
		// Return minimal info for hidden profiles
		return PlayerProfileResponse{
			PublicID:  user.PublicID,
			FirstName: user.FirstName,
			LastName:  user.LastName,
		}, nil
	}

	return toPublicProfile(user), nil
}

// GetProfileByPublicID retrieves a player profile by public ID (CC-XXXXX).
func (s *PlayerService) GetProfileByPublicID(ctx context.Context, publicID string, requesterID int64, requesterRole string) (interface{}, error) {
	user, err := s.queries.GetPlayerByPublicID(ctx, publicID)
	if err != nil {
		return nil, &NotFoundError{Message: "player not found"}
	}

	return s.GetProfile(ctx, user.ID, requesterID, requesterRole)
}

// UpdateProfile updates the authenticated user's own profile.
func (s *PlayerService) UpdateProfile(ctx context.Context, userID int64, params generated.UpdatePlayerProfileParams) (PrivatePlayerProfileResponse, error) {
	params.UserID = userID
	user, err := s.queries.UpdatePlayerProfile(ctx, params)
	if err != nil {
		return PrivatePlayerProfileResponse{}, fmt.Errorf("failed to update profile: %w", err)
	}
	return toPrivateProfile(user), nil
}

// AcceptWaiver records the user accepting the platform waiver.
func (s *PlayerService) AcceptWaiver(ctx context.Context, userID int64) (PrivatePlayerProfileResponse, error) {
	user, err := s.queries.AcceptWaiver(ctx, userID)
	if err != nil {
		return PrivatePlayerProfileResponse{}, fmt.Errorf("failed to accept waiver: %w", err)
	}
	return toPrivateProfile(user), nil
}

// SearchPlayers searches for players with optional filters.
func (s *PlayerService) SearchPlayers(ctx context.Context, params generated.SearchPlayersParams) ([]PlayerProfileResponse, int64, error) {
	players, err := s.queries.SearchPlayers(ctx, params)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search players: %w", err)
	}

	count, err := s.queries.CountSearchPlayers(ctx, generated.CountSearchPlayersParams{
		Query:         params.Query,
		City:          params.City,
		StateProvince: params.StateProvince,
		Country:       params.Country,
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count players: %w", err)
	}

	profiles := make([]PlayerProfileResponse, len(players))
	for i, p := range players {
		if p.IsProfileHidden {
			profiles[i] = PlayerProfileResponse{
				PublicID:  p.PublicID,
				FirstName: p.FirstName,
				LastName:  p.LastName,
			}
		} else {
			profiles[i] = toPublicProfile(p)
		}
	}

	return profiles, count, nil
}
