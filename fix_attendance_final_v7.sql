-- Final Database Sync v7 (Handling JSONB for geotag)
-- Ensuring all variants of column names exist
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'MASUK',
ADD COLUMN IF NOT EXISTS tipe TEXT DEFAULT 'MASUK',
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS profile_id UUID,
ADD COLUMN IF NOT EXISTS waktu_absen TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS foto_url TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION DEFAULT 0;

-- Special handling for geotag if it's JSONB
DO $$ 
BEGIN 
    -- Try to add column as JSONB if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'geotag') THEN
        ALTER TABLE attendance ADD COLUMN geotag JSONB;
    END IF;
    
    -- If it is NOT NULL, we might need a default to prevent insertion errors
    ALTER TABLE attendance ALTER COLUMN geotag DROP NOT NULL;
END $$;

-- Fill missing data for consistency
UPDATE attendance SET photo_url = foto_url WHERE photo_url IS NULL AND foto_url IS NOT NULL;
UPDATE attendance SET foto_url = photo_url WHERE foto_url IS NULL AND photo_url IS NOT NULL;
UPDATE attendance SET type = tipe WHERE type IS NULL AND tipe IS NOT NULL;
UPDATE attendance SET tipe = type WHERE tipe IS NULL AND type IS NOT NULL;
UPDATE attendance SET profile_id = user_id WHERE profile_id IS NULL AND user_id IS NOT NULL;
UPDATE attendance SET user_id = profile_id WHERE user_id IS NULL AND profile_id IS NOT NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
