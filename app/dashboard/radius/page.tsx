'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  MapPin, 
  Navigation, 
  Sliders, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  RefreshCw, 
  Save, 
  Home, 
  Radio, 
  HelpCircle, 
  Loader2, 
  Info,
  Edit2,
  Trash2,
  Settings,
  Sparkles,
  Compass,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { supabase, Profile, BAGIAN_LIST } from '@/lib/supabase';
import { AppRadiusSettings, DEFAULT_RADIUS_SETTINGS, EmployeeRadiusConfig, formatDistance } from '@/lib/geoDistance';

export default function RadiusSettingsPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [radiusSettings, setRadiusSettings] = useState<AppRadiusSettings>(DEFAULT_RADIUS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'ENTRI_PEGAWAI' | 'GLOBAL' | 'TABEL_SEMUA'>('ENTRI_PEGAWAI');

  // Selected employee for custom radius entry form
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [selectedBagian, setSelectedBagian] = useState<string>('SEMUA');
  const [filterRadiusType, setFilterRadiusType] = useState<'SEMUA' | 'CUSTOM' | 'DEFAULT' | 'FLEXIBLE'>('SEMUA');

  // Form states for individual employee
  const [formRadiusMeter, setFormRadiusMeter] = useState<number>(200);
  const [formGpsTolerance, setFormGpsTolerance] = useState<number>(150);
  const [formLokasiNama, setFormLokasiNama] = useState<string>('');
  const [formLatitude, setFormLatitude] = useState<string>('');
  const [formLongitude, setFormLongitude] = useState<string>('');
  const [formIsFlexible, setFormIsFlexible] = useState<boolean>(false);
  const [formCatatan, setFormCatatan] = useState<string>('');
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [isFetchingLastAttendance, setIsFetchingLastAttendance] = useState<boolean>(false);

  // Form states for global settings
  const [globalRadius, setGlobalRadius] = useState<number>(200);
  const [globalGpsTolerance, setGlobalGpsTolerance] = useState<number>(150);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // 1. Fetch profiles
      const { data: pData, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .order('nama_lengkap', { ascending: true });

      if (pError) throw pError;
      setProfiles(pData as Profile[] || []);

      // 2. Fetch radius settings
      const res = await fetch('/api/radius-settings');
      if (res.ok) {
        const config: AppRadiusSettings = await res.json();
        setRadiusSettings(config);
        setGlobalRadius(config.default_radius || 200);
        setGlobalGpsTolerance(config.default_gps_tolerance || 150);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setErrorMessage('Gagal memuat data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial data on mount without synchronous setState in effect
  useEffect(() => {
    let ignore = false;
    const loadInitialData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/');
          return;
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        const email = session.user.email || '';
        const isAdmin = profileData?.role === 'ADMIN' || email.toLowerCase().includes('admin');
        if (!isAdmin) {
          router.push('/dashboard');
          return;
        }

        const { data: pData, error: pError } = await supabase
          .from('profiles')
          .select('*')
          .order('nama_lengkap', { ascending: true });

        if (pError) throw pError;
        if (!ignore && pData) {
          setProfiles(pData as Profile[]);
        }

        const res = await fetch('/api/radius-settings');
        if (res.ok) {
          const config: AppRadiusSettings = await res.json();
          if (!ignore) {
            setRadiusSettings(config);
            setGlobalRadius(config.default_radius || 200);
            setGlobalGpsTolerance(config.default_gps_tolerance || 150);
          }
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        if (!ignore) {
          setErrorMessage('Gagal memuat data: ' + err.message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadInitialData();
    return () => {
      ignore = true;
    };
  }, []);

  // Handler for selecting an employee and populating the form
  const handleSelectProfile = (id: string, customRadiusConfig?: AppRadiusSettings) => {
    setSelectedProfileId(id);
    const activeRadiusSettings = customRadiusConfig || radiusSettings;
    if (!id) {
      setFormRadiusMeter(activeRadiusSettings.default_radius || 200);
      setFormGpsTolerance(activeRadiusSettings.default_gps_tolerance || 150);
      setFormLokasiNama('');
      setFormLatitude('');
      setFormLongitude('');
      setFormIsFlexible(false);
      setFormCatatan('');
      return;
    }

    const p = profiles.find(item => item.id === id);
    if (!p) return;

    // Check if employee already has custom radius
    const custom = activeRadiusSettings.pegawai_radius[p.id] || activeRadiusSettings.pegawai_radius[p.nip];
    if (custom) {
      setFormRadiusMeter(custom.radius_meter || activeRadiusSettings.default_radius || 200);
      setFormGpsTolerance(custom.toleransi_gps_meter || activeRadiusSettings.default_gps_tolerance || 150);
      setFormLokasiNama(custom.lokasi_nama || '');
      setFormLatitude(custom.latitude !== null && custom.latitude !== undefined ? String(custom.latitude) : '');
      setFormLongitude(custom.longitude !== null && custom.longitude !== undefined ? String(custom.longitude) : '');
      setFormIsFlexible(!!custom.is_flexible);
      setFormCatatan(custom.catatan_kondisi || '');
    } else {
      setFormRadiusMeter(activeRadiusSettings.default_radius || 200);
      setFormGpsTolerance(activeRadiusSettings.default_gps_tolerance || 150);
      setFormLokasiNama(`Rumah WFH - ${p.nama_lengkap}`);
      setFormLatitude('');
      setFormLongitude('');
      setFormIsFlexible(false);
      setFormCatatan('');
    }
  };

  // Handle detecting current GPS location for the form
  const handleDetectCurrentGps = () => {
    if (!navigator.geolocation) {
      alert('Browser Anda tidak mendukung Geolocation.');
      return;
    }

    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormLatitude(pos.coords.latitude.toFixed(6));
        setFormLongitude(pos.coords.longitude.toFixed(6));
        setIsDetectingGps(false);
        setSuccessMessage(`Titik koordinat berhasil dideteksi: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)} (Akurasi: ±${Math.round(pos.coords.accuracy)}m)`);
        setTimeout(() => setSuccessMessage(null), 4000);
      },
      (err) => {
        setIsDetectingGps(false);
        alert('Gagal mendeteksi lokasi GPS: ' + err.message + '. Pastikan izin lokasi diberikan.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle fetching last attendance coordinate for selected employee
  const handleFetchLastAttendance = async () => {
    if (!selectedProfileId) return;
    setIsFetchingLastAttendance(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('latitude, longitude, geotag, waktu_absen')
        .eq('user_id', selectedProfileId)
        .order('waktu_absen', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data && data.latitude && data.longitude) {
        setFormLatitude(Number(data.latitude).toFixed(6));
        setFormLongitude(Number(data.longitude).toFixed(6));
        if (data.geotag?.address && !formLokasiNama) {
          setFormLokasiNama(data.geotag.address);
        }
        setSuccessMessage(`Berhasil mengambil titik koordinat dari riwayat absen terakhir (${new Date(data.waktu_absen).toLocaleDateString('id-ID')})`);
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        alert('Belum ada riwayat absensi dengan koordinat untuk pegawai ini.');
      }
    } catch (err: any) {
      alert('Gagal mengambil riwayat absen: ' + err.message);
    } finally {
      setIsFetchingLastAttendance(false);
    }
  };

  // Save individual employee radius
  const handleSavePegawaiRadius = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileId) {
      alert('Pilih pegawai terlebih dahulu.');
      return;
    }

    const p = profiles.find(item => item.id === selectedProfileId);
    if (!p) return;

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: EmployeeRadiusConfig = {
        user_id: p.id,
        nip: p.nip,
        nama_lengkap: p.nama_lengkap,
        unit_kerja: p.unit_kerja,
        radius_meter: Number(formRadiusMeter) || 200,
        toleransi_gps_meter: Number(formGpsTolerance) || 150,
        lokasi_nama: formLokasiNama || `Rumah WFH - ${p.nama_lengkap}`,
        latitude: formLatitude ? parseFloat(formLatitude) : null,
        longitude: formLongitude ? parseFloat(formLongitude) : null,
        catatan_kondisi: formCatatan,
        is_flexible: formIsFlexible
      };

      const res = await fetch('/api/radius-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_pegawai',
          pegawai_config: payload
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Gagal menyimpan pengaturan');
      }

      const result = await res.json();
      setRadiusSettings(result.config);
      handleSelectProfile(p.id, result.config);
      setSuccessMessage(`Konfigurasi radius untuk ${p.nama_lengkap} berhasil disimpan! (Radius: ${formRadiusMeter}m, Toleransi GPS: ${formGpsTolerance}m)`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Reset employee radius to default
  const handleResetPegawaiRadius = async (pId: string, pNip: string, pName: string) => {
    if (!confirm(`Kembalikan radius absensi ${pName} ke Standar Default (${radiusSettings.default_radius}m)?`)) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/radius-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_pegawai',
          user_id_or_nip: pId
        })
      });

      if (!res.ok) throw new Error('Gagal mereset');
      const result = await res.json();
      setRadiusSettings(result.config);
      if (selectedProfileId === pId) {
        handleSelectProfile(pId, result.config);
      }
      setSuccessMessage(`Radius ${pName} dikembalikan ke Standar Default.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert('Gagal: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Save global radius settings
  const handleSaveGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/radius-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_global',
          default_radius: Number(globalRadius),
          default_gps_tolerance: Number(globalGpsTolerance)
        })
      });

      if (!res.ok) throw new Error('Gagal menyimpan pengaturan global');
      const result = await res.json();
      setRadiusSettings(result.config);
      setSuccessMessage('Pengaturan radius global dan batas sinyal GPS berhasil diperbarui untuk seluruh pegawai!');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Filtered employees for dropdown search
  const filteredProfilesForSelect = useMemo(() => {
    if (!employeeSearch.trim()) return profiles.slice(0, 30);
    const q = employeeSearch.toLowerCase();
    return profiles.filter(p => 
      p.nama_lengkap.toLowerCase().includes(q) || 
      p.nip.toLowerCase().includes(q) ||
      (p.unit_kerja && p.unit_kerja.toLowerCase().includes(q))
    ).slice(0, 50);
  }, [profiles, employeeSearch]);

  // Selected employee profile object
  const selectedProfile = useMemo(() => {
    return profiles.find(p => p.id === selectedProfileId);
  }, [profiles, selectedProfileId]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = profiles.length;
    let customCount = 0;
    let flexibleCount = 0;
    let withCoordsCount = 0;

    profiles.forEach(p => {
      const c = radiusSettings.pegawai_radius[p.id] || radiusSettings.pegawai_radius[p.nip];
      if (c) {
        customCount++;
        if (c.is_flexible) flexibleCount++;
        if (c.latitude && c.longitude) withCoordsCount++;
      }
    });

    return {
      total,
      customCount,
      flexibleCount,
      withCoordsCount,
      defaultCount: total - customCount
    };
  }, [profiles, radiusSettings]);

  // Filtered profiles for table
  const filteredTableData = useMemo(() => {
    return profiles.filter(p => {
      const custom = radiusSettings.pegawai_radius[p.id] || radiusSettings.pegawai_radius[p.nip];
      
      // Bagian filter
      if (selectedBagian !== 'SEMUA' && p.unit_kerja !== selectedBagian) {
        return false;
      }

      // Radius type filter
      if (filterRadiusType === 'CUSTOM' && !custom) return false;
      if (filterRadiusType === 'DEFAULT' && custom) return false;
      if (filterRadiusType === 'FLEXIBLE' && (!custom || !custom.is_flexible)) return false;

      // Search filter
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const matchName = p.nama_lengkap.toLowerCase().includes(q);
        const matchNip = p.nip.toLowerCase().includes(q);
        const matchBagian = (p.unit_kerja || '').toLowerCase().includes(q);
        const matchLoc = custom?.lokasi_nama?.toLowerCase().includes(q);
        return matchName || matchNip || matchBagian || matchLoc;
      }

      return true;
    });
  }, [profiles, radiusSettings, selectedBagian, filterRadiusType, tableSearch]);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <Compass size={22} className="animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider">Modul Presensi Geotagging WFH</span>
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none italic font-display">
              PENGATURAN RADIUS LOKASI ABSEN
            </h1>
            <p className="text-slate-500 text-sm mt-1.5 font-medium max-w-2xl">
              Form penentuan radius jangkauan absen &amp; batas toleransi GPS per pegawai. Solusi bagi pegawai WFH yang mengalami kesulitan sinyal GPS atau melebihi radius lokasi rumah.
            </p>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(loading && "animate-spin")} />
            <span>Segarkan Data</span>
          </button>
        </div>

        {/* Info Banner: Kebijakan Geotagging GPS Murni */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
              <CheckCircle2 size={22} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>Sistem Geotagging GPS &amp; Alamat Terdekat Aktif (Bebas Batasan Jarak)</span>
                <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold uppercase">Kebijakan Baru</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Sesuai kebijakan operasional terbaru, sistem <strong>tidak membatasi radius jarak antara rumah dan lokasi absensi</strong>. Pegawai di manapun berada dapat melakukan presensi secara langsung. Sistem secara otomatis merekam titik koordinat GPS asli perangkat (Latitude &amp; Longitude), akurasi sensor, serta mendeteksi alamat fisik/wilayah terdekat.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-[11px] font-bold text-slate-700">
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] shrink-0">✓</span>
                  <span>Absensi fleksibel di mana saja</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] shrink-0">✓</span>
                  <span>Koordinat &amp; alamat terdekat otomatis</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] shrink-0">✓</span>
                  <span>Tanpa risiko pegawai terblokir</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="dashboard-card p-4 border-l-4 border-l-indigo-600">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pegawai</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{stats.total}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Semua bagian terdaftar</p>
          </div>
          <div className="dashboard-card p-4 border-l-4 border-l-emerald-500">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Radius Khusus</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{stats.customCount}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Pegawai dengan radius custom</p>
          </div>
          <div className="dashboard-card p-4 border-l-4 border-l-blue-500">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Radius Default</p>
            <p className="text-2xl font-black text-blue-600 mt-1">{radiusSettings.default_radius} m</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Standar seluruh ASN ({stats.defaultCount} pegawai)</p>
          </div>
          <div className="dashboard-card p-4 border-l-4 border-l-amber-500">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toleransi GPS Default</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{radiusSettings.default_gps_tolerance} m</p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Batas maksimal akurasi sinyal</p>
          </div>
        </div>

        {/* Notifications */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-xs font-bold shadow-sm"
            >
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </motion.div>
          )}

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-3 text-xs font-bold shadow-sm"
            >
              <AlertTriangle size={18} className="text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab('ENTRI_PEGAWAI')}
            className={cn(
              "px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2",
              activeTab === 'ENTRI_PEGAWAI'
                ? "border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <MapPin size={16} />
            <span>Form Entri Radius Pegawai</span>
          </button>
          <button
            onClick={() => setActiveTab('GLOBAL')}
            className={cn(
              "px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2",
              activeTab === 'GLOBAL'
                ? "border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <Settings size={16} />
            <span>Pengaturan Radius Global / Standar</span>
          </button>
          <button
            onClick={() => setActiveTab('TABEL_SEMUA')}
            className={cn(
              "px-5 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2",
              activeTab === 'TABEL_SEMUA'
                ? "border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <Sliders size={16} />
            <span>Daftar Radius Seluruh Pegawai ({filteredTableData.length})</span>
          </button>
        </div>

        {/* TAB 1: FORM ENTRI RADIUS PEGAWAI (INDIVIDUAL) */}
        {activeTab === 'ENTRI_PEGAWAI' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column: Select Employee Card */}
            <div className="dashboard-card space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Search size={16} className="text-indigo-600" />
                  <span>1. Pilih Pegawai WFH</span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">Cari berdasarkan Nama, NIP, atau Bagian</p>
              </div>

              {/* Employee search filter */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ketik nama atau NIP pegawai..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* List of filtered employees */}
              <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                {filteredProfilesForSelect.map((p) => {
                  const hasCustom = !!(radiusSettings.pegawai_radius[p.id] || radiusSettings.pegawai_radius[p.nip]);
                  const customCfg = radiusSettings.pegawai_radius[p.id] || radiusSettings.pegawai_radius[p.nip];
                  const isSelected = selectedProfileId === p.id;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProfile(p.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1 border",
                        isSelected
                          ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-sm"
                          : "bg-white hover:bg-slate-50 border-transparent hover:border-slate-200"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">{p.nama_lengkap}</span>
                        {hasCustom ? (
                          <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">
                            {customCfg.radius_meter}m
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>NIP: {p.nip}</span>
                        <span className="text-[10px] truncate max-w-[120px]">{p.unit_kerja || '-'}</span>
                      </div>
                    </button>
                  );
                })}

                {filteredProfilesForSelect.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-400 font-medium">
                    Tidak ada pegawai yang cocok dengan kata kunci.
                  </div>
                )}
              </div>
            </div>

            {/* Middle & Right: Entri Form Fields */}
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleSavePegawaiRadius} className="dashboard-card space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <MapPin size={18} className="text-indigo-600" />
                      <span>2. Form Entri Radius &amp; Lokasi WFH</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {selectedProfile ? (
                        <span>Mengatur konfigurasi untuk: <strong className="text-indigo-600 font-bold">{selectedProfile.nama_lengkap}</strong> ({selectedProfile.nip})</span>
                      ) : (
                        <span className="italic text-amber-600">Pilih pegawai di sebelah kiri untuk mengisi form ini</span>
                      )}
                    </p>
                  </div>

                  {selectedProfile && (radiusSettings.pegawai_radius[selectedProfile.id] || radiusSettings.pegawai_radius[selectedProfile.nip]) && (
                    <button
                      type="button"
                      onClick={() => handleResetPegawaiRadius(selectedProfile.id, selectedProfile.nip, selectedProfile.nama_lengkap)}
                      disabled={saving}
                      className="text-xs text-red-600 hover:text-red-700 font-bold px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-all flex items-center gap-1.5"
                    >
                      <Trash2 size={13} />
                      <span>Kembalikan ke Default</span>
                    </button>
                  )}
                </div>

                {!selectedProfile ? (
                  <div className="py-16 text-center space-y-3 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                    <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                      <MapPin size={28} />
                    </div>
                    <p className="text-sm font-bold text-slate-700">Silakan Pilih Pegawai Terlebih Dahulu</p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
                      Pilih nama pegawai dari daftar di sebelah kiri untuk membuka form penyesuaian radius absen dan toleransi GPS rumahnya.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Pegawai Info Header Card */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pegawai Terpilih:</p>
                        <h4 className="text-sm font-bold text-slate-800">{selectedProfile.nama_lengkap}</h4>
                        <p className="text-xs text-slate-600 font-medium">NIP: {selectedProfile.nip} • {selectedProfile.unit_kerja || 'Setda Demak'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold",
                          (radiusSettings.pegawai_radius[selectedProfile.id] || radiusSettings.pegawai_radius[selectedProfile.nip])
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                        )}>
                          {(radiusSettings.pegawai_radius[selectedProfile.id] || radiusSettings.pegawai_radius[selectedProfile.nip])
                            ? "Radius Khusus Aktif"
                            : "Menggunakan Radius Standar"}
                        </span>
                      </div>
                    </div>

                    {/* Input Field 1: Radius Jarak Absen WFH */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Radio size={15} className="text-indigo-600" />
                          <span>Radius Jarak Absen WFH (Meter)</span>
                          <span className="text-red-500">*</span>
                        </label>
                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                          {formRadiusMeter} Meter
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-500 font-medium">
                        Jarak toleransi maksimal pegawai dapat melakukan absensi dari titik rumah/alamat WFH.
                      </p>

                      {/* Quick preset buttons */}
                      <div className="flex flex-wrap gap-2">
                        {[50, 100, 150, 200, 300, 500, 1000].map((rVal) => (
                          <button
                            key={rVal}
                            type="button"
                            onClick={() => setFormRadiusMeter(rVal)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                              formRadiusMeter === rVal
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            {rVal} m {rVal === 200 && '(Disarankan)'} {rVal >= 500 && '(Luas)'}
                          </button>
                        ))}
                      </div>

                      {/* Custom number slider / input */}
                      <div className="flex items-center gap-3 pt-1">
                        <input
                          type="range"
                          min={30}
                          max={2000}
                          step={10}
                          value={formRadiusMeter}
                          onChange={(e) => setFormRadiusMeter(Number(e.target.value))}
                          className="flex-1 accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                        />
                        <input
                          type="number"
                          min={20}
                          max={10000}
                          value={formRadiusMeter}
                          onChange={(e) => setFormRadiusMeter(Number(e.target.value))}
                          className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <span className="text-xs text-slate-500 font-bold">m</span>
                      </div>
                    </div>

                    {/* Input Field 2: Toleransi Akurasi Sinyal GPS */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Navigation size={15} className="text-amber-600" />
                          <span>Batas Toleransi Akurasi GPS (Meter)</span>
                          <span className="text-red-500">*</span>
                        </label>
                        <span className="text-xs font-black text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                          Maksimal ±{formGpsTolerance} Meter
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 font-medium">
                        Jika sinyal GPS di rumah pegawai lemah (misal atap seng/gang rapat), besarkan nilai ini (contoh 200m - 500m) agar tombol presensi tidak terkunci.
                      </p>

                      {/* Quick tolerance buttons */}
                      <div className="flex flex-wrap gap-2">
                        {[50, 100, 150, 200, 300, 500].map((tVal) => (
                          <button
                            key={tVal}
                            type="button"
                            onClick={() => setFormGpsTolerance(tVal)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                              formGpsTolerance === tVal
                                ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            ±{tVal} m {tVal === 50 && '(Ketat)'} {tVal === 150 && '(Disarankan)'} {tVal >= 300 && '(Sinyal Lemah)'}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <input
                          type="range"
                          min={30}
                          max={1000}
                          step={10}
                          value={formGpsTolerance}
                          onChange={(e) => setFormGpsTolerance(Number(e.target.value))}
                          className="flex-1 accent-amber-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                        />
                        <input
                          type="number"
                          min={20}
                          max={5000}
                          value={formGpsTolerance}
                          onChange={(e) => setFormGpsTolerance(Number(e.target.value))}
                          className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                        <span className="text-xs text-slate-500 font-bold">m</span>
                      </div>
                    </div>

                    {/* Input Field 3: Nama Lokasi / Alamat */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Home size={15} className="text-indigo-600" />
                        <span>Nama / Keterangan Alamat Lokasi WFH</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Rumah Kediaman - Jl. Kyai Singkil No. 12, Demak"
                        value={formLokasiNama}
                        onChange={(e) => setFormLokasiNama(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    {/* Input Field 4: Titik Koordinat Rumah Pegawai */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin size={15} className="text-emerald-600" />
                          <span>Titik Koordinat Rumah WFH (Latitude &amp; Longitude)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleDetectCurrentGps}
                            disabled={isDetectingGps}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                          >
                            <Navigation size={12} className={cn(isDetectingGps && "animate-spin")} />
                            <span>{isDetectingGps ? "Mendeteksi..." : "Ambil GPS Sekarang"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleFetchLastAttendance}
                            disabled={isFetchingLastAttendance}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                          >
                            <RefreshCw size={12} className={cn(isFetchingLastAttendance && "animate-spin")} />
                            <span>{isFetchingLastAttendance ? "Memuat..." : "Ambil Absen Terakhir"}</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block mb-1">Latitude:</span>
                          <input
                            type="text"
                            placeholder="Contoh: -6.894321"
                            value={formLatitude}
                            onChange={(e) => setFormLatitude(e.target.value)}
                            className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 block mb-1">Longitude:</span>
                          <input
                            type="text"
                            placeholder="Contoh: 110.638765"
                            value={formLongitude}
                            onChange={(e) => setFormLongitude(e.target.value)}
                            className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>

                      {/* Map preview embed if coordinates valid */}
                      {formLatitude && formLongitude && !isNaN(parseFloat(formLatitude)) && !isNaN(parseFloat(formLongitude)) && (
                        <div className="rounded-xl overflow-hidden border border-slate-200 aspect-[16/6] bg-slate-100 relative">
                          <iframe
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            style={{ border: 0 }}
                            src={`https://maps.google.com/maps?q=${formLatitude},${formLongitude}&hl=id&z=16&output=embed`}
                            allowFullScreen
                          ></iframe>
                          <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-700 shadow-sm">
                            Titik WFH: {parseFloat(formLatitude).toFixed(5)}, {parseFloat(formLongitude).toFixed(5)} • Radius: ±{formRadiusMeter}m
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Input Field 5: Mode Fleksibel Blank Spot */}
                    <div className="pt-2 border-t border-slate-100">
                      <label className="flex items-start gap-3 p-3 bg-amber-50/60 hover:bg-amber-50 border border-amber-200 rounded-xl cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={formIsFlexible}
                          onChange={(e) => setFormIsFlexible(e.target.checked)}
                          className="mt-0.5 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-amber-900 block">
                            Mode Fleksibel (Lokasi Khusus Sinyal GPS Lemah / Blank Spot)
                          </span>
                          <span className="text-[11px] text-amber-700 leading-relaxed font-medium block">
                            Centang opsi ini jika pegawai berada di wilayah pedesaan atau rumah dengan sinyal GPS yang sangat sering tidak stabil. Sistem akan mengizinkan absensi selama ada koordinat dan swafoto sah.
                          </span>
                        </div>
                      </label>
                    </div>

                    {/* Input Field 6: Catatan Penyesuaian */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Info size={15} className="text-slate-500" />
                        <span>Catatan / Alasan Khusus Penentuan Radius</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Contoh: Rumah berada di gang sempit dan padat penduduk, sinyal GPS indoor sering terhalang sehingga radius diperluas menjadi 300 meter."
                        value={formCatatan}
                        onChange={(e) => setFormCatatan(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    {/* Save Button */}
                    <div className="pt-4 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedProfileId('')}
                        className="w-full sm:w-auto px-5 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full sm:w-auto px-7 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {saving ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Menyimpan Konfigurasi...</span>
                          </>
                        ) : (
                          <>
                            <Save size={16} />
                            <span>Simpan Konfigurasi Radius Pegawai</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: PENGATURAN RADIUS GLOBAL / DEFAULT */}
        {activeTab === 'GLOBAL' && (
          <div className="max-w-2xl mx-auto dashboard-card space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 font-display">
                <Settings size={20} className="text-indigo-600" />
                <span>Pengaturan Radius Standar (Global)</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Nilai default yang otomatis berlaku untuk seluruh ASN yang belum ditentukan radius khusus secara individual.
              </p>
            </div>

            <form onSubmit={handleSaveGlobal} className="space-y-6">
              {/* Default Radius */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Radius Default Jangkauan WFH (Meter)
                  </label>
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    {globalRadius} Meter
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Radius toleransi standar kehadiran WFH dari titik koordinat bagi seluruh pegawai.
                </p>

                <div className="flex flex-wrap gap-2">
                  {[50, 100, 150, 200, 300, 500].map((rVal) => (
                    <button
                      key={rVal}
                      type="button"
                      onClick={() => setGlobalRadius(rVal)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                        globalRadius === rVal
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {rVal} m {rVal === 200 && '(Standar Baru Disarankan)'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="range"
                    min={50}
                    max={1000}
                    step={25}
                    value={globalRadius}
                    onChange={(e) => setGlobalRadius(Number(e.target.value))}
                    className="flex-1 accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    min={20}
                    max={5000}
                    value={globalRadius}
                    onChange={(e) => setGlobalRadius(Number(e.target.value))}
                    className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <span className="text-xs text-slate-500 font-bold">m</span>
                </div>
              </div>

              {/* Default GPS Tolerance */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Batas Toleransi Akurasi Sinyal GPS Default (Meter)
                  </label>
                  <span className="text-xs font-black text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    ±{globalGpsTolerance} Meter
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Batas maksimal sinyal akurasi GPS yang diterima sistem saat pegawai menekan tombol presensi.
                  Sebelumnya bernilai 50m (terlalu ketat). Disarankan disetel antara <strong>150m - 250m</strong> agar pegawai tidak terhambat.
                </p>

                <div className="flex flex-wrap gap-2">
                  {[50, 100, 150, 200, 250, 300].map((tVal) => (
                    <button
                      key={tVal}
                      type="button"
                      onClick={() => setGlobalGpsTolerance(tVal)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                        globalGpsTolerance === tVal
                          ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      ±{tVal} m {tVal === 150 && '(Disarankan)'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="range"
                    min={50}
                    max={500}
                    step={25}
                    value={globalGpsTolerance}
                    onChange={(e) => setGlobalGpsTolerance(Number(e.target.value))}
                    className="flex-1 accent-amber-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    min={20}
                    max={2000}
                    value={globalGpsTolerance}
                    onChange={(e) => setGlobalGpsTolerance(Number(e.target.value))}
                    className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-center focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <span className="text-xs text-slate-500 font-bold">m</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Terapkan Pengaturan Standar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: TABEL DAFTAR MONITORING RADIUS SELURUH PEGAWAI */}
        {activeTab === 'TABEL_SEMUA' && (
          <div className="dashboard-card space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 font-display">
                  <Sliders size={18} className="text-indigo-600" />
                  <span>Daftar Radius Lokasi Pegawai WFH</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Menampilkan seluruh ASN beserta radius dan toleransi sinyal lokasi yang aktif
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama / NIP..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none w-48"
                  />
                </div>

                {/* Filter Bagian */}
                <select
                  value={selectedBagian}
                  onChange={(e) => setSelectedBagian(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="SEMUA">Semua Bagian</option>
                  {BAGIAN_LIST.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>

                {/* Filter Status */}
                <select
                  value={filterRadiusType}
                  onChange={(e) => setFilterRadiusType(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="SEMUA">Semua Status</option>
                  <option value="CUSTOM">Radius Khusus Saja</option>
                  <option value="DEFAULT">Standar Default</option>
                  <option value="FLEXIBLE">Mode Fleksibel</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 px-3">Pegawai &amp; NIP</th>
                    <th className="pb-3 px-3">Unit Kerja</th>
                    <th className="pb-3 px-3">Radius Absen</th>
                    <th className="pb-3 px-3">Toleransi GPS</th>
                    <th className="pb-3 px-3">Titik Koordinat</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredTableData.map((p) => {
                    const custom = radiusSettings.pegawai_radius[p.id] || radiusSettings.pegawai_radius[p.nip];
                    const radiusMeter = custom ? custom.radius_meter : radiusSettings.default_radius;
                    const gpsTolerance = custom ? custom.toleransi_gps_meter : radiusSettings.default_gps_tolerance;
                    const hasCoordinates = !!(custom?.latitude && custom?.longitude);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800">{p.nama_lengkap}</div>
                          <div className="text-[11px] text-slate-400 font-mono">NIP: {p.nip}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {p.unit_kerja || '-'}
                        </td>
                        <td className="py-3 px-3">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-black",
                            custom 
                              ? "bg-indigo-100 text-indigo-800" 
                              : "bg-slate-100 text-slate-600"
                          )}>
                            {radiusMeter} Meter
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-black",
                            gpsTolerance > 150
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          )}>
                            ±{gpsTolerance} m
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {hasCoordinates ? (
                            <div className="text-[11px] text-emerald-700 font-mono">
                              {custom.latitude?.toFixed(4)}, {custom.longitude?.toFixed(4)}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Belum dikunci</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {custom?.is_flexible ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Fleksibel
                            </span>
                          ) : custom ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Khusus
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              Standar
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectProfile(p.id);
                                setActiveTab('ENTRI_PEGAWAI');
                              }}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                              title="Edit konfigurasi radius pegawai ini"
                            >
                              <Edit2 size={12} />
                              <span>Set Radius</span>
                            </button>
                            {custom && (
                              <button
                                type="button"
                                onClick={() => handleResetPegawaiRadius(p.id, p.nip, p.nama_lengkap)}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all"
                                title="Kembalikan ke standar default"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredTableData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                        Tidak ada pegawai yang sesuai dengan kriteria filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
