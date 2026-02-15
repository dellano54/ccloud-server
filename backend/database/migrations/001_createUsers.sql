-- ============================
-- Migration: Create users table
-- Database: ccloud
-- ============================

BEGIN;

-- ---------- UP ----------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid();

    username        TEXT NOT NULL UNIQUE,
    email           TEXT NOT NULL UNIQUE,

    password_hash   TEXT NOT NULL,
    is_verified    BOOLEAN DEFAULT FALSE,
    

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Permissions hardening
REVOKE ALL ON users FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO ccloud;


-- indexes
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_username ON users(name);


COMMIT;

-- ---------- DOWN ----------
-- To rollback manually:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_users_updated ON users;
-- DROP FUNCTION IF EXISTS set_updated_at();
-- DROP TABLE IF EXISTS users;
-- COMMIT;