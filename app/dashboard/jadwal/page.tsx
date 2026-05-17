'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase, Profile } from '@/lib/supabase';
import { 
    Calendar as CalendarIcon, 
    Plus, 
    Clock, 
    User, 
    Settings, 
    ChevronLeft, 
    ChevronRight,
    Search,
    Filter,
    ArrowUpRight,
    Trash2,
    X,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

interface WfhSchedule {
    id: string;
    user_id: string;
    tanggal: string;
    shift_mulai: string;
    shift_selesai: string;
    status: string;
    profiles?: {
        nama_lengkap: string;
        nip: string;
        jabatan: string;
        unit_kerja?: string;
    };
}

export default function JadwalPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().getDate());
  
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<WfhSchedule[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [formData, setFormData] = useState({
      id: '',
      user_id: '',
      shift_mulai: '07:30',
      shift_selesai: '16:00',
      status: 'PENDING'
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const loadData = async () => {
    setLoading(true);
    
    // Get current user profile
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (profile) setUserProfile(profile as Profile);
    }
    
    const { data: profilesData } = await supabase.from('profiles').select('*').order('nama_lengkap');
    if (profilesData) setProfiles(profilesData);

    const paddedMonth = String(month + 1).padStart(2, '0');
    const paddedDate = String(selectedDate).padStart(2, '0');
    const dateStr = `${year}-${paddedMonth}-${paddedDate}`;

    const { data: schedulesData, error } = await supabase
        .from('wfh_schedules')
        .select('*, profiles!wfh_schedules_user_id_fkey(nama_lengkap, nip, jabatan, unit_kerja)')
        .eq('tanggal', dateStr);
        
    if (error) {
        console.error('Error loadData schedules:', error);
    }
    if (schedulesData) setSchedules(schedulesData as WfhSchedule[]);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, selectedDate]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const paddedMonth = String(month + 1).padStart(2, '0');
    const paddedDate = String(selectedDate).padStart(2, '0');
    const dateStr = `${year}-${paddedMonth}-${paddedDate}`;

    if (formData.id) {
        // Update
        const { error } = await supabase.from('wfh_schedules').update({
            shift_mulai: formData.shift_mulai,
            shift_selesai: formData.shift_selesai,
            status: formData.status
        }).eq('id', formData.id);
        if (error) {
            console.error('Update error:', error);
            alert(`Gagal update: ${error.message}`);
        }
    } else {
        // Insert
        const { error } = await supabase.from('wfh_schedules').insert({
            user_id: formData.user_id,
            tanggal: dateStr,
            shift_mulai: formData.shift_mulai,
            shift_selesai: formData.shift_selesai,
            status: formData.status
        });
        if (error) {
            console.error('Insert error:', error);
            alert(`Gagal menyimpan: ${error.message}`);
        }
    }
    
    setShowModal(false);
    loadData();
  };

  const handleDelete = async () => {
      if (deleteConfirmId) {
          const { error } = await supabase.from('wfh_schedules').delete().eq('id', deleteConfirmId);
          if (error) {
              console.error('Delete error:', error);
              alert(`Gagal menghapus: ${error.message}`);
          }
          setDeleteConfirmId(null);
          loadData();
      }
  };

  const openForm = (schedule?: WfhSchedule) => {
      if (schedule) {
          setFormData({
              id: schedule.id,
              user_id: schedule.user_id,
              shift_mulai: schedule.shift_mulai,
              shift_selesai: schedule.shift_selesai,
              status: schedule.status
          });
      } else {
          setFormData({
              id: '',
              user_id: profiles[0]?.id || '',
              shift_mulai: '07:30',
              shift_selesai: '16:00',
              status: 'PENDING'
          });
      }
      setShowModal(true);
  };

  const canEdit = userProfile?.role === 'ADMIN';
  const canApprove = userProfile?.role === 'ATASAN';

  const handleApprove = async (id: string, user_id: string, status: 'CONFIRMED' | 'CANCELLED') => {
      const { error } = await supabase.from('wfh_schedules').update({ status }).eq('id', id);
      if (error) {
          console.error('Update error:', error);
          alert(`Gagal update status: ${error.message}`);
      } else {
          await supabase.from('notifications').insert({
              user_id: user_id,
              judul: 'Status Jadwal WFH',
              pesan: status === 'CONFIRMED' ? 'Jadwal WFH telah disetujui atasan.' : 'Jadwal WFH ditolak atasan.',
              is_read: false
          });
          loadData();
      }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 relative">
        <div className="flex justify-between items-end">
            <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-none mb-1">Pengaturan Jadwal</h2>
                <p className="text-xs text-slate-500 font-medium">Ploting tugas WFH dan penetapan jam operasional shift pegawai.</p>
            </div>
            {canEdit && (
                <button 
                    onClick={() => openForm()}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus size={16} />
                    Tambah Plot
                </button>
            )}
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 auto-rows-[auto]">
          {/* Calendar Widget */}
          <div className="md:col-span-4 md:row-span-4 dashboard-card flex flex-col h-[380px]">
                <div className="flex items-center justify-between mb-8">
                    <span className="text-sm font-bold text-slate-800 tracking-tight uppercase">
                        {currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </span>
                    <div className="flex gap-1">
                        <button onClick={prevMonth} className="p-1 hover:bg-slate-50 rounded text-slate-400 transition-colors"><ChevronLeft size={16} /></button>
                        <button onClick={nextMonth} className="p-1 hover:bg-slate-50 rounded text-slate-400 transition-colors"><ChevronRight size={16} /></button>
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center mb-4">
                    {days.map(d => <span key={d} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1 flex-1">
                    {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                        <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => (
                        <button 
                            key={i}
                            onClick={() => setSelectedDate(i+1)}
                            className={cn(
                                "aspect-square flex items-center justify-center text-xs font-bold rounded-lg transition-all",
                                selectedDate === i+1 ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-600 hover:bg-slate-50",
                                i+1 === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear() && selectedDate !== i+1 ? "text-indigo-600 border border-indigo-100 bg-indigo-50" : ""
                            )}
                        >
                            {i+1}
                        </button>
                    ))}
                </div>
          </div>

          {/* Shift Table Section */}
          <div className="md:col-span-8 md:row-span-5 dashboard-card p-0 overflow-hidden flex flex-col min-h-[380px]">
              <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-50">
                  <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                      Daftar Penugasan - {selectedDate} {currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                  </h4>
                  <div className="flex items-center gap-2">
                       <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input placeholder="Cari Pegawai..." className="bg-slate-50 border border-slate-200 text-xs rounded-lg pl-9 pr-4 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500" />
                      </div>
                  </div>
              </div>

              <div className="overflow-x-auto flex-1">
                  {loading ? (
                       <div className="flex mt-10 justify-center">
                           <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                       </div>
                  ) : schedules.length > 0 ? (
                      <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50/50">
                              <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  <th className="px-6 py-4">Pegawai</th>
                                  <th className="px-6 py-4">Status</th>
                                  <th className="px-6 py-4">Jam Shift</th>
                                  {(canEdit || canApprove) && <th className="px-6 py-4 text-right">Aksi</th>}
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {schedules.map((row) => (
                                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                      <td className="px-6 py-4">
                                          <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                                  <User size={16} />
                                              </div>
                                              <div>
                                                  <p className="text-xs font-bold text-slate-800 leading-none mb-1">
                                                      {Array.isArray(row.profiles) ? row.profiles[0]?.nama_lengkap : row.profiles?.nama_lengkap}
                                                  </p>
                                                  <p className="text-[10px] font-medium text-slate-500">
                                                      NIP. {Array.isArray(row.profiles) ? row.profiles[0]?.nip : row.profiles?.nip} • {Array.isArray(row.profiles) ? row.profiles[0]?.unit_kerja : row.profiles?.unit_kerja || 'Tidak ada unit'}
                                                  </p>
                                              </div>
                                          </div>
                                      </td>
                                      <td className="px-6 py-4">
                                          <span className={cn(
                                              "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider",
                                              row.status === 'CONFIRMED' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                                              : row.status === 'CANCELLED' ? "bg-rose-50 text-rose-600 border border-rose-100"
                                              : "bg-amber-50 text-amber-600 border border-amber-100"
                                          )}>
                                              {row.status}
                                          </span>
                                      </td>
                                      <td className="px-6 py-4">
                                          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                              <Clock size={12} className="text-slate-400" />
                                              {row.shift_mulai.slice(0, 5)} - {row.shift_selesai.slice(0, 5)}
                                          </div>
                                      </td>
                                      {(canEdit || canApprove) && (
                                          <td className="px-6 py-4 text-right">
                                              {canApprove && row.status === 'PENDING' && (
                                                  <div className="flex justify-end gap-2">
                                                      <button 
                                                          onClick={() => handleApprove(row.id, row.user_id, 'CONFIRMED')}
                                                          className="px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                                      >
                                                          Setujui
                                                      </button>
                                                      <button 
                                                          onClick={() => handleApprove(row.id, row.user_id, 'CANCELLED')}
                                                          className="px-3 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
                                                      >
                                                          Tolak
                                                      </button>
                                                  </div>
                                              )}
                                              {canEdit && (
                                                  <div className="flex justify-end gap-2">
                                                      <button onClick={() => openForm(row)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                                                          <Settings size={14} />
                                                      </button>
                                                      <button onClick={() => setDeleteConfirmId(row.id)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600 transition-colors">
                                                          <Trash2 size={14} />
                                                      </button>
                                                  </div>
                                              )}
                                          </td>
                                      )}
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  ) : (
                      <div className="flex flex-col items-center justify-center p-10 text-slate-400 mt-4">
                          <CalendarIcon size={32} className="mb-4 opacity-50" />
                          <p className="text-sm font-medium">Belum ada jadwal WFH untuk tanggal ini.</p>
                      </div>
                  )}
              </div>
          </div>

          {/* Stats Summary Bento Items */}
          <div className="md:col-span-4 md:row-span-2 Dashboard-card bg-indigo-600 rounded-2xl p-6 text-white flex flex-col justify-between shadow-xl shadow-indigo-600/20">
              <div className="flex justify-between items-start">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">Jadwal WFH Hari Ini</p>
                  <ArrowUpRight size={16} className="text-indigo-300" />
              </div>
              <div className="mt-4">
                  <h3 className="text-3xl font-bold tracking-tight">{schedules.length} <span className="text-sm font-normal text-indigo-200">Asn</span></h3>
                  <div className="w-full bg-white/20 h-1.5 rounded-full mt-4">
                      <div className="bg-white h-full rounded-full" style={{ width: `${Math.min((schedules.length / 20) * 100, 100)}%` }} />
                  </div>
              </div>
          </div>
        </div>
      </div>

      {/* Check/Form Modal */}
      <AnimatePresence>
          {showModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                  <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden"
                  >
                      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                              {formData.id ? 'Edit Jadwal WFH' : 'Tambah Jadwal WFH'}
                          </h3>
                          <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                              <X size={16} />
                          </button>
                      </div>
                      <form onSubmit={handleSave} className="p-6 space-y-4">
                          {!formData.id && (
                              <div>
                                  <label className="block text-xs font-bold text-slate-700 tracking-tight mb-1.5">Pegawai</label>
                                  <select 
                                      required
                                      value={formData.user_id}
                                      onChange={(e) => setFormData({...formData, user_id: e.target.value})}
                                      className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                                  >
                                      {profiles.map(p => (
                                          <option key={p.id} value={p.id}>{p.nama_lengkap} - {p.nip}</option>
                                      ))}
                                  </select>
                              </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-700 tracking-tight mb-1.5">Jam Mulai</label>
                                  <input 
                                      type="time" 
                                      required
                                      value={formData.shift_mulai}
                                      onChange={(e) => setFormData({...formData, shift_mulai: e.target.value})}
                                      className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-700 tracking-tight mb-1.5">Jam Selesai</label>
                                  <input 
                                      type="time" 
                                      required
                                      value={formData.shift_selesai}
                                      onChange={(e) => setFormData({...formData, shift_selesai: e.target.value})}
                                      className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                                  />
                              </div>
                          </div>

                          <div>
                              <label className="block text-xs font-bold text-slate-700 tracking-tight mb-1.5">Status</label>
                              <select 
                                  value={formData.status}
                                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                                  className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                              >
                                  <option value="PENDING">PENDING</option>
                                  <option value="CONFIRMED">CONFIRMED</option>
                                  <option value="CANCELLED">CANCELLED</option>
                              </select>
                          </div>

                          <div className="pt-4 flex gap-3">
                              <button 
                                  type="button" 
                                  onClick={() => setShowModal(false)}
                                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                              >
                                  Batal
                              </button>
                              <button 
                                  type="submit" 
                                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                              >
                                  Simpan
                              </button>
                          </div>
                      </form>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
          {deleteConfirmId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)} />
                  <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white rounded-2xl shadow-xl w-full max-w-sm relative z-10 overflow-hidden p-6 text-center"
                  >
                      <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                          <Trash2 size={24} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">Hapus Jadwal?</h3>
                      <p className="text-sm text-slate-500 mb-6">Tindakan ini tidak dapat dibatalkan. Jadwal WFH ini akan dihapus secara permanen.</p>
                      <div className="flex gap-3">
                          <button 
                              onClick={() => setDeleteConfirmId(null)}
                              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                          >
                              Batal
                          </button>
                          <button 
                              onClick={handleDelete}
                              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20"
                          >
                              Hapus
                          </button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

