'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, UserCircle, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [nip, setNip] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[80%] rounded-full bg-indigo-100/50 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[60%] rounded-full bg-slate-200/50 blur-[120px]" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-indigo-600/30 overflow-hidden">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain p-2"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const span = document.createElement('span');
                  span.className = "text-2xl font-display font-black text-white";
                  span.innerText = "D";
                  parent.appendChild(span);
                }
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Si-WFH PORTAL</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Pemerintah Kabupaten Demak</p>
        </div>

        <div className="bg-white border border-slate-200 p-8 rounded-[32px] shadow-sm">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-600">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-tight">{error}</p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">NIP Pegawai</label>
              <div className="relative">
                <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="text" 
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  placeholder="Contoh: 19xxxxxxxxxxxxxx"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full group bg-indigo-600 hover:bg-black text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-600/20 active:scale-95 text-xs uppercase tracking-widest disabled:opacity-70"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin mx-auto" />
              ) : (
                <>
                  Masuk Sekarang
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-50 text-center">
            <p className="text-slate-400 text-[10px] font-medium leading-relaxed">
              &copy; 2024 Bagian Umum Setda Demak.<br/>
              Khusus Internal ASN Pemerintah Kab. Demak.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
