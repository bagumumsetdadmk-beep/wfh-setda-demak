import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Supabase URL or Service Role Key is missing on the server. Please add SUPABASE_SERVICE_ROLE_KEY to your environment variables.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const body = await req.json();
    const { nip, nama_lengkap, jabatan, unit_kerja, role, password } = body;

    if (!nip || !nama_lengkap || !password) {
      return NextResponse.json({ error: 'NIP, Nama Lengkap, dan Password harus diisi.' }, { status: 400 });
    }

    const simulatedEmail = nip.includes('@') ? nip : `${nip}@demak.go.id`;

    // 1. Create user in auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: simulatedEmail,
      email_confirm: true, // Auto confirm
      password: password,
      user_metadata: {
        nama_lengkap: nama_lengkap
      }
    });

    if (authError) {
      if (authError.message.includes('User already registered')) {
        return NextResponse.json({ error: 'NIP/ID ini sudah digunakan. Jika satu atasan menjabat di 2 bagian, silakan ubah digit terakhir NIP (contoh: akhiran 1 diganti A) agar tidak lebih dari 18 karakter.' }, { status: 400 });
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Insert into profiles
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        nip,
        nama_lengkap,
        jabatan,
        unit_kerja,
        role: role || 'PEGAWAI'
      })
      .select()
      .single();

    if (profileError) {
      // rollback auth user creation if profile fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ data: profileData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Supabase Service Role Key is missing.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Delete from auth.users (cascades to profiles usually, but let's be safe)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Attempt to manually delete from profiles just in case no cascade
    await supabaseAdmin.from('profiles').delete().eq('id', id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Supabase Service Role Key is missing.' }, { status: 500 });
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await req.json();
    const { id, nip, nama_lengkap, jabatan, unit_kerja, role, password } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Update auth user if password or nip (email) changes
    const authUpdatePayload: any = {};
    if (password) authUpdatePayload.password = password;
    if (nip) {
      const simulatedEmail = nip.includes('@') ? nip : `${nip}@demak.go.id`;
      authUpdatePayload.email = simulatedEmail;
    }
    
    if (Object.keys(authUpdatePayload).length > 0) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdatePayload);
      if (authUpdateError) {
         if (authUpdateError.message.includes('User already registered') || authUpdateError.message.includes('A user with this email address has already been registered')) {
            return NextResponse.json({ error: 'NIP/ID ini sudah digunakan. Jika satu atasan menjabat di 2 bagian, silakan ubah digit terakhir NIP (contoh: akhiran 1 diganti A) agar tidak lebih dari 18 karakter.' }, { status: 400 });
         }
         return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
      }
    }

    // Update Profile
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ nip, nama_lengkap, jabatan, unit_kerja, role })
      .eq('id', id)
      .select()
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ data: profileData });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
