-- CABO owner-scoped lexical retrieval foundation.
-- Dependency: 20261021_material_reading.sql and 20261109_r2_staging_budget.sql.
-- Not applied automatically. Apply only in isolated staging after review.
BEGIN;

CREATE TABLE IF NOT EXISTS cabo_material_chunks (
  id bigserial PRIMARY KEY,
  material_id integer NOT NULL REFERENCES study_materials(id) ON DELETE CASCADE,
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key text NOT NULL REFERENCES cabo_r2_objects(object_key) ON DELETE CASCADE,
  source_version char(64) NOT NULL CHECK (source_version ~ '^[0-9a-f]{64}$'),
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  start_char integer NOT NULL CHECK (start_char >= 0),
  end_char integer NOT NULL CHECK (end_char > start_char),
  content text NOT NULL CHECK (length(content) BETWEEN 30 AND 5000),
  content_sha256 char(64) NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, source_version, chunk_index),
  CHECK (end_char - start_char <= 5000)
);

CREATE INDEX IF NOT EXISTS cabo_material_chunks_owner_material_idx
  ON cabo_material_chunks(owner_user_id, material_id, source_version, chunk_index);
CREATE INDEX IF NOT EXISTS cabo_material_chunks_search_idx
  ON cabo_material_chunks USING gin(search_vector);

COMMENT ON TABLE cabo_material_chunks IS
  'Approved, consented, owner-scoped R2 learning-material chunks for lexical retrieval. No learner profile or emotional-support records.';
COMMENT ON COLUMN cabo_material_chunks.source_version IS
  'SHA-256 of normalized source text; replacement is transactional and idempotent.';

COMMIT;
