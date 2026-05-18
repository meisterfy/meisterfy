-- +goose Up
ALTER TABLE users
    ADD COLUMN system_role TEXT NOT NULL DEFAULT 'user'
        CHECK (system_role IN ('user', 'platform_admin'));

-- +goose Down
ALTER TABLE users DROP COLUMN system_role;
