package service

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

	"github.com/court-command/court-command/db/generated"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const passwordChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const passwordLength = 16

type TournamentStaffService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

func NewTournamentStaffService(queries *generated.Queries, pool *pgxpool.Pool) *TournamentStaffService {
	return &TournamentStaffService{queries: queries, pool: pool}
}

type StaffMemberResponse struct {
	ID           int64     `json:"id"`
	TournamentID int64     `json:"tournament_id"`
	UserID       int64     `json:"user_id"`
	Role         string    `json:"role"`
	RawPassword  string    `json:"raw_password"`
	Email        *string   `json:"email"`
	FirstName    string    `json:"first_name"`
	LastName     string    `json:"last_name"`
	PublicID     string    `json:"public_id"`
	CreatedAt    time.Time `json:"created_at"`
}

type MyTournamentAssignment struct {
	TournamentID   int64  `json:"tournament_id"`
	TournamentName string `json:"tournament_name"`
	Role           string `json:"role"`
}

func generatePassword() (string, error) {
	result := make([]byte, passwordLength)
	for i := range result {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(passwordChars))))
		if err != nil {
			return "", fmt.Errorf("generating random password: %w", err)
		}
		result[i] = passwordChars[idx.Int64()]
	}
	return string(result), nil
}

// CreateStaffAccounts creates the ref + scorekeeper staff accounts for a
// tournament in its own transaction. Use this when the caller does not already
// have a transaction scope; otherwise prefer CreateStaffAccountsTx.
func (s *TournamentStaffService) CreateStaffAccounts(ctx context.Context, tournamentID int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)
	if err := s.CreateStaffAccountsTx(ctx, qtx, tournamentID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// CreateStaffAccountsTx performs the staff-accounts creation against an
// existing tx-scoped Queries handle. Used by TournamentService.Create so
// the staff rows land in the same transaction as the tournament itself.
func (s *TournamentStaffService) CreateStaffAccountsTx(ctx context.Context, qtx *generated.Queries, tournamentID int64) error {
	roles := []struct {
		emailPrefix string
		role        string
		firstName   string
	}{
		{"ref", "referee", "Referee"},
		{"score", "scorekeeper", "Scorekeeper"},
	}

	for _, r := range roles {
		rawPassword, err := generatePassword()
		if err != nil {
			return err
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(rawPassword), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hashing password: %w", err)
		}

		email := fmt.Sprintf("%s%d@cc.dev", r.emailPrefix, tournamentID)
		lastName := fmt.Sprintf("T-%d", tournamentID)

		user, err := qtx.CreateUser(ctx, generated.CreateUserParams{
			Email:        &email,
			PasswordHash: string(hash),
			FirstName:    r.firstName,
			LastName:     lastName,
			Role:         r.role,
		})
		if err != nil {
			return fmt.Errorf("creating %s user: %w", r.role, err)
		}

		_, err = qtx.CreateTournamentStaffEntry(ctx, generated.CreateTournamentStaffEntryParams{
			TournamentID: tournamentID,
			UserID:       user.ID,
			Role:         r.role,
			RawPassword:  rawPassword,
		})
		if err != nil {
			return fmt.Errorf("creating %s staff entry: %w", r.role, err)
		}
	}

	return nil
}

func (s *TournamentStaffService) GetStaff(ctx context.Context, tournamentID int64) ([]StaffMemberResponse, error) {
	rows, err := s.queries.GetTournamentStaff(ctx, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("getting tournament staff: %w", err)
	}

	result := make([]StaffMemberResponse, len(rows))
	for i, row := range rows {
		result[i] = StaffMemberResponse{
			ID:           row.ID,
			TournamentID: row.TournamentID,
			UserID:       row.UserID,
			Role:         row.Role,
			RawPassword:  row.RawPassword,
			Email:        row.Email,
			FirstName:    row.FirstName,
			LastName:     row.LastName,
			PublicID:     row.PublicID,
			CreatedAt:    row.CreatedAt,
		}
	}
	return result, nil
}

func (s *TournamentStaffService) RegeneratePassword(ctx context.Context, tournamentID int64, role string) (*StaffMemberResponse, error) {
	if role != "referee" && role != "scorekeeper" {
		return nil, NewValidation("role must be 'referee' or 'scorekeeper'")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.queries.WithTx(tx)

	rawPassword, err := generatePassword()
	if err != nil {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(rawPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}

	// Update raw password in tournament_staff
	staffEntry, err := qtx.UpdateTournamentStaffPassword(ctx, generated.UpdateTournamentStaffPasswordParams{
		RawPassword:  rawPassword,
		TournamentID: tournamentID,
		Role:         role,
	})
	if err != nil {
		return nil, NewNotFound("staff entry not found")
	}

	// Update password hash on the user record
	_, err = qtx.UpdateUserPassword(ctx, generated.UpdateUserPasswordParams{
		ID:           staffEntry.UserID,
		PasswordHash: string(hash),
	})
	if err != nil {
		return nil, fmt.Errorf("updating user password: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	// Fetch full staff list to return the updated entry
	staff, err := s.GetStaff(ctx, tournamentID)
	if err != nil {
		return nil, err
	}
	for _, m := range staff {
		if m.Role == role {
			return &m, nil
		}
	}
	return nil, NewNotFound("staff entry not found after update")
}

func (s *TournamentStaffService) GetAssignmentByUserID(ctx context.Context, userID int64) (*MyTournamentAssignment, error) {
	row, err := s.queries.GetTournamentStaffByUserID(ctx, userID)
	if err != nil {
		return nil, NewNotFound("no tournament assignment found")
	}
	return &MyTournamentAssignment{
		TournamentID:   row.TournamentID,
		TournamentName: row.TournamentName,
		Role:           row.Role,
	}, nil
}
