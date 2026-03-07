-- Aggiunge i campi YouTube alla tabella projects (per il merge Tutorial → Progetti)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS video_id TEXT,
  ADD COLUMN IF NOT EXISTS playlist_id TEXT,
  ADD COLUMN IF NOT EXISTS transcript_data JSONB;
