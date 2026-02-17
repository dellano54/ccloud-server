BEGIN;

CREATE TABLE IF NOT EXISTS files (
    id              TEXT PRIMARY KEY,          -- SHA-256 hash
    filename        TEXT NOT NULL,
    creation_date   TIMESTAMPTZ NOT NULL,
    mime_type       TEXT NOT NULL,
    user_id         UUID NOT NULL,
    size            BIGINT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_files_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_files_user ON files(user_id);
CREATE INDEX idx_files_created ON files(created_at);

-- Prevent same user re-uploading identical content
CREATE UNIQUE INDEX uniq_files_user_hash
ON files(user_id, id);

-- Permissions
REVOKE ALL ON files FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON files TO ccloud;

COMMIT;