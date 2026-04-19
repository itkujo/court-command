-- +goose Up
-- CR-10: Phase 3 CR-1 canonicalized event types to lowercase snake_case in
-- api/service/events.go (match_started, match_paused, match_resumed,
-- match_complete, match_reset, point_removed, game_complete, confirm_game_over,
-- confirm_match_over, timeout, timeout_ended, end_change, match_configured,
-- score_override, forfeit_declared). The match_events.event_type CHECK
-- constraint from 00019 only allowed the pre-CR-1 values, so every StartMatch /
-- ScorePoint / Timeout / etc. write exploded at the database with a generic
-- 500. This migration aligns the CHECK constraint with the canonical set in
-- api/service/events.go while retaining the legacy values for backward
-- compatibility with any pre-CR-1 rows already in prod.
ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_event_type_check;

ALTER TABLE match_events ADD CONSTRAINT match_events_event_type_check
    CHECK (event_type IN (
        -- Canonical CR-1 event types (see api/service/events.go).
        'match_started',
        'match_paused',
        'match_resumed',
        'match_complete',
        'match_reset',
        'point_team1',
        'point_team2',
        'point_removed',
        'side_out',
        'undo',
        'game_complete',
        'confirm_game_over',
        'confirm_match_over',
        'timeout',
        'timeout_ended',
        'end_change',
        'substitution',
        'match_configured',
        'score_override',
        'forfeit_declared',

        -- Legacy values still accepted for historical rows created before CR-1.
        'timeout_team1',
        'timeout_team2',
        'end_timeout',
        'start_set',
        'end_set',
        'start_game',
        'end_game',
        'challenge',
        'fault',
        'note',
        'custom'
    ));

-- +goose Down
ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_event_type_check;

ALTER TABLE match_events ADD CONSTRAINT match_events_event_type_check
    CHECK (event_type IN (
        'point_team1',
        'point_team2',
        'side_out',
        'timeout_team1',
        'timeout_team2',
        'end_timeout',
        'start_set',
        'end_set',
        'start_game',
        'end_game',
        'substitution',
        'challenge',
        'fault',
        'undo',
        'note',
        'custom'
    ));
