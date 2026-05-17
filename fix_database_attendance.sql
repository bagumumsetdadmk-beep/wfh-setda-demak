-- Solusi untuk Error PGRST204: Kolom 'foto_url' tidak ditemukan di cache skema
-- Salin dan jalankan script ini di SQL Editor Supabase untuk memperbarui tabel attendance
-- dan merefresh cache skema database.

ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Reload schema cache Supabase agar API segera mengenali kolom baru
NOTIFY pgrst, 'reload schema';
