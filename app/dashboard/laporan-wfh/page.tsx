'use client';
import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  FileText, 
  Printer, 
  Calendar,
  AlertCircle,
  Camera
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Helper for month names in Indonesian
const monthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export default function LaporanWFHPage() {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reports, setReports] = useState<any[]>([]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${lastDay}`;

      const { data: workData, error: workError } = await supabase
        .from('work_reports')
        .select(`
          id,
          user_id,
          tanggal,
          tipe,
          konten,
          lampiran,
          status_approval,
          profiles!work_reports_user_id_fkey!inner(nama_lengkap, nip, unit_kerja)
        `)
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: true });
        
      if (workError) throw workError;

      // Group by user and date to pair RENCANA and HASIL
      const reportsMap = new Map();
      workData?.forEach((r) => {
        const key = `${r.user_id}_${r.tanggal}`;
        if (!reportsMap.has(key)) {
          reportsMap.set(key, {
            user_id: r.user_id,
            tanggal: r.tanggal,
            nama: (r.profiles as any).nama_lengkap,
            nip: (r.profiles as any).nip,
            unit_kerja: (r.profiles as any).unit_kerja,
            rencana: '',
            hasil: '',
            lampiran: '',
            status_approval: ''
          });
        }
        
        const entry = reportsMap.get(key);
        if (r.tipe === 'RENCANA') {
          entry.rencana = r.konten;
        } else if (r.tipe === 'HASIL') {
          entry.hasil = r.konten;
          entry.lampiran = r.lampiran;
          entry.status_approval = r.status_approval;
        }
      });
      
      setReports(Array.from(reportsMap.values()).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()));
    } catch (err: any) {
      console.error(err);
      alert('Gagal mengambil data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReports();
  }, [fetchReports]);

  const handlePrint = () => {
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Laporan WFH - ${monthNames[selectedMonth - 1]} ${selectedYear}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; color: #333; }
          h2 { text-align: center; margin-bottom: 5px; text-transform: uppercase; color: #000; }
          .date-subtitle { text-align: center; margin-bottom: 30px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; vertical-align: top; }
          th { background-color: #f3f4f6; text-align: center; font-weight: bold; text-transform: uppercase; }
          .center { text-align: center; }
          .ttd-section { margin-top: 50px; text-align: right; padding-right: 50px; }
          a { color: #2563eb; text-decoration: none; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>LAPORAN RENCANA DAN HASIL KERJA WFH</h2>
        <div class="date-subtitle">PERIODE: ${monthNames[selectedMonth - 1].toUpperCase()} ${selectedYear}</div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 5%">No</th>
              <th style="width: 20%">Nama / NIP</th>
              <th style="width: 15%">Unit Kerja</th>
              <th style="width: 25%">Rencana Kerja</th>
              <th style="width: 25%">Hasil Kerja</th>
              <th style="width: 10%">Bukti Dukung</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (reports.length === 0) {
      htmlContent += `<tr><td colspan="6" style="text-align: center; padding: 20px;">Tidak ada data laporan untuk periode ini</td></tr>`;
    } else {
      let currentDate = '';
      reports.forEach((item, idx) => {
        const itemDate = new Date(item.tanggal).toLocaleDateString('id-ID', { 
          weekday: 'long',
          day: '2-digit', 
          month: 'long', 
          year: 'numeric' 
        });

        if (itemDate !== currentDate) {
          currentDate = itemDate;
          htmlContent += `
            <tr style="background-color: #f9fafb;">
              <td colspan="6" style="font-weight: bold; padding: 10px; border-top: 2px solid #000;">
                HARI/TANGGAL: ${itemDate.toUpperCase()}
              </td>
            </tr>
          `;
        }

        htmlContent += `
          <tr>
            <td class="center">${idx + 1}</td>
            <td>
              <strong>${item.nama}</strong><br/>
              <span style="font-size: 10px; color: #666;">NIP. ${item.nip}</span>
            </td>
            <td>${item.unit_kerja || '-'}</td>
            <td><div style="white-space: pre-wrap;">${item.rencana || '-'}</div></td>
            <td><div style="white-space: pre-wrap;">${item.hasil || '-'}</div></td>
            <td class="center">${item.lampiran ? `<a href="${item.lampiran}" target="_blank">Link Bukti Dukung</a>` : '-'}</td>
          </tr>
        `;
      });
    }

    htmlContent += `
          </tbody>
        </table>
        
        <div style="margin-top: 30px; font-size: 10px; color: #666; text-align: right;">
          Dicetak pada: ${new Date().toLocaleString('id-ID')}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_WFH_${monthNames[selectedMonth - 1]}_${selectedYear}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleExportFoto = async () => {
    try {
      setLoading(true);
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${lastDay}`;
      
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
        .gte('waktu_absen', `${startDate}T00:00:00+07:00`)
        .lte('waktu_absen', `${endDate}T23:59:59+07:00`)
        .order('waktu_absen', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('Tidak ada data absensi foto pada bulan ini.');
        return;
      }

      // Grouping data by date and type
      const groupedData: Record<string, { masuk: any[], pulang: any[] }> = {};

      data.forEach((item: any) => {
        const photo = item.foto_url || item.photo_url;
        if (!photo) return;
        
        const dateStr = new Date(item.waktu_absen).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
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

      if (Object.keys(groupedData).length === 0) {
        alert('Tidak ada foto absensi yang ditemukan pada bulan ini.');
        return;
      }

      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Data Foto Absensi WFH - ${monthNames[selectedMonth - 1]} ${selectedYear}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; background: #f1f5f9; }
            h1 { text-align: center; color: #0f172a; margin-bottom: 30px; text-transform: uppercase; }
            .date-section { margin-bottom: 40px; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            .date-title { font-size: 20px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; margin-top: 0; text-transform: uppercase; }
            .type-section { margin-bottom: 20px; }
            .type-title { font-size: 16px; color: #475569; margin-bottom: 15px; display: inline-block; padding: 4px 12px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: bold; }
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
          <h1>Data Foto Absensi WFH - ${monthNames[selectedMonth - 1]} ${selectedYear}</h1>
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
      a.download = `Foto_Absensi_WFH_${monthNames[selectedMonth - 1]}_${selectedYear}.html`;
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
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-3xl font-display font-black text-slate-800 tracking-tight leading-none mb-2 italic uppercase">EXPORT WFH BULANAN</h2>
            <p className="text-slate-500 font-medium">Rekapitulasi Laporan Rencana dan Hasil Kerja WFH per Bulan.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white p-1.5 border border-slate-200 rounded-2xl shadow-sm">
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-4 py-2 bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                {monthNames.map((name, i) => (
                  <option key={i} value={i + 1}>{name}</option>
                ))}
              </select>
              
              <div className="w-px h-6 bg-slate-200"></div>
              
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-4 py-2 bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            
            <button 
              onClick={handleExportFoto}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <Camera size={18} className="group-hover:scale-110 transition-transform" />
              <span>Export Foto (HTML)</span>
            </button>

            <button 
              onClick={handlePrint}
              disabled={reports.length === 0 || loading}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <Printer size={18} className="group-hover:scale-110 transition-transform" />
              <span>Export HTML</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                <Calendar size={20} className="text-blue-500" />
                Laporan {monthNames[selectedMonth - 1]} {selectedYear}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Ditemukan {reports.length} data laporan kerja</p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-20 text-center">
                <div className="inline-block w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-bold">Menyiapkan data laporan...</p>
              </div>
            ) : reports.length > 0 ? (
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-16 text-center">No</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-1/4">Pegawai</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-1/4">Rencana Kerja</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-1/4">Hasil Kerja</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-28 text-center">Bukti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.map((report, idx) => {
                    const reportDate = new Date(report.tanggal).toLocaleDateString('id-ID', { 
                      weekday: 'long', 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric' 
                    });
                    const prevReport = idx > 0 ? reports[idx - 1] : null;
                    const isNewDate = !prevReport || prevReport.tanggal !== report.tanggal;

                    return (
                      <React.Fragment key={`${report.user_id}_${report.tanggal}`}>
                        {isNewDate && (
                          <tr className="bg-slate-50/80 border-y border-slate-200">
                            <td colSpan={5} className="p-3 px-6">
                              <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-blue-500" />
                                <span className="text-xs font-black text-slate-600 uppercase tracking-widest">
                                  {reportDate}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr className="hover:bg-blue-50/30 transition-colors group">
                          <td className="p-4 text-sm font-bold text-slate-400 text-center">{idx + 1}</td>
                          <td className="p-4">
                            <div className="font-black text-slate-800 group-hover:text-blue-600 transition-colors">{report.nama}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">NIP. {report.nip}</div>
                            <div className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-md mt-2">
                              {report.unit_kerja}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-3 leading-relaxed">
                              {report.rencana || <span className="text-slate-300 italic font-medium">Kosong</span>}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm text-slate-600 whitespace-pre-wrap line-clamp-3 leading-relaxed">
                              {report.hasil || <span className="text-slate-300 italic font-medium">Kosong</span>}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex justify-center">
                              {report.lampiran ? (
                                <a 
                                  href={report.lampiran} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                  title="Buka Link Bukti"
                                >
                                  <FileText size={18} />
                                </a>
                              ) : (
                                <div className="w-10 h-10 flex items-center justify-center text-slate-200">
                                  <AlertCircle size={18} />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-20 text-center flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <AlertCircle className="text-slate-200" size={40} />
                </div>
                <h4 className="text-xl font-bold text-slate-800 mb-2">Data Tidak Ditemukan</h4>
                <p className="text-slate-400 max-w-xs mx-auto">Tidak ada laporan WFH yang terdaftar pada bulan {monthNames[selectedMonth - 1]} {selectedYear}.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
