'use client';
import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  FileText, 
  Printer, 
  Calendar,
  AlertCircle
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
              onClick={handlePrint}
              disabled={reports.length === 0}
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
