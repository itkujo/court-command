-- +goose Up
-- Expand the users.role check constraint to cover every operational
-- role surface the app actually uses. The original migration only
-- allowed ('platform_admin', 'player'), which blocks the back office
-- from promoting users to anything else (tournament directors, head
-- refs, scorekeepers, broadcast ops, etc.) and forced hardcoded
-- platform_admin checks into handlers that should be broader.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (
    'platform_admin',
    'organization_admin',
    'league_admin',
    'tournament_director',
    'head_referee',
    'referee',
    'scorekeeper',
    'broadcast_operator',
    'team_coach',
    'api_readonly',
    'player'
));

-- +goose Down
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('platform_admin', 'player'));
