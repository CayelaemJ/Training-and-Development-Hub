CREATE TABLE IF NOT EXISTS learner_ai_profiles (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  personalization_enabled boolean NOT NULL DEFAULT false,
  goals jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(goals) = 'array'),
  interests jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(interests) = 'array'),
  preferred_language varchar(24) NOT NULL DEFAULT '',
  explanation_style varchar(24) NOT NULL DEFAULT 'step_by_step',
  learning_preferences jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(learning_preferences) = 'array'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_ai_explanation_style CHECK (explanation_style IN ('step_by_step','examples_first','concise','practice_first','visual'))
);
