/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
    Clock, 
    Search, 
    Camera, 
    MapPin, 
    FileText, 
    Bell,
    CheckCircle2,
    MessageSquare,
    ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';

type ApprovalType = 'ABSENSI' | 'RENCANA' | 'HASIL';

interface ApprovalItem {
    id: string;
    user_id: string;
    user: string;
    nip: string;
    type: ApprovalType;
    subtitle: string;
    time: string;
    status: string;
    data: any;
    originalTable: 'attendance' | 'work_reports';
}

export default function ApprovalPage() {
  const [filter, setFilter] = useState<ApprovalType | 'ALL'>('ALL');
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [catatan, setCatatan] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchApprovals = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profileData } = await supabase.from('profiles').select('role, unit_kerja').eq('id', session.user.id).single();
      const isAdmin = profileData?.role === 'ADMIN' || (session.user.email || '').toLowerCase().includes('admin');
      const unitKerja = profileData?.unit_kerja;

      let attendanceQuery = supabase.from('attendance')
        .select('*, profiles!attendance_user_id_fkey!inner(id, nama_lengkap, nip, unit_kerja)')
        .order('waktu_absen', { ascending: false });

      let reportQuery = supabase.from('work_reports')
        .select('*, profiles!work_reports_user_id_fkey!inner(id, nama_lengkap, nip, unit_kerja)')
        .order('created_at', { ascending: false });

      if (!isAdmin && unitKerja) {
        attendanceQuery = attendanceQuery.eq('profiles.unit_kerja', unitKerja);
        reportQuery = reportQuery.eq('profiles.unit_kerja', unitKerja);
      }

      const [attendances, reports] = await Promise.all([
        attendanceQuery,
        reportQuery
      ]);

      if (attendances.error) {
        console.error('Attendance fetch error:', attendances.error);
      }
      if (reports.error) {
        console.error('Reports fetch error:', reports.error);
      }

      const attendanceItems: ApprovalItem[] = (attendances.data || [])
        .filter(a => isAdmin || (a.status === 'PENDING' || a.status === null))
        .map(a => {
          const profile = a.profiles;
          return {
            id: a.id,
            user_id: a.user_id,
            user: (profile as any)?.nama_lengkap || 'Unknown',
            nip: (profile as any)?.nip || '-',
            type: 'ABSENSI',
            subtitle: `Absensi ${a.tipe || a.type || 'Harian'}`,
            time: new Date(a.waktu_absen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            status: a.status || 'PENDING',
            data: { photo: a.foto_url || a.photo_url, loc: a.geotag?.address || `Lat: ${a.latitude}, Lng: ${a.longitude}` },
            originalTable: 'attendance'
          };
      });

      const reportItems: ApprovalItem[] = (reports.data || [])
        .filter(r => isAdmin || (r.status === 'PENDING' || r.status === null || r.status_approval === 'PENDING' || r.status_approval === null))
        .map(r => {
          const profile = r.profiles;
          return {
            id: r.id,
            user_id: r.user_id,
            user: (profile as any)?.nama_lengkap || 'Unknown',
            nip: (profile as any)?.nip || '-',
            type: r.tipe === 'RENCANA' ? 'RENCANA' : 'HASIL',
            subtitle: r.tipe === 'RENCANA' ? 'Rencana Kerja' : 'Capaian Kinerja',
            time: new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            status: r.status || r.status_approval || 'PENDING',
            data: { detail: r.konten || r.content, lampiran: r.lampiran },
            originalTable: 'work_reports'
          };
      });

      setItems([...attendanceItems, ...reportItems]);
    } catch (err) {
      console.error('Error fetching approvals:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && mounted) {
        fetchApprovals();
      }
    };

    init();
    
    return () => {
      mounted = false;
    };
  }, []);

  const handleAction = async (item: ApprovalItem, status: 'APPROVED' | 'REVISION' | 'REJECTED') => {
      setIsProcessing(true);
      try {
          const updateData: any = { 
              status: status,
              catatan: catatan
          };

          if (item.originalTable === 'work_reports') {
              updateData.status_approval = status;
              updateData.catatan_atasan = catatan;
          }
          
          const { error } = await supabase
              .from(item.originalTable)
              .update(updateData)
              .eq('id', item.id);

          if (error) throw error;
          
          // Kirim notifikasi
          let judul = 'Persetujuan ' + item.subtitle;
          let pesan = status === 'APPROVED' ? `Laporan/Absensi telah disetujui.` : 
                      status === 'REVISION' ? `Laporan/Absensi perlu revisi: ${catatan}` : 
                      `Laporan/Absensi ditolak: ${catatan}`;
                      
          await supabase.from('notifications').insert({
              user_id: item.user_id,
              judul,
              pesan,
              is_read: false
          });
          
          setItems(items.filter(i => i.id !== item.id));
          setSelectedItem(null);
          setCatatan('');
      } catch (err: any) {
          alert('Gagal memproses: ' + err.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const filteredItems = filter === 'ALL' ? items : items.filter(i => i.type === filter);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 text-slate-800">
            <div>
                 <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-3xl font-display font-black tracking-tight leading-none italic uppercase">PERSETUJUAN</h2>
                    <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-lg italic">{items.length} ANTRIAN</span>
                </div>
                <p className="text-slate-500 font-medium">Validasi kehadiran dan capaian kinerja ASN di bawah koordinasi Anda.</p>
            </div>
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                {(['ALL', 'ABSENSI', 'RENCANA', 'HASIL'] as const).map((f) => (
                    <button 
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                            filter === f ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        {f}
                    </button>
                ))}
            </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-7 space-y-4">
                {isLoading ? (
                    <div className="py-20 text-center animate-pulse text-slate-400 font-bold uppercase italic tracking-widest text-xs">Memuat data antrian...</div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filteredItems.map((item) => (
                            <motion.div 
                                key={`${item.originalTable}-${item.id}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className={cn(
                                    "dashboard-card cursor-pointer group transition-all border-l-4",
                                    selectedItem?.id === item.id ? "border-indigo-600 bg-indigo-50/30" : "hover:border-slate-300 border-transparent shadow-sm hover:shadow-md"
                                )}
                                onClick={() => setSelectedItem(item)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105",
                                            item.type === 'ABSENSI' ? "bg-indigo-100 text-indigo-600" :
                                            item.type === 'RENCANA' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                                        )}>
                                            {item.type === 'ABSENSI' ? <Camera size={20} /> :
                                            item.type === 'RENCANA' ? <FileText size={20} /> : <CheckCircle2 size={20} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-black text-slate-800 mb-0.5 truncate uppercase italic tracking-tight">{item.user}</p>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                    {item.subtitle} • <Clock size={10} /> {item.time} WIB
                                                </p>
                                                <span className={cn(
                                                    "text-[8px] font-black uppercase px-2 py-0.5 rounded italic",
                                                    item.status === 'APPROVED' ? "bg-emerald-100 text-emerald-600" :
                                                    item.status === 'REVISION' ? "bg-amber-100 text-amber-600" :
                                                    item.status === 'REJECTED' ? "bg-rose-100 text-rose-600" :
                                                    "bg-slate-100 text-slate-500"
                                                )}>{item.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <ChevronRight size={16} className={cn("text-slate-300 transition-transform", selectedItem?.id === item.id && "rotate-90 text-indigo-600")} />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
                
                {filteredItems.length === 0 && !isLoading && (
                    <div className="dashboard-card border-dashed py-20 text-center space-y-4">
                        <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-slate-400">
                            <Bell size={24} />
                        </div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest italic">Tidak ada antrian persetujuan</p>
                    </div>
                )}
            </div>

            <div className="xl:col-span-5">
                <div className="dashboard-card sticky top-32 min-h-[400px] flex flex-col shadow-xl">
                    <AnimatePresence mode="wait">
                        {selectedItem ? (
                            <motion.div 
                                key={selectedItem.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex-1 flex flex-col"
                            >
                                <div className="border-b border-slate-100 pb-6 mb-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Detail Pengajuan</h4>
                                        <div className="flex gap-2">
                                            <span className="text-[9px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded tracking-widest uppercase italic">{selectedItem.type}</span>
                                            <span className={cn(
                                                "text-[9px] font-black px-2 py-1 rounded tracking-widest uppercase italic",
                                                selectedItem.status === 'APPROVED' ? "bg-emerald-100 text-emerald-600" :
                                                selectedItem.status === 'REVISION' ? "bg-amber-100 text-amber-600" :
                                                selectedItem.status === 'REJECTED' ? "bg-rose-100 text-rose-600" :
                                                "bg-slate-100 text-slate-500"
                                            )}>{selectedItem.status}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                                            {selectedItem.type === 'ABSENSI' ? <Camera size={20} className="text-slate-300" /> : <FileText size={20} className="text-slate-300" />}
                                        </div>
                                        <div>
                                            <p className="text-base font-black text-slate-800 leading-tight uppercase italic">{selectedItem.user}</p>
                                            <p className="text-[10px] font-bold text-slate-400 tracking-widest">NIP. {selectedItem.nip}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-6 overflow-y-auto max-h-[40vh] pr-2">
                                    {selectedItem.type === 'ABSENSI' && (
                                        <div className="space-y-4">
                                            <div className="relative aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 shadow-inner group">
                                                <img src={selectedItem.data.photo} alt="Photo" className="w-full h-full object-cover" />
                                                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                                                    <p className="text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                                                        <MapPin size={12} className="text-rose-400" /> {selectedItem.data.loc}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {(selectedItem.type === 'RENCANA' || selectedItem.type === 'HASIL') && (
                                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Konten Laporan Harian</p>
                                            <p className="text-sm font-medium text-slate-700 leading-relaxed italic border-l-2 border-indigo-200 pl-4">&quot;{selectedItem.data.detail || selectedItem.data.konten}&quot;</p>
                                            {selectedItem.data.lampiran && (
                                                <div className="pt-3 border-t border-slate-200">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Lampiran Bukti Kerja:</p>
                                                    <a 
                                                        href={selectedItem.data.lampiran}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all"
                                                    >
                                                        Buka Tautan Bukti Kerja
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-3 pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Berikan Feedback / Catatan</label>
                                            <MessageSquare size={14} className="text-slate-300" />
                                        </div>
                                        <textarea 
                                            value={catatan}
                                            onChange={(e) => setCatatan(e.target.value)}
                                            placeholder="Opsional: Alasan penolakan atau instruksi perbaikan..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                            rows={3}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-100">
                                    <button 
                                        disabled={isProcessing}
                                        onClick={() => handleAction(selectedItem, 'REVISION')}
                                        className="py-4 px-4 bg-amber-500 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <Clock size={16} /> Perlu Perbaikan
                                    </button>
                                    <button 
                                        disabled={isProcessing}
                                        onClick={() => handleAction(selectedItem, 'APPROVED')}
                                        className="py-4 px-4 bg-emerald-600 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <CheckCircle2 size={16} /> Terima / Approve
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 p-8">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 border border-slate-200 shadow-inner">
                                    <Search size={32} className="text-slate-300" />
                                </div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed italic tracking-tight">
                                    Pilih salah satu item di daftar<br/>untuk melakukan verifikasi data
                                </p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}


