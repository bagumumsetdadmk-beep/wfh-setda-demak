'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowRight, 
  Lock, 
  UserCircle, 
  Loader2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  MapPin, 
  FileCheck2, 
  Building2,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [nip, setNip] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Supabase membutuhkan email, kita konversi NIP menjadi format email simulasi
      const simulatedEmail = nip.includes('@') ? nip : `${nip}@demak.go.id`;

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: simulatedEmail,
        password,
      });

      if (authError) {
        if (authError.message.includes('Email logins are disabled')) {
          throw new Error('Metode login Email belum diaktifkan di Supabase. Silakan aktifkan di Authentication -> Providers -> Email.');
        }
        if (authError.message.includes('Email not confirmed')) {
          throw new Error('Email belum aktif. Karena menggunakan email NIP, silakan minta Admin untuk HAPUS user ini di Supabase (Authentication -> Users), lalu buat ulang user-nya. (Karena fitur Confirm Email sudah dimatikan, user baru akan langsung aktif).');
        }
        // Cek apakah NIP ini sebenarnya ada di tabel profiles tapi belum ada di Auth
        if (authError.message.includes('Invalid login credentials')) {
           const { data: profileCheck } = await supabase
            .from('profiles')
            .select('nip')
            .eq('nip', nip)
            .single();
          
          if (!profileCheck) {
            throw new Error('NIP tidak terdaftar di sistem. Silakan hubungi Admin Bagian Umum.');
          } else {
            throw new Error('Password salah. Silakan coba lagi.');
          }
        }
        throw authError;
      }

      if (data.user) {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal masuk. Periksa kembali NIP dan Password Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center lg:justify-end p-4 sm:p-6 lg:p-12 font-sans overflow-x-hidden bg-slate-950">
      {/* Background Image 3D Disney ASN WFH with 90% Transparency */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 opacity-90 scale-105 filter brightness-95"
        style={{ backgroundImage: `url('/asn_3d_disney_wfh.jpg')` }}
      />

      {/* Balanced Overlay: Dark subtle gradient that preserves 3D background clarity while keeping form crisp */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/40 to-slate-950/80 backdrop-blur-[1px]" />

      {/* Ambient Glow Effects */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Standalone Login Card (Form Login Berdiri Sendiri di Sisi Kanan) */}
      <div className="w-full max-w-md relative z-10 my-auto lg:mr-6">
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          
          {/* Top Decorative Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500" />

          {/* Header Branding */}
          <div className="text-center space-y-3 mb-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center p-2.5 shadow-lg shadow-indigo-500/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src="/logo.png" 
                alt="Logo Setda Demak" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    const span = document.createElement('span');
                    span.className = "text-xl font-black text-indigo-400";
                    span.innerText = "DEMAK";
                    parent.appendChild(span);
                  }
                }}
              />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-semibold">
              <Building2 size={12} className="text-indigo-400" />
              <span>Transformasi Budaya Kerja ASN WFH</span>
            </div>

            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">E-WFH SETDA DEMAK</h1>
              <p className="text-slate-400 text-xs font-medium mt-1">Pemerintah Kabupaten Demak</p>
            </div>
          </div>

          {/* Error Alert Banner */}
          {error && (
            <div className="mb-6 p-4 bg-rose-950/70 border border-rose-800/80 rounded-2xl flex items-start gap-3 text-rose-300 animate-in fade-in duration-200">
              <AlertCircle size={18} className="shrink-0 text-rose-400 mt-0.5" />
              <p className="text-xs font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {/* Form Login */}
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                NIP (Nomor Induk Pegawai)
              </label>
              <div className="relative">
                <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text" 
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  placeholder="Contoh: 198501012010011001"
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 rounded-xl py-3.5 pl-11 pr-4 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 rounded-xl py-3.5 pl-11 pr-11 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button 
                type="submit"
                disabled={loading}
                className="w-full group bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25 text-xs uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    <span>Memproses Login...</span>
                  </div>
                ) : (
                  <>
                    <span>Masuk Sekarang</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer Note */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center space-y-1.5">
            <p className="text-slate-400 text-[11px] font-medium leading-relaxed">
              &copy; 2026 Sekretariat Daerah Kabupaten Demak
            </p>
            <p className="text-slate-500 text-[10px] flex items-center justify-center gap-1">
              <Sparkles size={11} className="text-amber-400" />
              <span>Sistem Transformasi Budaya Kerja Digital ASN</span>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

