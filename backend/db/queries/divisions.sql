-- name: CreateDivision :one
INSERT INTO divisions (
    tournament_id, name, slug, format, gender_restriction, age_restriction,
    skill_min, skill_max, rating_system, bracket_format, scoring_format,
    max_teams, max_roster_size, entry_fee_amount, entry_fee_currency,
    check_in_open, allow_self_check_in, status, seed_method, sort_order,
    notes, auto_approve, registration_mode, auto_promote_waitlist,
    grand_finals_reset, advancement_count, current_phase,
    report_to_dupr, report_to_vair, allow_ref_player_add
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
    $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
) RETURNING *;

-- name: GetDivisionByID :one
SELECT * FROM divisions WHERE id = $1 AND deleted_at IS NULL;

-- name: GetDivisionBySlug :one
SELECT * FROM divisions
WHERE tournament_id = $1 AND slug = $2 AND deleted_at IS NULL;

-- name: ListDivisionsByTournament :many
SELECT * FROM divisions
WHERE tournament_id = $1 AND deleted_at IS NULL
ORDER BY sort_order ASC, name ASC;

-- name: UpdateDivision :one
UPDATE divisions SET
    name = COALESCE(sqlc.narg('name'), name),
    slug = COALESCE(sqlc.narg('slug'), slug),
    format = COALESCE(sqlc.narg('format'), format),
    gender_restriction = COALESCE(sqlc.narg('gender_restriction'), gender_restriction),
    age_restriction = COALESCE(sqlc.narg('age_restriction'), age_restriction),
    skill_min = COALESCE(sqlc.narg('skill_min'), skill_min),
    skill_max = COALESCE(sqlc.narg('skill_max'), skill_max),
    rating_system = COALESCE(sqlc.narg('rating_system'), rating_system),
    bracket_format = COALESCE(sqlc.narg('bracket_format'), bracket_format),
    scoring_format = COALESCE(sqlc.narg('scoring_format'), scoring_format),
    max_teams = COALESCE(sqlc.narg('max_teams'), max_teams),
    max_roster_size = COALESCE(sqlc.narg('max_roster_size'), max_roster_size),
    entry_fee_amount = COALESCE(sqlc.narg('entry_fee_amount'), entry_fee_amount),
    entry_fee_currency = COALESCE(sqlc.narg('entry_fee_currency'), entry_fee_currency),
    check_in_open = COALESCE(sqlc.narg('check_in_open'), check_in_open),
    allow_self_check_in = COALESCE(sqlc.narg('allow_self_check_in'), allow_self_check_in),
    status = COALESCE(sqlc.narg('status'), status),
    seed_method = COALESCE(sqlc.narg('seed_method'), seed_method),
    sort_order = COALESCE(sqlc.narg('sort_order'), sort_order),
    notes = COALESCE(sqlc.narg('notes'), notes),
    auto_approve = COALESCE(sqlc.narg('auto_approve'), auto_approve),
    registration_mode = COALESCE(sqlc.narg('registration_mode'), registration_mode),
    auto_promote_waitlist = COALESCE(sqlc.narg('auto_promote_waitlist'), auto_promote_waitlist),
    grand_finals_reset = COALESCE(sqlc.narg('grand_finals_reset'), grand_finals_reset),
    advancement_count = COALESCE(sqlc.narg('advancement_count'), advancement_count),
    current_phase = COALESCE(sqlc.narg('current_phase'), current_phase),
    report_to_dupr = COALESCE(sqlc.narg('report_to_dupr'), report_to_dupr),
    report_to_vair = COALESCE(sqlc.narg('report_to_vair'), report_to_vair),
    allow_ref_player_add = COALESCE(sqlc.narg('allow_ref_player_add'), allow_ref_player_add),
    updated_at = NOW()
WHERE id = @id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteDivision :exec
UPDATE divisions SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;

-- name: SlugExistsDivision :one
SELECT EXISTS(SELECT 1 FROM divisions WHERE tournament_id = $1 AND slug = $2 AND deleted_at IS NULL);

-- name: CountDivisionsByTournament :one
SELECT COUNT(*) FROM divisions
WHERE tournament_id = $1 AND deleted_at IS NULL;
