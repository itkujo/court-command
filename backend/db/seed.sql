-- Court Command v2 — Development Seed Data
-- Run with: make seed
-- Requires: migrations already applied, empty or safe-to-overwrite database
-- Password for all test users: TestPass123! (bcrypt hash below)

-- Bcrypt hash for "TestPass123!"
-- Generated via: htpasswd -bnBC 10 "" TestPass123! | tr -d ':\n' | sed 's/$2y/$2a/'

DO $$
DECLARE
  admin_id BIGINT;
  td_id BIGINT;
  ref_id BIGINT;
  player1_id BIGINT;
  player2_id BIGINT;
  player3_id BIGINT;
  player4_id BIGINT;
  player5_id BIGINT;
  player6_id BIGINT;
  player7_id BIGINT;
  player8_id BIGINT;
  org1_id BIGINT;
  org2_id BIGINT;
  team1_id BIGINT;
  team2_id BIGINT;
  team3_id BIGINT;
  team4_id BIGINT;
  venue_id BIGINT;
  court1_id BIGINT;
  court2_id BIGINT;
  court3_id BIGINT;
  court4_id BIGINT;
  league_id BIGINT;
  season_id BIGINT;
  tournament_id BIGINT;
  div1_id BIGINT;
  div2_id BIGINT;
  reg1_id BIGINT;
  reg2_id BIGINT;
  reg3_id BIGINT;
  reg4_id BIGINT;
  match1_id BIGINT;
  match2_id BIGINT;
  match3_id BIGINT;
  pw_hash TEXT := '$2a$10$rQZ8K8YxHi3VBhDBqMCJh.JZwJ3rYPnSn6X5B4r3G5P5oQv0e5tIi';
BEGIN

-- ============================================================
-- 1. USERS (11 users: 1 admin, 1 TD, 1 ref, 8 players)
-- ============================================================

INSERT INTO users (public_id, email, password_hash, first_name, last_name, date_of_birth, role, status)
VALUES ('CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'), 'admin@courtcommand.com', pw_hash, 'Admin', 'User', '1990-01-15', 'platform_admin', 'active')
RETURNING id INTO admin_id;

INSERT INTO users (public_id, email, password_hash, first_name, last_name, date_of_birth, role, status)
VALUES ('CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'), 'td@courtcommand.com', pw_hash, 'Tournament', 'Director', '1985-06-20', 'tournament_director', 'active')
RETURNING id INTO td_id;

INSERT INTO users (public_id, email, password_hash, first_name, last_name, date_of_birth, role, status)
VALUES ('CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'), 'ref@courtcommand.com', pw_hash, 'Head', 'Referee', '1988-03-10', 'head_referee', 'active')
RETURNING id INTO ref_id;

INSERT INTO users (public_id, email, password_hash, first_name, last_name, date_of_birth, role, status, gender, handedness, city, state_province, country)
VALUES
('CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'), 'alex.j@demo.com', pw_hash, 'Alex', 'Johnson', '1995-04-12', 'player', 'active', 'male', 'right', 'Dallas', 'TX', 'US')
RETURNING id INTO player1_id;

INSERT INTO users (public_id, email, password_hash, first_name, last_name, date_of_birth, role, status, gender, handedness, city, state_province, country)
VALUES
('CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'), 'maria.g@demo.com', pw_hash, 'Maria', 'Garcia', '1993-08-25', 'player', 'active', 'female', 'right', 'Dallas', 'TX', 'US')
RETURNING id INTO player2_id;

INSERT INTO users (public_id, email, password_hash, first_name, last_name, date_of_birth, role, status, gender, handedness, city, state_province, country)
VALUES
('CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'), 'james.w@demo.com', pw_hash, 'James', 'Wilson', '1990-11-03', 'player', 'active', 'male', 'left', 'Fort Worth', 'TX', 'US')
RETURNING id INTO player3_id;

INSERT INTO users (public_id, email, password_hash, first_name, last_name, date_of_birth, role, status, gender, handedness, city, state_province, country)
VALUES
('CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'), 'sarah.c@demo.com', pw_hash, 'Sarah', 'Chen', '1997-02-18', 'player', 'active', 'female', 'right', 'Fort Worth', 'TX', 'US')
RETURNING id INTO player4_id;

INSERT INTO users (public_id, email, password_hash, first_name, last_name, date_of_birth, role, status, gender, handedness, city, state_province, country)
VALUES
('CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'), 'mike.b@demo.com', pw_hash, 'Mike', 'Brown', '1992-07-30', 'player', 'active', 'male', 'right', 'Austin', 'TX', 'US')
RETURNING id INTO player5_id;

INSERT INTO users (public_id, email, password_hash, first_name, last_name, date_of_birth, role, status, gender, handedness, city, state_province, country)
VALUES
('CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'), 'lisa.p@demo.com', pw_hash, 'Lisa', 'Park', '1996-12-05', 'player', 'active', 'female', 'left', 'Austin', 'TX', 'US')
RETURNING id INTO player6_id;

INSERT INTO users (public_id, email, password_hash, first_name, last_name, date_of_birth, role, status, gender, handedness, city, state_province, country)
VALUES
('CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'), 'david.k@demo.com', pw_hash, 'David', 'Kim', '1994-09-14', 'player', 'active', 'male', 'right', 'Houston', 'TX', 'US')
RETURNING id INTO player7_id;

INSERT INTO users (public_id, email, password_hash, first_name, last_name, date_of_birth, role, status, gender, handedness, city, state_province, country)
VALUES
('CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'), 'emma.d@demo.com', pw_hash, 'Emma', 'Davis', '1998-05-22', 'player', 'active', 'female', 'right', 'Houston', 'TX', 'US')
RETURNING id INTO player8_id;

-- ============================================================
-- 2. ORGANIZATIONS (2 orgs)
-- ============================================================

INSERT INTO organizations (name, slug, city, state_province, country, bio, primary_color, created_by_user_id)
VALUES ('North Texas Pickleball Club', 'north-texas-pickleball-club', 'Dallas', 'TX', 'US', 'The premier pickleball organization in North Texas.', '#1e40af', admin_id)
RETURNING id INTO org1_id;

INSERT INTO organizations (name, slug, city, state_province, country, bio, primary_color, created_by_user_id)
VALUES ('Gulf Coast Pickleball Alliance', 'gulf-coast-pickleball-alliance', 'Houston', 'TX', 'US', 'Bringing competitive pickleball to the Gulf Coast region.', '#16a34a', admin_id)
RETURNING id INTO org2_id;

-- Org memberships (creator = admin)
INSERT INTO org_memberships (org_id, player_id, role) VALUES (org1_id, admin_id, 'admin');
INSERT INTO org_memberships (org_id, player_id, role) VALUES (org2_id, admin_id, 'admin');
-- Add some players to orgs
INSERT INTO org_memberships (org_id, player_id, role) VALUES (org1_id, player1_id, 'member');
INSERT INTO org_memberships (org_id, player_id, role) VALUES (org1_id, player2_id, 'member');
INSERT INTO org_memberships (org_id, player_id, role) VALUES (org1_id, player3_id, 'member');
INSERT INTO org_memberships (org_id, player_id, role) VALUES (org1_id, player4_id, 'member');
INSERT INTO org_memberships (org_id, player_id, role) VALUES (org2_id, player5_id, 'member');
INSERT INTO org_memberships (org_id, player_id, role) VALUES (org2_id, player6_id, 'member');
INSERT INTO org_memberships (org_id, player_id, role) VALUES (org2_id, player7_id, 'member');
INSERT INTO org_memberships (org_id, player_id, role) VALUES (org2_id, player8_id, 'member');

-- ============================================================
-- 3. TEAMS (4 teams, 2 per org, 2 players each)
-- ============================================================

INSERT INTO teams (name, short_name, slug, primary_color, org_id, city)
VALUES ('Dallas Dinkers', 'DAL', 'dallas-dinkers', '#1e40af', org1_id, 'Dallas')
RETURNING id INTO team1_id;

INSERT INTO teams (name, short_name, slug, primary_color, org_id, city)
VALUES ('Fort Worth Aces', 'FTW', 'fort-worth-aces', '#dc2626', org1_id, 'Fort Worth')
RETURNING id INTO team2_id;

INSERT INTO teams (name, short_name, slug, primary_color, org_id, city)
VALUES ('Austin Smashers', 'AUS', 'austin-smashers', '#16a34a', org2_id, 'Austin')
RETURNING id INTO team3_id;

INSERT INTO teams (name, short_name, slug, primary_color, org_id, city)
VALUES ('Houston Heat', 'HOU', 'houston-heat', '#ea580c', org2_id, 'Houston')
RETURNING id INTO team4_id;

-- Team rosters
INSERT INTO team_rosters (team_id, player_id, role, status) VALUES (team1_id, player1_id, 'captain', 'active');
INSERT INTO team_rosters (team_id, player_id, role, status) VALUES (team1_id, player2_id, 'player', 'active');
INSERT INTO team_rosters (team_id, player_id, role, status) VALUES (team2_id, player3_id, 'captain', 'active');
INSERT INTO team_rosters (team_id, player_id, role, status) VALUES (team2_id, player4_id, 'player', 'active');
INSERT INTO team_rosters (team_id, player_id, role, status) VALUES (team3_id, player5_id, 'captain', 'active');
INSERT INTO team_rosters (team_id, player_id, role, status) VALUES (team3_id, player6_id, 'player', 'active');
INSERT INTO team_rosters (team_id, player_id, role, status) VALUES (team4_id, player7_id, 'captain', 'active');
INSERT INTO team_rosters (team_id, player_id, role, status) VALUES (team4_id, player8_id, 'player', 'active');

-- ============================================================
-- 4. VENUE + COURTS
-- ============================================================

INSERT INTO venues (name, slug, status, address_line_1, city, state_province, country, postal_code, timezone, bio, created_by_user_id)
VALUES ('Pickleton Sports Complex', 'pickleton-sports-complex', 'published', '2585 Schwegmann Drive', 'Marrero', 'LA', 'US', '70072', 'America/Chicago', 'A state-of-the-art sports facility with 4 dedicated pickleball courts.', admin_id)
RETURNING id INTO venue_id;

-- Venue manager
INSERT INTO venue_managers (venue_id, user_id, role, added_by) VALUES (venue_id, admin_id, 'admin', admin_id);

INSERT INTO courts (name, slug, venue_id, surface_type, is_show_court, is_active, sort_order, created_by_user_id)
VALUES ('Court 1', 'court-1', venue_id, 'indoor_hard', true, true, 1, admin_id)
RETURNING id INTO court1_id;

INSERT INTO courts (name, slug, venue_id, surface_type, is_show_court, is_active, sort_order, created_by_user_id)
VALUES ('Court 2', 'court-2', venue_id, 'indoor_hard', false, true, 2, admin_id)
RETURNING id INTO court2_id;

INSERT INTO courts (name, slug, venue_id, surface_type, is_show_court, is_active, sort_order, created_by_user_id)
VALUES ('Court 3', 'court-3', venue_id, 'indoor_hard', false, true, 3, admin_id)
RETURNING id INTO court3_id;

INSERT INTO courts (name, slug, venue_id, surface_type, is_show_court, is_active, sort_order, created_by_user_id)
VALUES ('Court 4', 'court-4', venue_id, 'outdoor_concrete', false, true, 4, admin_id)
RETURNING id INTO court4_id;

-- ============================================================
-- 5. LEAGUE + SEASON
-- ============================================================

INSERT INTO leagues (public_id, name, slug, status, city, state_province, country, description, created_by_user_id)
VALUES ('CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'), 'Texas Pickleball League', 'texas-pickleball-league', 'active', 'Dallas', 'TX', 'US', 'The premier pickleball league covering all of Texas. Multiple seasons per year with divisions for all skill levels.', admin_id)
RETURNING id INTO league_id;

INSERT INTO seasons (name, slug, league_id, status, start_date, end_date, standings_method)
VALUES ('Spring 2026', 'spring-2026', league_id, 'active', '2026-03-01', '2026-06-30', 'win_loss')
RETURNING id INTO season_id;

-- ============================================================
-- 6. TOURNAMENT + DIVISIONS
-- ============================================================

INSERT INTO tournaments (public_id, name, slug, status, start_date, end_date, venue_id, league_id, season_id, description, created_by_user_id, td_user_id)
VALUES (
  'CC-' || lpad(nextval('user_public_id_seq')::TEXT, 5, '0'),
  'Spring Open 2026', 'spring-open-2026', 'in_progress',
  '2026-04-15', '2026-04-17',
  venue_id, league_id, season_id,
  'The first tournament of the Texas Pickleball League Spring 2026 season. Open doubles and mixed doubles divisions.',
  admin_id, td_id
)
RETURNING id INTO tournament_id;

INSERT INTO divisions (name, slug, tournament_id, format, gender_restriction, bracket_format, scoring_format, status, max_teams, seed_method, auto_approve)
VALUES ('Open Doubles', 'open-doubles', tournament_id, 'doubles', 'open', 'single_elimination', '{"scoring_type":"side_out","points_to_win":11,"win_by":2,"games_per_set":1,"sets_to_win":2}', 'in_progress', 16, 'rating', true)
RETURNING id INTO div1_id;

INSERT INTO divisions (name, slug, tournament_id, format, gender_restriction, bracket_format, scoring_format, status, max_teams, seed_method, auto_approve)
VALUES ('Mixed Doubles', 'mixed-doubles', tournament_id, 'mixed_doubles', 'mixed', 'round_robin', '{"scoring_type":"rally","points_to_win":15,"win_by":2,"games_per_set":1,"sets_to_win":1}', 'registration_open', 8, 'manual', true)
RETURNING id INTO div2_id;

-- ============================================================
-- 7. REGISTRATIONS (4 teams in Open Doubles, checked in)
-- ============================================================

INSERT INTO registrations (division_id, team_id, registered_by_user_id, status, seed)
VALUES (div1_id, team1_id, admin_id, 'checked_in', 1)
RETURNING id INTO reg1_id;

INSERT INTO registrations (division_id, team_id, registered_by_user_id, status, seed)
VALUES (div1_id, team2_id, admin_id, 'checked_in', 2)
RETURNING id INTO reg2_id;

INSERT INTO registrations (division_id, team_id, registered_by_user_id, status, seed)
VALUES (div1_id, team3_id, admin_id, 'checked_in', 3)
RETURNING id INTO reg3_id;

INSERT INTO registrations (division_id, team_id, registered_by_user_id, status, seed)
VALUES (div1_id, team4_id, admin_id, 'checked_in', 4)
RETURNING id INTO reg4_id;

-- ============================================================
-- 8. MATCHES (bracket: 2 semis + 1 final)
-- ============================================================

-- Semi 1: Dallas Dinkers vs Houston Heat (in progress, 7-5)
INSERT INTO matches (
  public_id, division_id, court_id, round, match_number,
  status, team1_id, team2_id,
  team1_seed, team2_seed,
  points_to_win, win_by, games_per_set, sets_to_win, rally_scoring,
  team1_score, team2_score, serving_team, server_number,
  current_game, referee_user_id, created_by_user_id
)
VALUES (
  'sf1-' || substr(md5(random()::text), 1, 12), div1_id, court1_id, 1, 1,
  'in_progress', team1_id, team4_id,
  1, 4,
  11, 2, 1, 2, false,
  7, 5, 1, 1, 1, ref_id, td_id
)
RETURNING id INTO match1_id;

-- Semi 2: Fort Worth Aces vs Austin Smashers (scheduled)
INSERT INTO matches (
  public_id, division_id, court_id, round, match_number,
  status, team1_id, team2_id,
  team1_seed, team2_seed,
  points_to_win, win_by, games_per_set, sets_to_win, rally_scoring,
  team1_score, team2_score, serving_team, server_number,
  current_game, created_by_user_id
)
VALUES (
  'sf2-' || substr(md5(random()::text), 1, 12), div1_id, court2_id, 1, 2,
  'scheduled', team2_id, team3_id,
  2, 3,
  11, 2, 1, 2, false,
  0, 0, 1, 1, 1, td_id
)
RETURNING id INTO match2_id;

-- Final: TBD vs TBD (scheduled)
INSERT INTO matches (
  public_id, division_id, court_id, round, match_number,
  status, points_to_win, win_by, games_per_set, sets_to_win, rally_scoring,
  team1_score, team2_score, serving_team, server_number, current_game, created_by_user_id
)
VALUES (
  'final-' || substr(md5(random()::text), 1, 12), div1_id, court1_id, 2, 3,
  'scheduled', 11, 2, 1, 2, false,
  0, 0, 1, 1, 1, td_id
)
RETURNING id INTO match3_id;

-- Wire bracket: semi winners feed into final
UPDATE matches SET next_match_id = match3_id WHERE id IN (match1_id, match2_id);

-- ============================================================
-- 9. MATCH EVENTS (some scoring events on semi 1)
-- ============================================================

INSERT INTO match_events (match_id, sequence_id, event_type, payload, team1_score, team2_score, current_game, serving_team, server_number, created_by_user_id)
VALUES
(match1_id, 1, 'start_game', '{"game":1}', 0, 0, 1, 1, 1, ref_id),
(match1_id, 2, 'point_team1', '{"team":1}', 1, 0, 1, 1, 1, ref_id),
(match1_id, 3, 'point_team1', '{"team":1}', 2, 0, 1, 1, 1, ref_id),
(match1_id, 4, 'side_out', '{}', 2, 0, 1, 2, 1, ref_id),
(match1_id, 5, 'point_team2', '{"team":2}', 2, 1, 1, 2, 1, ref_id),
(match1_id, 6, 'point_team2', '{"team":2}', 2, 2, 1, 2, 1, ref_id),
(match1_id, 7, 'side_out', '{}', 2, 2, 1, 1, 2, ref_id),
(match1_id, 8, 'point_team1', '{"team":1}', 3, 2, 1, 1, 2, ref_id),
(match1_id, 9, 'point_team1', '{"team":1}', 4, 2, 1, 1, 2, ref_id),
(match1_id, 10, 'point_team1', '{"team":1}', 5, 2, 1, 1, 2, ref_id),
(match1_id, 11, 'side_out', '{}', 5, 2, 1, 2, 2, ref_id),
(match1_id, 12, 'point_team2', '{"team":2}', 5, 3, 1, 2, 2, ref_id),
(match1_id, 13, 'point_team2', '{"team":2}', 5, 4, 1, 2, 2, ref_id),
(match1_id, 14, 'point_team2', '{"team":2}', 5, 5, 1, 2, 2, ref_id),
(match1_id, 15, 'side_out', '{}', 5, 5, 1, 1, 1, ref_id),
(match1_id, 16, 'point_team1', '{"team":1}', 6, 5, 1, 1, 1, ref_id),
(match1_id, 17, 'point_team1', '{"team":1}', 7, 5, 1, 1, 1, ref_id);

-- ============================================================
-- 10. ANNOUNCEMENTS
-- ============================================================

INSERT INTO announcements (tournament_id, title, body, is_pinned, created_by_user_id)
VALUES (tournament_id, 'Welcome to Spring Open 2026!', '<p>Welcome all teams! Check-in is at 8am on Court 1. Please have your team roster ready.</p>', true, td_id);

INSERT INTO announcements (tournament_id, title, body, is_pinned, created_by_user_id)
VALUES (tournament_id, 'Schedule Update', '<p>Open Doubles bracket play begins at 10am. Mixed Doubles round-robin starts at 2pm.</p>', false, td_id);

INSERT INTO announcements (league_id, title, body, is_pinned, created_by_user_id)
VALUES (league_id, 'Spring 2026 Season Kicks Off!', '<p>The Spring 2026 season is officially underway. Good luck to all teams!</p>', true, admin_id);

-- ============================================================
-- 11. SCORING PRESETS (already seeded by migration 00017)
-- ============================================================

RAISE NOTICE 'Seed data inserted successfully!';
RAISE NOTICE 'Test accounts (password: TestPass123!):';
RAISE NOTICE '  admin@courtcommand.com (platform_admin)';
RAISE NOTICE '  td@courtcommand.com (tournament_director)';
RAISE NOTICE '  ref@courtcommand.com (head_referee)';
RAISE NOTICE '  alex.j@demo.com through emma.d@demo.com (8 players)';

END $$;
