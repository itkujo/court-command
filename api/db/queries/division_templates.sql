-- name: CreateDivisionTemplate :one
INSERT INTO division_templates (
    league_id, name, format, gender_restriction, age_restriction,
    skill_min, skill_max, rating_system, bracket_format, scoring_format,
    max_teams, max_roster_size, entry_fee_amount, entry_fee_currency,
    seed_method, registration_mode, auto_approve, auto_promote_waitlist,
    grand_finals_reset, advancement_count, allow_self_check_in,
    allow_ref_player_add, report_to_dupr, report_to_vair, sort_order, notes
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
    $21, $22, $23, $24, $25, $26
) RETURNING *;

-- name: GetDivisionTemplateByID :one
SELECT * FROM division_templates WHERE id = $1 AND deleted_at IS NULL;

-- name: ListDivisionTemplatesByLeague :many
SELECT * FROM division_templates
WHERE league_id = $1 AND deleted_at IS NULL
ORDER BY sort_order ASC, name ASC;

-- name: UpdateDivisionTemplate :one
UPDATE division_templates SET
    name = COALESCE(sqlc.narg('name'), name),
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
    seed_method = COALESCE(sqlc.narg('seed_method'), seed_method),
    registration_mode = COALESCE(sqlc.narg('registration_mode'), registration_mode),
    auto_approve = COALESCE(sqlc.narg('auto_approve'), auto_approve),
    auto_promote_waitlist = COALESCE(sqlc.narg('auto_promote_waitlist'), auto_promote_waitlist),
    grand_finals_reset = COALESCE(sqlc.narg('grand_finals_reset'), grand_finals_reset),
    advancement_count = COALESCE(sqlc.narg('advancement_count'), advancement_count),
    allow_self_check_in = COALESCE(sqlc.narg('allow_self_check_in'), allow_self_check_in),
    allow_ref_player_add = COALESCE(sqlc.narg('allow_ref_player_add'), allow_ref_player_add),
    report_to_dupr = COALESCE(sqlc.narg('report_to_dupr'), report_to_dupr),
    report_to_vair = COALESCE(sqlc.narg('report_to_vair'), report_to_vair),
    sort_order = COALESCE(sqlc.narg('sort_order'), sort_order),
    notes = COALESCE(sqlc.narg('notes'), notes),
    updated_at = NOW()
WHERE id = @id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeleteDivisionTemplate :exec
UPDATE division_templates SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;
