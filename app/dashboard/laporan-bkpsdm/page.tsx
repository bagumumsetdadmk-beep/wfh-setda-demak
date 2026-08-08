'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  FileText, 
  Printer, 
  RefreshCw,
  AlertCircle,
  ChevronDown,
  DollarSign,
  ShieldAlert,
  Sliders,
  Upload,
  Image as ImageIcon,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// Helper to get weeks in a month
const getWeeks = (year: number, month: number) => {
  const weeks = [
    { start: 1, end: 7 },
    { start: 8, end: 14 },
    { start: 15, end: 21 },
    { start: 22, end: new Date(year, month + 1, 0).getDate() }
  ];
  return weeks;
};

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

interface WeeklyStats {
  totalAsn: number;
  wfoCount: number;
  wfhScheduled: number;
  wfhValid: number;
  percentage: number;
}

export default function LaporanBKPSDMPage() {
  const [loading, setLoading] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<'evaluasi_wfh' | 'efisiensi_anggaran' | 'semua'>('evaluasi_wfh');
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<WeeklyStats[]>([]);

  // Kop Surat Image Upload State
  const [kopImageUrl, setKopImageUrl] = useState<string | null>(null);
  const kopFileInputRef = useRef<HTMLInputElement>(null);

  // Manual input state for customization
  const [manualInputs, setManualInputs] = useState({
    nomorSuratBKPSDM: '000.1.2/123/2026',
    nomorSuratBPKPAD: '000.1.2/124/2026',
    tanggalSurat: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    perangkatDaerah: 'SEKRETARIAT DAERAH',
    alamat: 'Jalan Kyai Singkil Nomor 7 Demak Kode Pos 59511',
    telepon: '(0291) 685877',
    faksimile: '(0291) 685625',
    laman: 'setda.demakkab.go.id',
    email: 'setda@demakkab.go.id',
    
    // Section B
    kepatuhanPagiOverride: '',
    kepatuhanSoreOverride: '',
    kualitasOutput: 'BAIK', // 'SANGAT_BAIK' | 'BAIK' | 'KURANG'
    penjelasanOutput: 'Sebagian besar target harian tercapai dan tugas kedinasan terselesaikan dengan baik.',

    // Section D
    catatanEfektivitas: 'Pelaksanaan WFH berjalan efektif, tidak mengganggu penyelesaian dokumen dinas dan justru meningkatkan fokus penyelesaian tugas kedinasan.',
    rekomendasi: 'Perlu sosialisasi berkala dan penguatan pengawasan melalui panggilan video call acak.',

    // Signature
    atasNama: 'a.n. Sekretaris Daerah',
    jabatanPengirim: 'Asisten Administrasi Umum',
    kepalaNama: 'Amir Mahmud, S.Sos.,M.T.',
    kepalaPangkat: 'Pembina Utama Muda',
    kepalaNip: '197003161990031003',

    // Section Efficiency Budget (BPKPAD)
    anggaran: [
      { id: '1', uraian: 'Listrik', bulanNMinus1: '15.200.000', bulanN: '13.800.000', keterangan: 'Penghematan penggunaan AC & penerangan kantor saat WFH' },
      { id: '2', uraian: 'Bahan Bakar Minyak (BBM)', bulanNMinus1: '8.500.000', bulanN: '7.100.000', keterangan: 'Efisiensi mobilitas operasional harian' },
      { id: '3', uraian: 'Air', bulanNMinus1: '3.400.000', bulanN: '2.900.000', keterangan: 'Penurunan konsumsi air bersih operasional gedung' },
      { id: '4', uraian: 'Telepon', bulanNMinus1: '1.800.000', bulanN: '1.800.000', keterangan: 'Penggunaan sarana komunikasi digital resmi' }
    ]
  });

  // Section C: Sanctions Data (8 standard categories from SE Bupati No 6 Tahun 2026)
  const [sanctions, setSanctions] = useState([
    { id: 1, jenis: 'Tidak mengirim swafoto geotagging pagi/sore', jumlah: 0, tindakLanjut: 'Diberikan teguran / Dianulir kehadiran WFH-nya / Dicabut hak WFH-nya' },
    { id: 2, jenis: 'Tidak mengirimkan laporan rencana kerja (pagi)', jumlah: 0, tindakLanjut: 'Diberikan teguran lisan & peringatan' },
    { id: 3, jenis: 'Tidak mengirimkan laporan bukti kinerja (sore)', jumlah: 0, tindakLanjut: 'Dianulir kehadiran WFH hari tersebut' },
    { id: 4, jenis: 'Tidak merespons komunikasi WA (SLA 30 menit)', jumlah: 0, tindakLanjut: 'Diberikan peringatan tertulis' },
    { id: 5, jenis: 'Menolak / Tidak mengangkat panggilan Video Call', jumlah: 0, tindakLanjut: 'Dianulir hak WFH minggu berikutnya' },
    { id: 6, jenis: 'Tidak memenuhi panggilan untuk hadir ke kantor', jumlah: 0, tindakLanjut: 'Surat teguran tertulis dari Atasan' },
    { id: 7, jenis: 'Terbukti berada di luar domisili untuk urusan pribadi', jumlah: 0, tindakLanjut: 'Dicabut hak WFH-nya' },
    { id: 8, jenis: 'Lainnya (tuliskan)', jumlah: 0, tindakLanjut: 'Pembinaan disiplin ASN' }
  ]);

  const reportRef = useRef<HTMLDivElement>(null);

  // Load stored kop image from localStorage on mount
  useEffect(() => {
    const savedKop = localStorage.getItem('sijambu_kop_surat_image');
    if (savedKop) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKopImageUrl(savedKop);
    }
  }, []);

  // Handle Kop Upload
  const handleKopUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert('Ukuran file gambar kop surat terlalu besar (maksimal 3MB).');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setKopImageUrl(result);
        try {
          localStorage.setItem('sijambu_kop_surat_image', result);
        } catch {
          console.warn('Could not save kop image to localStorage due to quota limits');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveKop = () => {
    setKopImageUrl(null);
    localStorage.removeItem('sijambu_kop_surat_image');
    if (kopFileInputRef.current) {
      kopFileInputRef.current.value = '';
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const weeks = getWeeks(selectedYear, selectedMonth);
      const newStats: WeeklyStats[] = [];

      // Get Total ASN count
      const { count: totalAsnCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const totalAsn = totalAsnCount || 25; // Default fallback if zero

      for (const week of weeks) {
        const startStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(week.start).padStart(2, '0')}`;
        const endStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(week.end).padStart(2, '0')}`;

        // WFH Scheduled
        const { count: scheduledCount } = await supabase
          .from('wfh_schedules')
          .select('*', { count: 'exact', head: true })
          .gte('tanggal', startStr)
          .lte('tanggal', endStr)
          .neq('status', 'CANCELLED');

        const wfhScheduled = scheduledCount || 0;

        // Valid WFH (Attendance)
        const { count: validCount } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .or('tipe.eq.MASUK,type.eq.MASUK')
          .gte('waktu_absen', `${startStr}T00:00:00+07:00`)
          .lte('waktu_absen', `${endStr}T23:59:59+07:00`);

        const wfhValid = Math.min(validCount || 0, wfhScheduled > 0 ? wfhScheduled : validCount || 0);
        const percentage = wfhScheduled > 0 ? (wfhValid / wfhScheduled) * 100 : (wfhValid > 0 ? 100 : 0);

        newStats.push({
          totalAsn,
          wfoCount: Math.max(0, totalAsn - Math.ceil(wfhScheduled / 5)),
          wfhScheduled,
          wfhValid,
          percentage
        });
      }

      setStats(newStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handlePrint = () => {
    window.print();
  };

  const updateSanction = (index: number, field: 'jumlah' | 'tindakLanjut' | 'jenis', value: any) => {
    const updated = [...sanctions];
    updated[index] = { ...updated[index], [field]: value };
    setSanctions(updated);
  };

  const updateAnggaran = (index: number, field: 'bulanNMinus1' | 'bulanN' | 'keterangan', value: string) => {
    const updated = [...manualInputs.anggaran];
    updated[index] = { ...updated[index], [field]: value };
    setManualInputs({ ...manualInputs, anggaran: updated });
  };

  const avgAttendance = stats.length > 0 
    ? (stats.reduce((acc, curr) => acc + curr.percentage, 0) / stats.length).toFixed(1)
    : '0';

  const kepatuhanPagiVal = manualInputs.kepatuhanPagiOverride !== '' 
    ? manualInputs.kepatuhanPagiOverride 
    : (parseFloat(avgAttendance) > 0 ? avgAttendance : '100');

  const kepatuhanSoreVal = manualInputs.kepatuhanSoreOverride !== '' 
    ? manualInputs.kepatuhanSoreOverride 
    : (parseFloat(avgAttendance) > 0 ? (parseFloat(avgAttendance) * 0.98).toFixed(1) : '100');

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-20">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Laporan Resmi BKPSDM & BPKPAD</h1>
            <p className="text-slate-500 text-sm">
              Laporan Evaluasi Pelaksanaan WFH & Laporan Efisiensi Anggaran sesuai Surat Edaran Bupati Demak No. 6 Tahun 2026.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchData}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-800 text-white rounded-xl hover:bg-emerald-900 transition-all shadow-lg shadow-emerald-800/20 font-bold text-sm"
            >
              <Printer size={18} />
              <span>Cetak / Simpan PDF</span>
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 print:hidden">
          <button
            onClick={() => setActiveReportTab('evaluasi_wfh')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all",
              activeReportTab === 'evaluasi_wfh'
                ? "bg-emerald-800 text-white shadow-md shadow-emerald-900/20"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <FileText size={16} />
            <span>Laporan Evaluasi WFH (u.p. BKPSDM)</span>
          </button>
          <button
            onClick={() => setActiveReportTab('efisiensi_anggaran')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all",
              activeReportTab === 'efisiensi_anggaran'
                ? "bg-emerald-800 text-white shadow-md shadow-emerald-900/20"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <DollarSign size={16} />
            <span>Laporan Efisiensi Anggaran (u.p. BPKPAD)</span>
          </button>
          <button
            onClick={() => setActiveReportTab('semua')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all",
              activeReportTab === 'semua'
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <CheckCircle2 size={16} />
            <span>Tampilkan Semua Halaman (1-4)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Panel: Form Input Data */}
          <div className="lg:col-span-5 space-y-6 print:hidden">
            {/* Upload Kop Surat Card */}
            <div className="dashboard-card p-5 bg-gradient-to-br from-emerald-50 via-white to-amber-50/30 border-emerald-200/80 shadow-sm rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <ImageIcon size={18} className="text-emerald-700" />
                  KOP Surat Instansi Custom
                </h3>
                {kopImageUrl ? (
                  <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                    Kop Gambar Digunakan
                  </span>
                ) : (
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                    Kop Standar Teks
                  </span>
                )}
              </div>

              <input 
                type="file" 
                ref={kopFileInputRef} 
                accept="image/*" 
                onChange={handleKopUpload} 
                className="hidden" 
              />

              {kopImageUrl ? (
                <div className="space-y-3">
                  <div className="p-2 bg-white rounded-xl border border-slate-200 max-h-24 overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={kopImageUrl} alt="Kop Surat Custom" className="max-h-20 w-auto object-contain" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => kopFileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                    >
                      <Upload size={14} />
                      Ganti Gambar Kop
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveKop}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-100 transition-all"
                      title="Hapus dan gunakan Kop Standar"
                    >
                      <Trash2 size={14} />
                      Reset
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Unggah file gambar/header KOP Surat resmi instansi Anda (JPG/PNG max 3MB) untuk ditempatkan secara presisi pada bagian atas dokumen laporan.
                  </p>
                  <button
                    type="button"
                    onClick={() => kopFileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition-all shadow-md shadow-emerald-800/10"
                  >
                    <Upload size={16} />
                    <span>Upload Gambar KOP Surat Official</span>
                  </button>
                </div>
              )}
            </div>

            {/* Main Form Customization Card */}
            <div className="dashboard-card p-6 space-y-6 bg-white border-slate-200 shadow-sm rounded-2xl">
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Sliders size={18} className="text-emerald-700" />
                  Isian Data Laporan Evaluasi
                </h3>
                <span className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-semibold">
                  SE Bupati No. 6/2026
                </span>
              </div>
              
              {/* Periode */}
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">1. Periode Laporan Evaluasi</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <select 
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i}>{m}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <select 
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                    >
                      {[2024, 2025, 2026, 2027].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* General Document Header Info */}
              <div className="space-y-3 border-t pt-4">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">2. Nomor & Identitas Surat</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 font-semibold mb-1 block">Nomor Surat BKPSDM</label>
                    <input 
                      type="text"
                      value={manualInputs.nomorSuratBKPSDM}
                      onChange={(e) => setManualInputs({...manualInputs, nomorSuratBKPSDM: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 font-semibold mb-1 block">Nomor Surat BPKPAD</label>
                    <input 
                      type="text"
                      value={manualInputs.nomorSuratBPKPAD}
                      onChange={(e) => setManualInputs({...manualInputs, nomorSuratBPKPAD: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-600 font-semibold mb-1 block">Tanggal Surat Laporan</label>
                  <input 
                    type="text"
                    value={manualInputs.tanggalSurat}
                    onChange={(e) => setManualInputs({...manualInputs, tanggalSurat: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                    placeholder="Contoh: 31 Maret 2026"
                  />
                </div>
              </div>

              {/* Section B Inputs */}
              <div className="space-y-3 border-t pt-4">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  3. Evaluasi Capaian Kinerja WFH (Bagian B)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">Kepatuhan Pagi (%)</label>
                    <input 
                      type="text"
                      value={manualInputs.kepatuhanPagiOverride}
                      onChange={(e) => setManualInputs({...manualInputs, kepatuhanPagiOverride: e.target.value})}
                      placeholder={`Auto: ${avgAttendance}%`}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">Kepatuhan Sore (%)</label>
                    <input 
                      type="text"
                      value={manualInputs.kepatuhanSoreOverride}
                      onChange={(e) => setManualInputs({...manualInputs, kepatuhanSoreOverride: e.target.value})}
                      placeholder={`Auto: ${avgAttendance}%`}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-600 font-semibold mb-1 block">Kualitas Output Pekerjaan</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'SANGAT_BAIK', label: 'Sangat Baik' },
                      { key: 'BAIK', label: 'Baik' },
                      { key: 'KURANG', label: 'Kurang' }
                    ].map(q => (
                      <button
                        key={q.key}
                        type="button"
                        onClick={() => setManualInputs({...manualInputs, kualitasOutput: q.key})}
                        className={cn(
                          "px-2.5 py-2 rounded-xl border text-xs font-bold transition-all",
                          manualInputs.kualitasOutput === q.key 
                            ? "bg-emerald-800 border-emerald-800 text-white shadow-md shadow-emerald-900/20" 
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-600 font-semibold mb-1 block">Penjelasan Ringkas Output Pekerjaan</label>
                  <textarea 
                    value={manualInputs.penjelasanOutput}
                    onChange={(e) => setManualInputs({...manualInputs, penjelasanOutput: e.target.value})}
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 resize-none"
                  />
                </div>
              </div>

              {/* Section C: Sanctions Input */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <ShieldAlert size={14} className="text-amber-600" />
                    4. Data Pemberian Sanksi (Bagian C)
                  </label>
                </div>
                
                <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                  {sanctions.map((s, idx) => (
                    <div key={s.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                      <p className="font-semibold text-slate-800">{idx + 1}. {s.jenis}</p>
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                          <label className="text-[10px] text-slate-400 font-bold block mb-0.5">Jumlah Kasus</label>
                          <input 
                            type="number"
                            min={0}
                            value={s.jumlah}
                            onChange={(e) => updateSanction(idx, 'jumlah', parseInt(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-center font-bold text-amber-700"
                          />
                        </div>
                        <div className="col-span-8">
                          <label className="text-[10px] text-slate-400 font-bold block mb-0.5">Tindak Lanjut</label>
                          <input 
                            type="text"
                            value={s.tindakLanjut}
                            onChange={(e) => updateSanction(idx, 'tindakLanjut', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section D Inputs */}
              <div className="space-y-3 border-t pt-4">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  5. Catatan & Rekomendasi (Bagian D)
                </label>

                <div>
                  <label className="text-xs text-slate-600 font-semibold mb-1 block">1. Efektivitas WFH Terhadap Pelayanan</label>
                  <textarea 
                    value={manualInputs.catatanEfektivitas}
                    onChange={(e) => setManualInputs({...manualInputs, catatanEfektivitas: e.target.value})}
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-600 font-semibold mb-1 block">2. Rekomendasi Kepala Perangkat Daerah</label>
                  <textarea 
                    value={manualInputs.rekomendasi}
                    onChange={(e) => setManualInputs({...manualInputs, rekomendasi: e.target.value})}
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 resize-none"
                  />
                </div>
              </div>

              {/* Anggaran Inputs (BPKPAD) */}
              <div className="space-y-4 border-t pt-4">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                  <DollarSign size={14} className="text-emerald-600" />
                  6. Laporan Efisiensi Anggaran (u.p. BPKPAD)
                </label>

                <div className="space-y-3">
                  {manualInputs.anggaran.map((item, idx) => (
                    <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                      <p className="font-bold text-slate-800">{idx + 1}. {item.uraian}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Bulan N-1</label>
                          <input 
                            type="text"
                            value={item.bulanNMinus1}
                            onChange={(e) => updateAnggaran(idx, 'bulanNMinus1', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Bulan N</label>
                          <input 
                            type="text"
                            value={item.bulanN}
                            onChange={(e) => updateAnggaran(idx, 'bulanN', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">Keterangan</label>
                        <input 
                          type="text"
                          value={item.keterangan}
                          onChange={(e) => updateAnggaran(idx, 'keterangan', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Signature Info */}
              <div className="space-y-3 border-t pt-4">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">7. Penandatangan Surat</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">Atas Nama</label>
                    <input 
                      type="text"
                      value={manualInputs.atasNama}
                      onChange={(e) => setManualInputs({...manualInputs, atasNama: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">Jabatan Pengirim</label>
                    <input 
                      type="text"
                      value={manualInputs.jabatanPengirim}
                      onChange={(e) => setManualInputs({...manualInputs, jabatanPengirim: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Nama Pejabat</label>
                  <input 
                    type="text"
                    value={manualInputs.kepalaNama}
                    onChange={(e) => setManualInputs({...manualInputs, kepalaNama: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">Pangkat / Golongan</label>
                    <input 
                      type="text"
                      value={manualInputs.kepalaPangkat}
                      onChange={(e) => setManualInputs({...manualInputs, kepalaPangkat: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">NIP Pejabat</label>
                    <input 
                      type="text"
                      value={manualInputs.kepalaNip}
                      onChange={(e) => setManualInputs({...manualInputs, kepalaNip: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex gap-2.5 items-start">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 leading-normal">
                  Hasil pengisian data di sebelah kiri ter-render secara langsung pada lembar preview A4 di sebelah kanan sesuai contoh format resmi.
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel: Official Document Preview */}
          <div className="lg:col-span-7">
            <div 
              ref={reportRef}
              className="bg-white shadow-xl rounded-sm border border-slate-200 w-full max-w-[210mm] mx-auto min-h-[297mm] p-[15mm] md:p-[18mm] text-black print:shadow-none print:border-none print:p-0 print:m-0 print:w-full space-y-8"
              style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12pt' }}
              id="print-area"
            >
              {/* PAGE 1: DOKUMEN 1 - EVALUASI WFH (u.p. BKPSDM) */}
              {(activeReportTab === 'evaluasi_wfh' || activeReportTab === 'semua') && (
                <div className="space-y-5 text-[12pt] leading-normal text-black page-break-after" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  {/* Kop Surat Header */}
                  {kopImageUrl ? (
                    <div className="mb-4 flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={kopImageUrl} alt="KOP Surat Official" className="w-full max-h-[140px] object-contain" />
                    </div>
                  ) : (
                    <div className="relative border-b-4 border-black pb-3 mb-5 text-center">
                      <div className="absolute left-0 top-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logo-sidebar.png" alt="Logo Kabupaten Demak" className="h-[75px] w-auto object-contain" />
                      </div>
                      <div className="font-bold flex flex-col uppercase text-black">
                        <span className="text-base tracking-wide font-bold">PEMERINTAH KABUPATEN DEMAK</span>
                        <span className="text-xl leading-none font-black tracking-tight mt-0.5">{manualInputs.perangkatDaerah}</span>
                        <span className="text-[11px] font-normal normal-case mt-1.5 leading-tight text-slate-800">
                          {manualInputs.alamat}<br />
                          Telepon {manualInputs.telepon}; Faksimile {manualInputs.faksimile}<br />
                          Laman {manualInputs.laman}; Pos-el {manualInputs.email}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Top Date & Number Block */}
                  <div className="flex justify-between items-start text-[12pt]">
                    <div className="space-y-0.5">
                      <p><span className="w-20 inline-block">Nomor</span>: {manualInputs.nomorSuratBKPSDM}</p>
                      <p><span className="w-20 inline-block">Sifat</span>: Biasa</p>
                      <p><span className="w-20 inline-block">Lampiran</span>: -</p>
                      <p><span className="w-20 inline-block">Hal</span>: <strong>Laporan Evaluasi Pelaksanaan Work From Home<br /><span className="ml-20 inline-block"></span>(WFH) Bulan {MONTHS[selectedMonth]} Tahun {selectedYear}</strong></p>
                    </div>
                    <div className="text-right">
                      Demak, {manualInputs.tanggalSurat}
                    </div>
                  </div>

                  {/* Destination */}
                  <div className="mt-4 text-[12pt]">
                    <p>Yth. Bupati Demak</p>
                    <p>u.p. Kepala BKPSDM Kabupaten Demak</p>
                    <p className="mt-2">di</p>
                    <p className="ml-4 font-bold">Demak</p>
                  </div>

                  {/* Opening Paragraph */}
                  <div className="mt-4 text-[12pt]">
                    <p className="text-justify leading-relaxed">
                      Menindaklanjuti Surat Edaran Bupati Demak Nomor 6 Tahun 2026 tentang Transformasi Budaya Kerja Aparatur Sipil Negara di Lingkungan Pemerintah Kabupaten Demak, dengan ini kami sampaikan laporan detail pelaksanaan tugas kedinasan di rumah (Work From Home/WFH), dengan rincian sebagai berikut:
                    </p>
                  </div>

                  {/* Section A: Rekapitulasi Kepesertaan dan Kehadiran WFH */}
                  <div className="space-y-2 mt-4 text-[12pt]">
                    <h3 className="font-bold text-[12pt] uppercase">A. Rekapitulasi Kepesertaan dan Kehadiran WFH</h3>
                    <table className="w-full border-collapse border border-black text-[11pt]">
                      <thead>
                        <tr className="bg-slate-100 font-bold text-center">
                          <th className="border border-black p-2 text-center" rowSpan={2}>URAIAN</th>
                          <th className="border border-black p-1 text-center" colSpan={4}>MINGGU</th>
                        </tr>
                        <tr className="bg-slate-100 font-bold text-center">
                          <th className="border border-black p-1 text-center w-12">I</th>
                          <th className="border border-black p-1 text-center w-12">II</th>
                          <th className="border border-black p-1 text-center w-12">III</th>
                          <th className="border border-black p-1 text-center w-12">IV</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-black p-1.5">Jumlah Total Pegawai ASN (PNS/PPPK/Paruh Waktu)</td>
                          {stats.map((s, i) => <td key={i} className="border border-black p-1.5 text-center font-medium">{s.totalAsn}</td>)}
                        </tr>
                        <tr>
                          <td className="border border-black p-1.5">Jumlah Pegawai WFO 100% (Pengecualian / Shift)</td>
                          {stats.map((s, i) => <td key={i} className="border border-black p-1.5 text-center font-medium">{s.wfoCount}</td>)}
                        </tr>
                        <tr>
                          <td className="border border-black p-1.5">Jumlah Pegawai yang Dijadwalkan WFH</td>
                          {stats.map((s, i) => <td key={i} className="border border-black p-1.5 text-center font-medium">{s.wfhScheduled}</td>)}
                        </tr>
                        <tr>
                          <td className="border border-black p-1.5">Jumlah Hadir WFH Sah (Laporan Lengkap)</td>
                          {stats.map((s, i) => <td key={i} className="border border-black p-1.5 text-center font-medium">{s.wfhValid}</td>)}
                        </tr>
                        <tr className="font-bold bg-slate-50">
                          <td className="border border-black p-1.5">Persentase Kehadiran WFH Sah</td>
                          {stats.map((s, i) => <td key={i} className="border border-black p-1.5 text-center">{s.percentage.toFixed(1)} %</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section B: Evaluasi Capaian Kinerja WFH */}
                  <div className="space-y-3 mt-6 text-[12pt]">
                    <h3 className="font-bold text-[12pt] uppercase">B. Evaluasi Capaian Kinerja WFH (Berdasarkan Pelaporan)</h3>
                    <div className="space-y-3 ml-2 text-[11pt] leading-relaxed">
                      <div>
                        <p className="font-semibold">1. Tingkat Kepatuhan Pelaporan Pagi (Rencana Kerja)</p>
                        <p className="ml-4 mt-0.5 text-slate-800">
                          <strong>{kepatuhanPagiVal} %</strong> pegawai mengirimkan laporan rencana kerja dan swafoto geotagging pagi tepat waktu.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold">2. Tingkat Kepatuhan Pelaporan Sore (Bukti Output)</p>
                        <p className="ml-4 mt-0.5 text-slate-800">
                          <strong>{kepatuhanSoreVal} %</strong> pegawai mengirimkan bukti capaian kinerja dan swafoto geotagging sore secara lengkap.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="font-semibold">3. Kualitas Output Pekerjaan <span className="font-normal italic">(Pilih salah satu / beri tanda X dan jelaskan singkat)</span></p>
                        <div className="ml-4 space-y-1.5">
                          <div className="flex items-start gap-2">
                            <div className={cn("w-4 h-4 border border-black flex items-center justify-center font-bold text-xs shrink-0 mt-0.5", manualInputs.kualitasOutput === 'SANGAT_BAIK' && "bg-black text-white")}>
                              {manualInputs.kualitasOutput === 'SANGAT_BAIK' ? 'X' : ''}
                            </div>
                            <span><strong>[ ] Sangat Baik</strong> (Output tuntas 100% sesuai target harian)</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className={cn("w-4 h-4 border border-black flex items-center justify-center font-bold text-xs shrink-0 mt-0.5", manualInputs.kualitasOutput === 'BAIK' && "bg-black text-white")}>
                              {manualInputs.kualitasOutput === 'BAIK' ? 'X' : ''}
                            </div>
                            <span><strong>[ ] Baik</strong> (Sebagian besar target tercapai, pekerjaan terselesaikan)</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className={cn("w-4 h-4 border border-black flex items-center justify-center font-bold text-xs shrink-0 mt-0.5", manualInputs.kualitasOutput === 'KURANG' && "bg-black text-white")}>
                              {manualInputs.kualitasOutput === 'KURANG' ? 'X' : ''}
                            </div>
                            <span><strong>[ ] Kurang</strong> (Banyak pegawai yang melaporkan output yang tidak signifikan/tidak relevan)</span>
                          </div>
                          {manualInputs.penjelasanOutput && (
                            <p className="mt-2 text-slate-800 italic ml-6">
                              Penjelasan ringkas (jika ada): {manualInputs.penjelasanOutput}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section C: Data Pemberian Sanksi */}
                  <div className="space-y-2 mt-6 text-[12pt]">
                    <h3 className="font-bold text-[12pt] uppercase">C. Data Pemberian Sanksi Terhadap Pelanggaran</h3>
                    <table className="w-full border-collapse border border-black text-[11pt]">
                      <thead>
                        <tr className="bg-slate-100 font-bold text-center">
                          <th className="border border-black p-1.5">Jenis Pelanggaran (Sesuai SE)</th>
                          <th className="border border-black p-1.5 w-24">Jumlah Kejadian</th>
                          <th className="border border-black p-1.5">Tindak Lanjut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sanctions.map((s) => (
                          <tr key={s.id}>
                            <td className="border border-black p-1.5">{s.jenis}</td>
                            <td className="border border-black p-1.5 text-center font-semibold">{s.jumlah} kasus</td>
                            <td className="border border-black p-1.5">{s.tindakLanjut}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Section D: Catatan & Rekomendasi */}
                  <div className="space-y-3 mt-6 text-[12pt]">
                    <h3 className="font-bold text-[12pt] uppercase">D. Catatan dan Rekomendasi Kepala Perangkat Daerah</h3>
                    <div className="space-y-3 ml-2 text-[11pt]">
                      <div>
                        <p className="font-semibold">1. Efektivitas WFH Terhadap Pelayanan</p>
                        <p className="ml-4 mt-1 leading-relaxed italic text-slate-800 border-b border-dotted border-slate-400 pb-1">
                          {manualInputs.catatanEfektivitas}
                        </p>
                        <p className="ml-4 text-[10pt] text-slate-500 italic mt-0.5">
                          (Apakah pelaksanaan WFH mengganggu penyelesaian dokumen dinas atau justru meningkatkan fokus penyelesaian tugas kedinasan)
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold">2. Rekomendasi</p>
                        <p className="ml-4 mt-1 leading-relaxed italic text-slate-800 border-b border-dotted border-slate-400 pb-1">
                          {manualInputs.rekomendasi}
                        </p>
                        <p className="ml-4 text-[10pt] text-slate-500 italic mt-0.5">
                          (Saran untuk perbaikan mekanisme, misalnya: perlu perbaikan mekanisme, perlu sosialisasi ulang, penguatan pengawasan, dlsb).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Closing & Signature Block */}
                  <div className="mt-8 pt-4 text-[12pt] leading-relaxed">
                    <p className="text-justify mb-2">
                      Demikian laporan evaluasi Work From Home/WFH ini disusun dengan sebenarnya berdasarkan validasi berjenjang dan kondisi faktual.
                    </p>
                    <p className="mb-6">Demikian untuk menjadikan maklum.</p>

                    <div className="flex justify-end mt-8">
                      <div className="w-[300px] text-left leading-normal text-[12pt]">
                        <p>{manualInputs.atasNama}</p>
                        <p className="pl-6 font-normal">{manualInputs.jabatanPengirim}</p>
                        <div className="h-20"></div>
                        <div className="pl-6">
                          <p className="font-normal">{manualInputs.kepalaNama}</p>
                          <p>{manualInputs.kepalaPangkat}</p>
                          <p>NIP {manualInputs.kepalaNip}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PAGE 2: DOKUMEN 2 - LAPORAN EFISIENSI ANGGARAN (u.p. BPKPAD) */}
              {(activeReportTab === 'efisiensi_anggaran' || activeReportTab === 'semua') && (
                <div 
                  className={cn(
                    "space-y-6 text-[12pt] leading-normal text-black",
                    activeReportTab === 'semua' && "pt-8 border-t-2 border-dashed border-slate-300 print:border-none print:pt-0"
                  )}
                  style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
                >
                  {/* Kop Surat Header BPKPAD */}
                  {kopImageUrl ? (
                    <div className="mb-4 flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={kopImageUrl} alt="KOP Surat Official" className="w-full max-h-[140px] object-contain" />
                    </div>
                  ) : (
                    <div className="relative border-b-4 border-black pb-3 mb-5 text-center">
                      <div className="absolute left-0 top-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logo-sidebar.png" alt="Logo Kabupaten Demak" className="h-[75px] w-auto object-contain" />
                      </div>
                      <div className="font-bold flex flex-col uppercase text-black">
                        <span className="text-base tracking-wide font-bold">PEMERINTAH KABUPATEN DEMAK</span>
                        <span className="text-xl leading-none font-black tracking-tight mt-0.5">{manualInputs.perangkatDaerah}</span>
                        <span className="text-[11px] font-normal normal-case mt-1.5 leading-tight text-slate-800">
                          {manualInputs.alamat}<br />
                          Telepon {manualInputs.telepon}; Faksimile {manualInputs.faksimile}<br />
                          Laman {manualInputs.laman}; Pos-el {manualInputs.email}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Header Info BPKPAD */}
                  <div className="flex justify-between items-start text-[12pt]">
                    <div className="space-y-0.5">
                      <p><span className="w-20 inline-block">Nomor</span>: {manualInputs.nomorSuratBPKPAD}</p>
                      <p><span className="w-20 inline-block">Sifat</span>: Biasa</p>
                      <p><span className="w-20 inline-block">Lampiran</span>: -</p>
                      <p><span className="w-20 inline-block">Hal</span>: <strong>Laporan Efisiensi Anggaran</strong></p>
                    </div>
                    <div className="text-right">
                      Demak, {manualInputs.tanggalSurat}
                    </div>
                  </div>

                  {/* Destination BPKPAD */}
                  <div className="mt-4 text-[12pt]">
                    <p>Yth. Bupati Demak</p>
                    <p>u.p. Kepala BPKPAD Kabupaten Demak</p>
                    <p className="mt-2">di</p>
                    <p className="ml-4 font-bold">Demak</p>
                  </div>

                  {/* Opening Paragraph */}
                  <div className="mt-4 text-[12pt]">
                    <p className="text-justify leading-relaxed">
                      Menindaklanjuti Surat Edaran Bupati Demak Nomor 6 Tahun 2026 tentang Transformasi Budaya Kerja Aparatur Sipil Negara di Lingkungan Pemerintah Kabupaten Demak, dengan ini kami sampaikan laporan pelaksanaan efisiensi anggaran dengan rincian sebagai berikut:
                    </p>
                  </div>

                  {/* Table Anggaran */}
                  <div className="space-y-2 mt-4 text-[12pt]">
                    <table className="w-full border-collapse border border-black text-[11pt]">
                      <thead>
                        <tr className="bg-slate-100 font-bold text-center">
                          <th className="border border-black p-2 w-10">NO</th>
                          <th className="border border-black p-2">URAIAN</th>
                          <th className="border border-black p-2 w-32">BULAN N-1</th>
                          <th className="border border-black p-2 w-32">BULAN N</th>
                          <th className="border border-black p-2">KETERANGAN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manualInputs.anggaran.map((item, idx) => (
                          <tr key={item.id}>
                            <td className="border border-black p-2 text-center">{idx + 1}</td>
                            <td className="border border-black p-2 font-medium">{item.uraian}</td>
                            <td className="border border-black p-2 text-right">{item.bulanNMinus1}</td>
                            <td className="border border-black p-2 text-right">{item.bulanN}</td>
                            <td className="border border-black p-2 text-xs">{item.keterangan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="mt-3 text-[10pt] italic text-slate-700 space-y-0.5">
                      <p>Keterangan:</p>
                      <p>1. (N) adalah bulan yang sedang berjalan ({MONTHS[selectedMonth]} {selectedYear}).</p>
                    </div>
                  </div>

                  {/* Signature BPKPAD */}
                  <div className="flex justify-end mt-12">
                    <div className="w-[300px] text-left leading-normal text-[12pt]">
                      <p>{manualInputs.atasNama}</p>
                      <p className="pl-6 font-normal">{manualInputs.jabatanPengirim}</p>
                      <div className="h-20"></div>
                      <div className="pl-6">
                        <p className="font-normal">{manualInputs.kepalaNama}</p>
                        <p>{manualInputs.kepalaPangkat}</p>
                        <p>NIP {manualInputs.kepalaNip}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Print Styling */}
        <style jsx global>{`
          #print-area, #print-area * {
            font-family: Arial, Helvetica, sans-serif !important;
          }
          @page {
            margin: 1.5cm;
          }
          @media print {
            body * {
              visibility: hidden;
            }
            #print-area, #print-area * {
              visibility: visible;
              font-family: Arial, Helvetica, sans-serif !important;
            }
            #print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
              font-size: 12pt !important;
            }
            .page-break-after {
              page-break-after: always;
              break-after: page;
            }
            .dashboard-card, header, .nav-container, button, nav, aside {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </DashboardLayout>
  );
}
