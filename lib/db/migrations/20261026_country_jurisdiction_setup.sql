-- CABO ZA/BW institution jurisdiction marker. Additive, manually reviewed migration.
-- Do NOT assume existing institutions are South African; retain NULL as unclassified.
-- Do NOT use drizzle push --force against production.
ALTER TABLE institution_setup
  ADD COLUMN IF NOT EXISTS country_code varchar(2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='institution_setup'::regclass
      AND conname='institution_setup_country_code_check'
  ) THEN
    ALTER TABLE institution_setup
      ADD CONSTRAINT institution_setup_country_code_check
      CHECK (country_code IS NULL OR country_code IN ('ZA','BW')) NOT VALID;
  END IF;
END $$;
-- Existing records must be classified by an authorised school administrator.
-- Later validation: ALTER TABLE institution_setup VALIDATE CONSTRAINT institution_setup_country_code_check;
