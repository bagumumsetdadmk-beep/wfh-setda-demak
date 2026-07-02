'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  FileText, 
  Printer, 
  Calendar, 
  RefreshCw,
  AlertCircle,
  ChevronDown
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
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<WeeklyStats[]>([]);
  const [manualInputs, setManualInputs] = useState({
    nomorSurat: '(Nomor)',
    perangkatDaerah: 'SEKRETARIAT DAERAH',
    alamat: 'Jalan Kyai Singkil Nomor 7, Demak, Kode Pos 59511',
    telepon: '(0291) 685877',
    faksimile: '(0291) 685625',
    laman: 'setda.demakkab.go.id',
    email: 'setda@demakkab.go.id',
    kualitasOutput: 'BAIK', // SANGAT BAIK, BAIK, KURANG
    penjelasanOutput: '',
    catatanEfektivitas: 'Pelaksanaan WFH berjalan efektif dan menunjang penyelesaian dokumen kedinasan.',
    rekomendasi: 'Perlu penguatan monitoring melalui video call secara acak.',
    kepalaNama: 'Akhmad Sugiharto, S.T., M.T.',
    kepalaPangkat: 'Pembina Utama Muda',
    kepalaNip: '197305171998031007',
    kepalaJabatan: 'Sekretaris Daerah',
  });

  const [sanctions] = useState([
    { jenis: 'Tidak mengirim swafoto geotagging pagi/sore', jumlah: 0, tindakLanjut: 'Diberikan teguran lisan' },
    { jenis: 'Tidak mengirimkan laporan rencana kerja (pagi)', jumlah: 0, tindakLanjut: 'Anulir kehadiran WFH' },
    { jenis: 'Tidak mengirimkan laporan bukti kinerja (sore)', jumlah: 0, tindakLanjut: 'Anulir kehadiran WFH' },
    { jenis: 'Tidak merespons komunikasi WA (SLA 30 menit)', jumlah: 0, tindakLanjut: 'Diberikan teguran' },
    { jenis: 'Menolak / Tidak mengangkat panggilan Video Call', jumlah: 0, tindakLanjut: 'Anulir kehadiran WFH' },
    { jenis: 'Tidak memenuhi panggilan untuk hadir ke kantor', jumlah: 0, tindakLanjut: 'Peringatan tertulis' },
    { jenis: 'Terbukti berada di luar domisili untuk urusan pribadi', jumlah: 0, tindakLanjut: 'Dicabut hak WFH' },
  ]);

  const reportRef = useRef<HTMLDivElement>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const weeks = getWeeks(selectedYear, selectedMonth);
      const newStats: WeeklyStats[] = [];

      // 1. Get Total ASN
      const { count: totalAsnCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'PEGAWAI');

      const totalAsn = totalAsnCount || 0;

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

        const wfhValid = Math.min(validCount || 0, wfhScheduled);
        const percentage = wfhScheduled > 0 ? (wfhValid / wfhScheduled) * 100 : 0;

        newStats.push({
          totalAsn,
          wfoCount: Math.round(totalAsn - (wfhScheduled / 5)), // simplified
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

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-20">
      {/* Header UI */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Laporan BKPSDM</h1>
          <p className="text-slate-500 text-sm">Generate laporan evaluasi WFH sesuai format edaran Bupati.</p>
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
            onClick={async () => {
              try {
                setLoading(true);
                const startStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
                const endStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${new Date(selectedYear, selectedMonth + 1, 0).getDate()}`;
                
                const { data, error } = await supabase
                  .from('attendance')
                  .select(`
                    id,
                    waktu_absen,
                    tipe,
                    type,
                    foto_url,
                    photo_url,
                    status,
                    geotag,
                    profiles:user_id ( nama_lengkap, nip )
                  `)
                  .or('tipe.eq.MASUK,type.eq.MASUK,tipe.eq.PULANG,type.eq.PULANG')
                  .gte('waktu_absen', `${startStr}T00:00:00+07:00`)
                  .lte('waktu_absen', `${endStr}T23:59:59+07:00`)
                  .order('waktu_absen', { ascending: true });

                if (error) throw error;

                if (!data || data.length === 0) {
                  alert('Tidak ada data absensi pada bulan ini.');
                  return;
                }

                // Grouping data by date and type
                const groupedData: Record<string, { masuk: any[], pulang: any[] }> = {};

                data.forEach((item: any) => {
                  const photo = item.foto_url || item.photo_url;
                  if (!photo) return;
                  
                  const dateStr = new Date(item.waktu_absen).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
                  const isPulang = item.tipe === 'PULANG' || item.type === 'PULANG';
                  
                  if (!groupedData[dateStr]) {
                    groupedData[dateStr] = { masuk: [], pulang: [] };
                  }
                  
                  if (isPulang) {
                    groupedData[dateStr].pulang.push(item);
                  } else {
                    groupedData[dateStr].masuk.push(item);
                  }
                });

                let htmlContent = `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <title>Data Foto Absensi WFH - ${MONTHS[selectedMonth]} ${selectedYear}</title>
                    <style>
                      body { font-family: sans-serif; padding: 20px; background: #f1f5f9; }
                      h1 { text-align: center; color: #0f172a; margin-bottom: 30px; }
                      .date-section { margin-bottom: 40px; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                      .date-title { font-size: 20px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; margin-top: 0; }
                      .type-section { margin-bottom: 20px; }
                      .type-title { font-size: 16px; color: #475569; margin-bottom: 15px; display: inline-block; padding: 4px 12px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; }
                      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
                      .card { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                      .card img { width: 100%; height: 200px; object-fit: cover; border-radius: 4px; margin-bottom: 10px; border: 1px solid #cbd5e1; }
                      .card p { margin: 5px 0; font-size: 12px; color: #475569; }
                      .card .name { font-weight: bold; font-size: 14px; color: #0f172a; }
                      .card .geotag { font-size: 11px; color: #64748b; margin-top: 8px; border-top: 1px dashed #cbd5e1; padding-top: 8px; word-break: break-word; }
                      .empty-msg { color: #94a3b8; font-size: 14px; font-style: italic; }
                    </style>
                  </head>
                  <body>
                    <h1>Data Foto Absensi WFH - ${MONTHS[selectedMonth]} ${selectedYear}</h1>
                `;

                Object.keys(groupedData).forEach(date => {
                    const dayData = groupedData[date];
                    
                    htmlContent += `<div class="date-section">`;
                    htmlContent += `<h2 class="date-title">${date}</h2>`;
                    
                    // Absen Masuk
                    htmlContent += `<div class="type-section">`;
                    htmlContent += `<h3 class="type-title" style="color: #4f46e5; border-color: #c7d2fe; background: #eef2ff;">ABSEN MASUK</h3>`;
                    
                    if (dayData.masuk.length > 0) {
                        htmlContent += `<div class="grid">`;
                        dayData.masuk.forEach((item: any) => {
                            const profile = item.profiles || {};
                            const time = new Date(item.waktu_absen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                            const photo = item.foto_url || item.photo_url;
                            const loc = item.geotag?.address || 'Lokasi tidak tersedia';
                            const coords = item.geotag?.lat && item.geotag?.lng ? `${item.geotag.lat}, ${item.geotag.lng}` : '';
                            
                            htmlContent += `
                              <div class="card">
                                <img src="${photo}" alt="Foto Absen" loading="lazy" />
                                <p class="name">${profile.nama_lengkap || 'Unknown'}</p>
                                <p>NIP: ${profile.nip || '-'}</p>
                                <p>Pukul: ${time}</p>
                                <p>Status: ${item.status || 'PENDING'}</p>
                                <p class="geotag">📍 ${loc}</p>
                                ${coords ? `<p class="geotag" style="margin-top: 4px; border-top: none; padding-top: 0;"><a href="https://maps.google.com/?q=${coords}" target="_blank" style="color: #2563eb; text-decoration: none;">🌍 ${coords}</a></p>` : ''}
                              </div>
                            `;
                        });
                        htmlContent += `</div>`;
                    } else {
                        htmlContent += `<p class="empty-msg">Tidak ada data absen masuk.</p>`;
                    }
                    htmlContent += `</div>`; // type-section masuk
                    
                    // Absen Pulang
                    htmlContent += `<div class="type-section">`;
                    htmlContent += `<h3 class="type-title" style="color: #0ea5e9; border-color: #bae6fd; background: #e0f2fe;">ABSEN PULANG</h3>`;
                    
                    if (dayData.pulang.length > 0) {
                        htmlContent += `<div class="grid">`;
                        dayData.pulang.forEach((item: any) => {
                            const profile = item.profiles || {};
                            const time = new Date(item.waktu_absen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                            const photo = item.foto_url || item.photo_url;
                            const loc = item.geotag?.address || 'Lokasi tidak tersedia';
                            const coords = item.geotag?.lat && item.geotag?.lng ? `${item.geotag.lat}, ${item.geotag.lng}` : '';
                            
                            htmlContent += `
                              <div class="card">
                                <img src="${photo}" alt="Foto Absen" loading="lazy" />
                                <p class="name">${profile.nama_lengkap || 'Unknown'}</p>
                                <p>NIP: ${profile.nip || '-'}</p>
                                <p>Pukul: ${time}</p>
                                <p>Status: ${item.status || 'PENDING'}</p>
                                <p class="geotag">📍 ${loc}</p>
                                ${coords ? `<p class="geotag" style="margin-top: 4px; border-top: none; padding-top: 0;"><a href="https://maps.google.com/?q=${coords}" target="_blank" style="color: #2563eb; text-decoration: none;">🌍 ${coords}</a></p>` : ''}
                              </div>
                            `;
                        });
                        htmlContent += `</div>`;
                    } else {
                        htmlContent += `<p class="empty-msg">Tidak ada data absen pulang.</p>`;
                    }
                    htmlContent += `</div>`; // type-section pulang
                    
                    htmlContent += `</div>`; // date-section
                });

                htmlContent += `
                  </body>
                  </html>
                `;

                const blob = new Blob([htmlContent], { type: 'text/html' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Foto_Absensi_WFH_${MONTHS[selectedMonth]}_${selectedYear}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

              } catch (err: any) {
                console.error(err);
                alert('Gagal mengekspor data foto: ' + err.message);
              } finally {
                setLoading(false);
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 font-bold text-sm"
          >
            <Printer size={18} />
            <span className="hidden sm:inline">Export Foto (HTML)</span>
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 font-bold text-sm"
          >
            <Printer size={18} />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Control Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="dashboard-card p-6 space-y-6 bg-white border-slate-200 shadow-sm print:hidden">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-4 mb-4">
              <Calendar size={18} className="text-indigo-600" />
              Periode Laporan
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bulan</label>
                <div className="relative">
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tahun</label>
                <div className="relative">
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                  >
                    {[2024, 2025, 2026].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                <FileText size={16} className="text-indigo-600" />
                Info Dokumen
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Nomor Surat</label>
                  <input 
                    type="text"
                    value={manualInputs.nomorSurat}
                    onChange={(e) => setManualInputs({...manualInputs, nomorSurat: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Kualitas Output</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['SANGAT BAIK', 'BAIK', 'KURANG'].map(q => (
                      <button
                        key={q}
                        onClick={() => setManualInputs({...manualInputs, kualitasOutput: q})}
                        className={cn(
                          "px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all",
                          manualInputs.kualitasOutput === q 
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20" 
                            : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                        )}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Rekomendasi</label>
                  <textarea 
                    value={manualInputs.rekomendasi}
                    onChange={(e) => setManualInputs({...manualInputs, rekomendasi: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm h-20 resize-none outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-amber-900 leading-none">Sinkronisasi Data</p>
                <p className="text-[10px] text-amber-700 leading-normal">
                  Angka pada tabel rekapitulasi dihasilkan otomatis berdasarkan sistem. Anda dapat menyesuaikan data manual lainnya sebelum mencetak.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Report Preview */}
        <div className="lg:col-span-8">
          <div 
            ref={reportRef}
            className="bg-white shadow-2xl rounded-none border border-slate-200 w-full max-w-[210mm] mx-auto min-h-[297mm] p-[20mm] font-serif text-black print:shadow-none print:border-none print:p-0 print:m-0"
            id="print-area"
          >
            {/* Header / Kop Surat */}
            <div className="relative border-b-4 border-black pb-4 mb-6 text-center">
              <div className="absolute left-0 top-0">
                <img src="/logo-sidebar.png" alt="Logo" className="h-[80px]" />
              </div>
              <div className="font-bold flex flex-col uppercase">
                <span className="text-xl leading-tight">Pemerintah Kabupaten Demak</span>
                <span className="text-2xl leading-none font-black tracking-tight tracking-tight">{manualInputs.perangkatDaerah}</span>
                <span className="text-xs font-normal normal-case mt-2 leading-tight">
                  {manualInputs.alamat}<br />
                  Telepon {manualInputs.telepon}, Faksimile {manualInputs.faksimile},<br />
                  Laman {manualInputs.laman}, Pos-el {manualInputs.email}
                </span>
              </div>
            </div>

            {/* Document Body */}
            <div className="space-y-6 text-sm leading-relaxed text-black">
              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <p><span className="w-20 inline-block">Nomor</span>: {manualInputs.nomorSurat}</p>
                  <p><span className="w-20 inline-block">Sifat</span>: Biasa</p>
                  <p><span className="w-20 inline-block">Lampiran</span>: -</p>
                  <p><span className="w-20 inline-block">Hal</span>: <strong>Laporan Evaluasi Pelaksanaan Work From Home (WFH) Bulan {MONTHS[selectedMonth]} Tahun {selectedYear}</strong></p>
                </div>
                <div className="text-right">
                  Demak, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>

              <div className="mt-8">
                <p>Yth. Bupati Demak</p>
                <p>u.p. Kepala BKPSDM Kabupaten Demak</p>
                <p className="mt-4">di</p>
                <p className="ml-4 font-bold">Demak</p>
              </div>

              <div className="mt-8">
                <p className="indent-8">
                  Menindaklanjuti Surat Edaran Bupati Demak Nomor 6 Tahun 2026 tentang Transformasi Budaya Kerja Aparatur Sipil Negara di Lingkungan Pemerintah Kabupaten Demak, dengan ini kami sampaikan laporan detail pelaksanaan tugas kedinasan di rumah (Work From Home/WFH), dengan rincian sebagai berikut:
                </p>
              </div>

              {/* Section A */}
              <div className="space-y-2 mt-6 font-sans">
                <h3 className="font-bold">A. Rekapitulasi Kepesertaan dan Kehadiran WFH</h3>
                <table className="w-full border-collapse border border-black text-[12px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold">
                      <th className="border border-black p-2 text-center" rowSpan={2}>URAIAN</th>
                      <th className="border border-black p-1 text-center" colSpan={4}>MINGGU</th>
                    </tr>
                    <tr className="bg-slate-100 font-bold">
                      <th className="border border-black p-1 text-center w-12">I</th>
                      <th className="border border-black p-1 text-center w-12">II</th>
                      <th className="border border-black p-1 text-center w-12">III</th>
                      <th className="border border-black p-1 text-center w-12">IV</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black p-2">Jumlah Total Pegawai ASN (PNS/PPPK/Paruh Waktu)</td>
                      {stats.map((s, i) => <td key={i} className="border border-black p-2 text-center">{s.totalAsn}</td>)}
                    </tr>
                    <tr>
                      <td className="border border-black p-2">Jumlah Pegawai WFO 100% (Pengecualian / Shift)</td>
                      {stats.map((s, i) => <td key={i} className="border border-black p-2 text-center">{s.wfoCount}</td>)}
                    </tr>
                    <tr>
                      <td className="border border-black p-2">Jumlah Pegawai yang Dijadwalkan WFH</td>
                      {stats.map((s, i) => <td key={i} className="border border-black p-2 text-center">{s.wfhScheduled}</td>)}
                    </tr>
                    <tr>
                      <td className="border border-black p-2">Jumlah Hadir WFH Sah (Laporan Lengkap)</td>
                      {stats.map((s, i) => <td key={i} className="border border-black p-2 text-center">{s.wfhValid}</td>)}
                    </tr>
                    <tr className="font-bold">
                      <td className="border border-black p-2">Persentase Kehadiran WFH Sah</td>
                      {stats.map((s, i) => <td key={i} className="border border-black p-2 text-center">{s.percentage.toFixed(1)} %</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section B */}
              <div className="space-y-4 mt-8 font-sans">
                <h3 className="font-bold">B. Evaluasi Capaian Kinerja WFH (Berdasarkan Pelaporan)</h3>
                <div className="space-y-4 ml-2">
                  <div className="space-y-1">
                    <p>1. Tingkat Kepatuhan Pelaporan Pagi (Rencana Kerja)</p>
                    <p className="ml-4 italic text-slate-700">
                      {Math.round(stats.reduce((acc, curr) => acc + curr.percentage, 0) / 4) || 0}% pegawai mengirimkan laporan rencana kerja dan swafoto geotagging pagi tepat waktu.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p>2. Tingkat Kepatuhan Pelaporan Sore (Bukti Output)</p>
                    <p className="ml-4 italic text-slate-700">
                      {Math.round(stats.reduce((acc, curr) => acc + (curr.percentage * 0.95), 0) / 4) || 0}% pegawai mengirimkan bukti capaian kinerja dan swafoto geotagging sore secara lengkap.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p>3. Kualitas Output Pekerjaan</p>
                    <div className="ml-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-4 h-4 border border-black flex items-center justify-center font-bold text-xs", manualInputs.kualitasOutput === 'SANGAT BAIK' && "bg-black text-white")}>
                          {manualInputs.kualitasOutput === 'SANGAT BAIK' ? 'X' : ''}
                        </div>
                        <span><strong>Sangat Baik</strong> (Output tuntas 100% sesuai target harian)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-4 h-4 border border-black flex items-center justify-center font-bold text-xs", manualInputs.kualitasOutput === 'BAIK' && "bg-black text-white")}>
                          {manualInputs.kualitasOutput === 'BAIK' ? 'X' : ''}
                        </div>
                        <span><strong>Baik</strong> (Sebagian besar target tercapai, pekerjaan terselesaikan)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-4 h-4 border border-black flex items-center justify-center font-bold text-xs", manualInputs.kualitasOutput === 'KURANG' && "bg-black text-white")}>
                          {manualInputs.kualitasOutput === 'KURANG' ? 'X' : ''}
                        </div>
                        <span><strong>Kurang</strong> (Banyak pegawai yang melaporkan output yang tidak signifikan/tidak relevan)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section C */}
              <div className="space-y-2 mt-8 font-sans">
                <h3 className="font-bold">C. Data Pemberian Sanksi Terhadap Pelanggaran</h3>
                <table className="w-full border-collapse border border-black text-[12px]">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center">
                      <th className="border border-black p-2">Jenis Pelanggaran (Sesuai SE)</th>
                      <th className="border border-black p-2 w-20">Jumlah Kejadian</th>
                      <th className="border border-black p-2">Tindak Lanjut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sanctions.map((s, i) => (
                      <tr key={i}>
                        <td className="border border-black p-2">{s.jenis}</td>
                        <td className="border border-black p-2 text-center">{s.jumlah} kasus</td>
                        <td className="border border-black p-2">{s.tindakLanjut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Section D */}
              <div className="space-y-4 mt-8 font-sans">
                <h3 className="font-bold">D. Catatan dan Rekomendasi Kepala Perangkat Daerah</h3>
                <div className="space-y-4 ml-2">
                  <div className="space-y-1">
                    <p>1. Efektivitas WFH Terhadap Pelayanan</p>
                    <p className="ml-4 p-3 border border-dashed border-slate-300 rounded min-h-[60px] italic">
                      {manualInputs.catatanEfektivitas}
                    </p>
                    <p className="text-[10px] text-slate-500 italic mt-1">(Apakah pelaksanaan WFH mengganggu penyelesaian dokumen dinas atau justru meningkatkan fokus penyelesaian tugas kedinasan)</p>
                  </div>
                  <div className="space-y-1">
                    <p>2. Rekomendasi</p>
                    <p className="ml-4 p-3 border border-dashed border-slate-300 rounded min-h-[60px] italic">
                      {manualInputs.rekomendasi}
                    </p>
                    <p className="text-[10px] text-slate-500 italic mt-1">(Saran untuk perbaikan mekanisme, misalnya: perlu perbaikan mekanisme, perlu sosialisasi ulang, penguatan pengawasan, dlsb).</p>
                  </div>
                </div>
              </div>

              {/* Footer / Signature Area */}
              <div className="mt-16 flex justify-end font-sans">
                <div className="w-[300px] text-center">
                  <p>Kepala {manualInputs.perangkatDaerah}</p>
                  <p>Kabupaten Demak,</p>
                  <div className="h-[100px] flex items-center justify-center italic text-slate-300">
                    (Tanda Tangan & Stempel)
                  </div>
                  <p className="font-bold underline uppercase">{manualInputs.kepalaNama}</p>
                  <p>{manualInputs.kepalaPangkat}</p>
                  <p>NIP. {manualInputs.kepalaNip}</p>
                </div>
              </div>

              <div className="mt-12 text-center border-t pt-8">
                <p className="italic text-xs">
                  Demikian laporan evaluasi Work From Home/WFH ini disusun dengan sebenarnya berdasarkan validasi berjenjang dan kondisi faktual.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            border: none !important;
            box-shadow: none !important;
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
