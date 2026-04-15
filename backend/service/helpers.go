package service

import (
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

func parseDate(s string) time.Time {
	t, _ := time.Parse("2006-01-02", s)
	return t
}

func parseOptionalTimestamp(s *string) pgtype.Timestamptz {
	if s == nil {
		return pgtype.Timestamptz{}
	}
	t, err := time.Parse(time.RFC3339, *s)
	if err != nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: t, Valid: true}
}
