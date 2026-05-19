'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
    FileText, 
    Send, 
    CheckCircle, 
    Clock, 
    Calendar as CalendarIcon,
    AlertCircle,
    BadgeCheck,
    Trash2,
    Edit3
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function LaporanKerjaPage() {
  const [activeTab, setActiveTab] = useState<'RENCANA' | 'HASIL'>('RENCANA');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [content, setContent] = useState('');
  const [lampiran, setLampiran] = useState('');
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [todaySchedule, setTodaySchedule] = useState<any>(null);
  const [notification, setNotification] = useState<{ type: 'ERROR' | 'SUCCESS' | 'WARNING'; message: string; submessage?: string } | null>(null);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('work_reports')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContext = async () => {
    try {
      const today = new Date().toLocaleDateString('en-CA');
      const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch MASUK attendance today
      const { data: attendances } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', session.user.id)
        .or('type.eq.MASUK,tipe.eq.MASUK')
        .gte('waktu_absen', startOfDay)
        .lte('waktu_absen', endOfDay)
        .order('waktu_absen', { ascending: true })
        .limit(1);
      
      if (attendances?.[0]) setTodayAttendance(attendances[0]);

      // Fetch Today's WFH Schedule
      const { data: schedule } = await supabase
        .from('wfh_schedules')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('tanggal', today)
        .eq('status', 'CONFIRMED')
        .maybeSingle();
      
      if (schedule) setTodaySchedule(schedule);
    } catch (err) {
      console.error('Error fetching context:', err);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (mounted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchReports();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchContext();
    }
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    if (!editingId) {
        if (!todaySchedule || !todaySchedule.shift_mulai || !todaySchedule.shift_selesai) {
          setNotification({
              type: 'WARNING',
              message: 'Jadwal Tidak Ditemukan',
              submessage: 'Sistem tidak menemukan jadwal WFH Anda hari ini. Pastikan jadwal sudah disetujui dan data shift valid.'
          });
          return;
        }

        const [hMasuk, mMasuk] = todaySchedule.shift_mulai.split(':').map(Number);
        const [hPulang, mPulang] = todaySchedule.shift_selesai.split(':').map(Number);
        
        let timeMasuk = hMasuk * 60 + mMasuk;
        let timePulang = hPulang * 60 + mPulang;
        
        if (timePulang < timeMasuk) {
          timePulang += 1440; // Shift lewat tengah malam
        }
        
        const currentTime = now.getHours() * 60 + now.getMinutes();
        let testTime = currentTime;
        
        if (timePulang > 1440 && currentTime < (timePulang - 1440 + 180)) {
          testTime += 1440;
        }

        if (activeTab === 'RENCANA') {
          const limitRencana = timeMasuk + 60; // 1 jam setelah shift masuk
          
          if (testTime > limitRencana) {
            setNotification({
                type: 'WARNING',
                message: 'Batas Waktu Terlewati',
                submessage: `Pengiriman Rencana Kerja maksimal 1 jam setelah jam absensi masuk (${todaySchedule.shift_mulai}). Anda sudah melewati batas waktu.`
            });
            return;
          }
        } else if (activeTab === 'HASIL') {
          const limitHasilMulai = Math.max(timeMasuk, timePulang - 60); // 1 jam sebelum shift pulang
          const limitHasilAkhir = timePulang; // Sesuai permintaan, maksimal jam shift pulang
          
          if (testTime < limitHasilMulai) {
            setNotification({
                type: 'WARNING',
                message: 'Belum Waktunya',
                submessage: `Laporan Hasil Kerja hanya dapat dikirim mulai 1 jam sebelum jam absensi pulang (${todaySchedule.shift_selesai}).`
            });
            return;
          }
          
          if (testTime > limitHasilAkhir) {
            setNotification({
                type: 'WARNING',
                message: 'Batas Waktu Terlewati',
                submessage: `Pengiriman Laporan Hasil Kerja maksimal pada jam absensi pulang (${todaySchedule.shift_selesai}). Anda sudah melewati batas waktu pengiriman.`
            });
            return;
          }
        }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const today = new Date().toLocaleDateString('en-CA');

      if (editingId) {
        const { error } = await supabase
          .from('work_reports')
          .update({
            konten: content,
            lampiran: activeTab === 'HASIL' ? lampiran : null,
            status: 'PENDING',
            status_approval: 'PENDING'
          })
          .eq('id', editingId);
        
        if (error) throw error;
        setEditingId(null);
      } else {
        const { error } = await supabase.from('work_reports').insert({
          user_id: session.user.id,
          tanggal: today,
          tipe: activeTab,
          konten: content,
          lampiran: activeTab === 'HASIL' ? lampiran : null,
          status: 'PENDING'
        });

        if (error) throw error;
      }

      setContent('');
      setLampiran('');
      setIsSubmitted(true);
      fetchReports();
      setTimeout(() => setIsSubmitted(false), 3000);
    } catch (err: any) {
      setNotification({
          type: 'ERROR',
          message: 'Laporan Gagal Dikirim',
          submessage: 'Gagal mengirim laporan: ' + err.message
      });
    }
  };

  const handleDelete = async () => {
    if (!reportToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('work_reports').delete().eq('id', reportToDelete);
      if (error) throw error;
      
      fetchReports();
      setIsDeleteModalOpen(false);
      setReportToDelete(null);
    } catch (err: any) {
      setNotification({
          type: 'ERROR',
          message: 'Gagal Menghapus',
          submessage: 'Gagal menghapus laporan: ' + err.message
      });
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (id: string) => {
    setReportToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleEdit = (report: any) => {
    setEditingId(report.id);
    setContent(report.konten || report.content);
    setLampiran(report.lampiran || '');
    setActiveTab(report.tipe as any);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
                <h2 className="text-3xl font-display font-black text-slate-800 tracking-tight leading-none mb-2 italic">LAPORAN KERJA</h2>
                <p className="text-slate-500 font-medium">Dokumentasikan rencana dan capaian kinerja harian Anda selama WFH.</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button 
                    disabled={!!editingId}
                    onClick={() => setActiveTab('RENCANA')}
                    className={cn(
                        "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                        activeTab === 'RENCANA' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700",
                        editingId && "opacity-50 cursor-not-allowed"
                    )}
                >
                    Rencana Harian
                </button>
                <button 
                    disabled={!!editingId}
                    onClick={() => setActiveTab('HASIL')}
                    className={cn(
                        "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                        activeTab === 'HASIL' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700",
                        editingId && "opacity-50 cursor-not-allowed"
                    )}
                >
                    Hasil Capaian
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="dashboard-card relative overflow-hidden">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                        {activeTab === 'RENCANA' ? <CalendarIcon size={20} /> : <BadgeCheck size={20} />}
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-800 tracking-tight uppercase italic">
                            {editingId ? 'Edit ' : 'Formulir '}
                            {activeTab === 'RENCANA' ? 'Rencana Kerja' : 'Laporan Capaian Kinerja'}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Tanggal: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 italic">
                           {activeTab === 'RENCANA' ? 'Rincian Kegiatan Yang Direncanakan' : 'Uraian Hasil/Output Yang Dicapai'}
                        </label>
                        <textarea 
                            rows={8}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={activeTab === 'RENCANA' 
                                ? "Contoh: Melakukan verifikasi data ASN bagian umum, Menyusun draf surat edaran..."
                                : "Contoh: Selesai melakukan verifikasi 50 data ASN, Draf SE sudah dikirim ke Kabag..."
                            }
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                        />
                    </div>
                    
                    {activeTab === 'HASIL' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 italic">
                               Tautan Bukti Kerja / Lampiran (Opsional)
                            </label>
                            <input 
                                type="url"
                                value={lampiran}
                                onChange={(e) => setLampiran(e.target.value)}
                                placeholder="Contoh: https://drive.google.com/..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                            />
                            <p className="text-[10px] text-slate-500 mt-2 font-medium">Jika ukuran file terlalu besar, kami sangat menyarankan mengunggahnya ke Google Drive/OneDrive lalu tautkan pada isian di atas.</p>
                        </div>
                    )}

                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                        <Clock size={20} className="text-amber-500 shrink-0" />
                        <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wide leading-relaxed">
                            {activeTab === 'RENCANA' 
                              ? `Batas pengiriman maksimal 1 jam setelah absensi masuk (${todaySchedule?.shift_mulai || '-'}).` 
                              : `Hanya dapat dikirim mulai 1 jam sebelum absensi pulang hingga jam absensi pulang (${todaySchedule?.shift_selesai || '-'}).`}
                        </p>
                    </div>

                    <div className="flex gap-2">
                        {editingId && (
                            <button 
                                type="button"
                                onClick={() => { setEditingId(null); setContent(''); }}
                                className="px-6 bg-slate-100 text-slate-600 rounded-2xl font-bold transition-all text-sm uppercase tracking-widest"
                            >
                                Batal
                            </button>
                        )}
                        <button 
                            type="submit"
                            disabled={!content.trim()}
                            className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50"
                        >
                            <Send size={18} />
                            {editingId ? 'Simpan Perubahan' : 'Kirim Laporan'}
                        </button>
                    </div>
                </form>

                {isSubmitted && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute inset-x-8 bottom-8 p-4 bg-emerald-500 text-white rounded-xl flex items-center gap-3 shadow-xl"
                    >
                        <CheckCircle size={20} />
                        <span className="text-sm font-bold">Laporan berhasil {editingId ? 'diperbarui' : 'terkirim'}!</span>
                    </motion.div>
                )}
            </div>

            {/* Reports List */}
            <div className="space-y-4">
                <h3 className="text-xl font-display font-bold text-slate-800 italic uppercase">Riwayat Laporan</h3>
                {isLoading ? (
                    <div className="text-center py-10 text-slate-400 font-bold italic tracking-widest text-xs animate-pulse">MEMUAT DATA...</div>
                ) : reports.length > 0 ? (
                    reports.map((report) => (
                        <motion.div 
                            key={report.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="dashboard-card p-5 border-l-4 border-indigo-500 hover:shadow-md transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <BadgeCheck size={16} className={cn("inline mr-2", report.tipe === 'HASIL' ? 'text-emerald-500' : 'text-blue-500')} />
                                    <span className="text-[10px] font-black uppercase italic tracking-widest text-slate-400">{report.tipe === 'RENCANA' ? 'Rencana Harian' : 'Capaian Kinerja'}</span>
                                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{new Date(report.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={cn(
                                        "text-[9px] font-black uppercase px-2 py-1 rounded",
                                        (report.status_approval || report.status) === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 
                                        (report.status_approval || report.status) === 'REVISION' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                    )}>
                                        {(report.status_approval || report.status) || 'PENDING'}
                                    </span>
                                    {((report.status_approval || report.status) === 'PENDING' || (report.status_approval || report.status) === 'REVISION' || !report.status) && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(report)} title="Edit Laporan" className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg"><Edit3 size={12} /></button>
                                            <button onClick={() => confirmDelete(report.id)} title="Hapus Laporan" className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg"><Trash2 size={12} /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{report.konten || report.content}</p>
                            {report.lampiran && (
                                <div className="mt-4 pt-3 border-t border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-2">Lampiran Bukti Kerja:</p>
                                    <a 
                                        href={report.lampiran}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all"
                                    >
                                        Buka Tautan Bukti Kerja
                                    </a>
                                </div>
                            )}
                            {(report.catatan_atasan || report.catatan) && (
                                <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                    <p className="text-[10px] font-black text-amber-800 tracking-widest uppercase mb-1 flex items-center gap-1">
                                        <AlertCircle size={12} /> Feedback Atasan:
                                    </p>
                                    <p className="text-xs font-medium text-amber-700">{report.catatan_atasan || report.catatan}</p>
                                </div>
                            )}
                        </motion.div>
                    ))
                ) : (
                    <div className="dashboard-card py-12 text-center border-dashed">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic tracking-tight">Belum ada riwayat laporan</p>
                    </div>
                )}
            </div>
          </div>

          {/* Guidelines */}
          <div className="space-y-6">
            <div className="dashboard-card border-indigo-100">
                <div className="flex items-center gap-2 mb-6">
                    <AlertCircle size={18} className="text-indigo-500" />
                    <h4 className="text-xs font-bold uppercase tracking-widest italic tracking-tight text-slate-800">Ketentuan Pelaporan</h4>
                </div>
                <ol className="space-y-4">
                    {[
                        'Isi rencana kerja maksimal 1 jam setelah jam absensi masuk WFH.',
                        'Lampirkan detail output yang konkrit.',
                        'Segala bentuk keterlambatan akan mempengaruhi tunjangan kinerja.',
                        'Laporan dengan status REVISION wajib diperbaiki segera.'
                    ].map((step, i) => (
                        <li key={i} className="flex gap-3 items-start">
                            <span className="text-indigo-500 font-black italic">0{i+1}</span>
                            <p className="text-xs text-slate-700 leading-relaxed font-semibold">{step}</p>
                        </li>
                    ))}
                </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-6 mx-auto">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-display font-black text-slate-800 text-center mb-2 italic">KONFIRMASI HAPUS</h3>
            <p className="text-slate-500 text-center text-sm font-medium mb-8">
              Apakah Anda yakin ingin menghapus laporan ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Batal
              </button>
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-6 py-4 rounded-2xl bg-red-600 text-white font-bold text-sm uppercase tracking-widest shadow-lg shadow-red-600/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Notification Modal */}
      {notification && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center"
          >
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center mb-6",
              notification.type === 'SUCCESS' ? "bg-emerald-50 text-emerald-600" :
              notification.type === 'WARNING' ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
            )}>
              {notification.type === 'SUCCESS' ? <CheckCircle size={40} /> :
               notification.type === 'WARNING' ? <AlertCircle size={40} /> : <AlertCircle size={40} />}
            </div>
            <h3 className="text-xl font-display font-black text-slate-800 mb-2 italic tracking-tight uppercase">
              {notification.message}
            </h3>
            <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
              {notification.submessage}
            </p>
            <button 
              onClick={() => setNotification(null)}
              className={cn(
                "w-full py-4 rounded-2xl text-white font-bold text-sm uppercase tracking-widest transition-all active:scale-95",
                notification.type === 'SUCCESS' ? "bg-emerald-600 shadow-emerald-600/20" :
                notification.type === 'WARNING' ? "bg-amber-600 shadow-amber-600/20" : "bg-red-600 shadow-red-600/20"
              )}
            >
              Mengerti
            </button>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
}
