-- +goose Up
-- Promote the earliest created user to platform_admin.
-- This fixes setups created before system_role was introduced,
-- where the first/only admin user defaulted to 'user'.
UPDATE users
SET system_role = 'platform_admin'
WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
  AND system_role = 'user';

-- +goose Down
UPDATE users
SET system_role = 'user'
WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
  AND system_role = 'platform_admin';
