BEGIN;

-- Albums
CREATE TABLE albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_album_title UNIQUE (user_id, title)
);

CREATE INDEX idx_albums_user ON albums(user_id);

-- Album ↔ Files (Many-to-Many)
CREATE TABLE album_files (
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    file_id  TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    PRIMARY KEY (album_id, file_id)
);

CREATE INDEX idx_album_files_album ON album_files(album_id);

COMMIT;