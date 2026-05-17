-- Tambahkan kolom unit_kerja ke tabel profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS unit_kerja TEXT;

-- Reload schema cache Supabase agar API segera mengenali kolom baru
NOTIFY pgrst, 'reload schema';
