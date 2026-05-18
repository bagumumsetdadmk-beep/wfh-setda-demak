import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yhacmkkfntmshhssnxnl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey === 'placeholder') {
  console.warn('Supabase URL or Anon Key is missing. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const BAGIAN_LIST = [
  'Bagian Umum',
  'Bagian Organisasi',
  'Bagian Prokompim',
  'Bagian Adm. Pembangunan',
  'Bagian Perekonomian dan SDA',
  'Bagian Pengadaan Barang/Jasa',
  'Bagian Hukum',
  'Bagian Kesra',
  'Bagian Pemerintahan'
];

export type Role = 'ADMIN' | 'ATASAN' | 'PEGAWAI';

export interface Profile {
  id: string;
  nip: string;
  nama_lengkap: string;
  jabatan?: string;
  role: Role;
  foto_url?: string;
  unit_kerja?: string;
}

export interface Schedule {
  id: string;
  user_id: string;
  tanggal: string;
  shift_mulai: string;
  shift_selesai: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  created_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  tipe: 'MASUK' | 'PULANG';
  type: 'MASUK' | 'PULANG';
  foto_url: string;
  photo_url: string;
  geotag?: any;
  latitude: number;
  longitude: number;
  waktu_absen: string;
  catatan?: string;
}

export interface WorkReport {
  id: string;
  user_id: string;
  tanggal: string;
  tipe: 'RENCANA' | 'HASIL';
  konten: string;
  status_approval: 'PENDING' | 'APPROVED' | 'REJECTED';
  catatan_atasan?: string;
  created_at: string;
}
