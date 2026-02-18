-- =============================================================================
-- File Sync Schema
-- Two-table design: `files` (current state) + `file_changes` (sync log)
-- Per-user versioning: each user has their own 1, 2, 3... version sequence
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Table: files
-- Source of truth for current file state.
-- Hard deletes are used — deleted files are NOT kept here.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS files (
    id              TEXT        PRIMARY KEY,    -- SHA-256 hash of file content
    filename        TEXT        NOT NULL,
    creation_date   TIMESTAMPTZ NOT NULL,
    mime_type       TEXT        NOT NULL,
    user_id         UUID        NOT NULL,
    size            BIGINT      NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT fk_files_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_files_user
    ON files(user_id);

CREATE INDEX IF NOT EXISTS idx_files_created
    ON files(created_at);

-- Same user cannot re-upload identical content (same hash)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_files_user_hash
    ON files(user_id, id);

REVOKE ALL ON files FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON files TO ccloud;


-- -----------------------------------------------------------------------------
-- Table: file_changes
-- Append-only sync log. Every INSERT / UPDATE / DELETE on `files` produces
-- one row here via trigger.
--
-- `version` is scoped per user — each user has their own 1, 2, 3... sequence.
-- `id` is a surrogate PK for internal use only (not exposed to clients).
-- No FK back to `files` — delete events must outlive the deleted row.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS file_changes (
    id          BIGSERIAL   PRIMARY KEY,
    version     BIGINT      NOT NULL,
    file_id     TEXT        NOT NULL,
    user_id     UUID        NOT NULL,
    op          TEXT        NOT NULL CHECK (op IN ('insert', 'update', 'delete')),
    -- Full metadata snapshot at time of change. NULL for delete events.
    snapshot    JSONB,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- version must be unique within a user
    CONSTRAINT uniq_file_changes_user_version
        UNIQUE (user_id, version)
);

-- Primary sync query pattern: fetch changes for a user after a given version
CREATE INDEX IF NOT EXISTS idx_file_changes_user_version
    ON file_changes(user_id, version);

-- For retention / pruning jobs
CREATE INDEX IF NOT EXISTS idx_file_changes_changed_at
    ON file_changes(changed_at);

REVOKE ALL ON file_changes FROM PUBLIC;
GRANT SELECT, INSERT ON file_changes TO ccloud;


-- -----------------------------------------------------------------------------
-- Trigger function: writes to file_changes on every mutation of `files`.
-- Computes the next per-user version using MAX(version) + 1.
--
-- Race condition note: MAX() + 1 is safe for low-to-medium concurrency.
-- For high concurrency, replace with a per-user sequence or advisory lock.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_file_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    next_version BIGINT;
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN

        SELECT COALESCE(MAX(version), 0) + 1
        INTO   next_version
        FROM   file_changes
        WHERE  user_id = NEW.user_id;

        INSERT INTO file_changes (version, file_id, user_id, op, snapshot)
        VALUES (
            next_version,
            NEW.id,
            NEW.user_id,
            lower(TG_OP),
            jsonb_build_object(
                'id',           NEW.id,
                'name',         NEW.filename,
                'mimeType',     NEW.mime_type,
                'size',         NEW.size,
                'creationDate', NEW.creation_date,
                'checksum',     NEW.id          -- SHA-256 id doubles as checksum
            )
        );
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN

        SELECT COALESCE(MAX(version), 0) + 1
        INTO   next_version
        FROM   file_changes
        WHERE  user_id = OLD.user_id;

        INSERT INTO file_changes (version, file_id, user_id, op, snapshot)
        VALUES (next_version, OLD.id, OLD.user_id, 'delete', NULL);
        RETURN OLD;

    END IF;
END;
$$;

CREATE OR REPLACE TRIGGER trg_files_audit
    AFTER INSERT OR UPDATE OR DELETE ON files
    FOR EACH ROW EXECUTE FUNCTION trg_file_changes();


-- =============================================================================
-- EXAMPLE QUERIES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. NORMAL SYNC
--    Client provides their last known version.
--    Returns all changes that happened after that version.
--
--    $1 = user_id
--    $2 = last version the client successfully synced
--    $3 = batch limit (default 100)
-- -----------------------------------------------------------------------------

/*
SELECT
    version,
    file_id,
    op,
    snapshot
FROM   file_changes
WHERE  user_id = $1
  AND  version > $2
ORDER  BY version ASC
LIMIT  $3;
*/


-- -----------------------------------------------------------------------------
-- 2. FULL SYNC FROM SCRATCH
--    Client is new or has lost their state entirely.
--    Pass version = 0 to get everything from the beginning.
--
--    $1 = user_id
--    $3 = batch limit
-- -----------------------------------------------------------------------------

/*
SELECT
    version,
    file_id,
    op,
    snapshot
FROM   file_changes
WHERE  user_id = $1
  AND  version > 0
ORDER  BY version ASC
LIMIT  $3;
*/


-- -----------------------------------------------------------------------------
-- 3. WHAT THE API RESPONSE LOOKS LIKE
--    The query above returns raw rows. Your API layer splits them:
--
--    items      <- rows where op IN ('insert', 'update'), use snapshot column
--    deletedIds <- rows where op = 'delete', use file_id column
--    nextVersion <- MAX(version) from the batch
--
-- Raw rows example:
--
--   version | file_id    | op       | snapshot
--   --------+------------+----------+-------------------------------------------
--   1       | abc123     | insert   | {"id":"abc123","name":"IMG_2022.jpg",...}
--   2       | def456     | insert   | {"id":"def456","name":"DOC_2023.pdf",...}
--   3       | abc123     | delete   | null
--
-- Becomes this JSON response:
--
--   {
--     "items": [
--       {
--         "id":           "def456",
--         "version":      2,
--         "name":         "DOC_2023.pdf",
--         "mimeType":     "application/pdf",
--         "size":         102400,
--         "creationDate": "2023-06-01T09:00:00Z",
--         "checksum":     "def456"
--       }
--     ],
--     "deletedIds":  ["abc123"],
--     "nextVersion": 3
--   }
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- 4. GET THE LATEST VERSION FOR A USER
--    Useful to compute the stateHash in Level 1 (quick consistency check).
--
--    $1 = user_id
-- -----------------------------------------------------------------------------

/*
SELECT COALESCE(MAX(version), 0) AS current_version
FROM   file_changes
WHERE  user_id = $1;
*/


COMMIT;