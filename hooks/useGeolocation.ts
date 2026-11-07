'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface GeolocationLocation {
  lat: number;
  lng: number;
}

export interface GeolocationError {
  code: number | string;
  message: string;
  type: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED' | 'UNKNOWN';
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  accuracyThreshold?: number; // In meters, default 150m (dapat disesuaikan per pegawai)
  isFlexible?: boolean; // Jika true, toleransi sinyal di lokasi sulit sinyal
  watch?: boolean; // Continuously update position using watchPosition
  reverseGeocode?: boolean; // Fetch address string from reverse geocoding
}

export interface UseGeolocationReturn {
  location: GeolocationLocation | null;
  accuracy: number | null; // In meters
  isAccuracyValid: boolean; // True if accuracy <= accuracyThreshold or isFlexible
  accuracyThreshold: number;
  address: string;
  loading: boolean;
  error: GeolocationError | null;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unknown';
  refreshLocation: () => void;
  clearError: () => void;
}

export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationReturn {
  const {
    enableHighAccuracy = true,
    timeout = 15000,
    maximumAge = 0,
    accuracyThreshold = 150,
    isFlexible = false,
    watch = true,
    reverseGeocode = true,
  } = options;

  const [location, setLocation] = useState<GeolocationLocation | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [address, setAddress] = useState<string>('Mendeteksi lokasi...');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');

  const watchIdRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Helper for reverse geocoding with smart nearest-address fallback
  const fetchAddress = useCallback(async (lat: number, lng: number) => {
    if (!reverseGeocode) return;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=id,en`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error('Failed to fetch address');
      const data = await res.json();
      if (isMountedRef.current) {
        if (data && data.address) {
          const addr = data.address;
          // Build clean structured Indonesian address
          const road = addr.road || addr.street || addr.pedestrian || addr.residential || addr.path || addr.footway || '';
          const village = addr.village || addr.suburb || addr.neighbourhood || addr.hamlet || addr.quarter || addr.village_hall || '';
          const subdistrict = addr.city_district || addr.subdistrict || addr.district || addr.municipality || '';
          const regency = addr.county || addr.city || addr.regency || addr.town || '';
          const state = addr.state || '';

          const parts = [road, village, subdistrict, regency, state].filter(Boolean);
          if (parts.length > 0) {
            setAddress(parts.join(', '));
            return;
          }
        }
        
        if (data && data.display_name) {
          setAddress(data.display_name);
        } else {
          setAddress(`Titik Koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
      }
    } catch {
      if (isMountedRef.current) {
        setAddress(`Titik Koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)} (Lokasi Terdeteksi)`);
      }
    }
  }, [reverseGeocode]);

  // Handle position success
  const handleSuccess = useCallback((position: GeolocationPosition) => {
    if (!isMountedRef.current) return;

    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const acc = Math.round(position.coords.accuracy);

    setLocation({ lat, lng });
    setAccuracy(acc);
    setLoading(false);
    setError(null);
    setPermissionState('granted');

    fetchAddress(lat, lng);
  }, [fetchAddress]);

  // Handle position error
  const handleError = useCallback((err: GeolocationPositionError) => {
    if (!isMountedRef.current) return;

    setLoading(false);
    let errorType: GeolocationError['type'] = 'UNKNOWN';
    let errorMessage = 'Gagal mendapatkan lokasi.';

    switch (err.code) {
      case err.PERMISSION_DENIED:
        errorType = 'PERMISSION_DENIED';
        errorMessage = 'Akses lokasi ditolak. Mohon aktifkan izin lokasi/GPS pada browser Anda.';
        setPermissionState('denied');
        break;
      case err.POSITION_UNAVAILABLE:
        errorType = 'POSITION_UNAVAILABLE';
        errorMessage = 'Sinyal GPS tidak ditemukan. Pastikan GPS/Layanan Lokasi pada perangkat sudah aktif.';
        break;
      case err.TIMEOUT:
        errorType = 'TIMEOUT';
        errorMessage = 'Waktu pengambilan lokasi habis (Timeout 15 detik). Pastikan Anda berada di area terbuka dan coba lagi.';
        break;
      default:
        errorMessage = err.message || 'Terjadi kesalahan saat mendeteksi lokasi.';
        break;
    }

    setError({
      code: err.code,
      message: errorMessage,
      type: errorType,
    });
    setAddress('Gagal menentukan lokasi presisi.');
  }, []);

  // Check permission status if navigator.permissions is available
  useEffect(() => {
    if (typeof window !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          if (isMountedRef.current) {
            setPermissionState(result.state);
            result.onchange = () => {
              if (isMountedRef.current) {
                setPermissionState(result.state);
              }
            };
          }
        })
        .catch(() => {
          // Ignore permissions query error on unsupported browsers
        });
    }
  }, []);

  // Request location update
  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setLoading(false);
      setError({
        code: 'UNSUPPORTED',
        message: 'Perangkat atau browser Anda tidak mendukung fitur Geolocation.',
        type: 'UNSUPPORTED',
      });
      setAddress('Browser tidak mendukung Geolocation.');
      return;
    }

    setLoading(true);
    setError(null);

    const geoOptions: PositionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge,
    };

    // First get current position immediately
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);

    // If watch is enabled, set up watchPosition for continuous high-accuracy updates
    if (watch) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);
    }
  }, [enableHighAccuracy, timeout, maximumAge, watch, handleSuccess, handleError]);

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;

    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        requestLocation();
      }
    }, 0);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      if (watchIdRef.current !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [requestLocation]);

  const refreshLocation = useCallback(() => {
    requestLocation();
  }, [requestLocation]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // GPS coordinates are the primary ground truth; accuracy level provides transparency without blocking
  const isAccuracyValid = location !== null;

  return {
    location,
    accuracy,
    isAccuracyValid,
    accuracyThreshold,
    address,
    loading,
    error,
    permissionState,
    refreshLocation,
    clearError,
  };
}
