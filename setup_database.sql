-- SQL Schema untuk Si-WFH Setda Demak
-- Salin semua kode ini (Ctrl+A) lalu tempel ke SQL Editor di Dashboard Supabase lalu jalankan (Run).

-- 1. Buat Fungsi Security Definer (Untuk mencegah RLS infinite recursion)
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Tabel Profil Pegawai (Profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nip VARCHAR(18) UNIQUE NOT NULL,
  nama_lengkap TEXT NOT NULL,
  jabatan TEXT,
  role TEXT DEFAULT 'PEGAWAI' CHECK (role IN ('ADMIN', 'ATASAN', 'PEGAWAI')),
  foto_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabel Jadwal WFH (Schedules)
CREATE TABLE IF NOT EXISTS wfh_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  shift_mulai TIME NOT NULL DEFAULT '07:30',
  shift_selesai TIME NOT NULL DEFAULT '16:00',
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, tanggal)
);

-- 4. Tabel Presensi/Absensi (Attendance)
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL CHECK (tipe IN ('MASUK', 'PULANG')),
  foto_url TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  waktu_absen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  catatan TEXT
);

-- 5. Tabel Laporan Kerja (Work Reports)
CREATE TABLE IF NOT EXISTS work_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tanggal DATE DEFAULT CURRENT_DATE NOT NULL,
  tipe TEXT NOT NULL CHECK (tipe IN ('RENCANA', 'HASIL')),
  konten TEXT NOT NULL,
  status_approval TEXT DEFAULT 'PENDING' CHECK (status_approval IN ('PENDING', 'APPROVED', 'REJECTED')),
  catatan_atasan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tabel Notifikasi (Notifications)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  judul TEXT NOT NULL,
  pesan TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Aktifkan Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfh_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 8. Menghapus semua policy lama (opsional untuk memastikan bersih)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view everything" ON profiles;
DROP POLICY IF EXISTS "Users can view their own schedules" ON wfh_schedules;
DROP POLICY IF EXISTS "Admins can insert schedules" ON wfh_schedules;
DROP POLICY IF EXISTS "Admins can view all schedules" ON wfh_schedules;
DROP POLICY IF EXISTS "Admins can update schedules" ON wfh_schedules;
DROP POLICY IF EXISTS "Admins can delete schedules" ON wfh_schedules;

-- 9. Buat Policy - PROFILES
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view everything" ON profiles FOR SELECT USING (is_admin());

-- 10. Buat Policy - WFH SCHEDULES
CREATE POLICY "Users can view their own schedules" ON wfh_schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert schedules" ON wfh_schedules FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can view all schedules" ON wfh_schedules FOR SELECT USING (is_admin());
CREATE POLICY "Admins can update schedules" ON wfh_schedules FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete schedules" ON wfh_schedules FOR DELETE USING (is_admin());

-- 11. Buat Policy - ATTENDANCE & REPORTS (Basic)
CREATE POLICY "Users can manage their own attendance" ON attendance FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own reports" ON work_reports FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all attendance" ON attendance FOR SELECT USING (is_admin());
CREATE POLICY "Admins can view all reports" ON work_reports FOR SELECT USING (is_admin());
