-- +goose Up
INSERT INTO site_settings (key, value) VALUES ('google_maps_api_key', '');

-- +goose Down
DELETE FROM site_settings WHERE key = 'google_maps_api_key';
