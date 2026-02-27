-- Aggiunge supporto per immagini multiple agli eventi
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- Popola image_urls dagli eventi esistenti che hanno già image_url
UPDATE events SET image_urls = ARRAY[image_url] WHERE image_url IS NOT NULL AND image_url != '' AND (image_urls IS NULL OR image_urls = '{}');
