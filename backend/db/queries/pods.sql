-- name: CreatePod :one
INSERT INTO pods (division_id, name, sort_order)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetPodByID :one
SELECT * FROM pods WHERE id = $1 AND deleted_at IS NULL;

-- name: ListPodsByDivision :many
SELECT * FROM pods
WHERE division_id = $1 AND deleted_at IS NULL
ORDER BY sort_order ASC, name ASC;

-- name: UpdatePod :one
UPDATE pods SET
    name = COALESCE(sqlc.narg('name'), name),
    sort_order = COALESCE(sqlc.narg('sort_order'), sort_order),
    updated_at = NOW()
WHERE id = @id AND deleted_at IS NULL
RETURNING *;

-- name: SoftDeletePod :exec
UPDATE pods SET deleted_at = NOW(), updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;

-- name: CountPodsByDivision :one
SELECT COUNT(*) FROM pods
WHERE division_id = $1 AND deleted_at IS NULL;
