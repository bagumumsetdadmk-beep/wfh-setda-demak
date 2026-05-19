-- SQL Schema untuk Si-WFH Setda Demak
-- Anda dapat menyalin kode ini ke dalam SQL Editor di Dashboard Supabase Anda.

-- 1. Tabel Profil Pegawai (Profiles)
-- Tabel ini menyimpan data dasar ASN yang terintegrasi dengan Auth Supabase.
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nip VARCHAR(18) UNIQUE NOT NULL,
  nama_lengkap TEXT NOT NULL,
  jabatan TEXT,
  role TEXT DEFAULT 'PEGAWAI' CHECK (role IN ('ADMIN', 'ATASAN', 'PEGAWAI')),
  foto_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabel Jadwal WFH (Schedules)
-- Digunakan oleh Admin untuk memplot siapa saja yang WFH pada tanggal tertentu.
CREATE TABLE wfh_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  shift_mulai TIME NOT NULL DEFAULT '07:30',
  shift_selesai TIME NOT NULL DEFAULT '16:00',
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, tanggal)
);

-- 3. Tabel Presensi/Absensi (Attendance)
-- Menyimpan data swafoto (selfie) dan lokasi saat absen masuk/pulang.
CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tipe TEXT NOT NULL CHECK (tipe IN ('MASUK', 'PULANG')),
  foto_url TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  waktu_absen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  catatan TEXT
);

-- 4. Tabel Laporan Kerja (Work Reports)
-- Menyimpan Rencana Harian (pagi) dan Hasil Capaian (sore).
CREATE TABLE work_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tanggal DATE DEFAULT CURRENT_DATE NOT NULL,
  tipe TEXT NOT NULL CHECK (tipe IN ('RENCANA', 'HASIL')),
  konten TEXT NOT NULL,
  lampiran TEXT,
  status_approval TEXT DEFAULT 'PENDING' CHECK (status_approval IN ('PENDING', 'APPROVED', 'REJECTED')),
  catatan_atasan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabel Notifikasi (Notifications)
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  judul TEXT NOT NULL,
  pesan TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security (RLS) - Basic Policy
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfh_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;

-- Contoh Policy sederhana: User hanya bisa melihat data miliknya sendiri
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view their own schedules" ON wfh_schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own attendance" ON attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage their own reports" ON work_reports FOR ALL USING (auth.uid() = user_id);

-- Atasan/Admin can view all (Policy ini perlu disesuaikan dengan role user)
CREATE POLICY "Admins can view everything" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
