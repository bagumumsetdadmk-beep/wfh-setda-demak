'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useGeolocation } from '@/hooks/useGeolocation';
import { MapPin, Navigation, AlertTriangle, RefreshCw, AlertCircle, Camera, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AbsenPage() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Hook Geolocation dengan opsi High Accuracy, Timeout 15s, dan Batas Akurasi 50m
  const {
    location,
    accuracy,
    isAccuracyValid,
    accuracyThreshold,
    address,
    loading: geoLoading,
    error: geoError,
    refreshLocation,
  } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
    accuracyThreshold: 50,
    watch: true,
    reverseGeocode: true,
  });

  const handleSimulasiFoto = () => {
    // Simulasi pengambilan swafoto
    setPhoto('https://picsum.photos/seed/swafoto/400/500');
  };

  const handleKirimAbsen = () => {
    if (!photo || !location || !isAccuracyValid) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1000);
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 pb-12">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Presensi WFH Geotagging</h1>
          <p className="text-sm text-slate-500 font-medium">Pengambilan lokasi dengan akurasi presisi tinggi (Maksimal 50 meter)</p>
        </div>

        {submitted ? (
          <div className="p-8 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-4">
            <CheckCircle2 size={48} className="text-emerald-600 mx-auto" />
            <h2 className="text-xl font-bold text-emerald-900">Absensi Berhasil Dikirim!</h2>
            <p className="text-sm text-emerald-700">
              Lokasi: {address} <br />
              Koordinat: {location?.lat.toFixed(6)}, {location?.lng.toFixed(6)} <br />
              Akurasi GPS: {accuracy} meter (Valid)
            </p>
            <button
              onClick={() => { setSubmitted(false); setPhoto(null); }}
              className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
            >
              Kembali
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Box Informasi Lokasi & GPS */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <MapPin size={18} className="text-indigo-600" />
                  <span>Status GPS & Geotagging</span>
                </h3>
                <button
                  onClick={refreshLocation}
                  disabled={geoLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  <RefreshCw size={14} className={cn(geoLoading && "animate-spin")} />
                  <span>{geoLoading ? "Mendeteksi..." : "Coba Lagi / Refresh"}</span>
                </button>
              </div>

              {/* Error State Handling */}
              {geoError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold uppercase">Gagal Mengakses GPS</p>
                      <p className="text-xs text-red-700">{geoError.message}</p>
                    </div>
                  </div>
                  <button
                    onClick={refreshLocation}
                    className="w-full py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw size={12} />
                    Coba Lagi
                  </button>
                </div>
              )}

              {/* Informasi Alamat */}
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                <p className="text-xs text-slate-400 font-bold uppercase">Alamat Terdeteksi:</p>
                <p className="text-sm text-slate-800 font-medium leading-relaxed">{address}</p>
              </div>

              {/* Informasi Indikator Akurasi GPS */}
              {accuracy !== null && !geoError && (
                <div className={cn(
                  "p-4 rounded-xl border flex items-center justify-between gap-3 transition-all",
                  isAccuracyValid ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"
                )}>
                  <div className="flex items-center gap-3">
                    <Navigation size={20} className={isAccuracyValid ? "text-emerald-600" : "text-amber-600"} />
                    <div>
                      <p className="text-sm font-bold">
                        Akurasi GPS: <span className="underline">{accuracy} meter</span>
                      </p>
                      <p className="text-xs opacity-80">
                        {isAccuracyValid
                          ? `Sinyal GPS Presisi (Batas maksimal ${accuracyThreshold}m)`
                          : `Sinyal Buruk (Melebihi batas maksimal ${accuracyThreshold}m)`}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs font-bold px-3 py-1 rounded-full text-white",
                    isAccuracyValid ? "bg-emerald-600" : "bg-amber-500 animate-pulse"
                  )}>
                    {isAccuracyValid ? "LOKASI VALID" : "AKURASI LOW"}
                  </span>
                </div>
              )}

              {/* Peringatan jika Akurasi > 50m */}
              {!isAccuracyValid && accuracy !== null && !geoError && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <span>Akurasi GPS Belum Memenuhi Syarat</span>
                  </div>
                  <p>
                    Lokasi Anda saat ini memiliki akurasi <strong className="font-bold">{accuracy}m</strong>.
                    Sistem membutuhkan akurasi di bawah <strong className="font-bold">50 meter</strong>.
                    Tombol Absen dinonaktifkan sampai sinyal lokasi mencukupi.
                  </p>
                  <p className="italic text-slate-600">
                    Saran: Berdirilah di luar ruangan atau dekat jendela, kemudian tekan tombol <strong>&quot;Coba Lagi / Refresh&quot;</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Swafoto Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Camera size={18} className="text-indigo-600" />
                <span>Swafoto Kehadiran</span>
              </h3>

              {photo ? (
                <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="Foto Absen" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPhoto(null)}
                    className="absolute top-2 right-2 bg-black/70 text-white text-xs px-3 py-1 rounded-lg font-bold"
                  >
                    Ganti Foto
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSimulasiFoto}
                  className="w-full py-8 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-slate-50 transition-all flex flex-col items-center justify-center gap-2 text-slate-500 font-medium text-xs"
                >
                  <Camera size={28} className="text-slate-400" />
                  <span>Ambil Swafoto</span>
                </button>
              )}
            </div>

            {/* Tombol Absen (Disabled jika Akurasi > 50m / Tidak ada lokasi / Tidak ada foto) */}
            <button
              disabled={!photo || !location || !isAccuracyValid || geoLoading || submitting}
              onClick={handleKirimAbsen}
              className="w-full py-4 bg-indigo-600 disabled:bg-slate-300 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span>Mengirim...</span>
              ) : geoLoading ? (
                <span>Mendeteksi GPS...</span>
              ) : !photo ? (
                <span>Ambil Foto Terlebih Dahulu</span>
              ) : !location ? (
                <span>GPS Tidak Ditemukan</span>
              ) : !isAccuracyValid ? (
                <span>Akurasi GPS Harus ≤ 50m (Saat ini: {accuracy}m)</span>
              ) : (
                <span>Kirim Presensi Sekarang</span>
              )}
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
