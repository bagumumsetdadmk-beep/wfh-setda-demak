import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AppRadiusSettings, DEFAULT_RADIUS_SETTINGS, EmployeeRadiusConfig } from '@/lib/geoDistance';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yhacmkkfntmshhssnxnl.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const BUCKET_NAME = 'wfh-config';
const CONFIG_FILE = 'radius_settings.json';

function getAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function loadConfigFromStorage(): Promise<AppRadiusSettings> {
  const supabase = getAdminClient();
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(CONFIG_FILE);

    if (error || !data) {
      return DEFAULT_RADIUS_SETTINGS;
    }

    const text = await data.text();
    const parsed = JSON.parse(text);
    return {
      default_radius: Number(parsed.default_radius) || DEFAULT_RADIUS_SETTINGS.default_radius,
      default_gps_tolerance: Number(parsed.default_gps_tolerance) || DEFAULT_RADIUS_SETTINGS.default_gps_tolerance,
      pegawai_radius: parsed.pegawai_radius || {}
    };
  } catch (err) {
    console.error('Error reading radius settings from storage:', err);
    return DEFAULT_RADIUS_SETTINGS;
  }
}

async function saveConfigToStorage(config: AppRadiusSettings): Promise<void> {
  const supabase = getAdminClient();
  const content = Buffer.from(JSON.stringify(config, null, 2), 'utf-8');

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(CONFIG_FILE, content, {
      contentType: 'application/json',
      upsert: true
    });

  if (error) {
    throw error;
  }
}

export async function GET() {
  try {
    const config = await loadConfigFromStorage();
    return NextResponse.json(config);
  } catch (err: any) {
    return NextResponse.json({ error: err.message, fallback: DEFAULT_RADIUS_SETTINGS }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const currentConfig = await loadConfigFromStorage();

    if (body.action === 'set_global') {
      const default_radius = Number(body.default_radius);
      const default_gps_tolerance = Number(body.default_gps_tolerance);

      if (!isNaN(default_radius) && default_radius >= 20) {
        currentConfig.default_radius = default_radius;
      }
      if (!isNaN(default_gps_tolerance) && default_gps_tolerance >= 20) {
        currentConfig.default_gps_tolerance = default_gps_tolerance;
      }

      await saveConfigToStorage(currentConfig);
      return NextResponse.json({ success: true, config: currentConfig });
    }

    if (body.action === 'set_pegawai') {
      const p = body.pegawai_config as EmployeeRadiusConfig;
      const key = p.user_id || p.nip;
      if (!key) {
        return NextResponse.json({ error: 'user_id or nip is required' }, { status: 400 });
      }

      const radius = Number(p.radius_meter) || currentConfig.default_radius || 200;
      const tolerance = Number(p.toleransi_gps_meter) || currentConfig.default_gps_tolerance || 150;

      currentConfig.pegawai_radius[key] = {
        user_id: p.user_id,
        nip: p.nip,
        nama_lengkap: p.nama_lengkap,
        unit_kerja: p.unit_kerja,
        radius_meter: radius,
        toleransi_gps_meter: tolerance,
        lokasi_nama: p.lokasi_nama || 'Alamat WFH Pegawai',
        latitude: typeof p.latitude === 'number' ? p.latitude : (p.latitude ? parseFloat(String(p.latitude)) : null),
        longitude: typeof p.longitude === 'number' ? p.longitude : (p.longitude ? parseFloat(String(p.longitude)) : null),
        catatan_kondisi: p.catatan_kondisi || '',
        is_flexible: !!p.is_flexible,
        updated_at: new Date().toISOString()
      };

      // Also map by NIP if available for fast lookup
      if (p.nip && p.user_id && p.nip !== p.user_id) {
        currentConfig.pegawai_radius[p.nip] = currentConfig.pegawai_radius[key];
      }

      await saveConfigToStorage(currentConfig);
      return NextResponse.json({ success: true, config: currentConfig });
    }

    if (body.action === 'delete_pegawai') {
      const key = body.user_id_or_nip;
      if (key && currentConfig.pegawai_radius[key]) {
        const item = currentConfig.pegawai_radius[key];
        delete currentConfig.pegawai_radius[key];
        if (item.nip && currentConfig.pegawai_radius[item.nip]) {
          delete currentConfig.pegawai_radius[item.nip];
        }
        if (item.user_id && currentConfig.pegawai_radius[item.user_id]) {
          delete currentConfig.pegawai_radius[item.user_id];
        }
      }
      await saveConfigToStorage(currentConfig);
      return NextResponse.json({ success: true, config: currentConfig });
    }

    // Direct update of entire config
    if (body.default_radius || body.pegawai_radius) {
      const newConfig: AppRadiusSettings = {
        default_radius: Number(body.default_radius) || currentConfig.default_radius,
        default_gps_tolerance: Number(body.default_gps_tolerance) || currentConfig.default_gps_tolerance,
        pegawai_radius: body.pegawai_radius || currentConfig.pegawai_radius
      };
      await saveConfigToStorage(newConfig);
      return NextResponse.json({ success: true, config: newConfig });
    }

    return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 });
  } catch (err: any) {
    console.error('Error saving radius settings:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
