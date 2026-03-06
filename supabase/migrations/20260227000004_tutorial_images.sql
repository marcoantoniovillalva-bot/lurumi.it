-- Add image support to tutorials table
ALTER TABLE tutorials
    ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS cover_image_id TEXT;
