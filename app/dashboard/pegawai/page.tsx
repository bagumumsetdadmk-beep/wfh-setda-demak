/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
    Users, 
    UserPlus, 
    Search, 
    Shield, 
    User as UserIcon,
    Mail,
    Edit2,
    Trash2,
    X,
    Loader2,
    AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase, Profile, BAGIAN_LIST } from '@/lib/supabase';

interface PegawaiFormData {
    id?: string;
    nip: string;
    nama_lengkap: string;
    jabatan: string;
    unit_kerja: string;
    role: 'ADMIN' | 'ATASAN' | 'PEGAWAI';
    password?: string;
}

export default function PegawaiPage() {
    const [pegawai, setPegawai] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'PEGAWAI' | 'ATASAN' | 'ADMIN' | 'ALL'>('ALL');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [pegawaiToDelete, setPegawaiToDelete] = useState<{ id: string; nip: string; nama_lengkap: string } | null>(null);
    const [formData, setFormData] = useState<PegawaiFormData>({
        nip: '',
        nama_lengkap: '',
        jabatan: '',
        unit_kerja: '',
        role: 'PEGAWAI',
        password: 'password123'
    });
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPegawai = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('nama_lengkap', { ascending: true });
        
        if (error) {
            console.error('Error fetching pegawai:', error);
        } else {
            setPegawai(data as Profile[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchPegawai();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setError(null);

        try {
            const method = formData.id ? 'PUT' : 'POST';
            const res = await fetch('/api/pegawai', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await res.text();
                throw new Error(`Server tidak mengembalikan JSON. Response: ${text.substring(0, 50)}...`);
            }

            const result = await res.json();
            
            if (!res.ok) {
                throw new Error(result.error || 'Terjadi kesalahan sistem');
            }

            setIsModalOpen(false);
            fetchPegawai();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setFormLoading(false);
        }
    };

    const promptDelete = (asn: Profile) => {
        setPegawaiToDelete({ id: asn.id, nip: asn.nip, nama_lengkap: asn.nama_lengkap });
        setError(null);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!pegawaiToDelete) return;
        setFormLoading(true);
        setError(null);
        
        try {
            const res = await fetch(`/api/pegawai?id=${pegawaiToDelete.id}`, {
                method: 'DELETE',
            });
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error(`Server tidak mengembalikan JSON.`);
            }
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            
            setDeleteModalOpen(false);
            setPegawaiToDelete(null);
            fetchPegawai();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setFormLoading(false);
        }
    };

    const openCreateModal = () => {
        setFormData({
            nip: '',
            nama_lengkap: '',
            jabatan: '',
            unit_kerja: '',
            role: 'PEGAWAI',
            password: 'password123'
        });
        setError(null);
        setIsModalOpen(true);
    };

    const openEditModal = (p: Profile) => {
        setFormData({
            id: p.id,
            nip: p.nip,
            nama_lengkap: p.nama_lengkap,
            jabatan: p.jabatan || '',
            unit_kerja: p.unit_kerja || '',
            role: p.role,
        });
        setError(null);
        setIsModalOpen(true);
    };

    const filteredPegawai = pegawai
        .filter(p => activeTab === 'ALL' || p.role === activeTab)
        .filter(p => 
            p.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.nip.includes(searchTerm)
        );

    const stats = {
        total: pegawai.length,
        atasan: pegawai.filter(p => p.role === 'ATASAN').length,
        admin: pegawai.filter(p => p.role === 'ADMIN').length,
    };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-end">
            <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-none mb-1">Daftar Pegawai</h2>
                <p className="text-xs text-slate-500 font-medium">Manajemen data ASN Sekretariat Daerah Kabupaten Demak.</p>
            </div>
            <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
                <UserPlus size={16} />
                Pegawai Baru
            </button>
        </div>

        {/* Bento Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 auto-rows-[100px]">
            <div className="md:col-span-4 md:row-span-1 dashboard-card flex items-center gap-4 bg-white border-l-4 border-indigo-600">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Users size={20} />
                </div>
                <div>
                    <h4 className="text-xl font-bold text-slate-800 leading-none">{stats.total}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Personel</p>
                </div>
            </div>
            <div className="md:col-span-4 md:row-span-1 dashboard-card flex items-center gap-4 bg-white border-l-4 border-amber-500">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Shield size={20} />
                </div>
                <div>
                    <h4 className="text-xl font-bold text-slate-800 leading-none">{stats.atasan}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Atasan</p>
                </div>
            </div>
             <div className="md:col-span-4 md:row-span-1 dashboard-card flex items-center gap-4 bg-white border-l-4 border-emerald-500">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <UserIcon size={20} />
                </div>
                <div>
                    <h4 className="text-xl font-bold text-slate-800 leading-none">{stats.admin}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Admin</p>
                </div>
            </div>

            {/* List Table Section */}
            <div className="md:col-span-12 md:row-span-6 dashboard-card p-0 overflow-hidden flex flex-col mt-4">
                <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                     <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input 
                            type="text" 
                            placeholder="Cari NIP atau Nama..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 text-xs rounded-xl pl-10 pr-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                        />
                    </div>
                    <div className="flex gap-2">
                        <select 
                            value={activeTab}
                            onChange={(e) => setActiveTab(e.target.value as 'ALL' | 'PEGAWAI' | 'ATASAN' | 'ADMIN')}
                            className="bg-white border border-slate-100 text-xs text-slate-600 rounded-lg px-3 py-2 outline-none"
                        >
                            <option value="ALL">Semua Role</option>
                            <option value="PEGAWAI">Pegawai</option>
                            <option value="ATASAN">Atasan</option>
                            <option value="ADMIN">Admin</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto flex-1">
                    {loading ? (
                        <div className="flex justify-center items-center p-12">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50">
                                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    <th className="px-6 py-4">Nama / NIP</th>
                                    <th className="px-6 py-4">Jabatan</th>
                                    <th className="px-6 py-4">Unit Kerja</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredPegawai.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                                            Tidak ada data pegawai.
                                        </td>
                                    </tr>
                                ) : filteredPegawai.map((asn) => (
                                    <tr key={asn.id} className="hover:bg-slate-50/50 transition-all group">
                                        <td className="px-6 py-4 flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                                <img src={asn.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(asn.nama_lengkap)}&background=random`} alt="Ava" className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-800 leading-none mb-1">{asn.nama_lengkap}</p>
                                                <p className="text-[10px] font-medium text-slate-400">NIP. {asn.nip}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-[11px] font-medium text-slate-500">{asn.jabatan || '-'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-[11px] font-medium text-slate-500">{asn.unit_kerja || '-'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full",
                                                    asn.role === 'ADMIN' ? 'bg-indigo-600' : asn.role === 'ATASAN' ? 'bg-amber-500' : 'bg-slate-400'
                                                )} />
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{asn.role}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => openEditModal(asn)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => promptDelete(asn)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="p-4 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Menampilkan {filteredPegawai.length} Pegawai</p>
                </div>
            </div>
        </div>

        {/* Modal CRUD Pegawai */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-slate-800">
                            {formData.id ? 'Edit Pegawai' : 'Tambah Pegawai Baru'}
                        </h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <form onSubmit={handleSave} className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg">
                                {error}
                            </div>
                        )}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">NIP (atau ID Login)</label>
                            <input 
                                type="text"
                                required
                                maxLength={18}
                                value={formData.nip}
                                onChange={e => setFormData({...formData, nip: e.target.value})}
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                                placeholder="Contoh: 198501012010011001"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Maksimal 18 karakter. Jika atasan membawahi lebih dari 1 bagian, ubah digit terakhir (contoh: akhiran 1 jadi A) sebagai ID login kedua.</p>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Nama Lengkap</label>
                            <input 
                                type="text"
                                required
                                value={formData.nama_lengkap}
                                onChange={e => setFormData({...formData, nama_lengkap: e.target.value})}
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Jabatan</label>
                            <input 
                                type="text"
                                value={formData.jabatan}
                                onChange={e => setFormData({...formData, jabatan: e.target.value})}
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Unit Kerja</label>
                            <select 
                                value={formData.unit_kerja}
                                onChange={e => setFormData({...formData, unit_kerja: e.target.value})}
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 bg-white"
                            >
                                <option value="">Pilih Unit Kerja</option>
                                {BAGIAN_LIST.map(bagian => (
                                    <option key={bagian} value={bagian}>{bagian}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Role</label>
                            <select 
                                value={formData.role}
                                onChange={e => setFormData({...formData, role: e.target.value as any})}
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 bg-white"
                            >
                                <option value="PEGAWAI">PEGAWAI</option>
                                <option value="ATASAN">ATASAN</option>
                                <option value="ADMIN">ADMIN</option>
                            </select>
                        </div>
                        {!formData.id && (
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Password Default</label>
                                <input 
                                    type="text"
                                    required
                                    value={formData.password}
                                    onChange={e => setFormData({...formData, password: e.target.value})}
                                    className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500 bg-slate-50"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Pegawai dapat login dengan NIP dan password ini.</p>
                            </div>
                        )}
                        <div className="pt-4 flex gap-2">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all font-medium"
                            >
                                Batal
                            </button>
                            <button 
                                type="submit" 
                                disabled={formLoading}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {formLoading && <Loader2 size={16} className="animate-spin" />}
                                Simpan
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Modal Konfirmasi Delete */}
        {deleteModalOpen && pegawaiToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-6">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-display font-black text-slate-800 mb-2 tracking-tight">Hapus Pegawai?</h3>
                    <p className="text-slate-500 text-sm font-medium mb-1">
                        Anda yakin ingin menghapus data pegawai <span className="font-bold text-slate-800">{pegawaiToDelete.nama_lengkap}</span>?
                    </p>
                    <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider mb-8">
                        Tindakan ini tidak dapat dibatalkan.
                    </p>

                    {error && (
                        <div className="w-full mb-6 p-3 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg text-left">
                            {error}
                        </div>
                    )}

                    <div className="w-full flex gap-3">
                        <button 
                            onClick={() => {
                                setDeleteModalOpen(false);
                                setPegawaiToDelete(null);
                                setError(null);
                            }}
                            disabled={formLoading}
                            className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50"
                        >
                            Batal
                        </button>
                        <button 
                            onClick={confirmDelete}
                            disabled={formLoading}
                            className="flex-1 py-3 rounded-2xl bg-rose-600 shadow-rose-600/20 text-white font-bold text-xs uppercase tracking-widest transition-all hover:bg-rose-700 disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {formLoading ? <Loader2 size={16} className="animate-spin" /> : 'Hapus'}
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </DashboardLayout>
  );
}
