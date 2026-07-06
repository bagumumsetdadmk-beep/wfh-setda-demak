const fs = require('fs');
const path = 'app/dashboard/approval/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldQueries = `      const startOfDay = \`\${selectedDate}T00:00:00+07:00\`;
      const endOfDay = \`\${selectedDate}T23:59:59+07:00\`;

      let attendanceQuery = supabase.from('attendance')
        .select('*, profiles!attendance_user_id_fkey!inner(id, nama_lengkap, nip, unit_kerja)')
        .gte('waktu_absen', startOfDay)
        .lte('waktu_absen', endOfDay)
        .order('waktu_absen', { ascending: false });

      let reportQuery = supabase.from('work_reports')
        .select('*, profiles!work_reports_user_id_fkey!inner(id, nama_lengkap, nip, unit_kerja)')
        .eq('tanggal', selectedDate)
        .order('created_at', { ascending: false });

      if (!adminStatus && unitKerja) {
        attendanceQuery = attendanceQuery.eq('profiles.unit_kerja', unitKerja);
        reportQuery = reportQuery.eq('profiles.unit_kerja', unitKerja);
      }

      const [attendances, reports] = await Promise.all([
        attendanceQuery,
        reportQuery
      ]);

      if (attendances.error) {
        console.error('Attendance fetch error:', attendances.error);
      }
      if (reports.error) {
        console.error('Reports fetch error:', reports.error);
      }

      const attendanceItems: ApprovalItem[] = (attendances.data || [])`;

const newQueries = `      const startOfDay = \`\${selectedDate}T00:00:00+07:00\`;
      const endOfDay = \`\${selectedDate}T23:59:59+07:00\`;

      let qAttDate = supabase.from('attendance').select('*, profiles!attendance_user_id_fkey!inner(id, nama_lengkap, nip, unit_kerja)').gte('waktu_absen', startOfDay).lte('waktu_absen', endOfDay).order('waktu_absen', { ascending: false });
      let qAttPending = supabase.from('attendance').select('*, profiles!attendance_user_id_fkey!inner(id, nama_lengkap, nip, unit_kerja)').or('status.eq.PENDING,status.eq.pending,status.is.null').order('waktu_absen', { ascending: false });
      
      let qRepDate = supabase.from('work_reports').select('*, profiles!work_reports_user_id_fkey!inner(id, nama_lengkap, nip, unit_kerja)').eq('tanggal', selectedDate).order('created_at', { ascending: false });
      let qRepPending = supabase.from('work_reports').select('*, profiles!work_reports_user_id_fkey!inner(id, nama_lengkap, nip, unit_kerja)').or('status_approval.eq.PENDING,status_approval.eq.pending,status_approval.is.null,status.eq.PENDING,status.eq.pending,status.is.null').order('created_at', { ascending: false });

      if (!adminStatus && unitKerja) {
        qAttDate = qAttDate.eq('profiles.unit_kerja', unitKerja);
        qAttPending = qAttPending.eq('profiles.unit_kerja', unitKerja);
        qRepDate = qRepDate.eq('profiles.unit_kerja', unitKerja);
        qRepPending = qRepPending.eq('profiles.unit_kerja', unitKerja);
      }

      const [resAttDate, resAttPending, resRepDate, resRepPending] = await Promise.all([
        qAttDate, qAttPending, qRepDate, qRepPending
      ]);

      // Merge and deduplicate
      const attMap = new Map();
      [...(resAttDate.data || []), ...(resAttPending.data || [])].forEach(a => attMap.set(a.id, a));
      const mergedAttendances = Array.from(attMap.values()).sort((a, b) => new Date(b.waktu_absen).getTime() - new Date(a.waktu_absen).getTime());

      const repMap = new Map();
      [...(resRepDate.data || []), ...(resRepPending.data || [])].forEach(r => repMap.set(r.id, r));
      const mergedReports = Array.from(repMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const attendanceItems: ApprovalItem[] = mergedAttendances`;

content = content.replace(oldQueries, newQueries);
fs.writeFileSync(path, content, 'utf8');
console.log('patched');
