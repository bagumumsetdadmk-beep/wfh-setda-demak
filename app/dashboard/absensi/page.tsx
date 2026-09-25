'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Camera, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Map as MapIcon, 
  Trash2, 
  RefreshCw, 
  Navigation, 
  AlertCircle,
  Sliders,
  Home,
  Compass,
  Radio,
  Save,
  X,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { supabase, Profile } from '@/lib/supabase';
import { useGeolocation } from '@/hooks/useGeolocation';
import { calculateDistanceMeters, formatDistance, EmployeeRadiusConfig, AppRadiusSettings, DEFAULT_RADIUS_SETTINGS } from '@/lib/geoDistance';

export default function AbsensiPage() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [isCameraActive, setCameraActive] = useState(false);
  const [type, setType] = useState<'MASUK' | 'PULANG'>('MASUK');
  const [status, setStatus] = useState<'IDLE' | 'CAPTURING' | 'SUBMITTED'>('IDLE');
  const [todaySchedule, setTodaySchedule] = useState<any>(null);
  const [isCheckingSchedule, setIsCheckingSchedule] = useState(true);
  const [notification, setNotification] = useState<{ type: 'ERROR' | 'SUCCESS' | 'WARNING'; message: string; submessage?: string } | null>(null);

  // Dynamic radius & GPS tolerance configuration per employee
  const [effectiveRadius, setEffectiveRadius] = useState<number>(200);
  const [effectiveGpsTolerance, setEffectiveGpsTolerance] = useState<number>(150);
  const [isFlexible, setIsFlexible] = useState<boolean>(false);
  const [userRadiusConfig, setUserRadiusConfig] = useState<EmployeeRadiusConfig | null>(null);
  const [radiusSettings, setRadiusSettings] = useState<AppRadiusSettings>(DEFAULT_RADIUS_SETTINGS);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);

  // Radius adjustment modal states
  const [isRadiusModalOpen, setIsRadiusModalOpen] = useState(false);
  const [modalRadius, setModalRadius] = useState<number>(200);
  const [modalTolerance, setModalTolerance] = useState<number>(150);
  const [modalIsFlexible, setModalIsFlexible] = useState<boolean>(false);
  const [modalAddressName, setModalAddressName] = useState<string>('');
  const [modalLat, setModalLat] = useState<string>('');
  const [modalLng, setModalLng] = useState<string>('');
  const [savingRadius, setSavingRadius] = useState<boolean>(false);

  // Geolocation Hook with dynamic tolerance & flexible signal support
  const {
    location,
    accuracy,
    isAccuracyValid,
    accuracyThreshold,
    address,
    loading: geoLoading,
    error: geoError,
    refreshLocation
  } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
    accuracyThreshold: effectiveGpsTolerance,
    isFlexible: isFlexible,
    watch: true,
    reverseGeocode: true,
  });
  
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

  // Distance to home calculation
  const distanceToHome = useMemo(() => {
    if (!location || !userRadiusConfig?.latitude || !userRadiusConfig?.longitude) return null;
    return calculateDistanceMeters(location.lat, location.lng, userRadiusConfig.latitude, userRadiusConfig.longitude);
  }, [location, userRadiusConfig]);

  const isDistanceValid = useMemo(() => {
    if (distanceToHome === null) return true;
    const allowed = isFlexible ? effectiveRadius * 1.5 : effectiveRadius;
    return distanceToHome <= allowed;
  }, [distanceToHome, isFlexible, effectiveRadius]);

  const fetchRadiusSettings = async (userId: string, userNip?: string) => {
    try {
      const res = await fetch('/api/radius-settings');
      if (res.ok) {
        const config: AppRadiusSettings = await res.json();
        setRadiusSettings(config);
        const userCfg = config.pegawai_radius[userId] || (userNip ? config.pegawai_radius[userNip] : null);
        if (userCfg) {
          setUserRadiusConfig(userCfg);
          setEffectiveRadius(userCfg.radius_meter || config.default_radius || 200);
          setEffectiveGpsTolerance(userCfg.toleransi_gps_meter || config.default_gps_tolerance || 150);
          setIsFlexible(!!userCfg.is_flexible);
          setModalRadius(userCfg.radius_meter || config.default_radius || 200);
          setModalTolerance(userCfg.toleransi_gps_meter || config.default_gps_tolerance || 150);
          setModalIsFlexible(!!userCfg.is_flexible);
          setModalAddressName(userCfg.lokasi_nama || '');
          setModalLat(userCfg.latitude ? String(userCfg.latitude) : '');
          setModalLng(userCfg.longitude ? String(userCfg.longitude) : '');
        } else {
          setEffectiveRadius(config.default_radius || 200);
          setEffectiveGpsTolerance(config.default_gps_tolerance || 150);
          setModalRadius(config.default_radius || 200);
          setModalTolerance(config.default_gps_tolerance || 150);
        }
      }
    } catch (err) {
      console.error('Error fetching radius settings:', err);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (data) {
        setUserProfile(data as Profile);
        return data as Profile;
      }
    } catch (e) {
      console.error('Error fetching profile:', e);
    }
    return null;
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
    try {
      const today = new Date().toLocaleDateString('en-CA');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const { data } = await supabase
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
    const loadInitialData = async () => {
      const prof = await fetchUserProfile();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetchRadiusSettings(session.user.id, prof?.nip);
      }
      await fetchAttendanceHistory();
      await fetchTodaySchedule();
    };
    loadInitialData();
  }, []);

  const handleSaveModalRadius = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setSavingRadius(true);
    try {
      const targetProfile = userProfile || {
        id: session.user.id,
        nip: session.user.email?.split('@')[0] || 'PEGAWAI',
        nama_lengkap: 'Pegawai WFH',
        unit_kerja: 'Setda Demak'
      };

      const payload: EmployeeRadiusConfig = {
        user_id: targetProfile.id,
        nip: targetProfile.nip,
        nama_lengkap: targetProfile.nama_lengkap,
        unit_kerja: targetProfile.unit_kerja,
        radius_meter: Number(modalRadius) || 200,
        toleransi_gps_meter: Number(modalTolerance) || 150,
        lokasi_nama: modalAddressName || `Rumah WFH - ${targetProfile.nama_lengkap}`,
        latitude: modalLat ? parseFloat(modalLat) : null,
        longitude: modalLng ? parseFloat(modalLng) : null,
        is_flexible: modalIsFlexible,
        catatan_kondisi: 'Disetel mandiri melalui halaman presensi absensi WFH'
      };

      const res = await fetch('/api/radius-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_pegawai', pegawai_config: payload })
      });

      if (!res.ok) throw new Error('Gagal menyimpan radius');
      const result = await res.json();
      setRadiusSettings(result.config);
      setUserRadiusConfig(payload);
      setEffectiveRadius(payload.radius_meter);
      setEffectiveGpsTolerance(payload.toleransi_gps_meter);
      setIsFlexible(payload.is_flexible || false);
      setIsRadiusModalOpen(false);
      setNotification({
        type: 'SUCCESS',
        message: 'Radius Berhasil Disimpan',
        submessage: `Radius kehadiran WFH disetel ${payload.radius_meter} meter dan toleransi sinyal GPS ±${payload.toleransi_gps_meter} meter. Tombol presensi kini aktif.`
      });
    } catch (err: any) {
      alert('Gagal menyimpan radius: ' + err.message);
    } finally {
      setSavingRadius(false);
    }
  };

  const handleLockCurrentLocation = () => {
    if (location) {
      setModalLat(location.lat.toFixed(6));
      setModalLng(location.lng.toFixed(6));
      if (address && !modalAddressName) {
        setModalAddressName(address);
      }
    } else {
      refreshLocation();
    }
  };

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
    if (!photo) {
      setNotification({
        type: 'WARNING',
        message: 'Foto Belum Diambil',
        submessage: 'Silakan ambil swafoto terlebih dahulu sebelum mengirim presensi.'
      });
      return;
    }

    if (!location) {
      setNotification({
        type: 'WARNING',
        message: 'Lokasi Tidak Ditemukan',
        submessage: 'Gagal mendeteksi lokasi presisi Anda. Pastikan GPS aktif dan berikan izin lokasi pada browser.'
      });
      return;
    }

    if (!isAccuracyValid) {
      setNotification({
        type: 'WARNING',
        message: 'Akurasi GPS Belum Memenuhi Syarat',
        submessage: `Akurasi GPS saat ini adalah ${accuracy ?? 'tidak terdeteksi'} meter (batas toleransi Anda: ±${accuracyThreshold}m). Jika Anda berada di lokasi sulit sinyal, silakan klik tombol "Sesuaikan Radius" untuk melonggarkan toleransi atau mengaktifkan Mode Fleksibel.`
      });
      return;
    }

    if (!isDistanceValid && distanceToHome !== null) {
      setNotification({
        type: 'WARNING',
        message: 'Melebihi Radius Lokasi WFH',
        submessage: `Posisi Anda saat ini berjarak ${distanceToHome} meter dari titik rumah WFH (batas radius yang ditentukan: ${effectiveRadius} meter). Jika titik rumah bergeser atau sinyal GPS meleset, klik tombol "Sesuaikan Radius" untuk memperbarui titik koordinat rumah atau memperbesar radius.`
      });
      return;
    }
    
    const todayStr = new Date().toLocaleDateString('en-CA');
    const revisionRecord = attendanceHistory.find(item => {
      const itemDate = new Date(item.waktu_absen).toLocaleDateString('en-CA');
      return itemDate === todayStr && 
             (item.type === type || item.tipe === type) && 
             item.status === 'REVISION';
    });

    // Schedule Validation (Bypassed if we are correcting a revision)
    if (!revisionRecord) {
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
                const endWindow = timeMasuk;         // Limit absensi masuk sampai batas akhir jam shift mulai
                
                if (testTime < startWindow || testTime > endWindow) {
                    setNotification({
                        type: 'WARNING',
                        message: 'Diluar Jendela Absensi',
                        submessage: `Absensi MASUK gagal: Anda hanya dapat absen masuk mulai 3 jam sebelum shift kerja hingga tepat pada saat shift kerja dimulai (${todaySchedule.shift_mulai}).`
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
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Sesi anda telah berakhir. Silakan login kembali.');
        return;
      }

      let error = null;
      let finalPhotoUrl = photo;

      if (photo.startsWith('data:image')) {
        try {
          const res = await fetch(photo);
          const blob = await res.blob();
          const fileName = `${session.user.id}_${Date.now()}.jpg`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('attendance-photos')
            .upload(fileName, blob, {
              contentType: 'image/jpeg',
              upsert: false
            });
            
          if (uploadError) {
             throw uploadError;
          }
          
          const { data: publicUrlData } = supabase.storage
            .from('attendance-photos')
            .getPublicUrl(fileName);
            
          finalPhotoUrl = publicUrlData.publicUrl;
        } catch (uploadErr: any) {
          console.error("Failed to upload to storage", uploadErr);
          alert('Gagal mengupload foto: ' + uploadErr.message);
          return;
        }
      }

      if (revisionRecord) {
        const { error: updateError } = await supabase
          .from('attendance')
          .update({
            status: 'PENDING',
            // Keep the supervisor revision note so we can trace and show 'PERBAIKAN' status
            foto_url: finalPhotoUrl,
            geotag: {
              address: address,
              lat: location.lat,
              lng: location.lng,
              timestamp: new Date().toISOString()
            },
            latitude: location.lat,
            longitude: location.lng,
            waktu_absen: new Date().toISOString() // Update to the new correct capture time
          })
          .eq('id', revisionRecord.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('attendance').insert({
          user_id: session.user.id,
          type: type,
          tipe: type,
          foto_url: finalPhotoUrl,
          photo_url: finalPhotoUrl,
          geotag: {
            address: address,
            lat: location.lat,
            lng: location.lng,
            timestamp: new Date().toISOString()
          },
          latitude: location.lat,
          longitude: location.lng
        });
        error = insertError;
      }

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

  const todayStr = new Date().toLocaleDateString('en-CA');
  const activeRevision = attendanceHistory.find(item => {
    const itemDate = new Date(item.waktu_absen).toLocaleDateString('en-CA');
    return itemDate === todayStr && 
           (item.type === type || item.tipe === type) && 
           item.status === 'REVISION';
  });

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
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Informasi Lokasi & GPS</h4>
                  <button
                    onClick={refreshLocation}
                    disabled={geoLoading}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    title="Segarkan lokasi GPS"
                  >
                    <RefreshCw size={12} className={cn(geoLoading && "animate-spin")} />
                    <span>{geoLoading ? 'Mendeteksi...' : 'Segarkan Lokasi'}</span>
                  </button>
                </div>

                {/* Error Banner */}
                {geoError && (
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-200 text-red-800 space-y-3 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide">Gagal Mengakses Lokasi GPS</p>
                        <p className="text-xs text-red-700 leading-relaxed mt-1 font-medium">{geoError.message}</p>
                      </div>
                    </div>
                    <button
                      onClick={refreshLocation}
                      className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-red-600/20"
                    >
                      <RefreshCw size={14} />
                      Coba Lagi
                    </button>
                  </div>
                )}

                {/* Radius & Geofence Status Card */}
                <div className="p-3.5 bg-gradient-to-br from-indigo-50/70 to-slate-50 border border-indigo-100 rounded-xl space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 uppercase tracking-wider">
                      <Radio size={14} className="text-indigo-600 animate-pulse" />
                      <span>Ketentuan Radius Lokasi WFH</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRadiusModalOpen(true)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-200 transition-all shadow-sm"
                      title="Buka form entri untuk menyesuaikan radius dan koordinat"
                    >
                      <Sliders size={12} />
                      <span>Sesuaikan Radius</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                    <div className="bg-white/90 p-2 rounded-lg border border-indigo-50">
                      <span className="text-slate-400 block font-semibold text-[10px]">Radius Absen:</span>
                      <span className="font-black text-indigo-700">{effectiveRadius} Meter</span>
                    </div>
                    <div className="bg-white/90 p-2 rounded-lg border border-indigo-50">
                      <span className="text-slate-400 block font-semibold text-[10px]">Toleransi GPS:</span>
                      <span className="font-black text-amber-700">±{effectiveGpsTolerance} Meter</span>
                    </div>
                  </div>

                  {/* Distance indicator if home coordinate is set */}
                  {userRadiusConfig?.latitude && userRadiusConfig?.longitude && (
                    <div className={cn(
                      "p-2 rounded-lg text-[11px] font-bold flex items-center justify-between border",
                      isDistanceValid ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
                    )}>
                      <span className="flex items-center gap-1">
                        <Home size={13} />
                        <span>Jarak ke Rumah: {formatDistance(distanceToHome)}</span>
                      </span>
                      <span className="text-[10px] uppercase font-black">
                        {isDistanceValid ? "✓ Dalam Radius" : "⚠ Melebihi Radius"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Location Address & Geotag */}
                <div className="flex gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-sm border border-blue-100">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Geotagging Presisi</p>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">{address}</p>
                  </div>
                </div>

                {/* Accuracy Indicator Badge */}
                {accuracy !== null && !geoError && (
                  <div className={cn(
                    "p-3 rounded-xl border flex items-center justify-between gap-2 mb-4 transition-all",
                    isAccuracyValid 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                      : "bg-amber-50 border-amber-200 text-amber-900"
                  )}>
                    <div className="flex items-center gap-2">
                      <Navigation size={16} className={isAccuracyValid ? "text-emerald-600" : "text-amber-600"} />
                      <div>
                        <p className="text-xs font-bold">
                          Akurasi GPS: <span className="font-black underline">{accuracy} meter</span>
                        </p>
                        <p className="text-[11px] opacity-80">
                          {isAccuracyValid 
                            ? `Sinyal Bagus (Memenuhi syarat ≤ ${accuracyThreshold}m)`
                            : `Sinyal Lemah (Melebihi batas toleransi ±${accuracyThreshold}m)`}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 shadow-sm",
                      isAccuracyValid 
                        ? "bg-emerald-600 text-white" 
                        : "bg-amber-500 text-white animate-pulse"
                    )}>
                      {isAccuracyValid ? "Sinyal Valid" : `Di Atas ${accuracyThreshold}m`}
                    </span>
                  </div>
                )}
                
                <div className="aspect-video bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 overflow-hidden relative">
                  {location ? (
                    <iframe
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      style={{ border: 0 }}
                      src={`https://maps.google.com/maps?q=${location.lat},${location.lng}&hl=id&z=16&output=embed`}
                      allowFullScreen
                    ></iframe>
                  ) : (
                    <>
                      <MapIcon size={32} className="text-slate-300" />
                      <span className="absolute bottom-2 right-2 text-[10px] font-bold text-slate-400 bg-white/80 px-2 py-1 rounded backdrop-blur-sm">DEMAK GEOSPATIAL</span>
                    </>
                  )}
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

                {/* Accuracy Warning Banner */}
                {!isAccuracyValid && accuracy !== null && !geoError && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 text-amber-900 mb-6 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-black text-xs uppercase text-amber-800">
                        <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                        <span>Sinyal GPS Melebihi Toleransi ({accuracy}m &gt; ±{accuracyThreshold}m)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRadiusModalOpen(true)}
                        className="text-[11px] font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-amber-200 hover:bg-indigo-50 transition-all shadow-sm"
                      >
                        Sesuaikan Radius
                      </button>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                      Akurasi GPS Anda saat ini adalah <strong className="font-bold">{accuracy} meter</strong>. Jika Anda berada di dalam rumah dengan atap tebal atau sinyal sulit, silakan klik tombol &quot;Sesuaikan Radius&quot; untuk melonggarkan batas toleransi atau mengaktifkan Mode Fleksibel.
                    </p>
                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[11px] text-amber-700 italic">Tips: Pindah ke dekat jendela atau luar ruangan.</span>
                      <button
                        onClick={refreshLocation}
                        className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-all shadow-sm flex items-center gap-1"
                      >
                        <RefreshCw size={12} className={cn(geoLoading && "animate-spin")} />
                        Coba Lagi
                      </button>
                    </div>
                  </div>
                )}

                {/* Distance Warning Banner if exceeding home radius */}
                {!isDistanceValid && distanceToHome !== null && (
                  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-300 text-rose-900 mb-6 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-black text-xs uppercase text-rose-800">
                        <AlertTriangle size={18} className="text-rose-600 shrink-0" />
                        <span>Melebihi Radius Lokasi WFH ({distanceToHome}m &gt; {effectiveRadius}m)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRadiusModalOpen(true)}
                        className="text-[11px] font-bold text-rose-700 bg-white px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-50 transition-all shadow-sm"
                      >
                        Sesuaikan Radius
                      </button>
                    </div>
                    <p className="text-xs text-rose-800 leading-relaxed font-medium">
                      Jarak lokasi Anda saat ini terdeteksi <strong className="font-bold">{distanceToHome} meter</strong> dari titik rumah WFH (batas radius: {effectiveRadius} meter). Jika titik rumah Anda bergeser atau Anda berada di lokasi WFH yang sah, klik &quot;Sesuaikan Radius&quot; untuk memperbarui koordinat atau memperluas radius.
                    </p>
                  </div>
                )}

                {activeRevision ? (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex flex-col gap-1 mb-6">
                    <div className="flex gap-2 items-center text-amber-800">
                      <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                      <p className="text-xs font-black uppercase tracking-tight">Mode Perbaikan Revisi Aktif</p>
                    </div>
                    <p className="text-[11px] text-amber-700 font-medium leading-relaxed mt-1">
                      Absen <span className="font-bold">{type}</span> Anda hari ini berstatus <span className="font-bold">REVISION</span>. Mengirim absensi sekarang akan memperbarui swafoto dan lokasi Anda serta mengirim ulang untuk persetujuan atasan. Batas jam masuk ditangguhkan.
                    </p>
                    {activeRevision.catatan && (
                      <div className="mt-2 text-[10px] bg-white/70 p-2 rounded-lg text-amber-800 border border-amber-100 italic">
                        Catatan Atasan: &quot;{activeRevision.catatan}&quot;
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex gap-3 mb-6">
                    <ShieldCheck size={20} className="text-indigo-500 shrink-0" />
                    <p className="text-xs text-indigo-700 leading-relaxed font-bold uppercase italic tracking-tight">
                      Data presisi akan dikirimkan beserta waktu server ({new Date().toLocaleTimeString('id-ID')}).
                    </p>
                  </div>
                )}

                <button 
                  disabled={!photo || !location || !isAccuracyValid || !isDistanceValid || geoLoading}
                  onClick={handleSubmit}
                  className="w-full bg-indigo-600 disabled:bg-slate-300 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {geoLoading ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Mendeteksi Lokasi Presisi...</span>
                    </>
                  ) : !photo ? (
                    <span>Ambil Swafoto Terlebih Dahulu</span>
                  ) : !location ? (
                    <span>Mencari Lokasi GPS...</span>
                  ) : !isAccuracyValid ? (
                    <span>Akurasi GPS (±{accuracy}m) Melebihi Batas ±{accuracyThreshold}m</span>
                  ) : !isDistanceValid ? (
                    <span>Melebihi Radius ({distanceToHome}m &gt; {effectiveRadius}m)</span>
                  ) : (
                    <span>Kirim Presensi Sekarang</span>
                  )}
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
                    {item.status !== 'APPROVED' && (
                      <div className="absolute top-2 left-2">
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="p-1.5 bg-red-500/90 text-white rounded shadow-sm backdrop-blur-md hover:bg-red-600 transition-colors"
                          title="Hapus Absensi"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                      <span className={cn(
                        "text-[9px] font-black uppercase px-2 py-1 rounded shadow-sm backdrop-blur-md text-white",
                        item.status === 'APPROVED' ? 'bg-emerald-500/90' : 
                        item.status === 'REVISION' ? 'bg-amber-500/90' : 'bg-slate-700/90'
                      )}>
                        {item.status === 'PENDING' || !item.status ? 'MENUNGGU' : item.status}
                      </span>
                      {item.status === 'PENDING' && item.catatan && (
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-sm backdrop-blur-md bg-sky-500/90 text-white animate-pulse">
                          PERBAIKAN
                        </span>
                      )}
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

      {/* Modal Form Entri Penyesuaian Radius WFH */}
      {isRadiusModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-slate-100 my-8 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 leading-tight">
                    Form Entri Radius Lokasi Absen
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Penyesuaian jangkauan &amp; toleransi sinyal GPS di lokasi WFH
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRadiusModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Signal Status Pill */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Sinyal GPS Saat Ini:</span>
                <span className="font-bold text-slate-700">
                  {accuracy ? `Akurasi ±${accuracy} meter` : 'Belum terdeteksi'}
                </span>
              </div>
              <button
                type="button"
                onClick={refreshLocation}
                disabled={geoLoading}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold border border-slate-200 transition-all flex items-center gap-1"
              >
                <RefreshCw size={12} className={cn(geoLoading && "animate-spin")} />
                <span>Segarkan</span>
              </button>
            </div>

            <form onSubmit={handleSaveModalRadius} className="space-y-4">
              {/* Field 1: Radius Jangkauan WFH */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio size={14} className="text-indigo-600" />
                    <span>Radius Jarak Absen WFH (Meter)</span>
                  </label>
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {modalRadius} m
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Jarak maksimal dari titik rumah untuk diizinkan absen masuk/pulang.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[100, 200, 300, 500, 1000].map((rVal) => (
                    <button
                      key={rVal}
                      type="button"
                      onClick={() => setModalRadius(rVal)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border",
                        modalRadius === rVal
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {rVal}m {rVal === 200 && '(Standar)'} {rVal >= 500 && '(Luas)'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="range"
                    min={50}
                    max={2000}
                    step={25}
                    value={modalRadius}
                    onChange={(e) => setModalRadius(Number(e.target.value))}
                    className="flex-1 accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    min={20}
                    max={10000}
                    value={modalRadius}
                    onChange={(e) => setModalRadius(Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-slate-400 font-bold">m</span>
                </div>
              </div>

              {/* Field 2: Toleransi Akurasi Sinyal GPS */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Navigation size={14} className="text-amber-600" />
                    <span>Batas Toleransi Akurasi GPS (Meter)</span>
                  </label>
                  <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    ±{modalTolerance} m
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Batas sinyal GPS yang diterima browser. Tingkatkan jika Anda di dalam rumah/atap tebal agar tombol tidak terkunci.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[50, 100, 150, 250, 500].map((tVal) => (
                    <button
                      key={tVal}
                      type="button"
                      onClick={() => setModalTolerance(tVal)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border",
                        modalTolerance === tVal
                          ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      ±{tVal}m {tVal === 150 && '(Disarankan)'} {tVal >= 250 && '(Sinyal Lemah)'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="range"
                    min={50}
                    max={1000}
                    step={25}
                    value={modalTolerance}
                    onChange={(e) => setModalTolerance(Number(e.target.value))}
                    className="flex-1 accent-amber-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <input
                    type="number"
                    min={20}
                    max={5000}
                    value={modalTolerance}
                    onChange={(e) => setModalTolerance(Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-center outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-xs text-slate-400 font-bold">m</span>
                </div>
              </div>

              {/* Field 3: Titik Koordinat Rumah */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={14} className="text-emerald-600" />
                    <span>Titik Koordinat Rumah WFH</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleLockCurrentLocation}
                    className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-all flex items-center gap-1"
                  >
                    <Navigation size={12} />
                    <span>Kunci Posisi Saya Sekarang</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Latitude: -6.894321"
                    value={modalLat}
                    onChange={(e) => setModalLat(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Longitude: 110.638765"
                    value={modalLng}
                    onChange={(e) => setModalLng(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Keterangan Alamat (contoh: Rumah Tinggal Pegawai, Wonosalam Demak)"
                  value={modalAddressName}
                  onChange={(e) => setModalAddressName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Field 4: Mode Fleksibel */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-start gap-2.5 p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modalIsFlexible}
                    onChange={(e) => setModalIsFlexible(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-amber-900 block">
                      Mode Fleksibel (Alamat Sulit GPS / Blank Spot)
                    </span>
                    <span className="text-[10px] text-amber-700 leading-tight block">
                      Mengizinkan absensi dikirim meskipun sinyal GPS berfluktuasi, asalkan menyertakan swafoto kehadiran yang valid.
                    </span>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRadiusModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingRadius}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingRadius ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      <span>Simpan &amp; Terapkan Langsung</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
}
