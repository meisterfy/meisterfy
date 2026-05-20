-- +goose Up
ALTER TABLE posts
  ADD COLUMN connector_resource_id TEXT REFERENCES connector_resources(id) ON DELETE SET NULL;

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE posts
  ADD CONSTRAINT posts_status_check
    CHECK (status IN ('draft','approved','scheduled','published','failed','partially_published'));

-- +goose Down
ALTER TABLE posts DROP COLUMN IF EXISTS connector_resource_id;
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE posts
  ADD CONSTRAINT posts_status_check
    CHECK (status IN ('draft','approved','scheduled','published'));
