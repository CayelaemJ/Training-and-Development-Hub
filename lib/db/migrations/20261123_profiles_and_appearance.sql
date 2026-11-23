-- Personal profiles, look-and-feel settings and display pictures.
--
-- Additive only: three new tables. Nothing existing changes.
-- Learner photos start as 'pending_guardian' and are shown to nobody else
-- until a school-verified guardian approves them (application rule).
--
-- Rollback (only if no profile data needs keeping):
--   DROP TABLE IF EXISTS profile_photos, user_appearance, user_profiles;
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name varchar(60) NOT NULL DEFAULT '',
  pronouns varchar(30) NOT NULL DEFAULT '',
  bio varchar(280) NOT NULL DEFAULT '',
  avatar_style varchar(12) NOT NULL DEFAULT 'initials' CHECK (avatar_style IN ('initials','pattern','photo')),
  avatar_color varchar(12) NOT NULL DEFAULT 'clay' CHECK (avatar_color IN ('clay','teal','gold','ink','violet','rose','sky','leaf')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_appearance (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme varchar(8) NOT NULL DEFAULT 'system' CHECK (theme IN ('system','light','dark')),
  accent varchar(12) NOT NULL DEFAULT 'clay' CHECK (accent IN ('clay','teal','gold','ink','violet','rose','sky','leaf')),
  font_scale real NOT NULL DEFAULT 1 CHECK (font_scale BETWEEN 0.875 AND 1.75),
  density varchar(12) NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable','compact','spacious')),
  font varchar(12) NOT NULL DEFAULT 'default' CHECK (font IN ('default','easy_read','serif','mono')),
  high_contrast boolean NOT NULL DEFAULT false,
  reduce_motion boolean NOT NULL DEFAULT false,
  underline_links boolean NOT NULL DEFAULT false,
  captions_default boolean NOT NULL DEFAULT true,
  pinned jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(pinned) = 'array' AND jsonb_array_length(pinned) <= 8),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profile_photos (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE,
  content_type varchar(16) NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  bytes bytea NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 307200),
  status varchar(20) NOT NULL CHECK (status IN ('approved','pending_guardian','declined')),
  decided_by varchar REFERENCES users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
