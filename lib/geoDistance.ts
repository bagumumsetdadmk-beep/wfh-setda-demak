/**
 * Utilities for calculating distance and evaluating attendance radius
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface EmployeeRadiusConfig {
  user_id?: string;
  nip?: string;
  nama_lengkap?: string;
  unit_kerja?: string;
  radius_meter: number; // e.g. 50, 100, 200, 300, 500, 1000
  toleransi_gps_meter: number; // e.g. 50, 100, 150, 250, 500
  lokasi_nama?: string;
  latitude?: number | null;
  longitude?: number | null;
  catatan_kondisi?: string;
  is_flexible?: boolean;
  updated_at?: string;
}

export interface AppRadiusSettings {
  default_radius: number; // Default radius jangkauan WFH (meter)
  default_gps_tolerance: number; // Default batas akurasi GPS (meter)
  pegawai_radius: Record<string, EmployeeRadiusConfig>;
}

export const DEFAULT_RADIUS_SETTINGS: AppRadiusSettings = {
  default_radius: 200, // 200 meter default (sebelumnya kaku 50m)
  default_gps_tolerance: 150, // 150 meter toleransi akurasi GPS default
  pegawai_radius: {}
};

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 * @returns Distance in meters
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const phi1 = lat1 * rad;
  const phi2 = lat2 * rad;
  const deltaPhi = (lat2 - lat1) * rad;
  const deltaLambda = (lon2 - lon1) * rad;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Formats a meter distance into a human-readable string (e.g. "45 m" or "1.3 km")
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || isNaN(meters)) return '-';
  if (meters < 1000) {
    return `${meters} meter`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Evaluates whether an employee can clock in based on their current GPS coordinates,
 * GPS accuracy, and their custom or default radius configuration.
 */
export function evaluateAttendanceLocation(
  currentLat: number | null | undefined,
  currentLng: number | null | undefined,
  currentAccuracy: number | null | undefined,
  employeeConfig?: Partial<EmployeeRadiusConfig> | null,
  globalDefaults: { default_radius: number; default_gps_tolerance: number } = {
    default_radius: 200,
    default_gps_tolerance: 150
  }
) {
  const allowedRadius = employeeConfig?.radius_meter || globalDefaults.default_radius || 200;
  const allowedGpsTolerance = employeeConfig?.toleransi_gps_meter || globalDefaults.default_gps_tolerance || 150;
  const isFlexible = !!employeeConfig?.is_flexible;

  // 1. Check GPS accuracy signal
  const accuracy = currentAccuracy !== null && currentAccuracy !== undefined ? Math.round(currentAccuracy) : null;
  const isAccuracyAcceptable = accuracy !== null && (accuracy <= allowedGpsTolerance || isFlexible);

  // 2. Check distance from registered home/WFH coordinate (if set)
  const homeLat = employeeConfig?.latitude;
  const homeLng = employeeConfig?.longitude;
  const hasHomeCoordinate = typeof homeLat === 'number' && typeof homeLng === 'number' && !isNaN(homeLat) && !isNaN(homeLng) && (homeLat !== 0 || homeLng !== 0);

  let distanceToHome: number | null = null;
  let isWithinRadius = true;

  if (hasHomeCoordinate && typeof currentLat === 'number' && typeof currentLng === 'number') {
    distanceToHome = calculateDistanceMeters(currentLat, currentLng, homeLat!, homeLng!);
    // If flexible is on, grant a 1.5x buffer before hard blocking
    const effectiveRadius = isFlexible ? allowedRadius * 1.5 : allowedRadius;
    isWithinRadius = distanceToHome <= effectiveRadius;
  }

  const canClockIn = (currentLat !== null && currentLng !== null) && isAccuracyAcceptable && isWithinRadius;

  return {
    allowedRadius,
    allowedGpsTolerance,
    isFlexible,
    hasHomeCoordinate,
    distanceToHome,
    isWithinRadius,
    isAccuracyAcceptable,
    canClockIn,
    accuracy
  };
}
