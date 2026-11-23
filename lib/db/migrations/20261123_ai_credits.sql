-- AI credit plans and ledger. Additive only: two new tables.
-- No one is charged by this migration; payment needs a configured provider.
--
-- Rollback (only if no purchases need keeping):
--   DROP TABLE IF EXISTS ai_credit_ledger, ai_subscriptions;
CREATE TABLE IF NOT EXISTS ai_subscriptions (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan varchar(16) NOT NULL CHECK (plan IN ('free','educator','plus','pro')),
  status varchar(16) NOT NULL CHECK (status IN ('active','cancelled','past_due')),
  current_period_end timestamptz NOT NULL,
  provider varchar(16) NOT NULL CHECK (provider IN ('paystack','manual','demo')),
  provider_reference varchar(120),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_credit_ledger (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind varchar(16) NOT NULL CHECK (kind IN ('usage','usage_topup','refund','refund_topup','purchase','grant')),
  delta integer NOT NULL CHECK (delta BETWEEN -1000 AND 100000 AND delta <> 0),
  operation varchar(32),
  reference varchar(120),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_credit_sign CHECK ((kind IN ('usage','usage_topup') AND delta < 0) OR (kind NOT IN ('usage','usage_topup') AND delta > 0))
);
CREATE INDEX IF NOT EXISTS ai_credit_ledger_user_idx ON ai_credit_ledger (user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS ai_credit_ledger_reference_idx ON ai_credit_ledger (reference);
