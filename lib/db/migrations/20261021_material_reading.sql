-- Additive, nullable cache; existing uploaded files remain intact.
ALTER TABLE upload_intents ADD COLUMN IF NOT EXISTS allow_ai_reading boolean NOT NULL DEFAULT false;
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS allow_ai_reading boolean NOT NULL DEFAULT false;
ALTER TABLE study_materials ADD COLUMN IF NOT EXISTS extracted_text text;
