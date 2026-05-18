'use client';

import React, { useState, useRef, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Camera, MapPin, CheckCircle2, AlertTriangle, ShieldCheck, Map as MapIcon, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function AbsensiPage() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>('Mendeteksi lokasi...');
  const [isCameraActive, setCameraActive] = useState(false);
  const [type, setType] = useState<'MASUK' | 'PULANG'>('MASUK');
  const [status, setStatus] = useState<'IDLE' | 'CAPTURING' | 'SUBMITTED'>('IDLE');
  const [todaySchedule, setTodaySchedule] = useState<any>(null);
  const [isCheckingSchedule, setIsCheckingSchedule] = useState(true);
  const [notification, setNotification] = useState<{ type: 'ERROR' | 'SUCCESS' | 'WARNING'; message: string; submessage?: string } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', deleteId);
        
      if (error) throw error;
      
      await fetchAttendanceHistory();
    } catch (err: any) {
      console.error('Delete error:', err);
      alert('Gagal menghapus absensi: ' + err.message);
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', session.user.id)
        .order('waktu_absen', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAttendanceHistory(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const fetchTodaySchedule = async () => {
    setIsCheckingSchedule(true);
    try {
      const today = new Date().toLocaleDateString('en-CA');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data, error } = await supabase
        .from('wfh_schedules')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('tanggal', today)
        .eq('status', 'CONFIRMED')
        .maybeSingle();
        
      if (data) setTodaySchedule(data);
    } catch (err) {
      console.error('Error fetching schedule:', err);
    } finally {
      setIsCheckingSchedule(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (mounted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAttendanceHistory();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchTodaySchedule();
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.display_name) {
                setAddress(data.display_name);
              } else {
                setAddress(`Koordinat: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
              }
            })
            .catch(() => {
              setAddress(`Koordinat: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            });
        },
        (err) => {
          setAddress('Gagal mendeteksi lokasi. Menggunakan lokasi default Demak.');
          setLocation({ lat: -6.8943, lng: 110.6385 }); // Default Demak Koordinat
        }
      );
    } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAddress('Browser tidak mendukung lokasi. Menggunakan lokasi default Demak.');
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLocation({ lat: -6.8943, lng: 110.6385 });
    }
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraActive(true);
      setStatus('CAPTURING');
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch (err) {
      alert('Gagal mengakses kamera. Pastikan izin diberikan.');
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        // Only set width/height if valid dimensions exist
        if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
            const MAX_WIDTH = 640;
            const MAX_HEIGHT = 480;
            let width = videoRef.current.videoWidth;
            let height = videoRef.current.videoHeight;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width = Math.round((width * MAX_HEIGHT) / height);
                    height = MAX_HEIGHT;
                }
            }

            canvasRef.current.width = width;
            canvasRef.current.height = height;
            context.drawImage(videoRef.current, 0, 0, width, height);
            
            // Kompresi JPEG tinggi (kualitas 60%) agar base64 size tetap kecil (biasanya < 100KB)
            const data = canvasRef.current.toDataURL('image/jpeg', 0.6);
            setPhoto(data);
            stopCamera();
        }
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const handleSubmit = async () => {
    if (!photo || !location) return;
    
    // Schedule Validation
    if (!todaySchedule && !isCheckingSchedule) {
        setNotification({
            type: 'WARNING',
            message: 'Jadwal Tidak Ditemukan',
            submessage: 'Anda tidak memiliki jadwal WFH yang disetujui untuk hari ini. Silakan hubungi atasan atau buat jadwal terlebih dahulu.'
        });
        return;
    }

    if (todaySchedule) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        // Safety check for properties
        if (!todaySchedule.shift_mulai || !todaySchedule.shift_selesai) {
            setNotification({
                type: 'ERROR',
                message: 'Data Jadwal Tidak Valid',
                submessage: 'Data jam masuk atau pulang pada jadwal Anda tidak terbaca dengan benar. Hubungi admin.'
            });
            return;
        }

        const [hMasuk, mMasuk] = String(todaySchedule.shift_mulai).split(':').map(Number);
        const [hPulang, mPulang] = String(todaySchedule.shift_selesai).split(':').map(Number);
        
        if (isNaN(hMasuk) || isNaN(mMasuk) || isNaN(hPulang) || isNaN(mPulang)) {
            setNotification({
                type: 'ERROR',
                message: 'Format Jam Salah',
                submessage: 'Format jam pada jadwal Anda tidak valid (harus HH:mm).'
            });
            return;
        }

        let timeMasuk = hMasuk * 60 + mMasuk;
        let timePulang = hPulang * 60 + mPulang;

        if (timePulang < timeMasuk) {
            timePulang += 1440; // Handle shift lewat tengah malam
        }

        let testTime = currentTime;
        // Jika shift lewat tengah malam dan waktu sekarang adalah pagi hari, tambahkan 24 jam
        if (timePulang > 1440 && currentTime < (timePulang - 1440 + 180)) {
            testTime += 1440;
        }

        if (type === 'MASUK') {
            const startWindow = timeMasuk - 180; // 3 jam sebelum shift mulai
            const endWindow = timePulang;        // Limit absensi masuk sampai waktu shift selesai
            
            if (testTime < startWindow || testTime > endWindow) {
                setNotification({
                    type: 'WARNING',
                    message: 'Diluar Jendela Absensi',
                    submessage: `Absensi MASUK gagal: Anda hanya dapat absen masuk mulai 3 jam sebelum shift masuk (${todaySchedule.shift_mulai}) hingga jam shift pulang (${todaySchedule.shift_selesai}).`
                });
                return;
            }
        }

        if (type === 'PULANG') {
            const startWindow = Math.max(timeMasuk, timePulang - 180); // Jangan lebih awal dari jam masuk
            const endWindow = timePulang + 180;   // 3 jam setelah shift selesai
            
            if (testTime < startWindow || testTime > endWindow) {
                setNotification({
                    type: 'WARNING',
                    message: 'Diluar Jendela Absensi',
                    submessage: `Absensi PULANG gagal: Anda hanya dapat absen pulang hingga maksimal 3 jam setelah jam shift pulang (${todaySchedule.shift_selesai}).`
                });
                return;
            }
        }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Sesi anda telah berakhir. Silakan login kembali.');
        return;
      }

      const { error } = await supabase.from('attendance').insert({
        user_id: session.user.id,
        type: type,
        tipe: type,
        foto_url: photo,
        photo_url: photo,
        geotag: {
          address: address,
          lat: location.lat,
          lng: location.lng,
          timestamp: new Date().toISOString()
        },
        latitude: location.lat,
        longitude: location.lng
      });

      if (error) {
        throw error;
      }
      
      await fetchAttendanceHistory();
      setStatus('SUBMITTED');
    } catch (err: any) {
      console.error('Submit error:', err);
      alert('Gagal mengirim absensi: ' + err.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <div>
          <h2 className="text-3xl font-display font-black text-slate-800 tracking-tight leading-none mb-2 italic">ABSENSI WFH</h2>
          <p className="text-slate-500 font-medium">Lengkapi swafoto dan lokasi presisi Anda untuk memulai/mengakhiri kerja.</p>
        </div>

        {status === 'SUBMITTED' ? (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="dashboard-card text-center py-16 space-y-4"
          >
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center mb-4">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-2xl font-display font-bold text-slate-800">Absensi Berhasil Dikirim!</h3>
            <p className="text-slate-500 max-w-sm mx-auto italic">
              Status presisi Anda saat ini sedang menunggu persetujuan (approval) dari Atasan Langsung.
            </p>
            <button 
              onClick={() => setStatus('IDLE')}
              className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all mt-4"
            >
              Kembali ke Menu
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Camera Preview Section */}
            <div className="dashboard-card p-4">
              <div className="relative aspect-[3/4] bg-slate-900 rounded-2xl overflow-hidden shadow-inner border-2 border-slate-200 group">
                {!photo && !isCameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                      <Camera size={32} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest px-8 text-center italic opacity-60">Klik Tombol &quot;Mulai Kamera&quot; Untuk Swafoto</p>
                  </div>
                )}

                {photo && !isCameraActive && (
// eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="Surat Swafoto" className="w-full h-full object-cover" />
                )}

                {isCameraActive && (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                )}
                
                <canvas ref={canvasRef} className="hidden" />

                {isCameraActive && (
                    <div className="absolute bottom-6 left-0 w-full flex justify-center">
                        <button 
                            onClick={takePhoto}
                            className="w-14 h-14 rounded-full bg-white border-4 border-white/30 shadow-2xl flex items-center justify-center active:scale-95 transition-all"
                        >
                            <div className="w-10 h-10 rounded-full border-2 border-slate-900 flex items-center justify-center">
                                <div className="w-6 h-6 rounded-full bg-slate-900" />
                            </div>
                        </button>
                    </div>
                )}
              </div>

              {!isCameraActive && !photo && (
                <button 
                  onClick={startCamera}
                  className="w-full mt-4 bg-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-secondary transition-all"
                >
                  <Camera size={20} />
                  Mulai Kamera
                </button>
              )}

              {photo && (
                <button 
                  onClick={() => { setPhoto(null); startCamera(); }}
                  className="w-full mt-4 text-slate-500 hover:text-slate-700 py-3 rounded-2xl font-bold transition-all text-sm uppercase tracking-wide flex items-center justify-center gap-2"
                >
                  <AlertTriangle size={16} />
                  Ulangi Swafoto
                </button>
              )}
            </div>

            {/* Form Section */}
            <div className="space-y-6">
              <div className="dashboard-card">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Informasi Lokasi</h4>
                <div className="flex gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-sm border border-blue-100">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Geotagging Aktif</p>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">{address}</p>
                  </div>
                </div>
                
                <div className="aspect-video bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 overflow-hidden relative grayscale opacity-70">
                    <MapIcon size={32} className="text-slate-300" />
                    <span className="absolute bottom-2 right-2 text-[10px] font-bold text-slate-400 bg-white/80 px-2 py-1 rounded backdrop-blur-sm">DEMAK GEOSPATIAL</span>
                </div>
              </div>

              <div className="dashboard-card">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Pengaturan Presensi</h4>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-6">
                  <button 
                    onClick={() => setType('MASUK')}
                    className={cn(
                      "py-2 rounded-lg font-bold text-sm transition-all",
                      type === 'MASUK' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    Masuk Kerja
                  </button>
                  <button 
                    onClick={() => setType('PULANG')}
                    className={cn(
                      "py-2 rounded-lg font-bold text-sm transition-all",
                      type === 'PULANG' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                    )}
                  >
                    Pulang Kerja
                  </button>
                </div>

                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex gap-3 mb-6">
                  <ShieldCheck size={20} className="text-indigo-500 shrink-0" />
                  <p className="text-xs text-indigo-700 leading-relaxed font-bold uppercase italic tracking-tight">
                    Data presisi akan dikirimkan beserta waktu server ({new Date().toLocaleTimeString('id-ID')}).
                  </p>
                </div>

                <button 
                  disabled={!photo || !location}
                  onClick={handleSubmit}
                  className="w-full bg-indigo-600 disabled:bg-slate-300 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-sm uppercase tracking-widest"
                >
                  Kirim Presensi Sekarang
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Results Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-display font-bold text-slate-800 italic uppercase">Riwayat Absensi</h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">100 Record Terakhir</span>
          </div>
          
          {attendanceHistory.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {attendanceHistory.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="dashboard-card p-3 flex flex-col gap-3 group relative overflow-hidden"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    <img 
                      src={item.photo_url || item.foto_url} 
                      alt="Selfie" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute top-2 left-2">
                      <button
                        onClick={() => setDeleteId(item.id)}
                        className="p-1.5 bg-red-500/90 text-white rounded shadow-sm backdrop-blur-md hover:bg-red-600 transition-colors"
                        title="Hapus Absensi"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                      <span className={cn(
                        "text-[9px] font-black uppercase px-2 py-1 rounded shadow-sm backdrop-blur-md text-white",
                        item.status === 'APPROVED' ? 'bg-emerald-500/90' : 
                        item.status === 'REVISION' ? 'bg-amber-500/90' : 'bg-slate-700/90'
                      )}>
                        {item.status || 'PENDING'}
                      </span>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/60 to-transparent">
                      <p className="text-[10px] text-white font-bold tracking-widest">
                        {new Date(item.waktu_absen).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {new Date(item.waktu_absen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-black text-slate-900 italic">ABSENSI {item.type || item.tipe}</p>
                      <MapPin size={12} className="text-slate-400" />
                    </div>
                    {item.catatan && (
                      <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-100">
                        <p className="text-[9px] text-amber-700 font-bold leading-tight">CATATAN: {item.catatan}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="dashboard-card py-12 text-center border-dashed">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic tracking-tight">Belum ada data absensi</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Konfirmasi Hapus */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
          >
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Hapus Absensi</h3>
            <p className="text-sm text-slate-500">Apakah Anda yakin ingin menghapus data absensi ini? Data yang sudah dihapus tidak dapat dikembalikan.</p>
            
            <div className="flex justify-end gap-3 pt-4">
              <button 
                onClick={() => setDeleteId(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
              >
                Batal
              </button>
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
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
              {notification.type === 'SUCCESS' ? <CheckCircle2 size={40} /> :
               notification.type === 'WARNING' ? <AlertTriangle size={40} /> : <AlertTriangle size={40} />}
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
