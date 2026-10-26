-- Additive migration; use the checksum-tracked migration runner on staging first.
CREATE TABLE IF NOT EXISTS lifelong_preferences (
 user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 learning_context varchar(32) NOT NULL DEFAULT 'lifelong' CHECK(learning_context IN ('school','adult_returning','professional','career_change','personal','lifelong')),
 preferred_language varchar(24) NOT NULL DEFAULT '',
 learning_goal text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS passport_external_links (
 id serial PRIMARY KEY,
 user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 provider varchar(80) NOT NULL,
 url text NOT NULL,
 description text NOT NULL DEFAULT '',
 evidence_type varchar(32) NOT NULL DEFAULT 'portfolio' CHECK(evidence_type IN ('portfolio','project','social','learning','community','other')),
 verification_status varchar(24) NOT NULL DEFAULT 'self_reported',
 visibility varchar(16) NOT NULL DEFAULT 'private' CHECK(visibility='private'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS passport_link_user_url_unique ON passport_external_links(user_id,url);
CREATE INDEX IF NOT EXISTS passport_links_owner_idx ON passport_external_links(user_id);
CREATE TABLE IF NOT EXISTS passport_competencies (
 id serial PRIMARY KEY,
 user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 skill varchar(120) NOT NULL,
 category varchar(32) NOT NULL CHECK(category IN ('technical','academic','creative','vocational','transferable','other')),
 mastery_level integer NOT NULL CHECK(mastery_level BETWEEN 0 AND 4),
 demonstration varchar(32) NOT NULL CHECK(demonstration IN ('practical','project','assessment','portfolio','work_example','reflection','other')),
 description text NOT NULL,
 evidence_link_id integer REFERENCES passport_external_links(id) ON DELETE SET NULL,
 verification_status varchar(24) NOT NULL DEFAULT 'self_reported',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_competency_owner_idx ON passport_competencies(user_id,created_at);
