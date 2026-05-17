'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { cn } from '@/lib/utils';
import { supabase, Profile } from '@/lib/supabase';
import { 
  Users, 
  CalendarIcon, 
  Camera, 
  FileCheck, 
  ArrowUpRight, 
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';

export default function DashboardPage() {
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>({});
  const [chartData, setChartData] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchProfileAndData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      
      let profile = null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (data) {
        profile = data as Profile;
        setUserProfile(profile);
      } else {
        const email = session.user.email || '';
        const isEmailAdmin = email.toLowerCase().includes('admin');
        profile = {
          id: session.user.id,
          nip: email.split('@')[0] || 'UNKNOWN',
          nama_lengkap: isEmailAdmin ? 'Administrator' : email.split('@')[0],
          role: isEmailAdmin ? 'ADMIN' : 'PEGAWAI',
          jabatan: isEmailAdmin ? 'Sistem Admin' : 'Pegawai',
        } as Profile;
        setUserProfile(profile);
      }

      // Fetch dashboard numeric data based on role
      const now = new Date();
      const today = new Date().toLocaleDateString('en-CA');
      
      // Use local ISO format for start/end of day to match Supabase TIMESTAMPTZ correctly
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

      const dataStore: any = {};

      if (profile.role === 'PEGAWAI') {
        const [wfhRes, absenRes, reportRes, activityRes] = await Promise.all([
          // Check for any active WFH schedule for today
          supabase.from('wfh_schedules').select('*').eq('user_id', profile.id).eq('tanggal', today),
          supabase.from('attendance').select('*').eq('user_id', profile.id).gte('waktu_absen', startOfDay).lte('waktu_absen', endOfDay),
          supabase.from('work_reports').select('*').eq('user_id', profile.id).eq('tanggal', today),
          supabase.from('attendance').select('*, profiles!attendance_user_id_fkey(nama_lengkap)').eq('user_id', profile.id).order('waktu_absen', { ascending: false }).limit(5)
        ]);

        const activeWfh = (wfhRes.data || []).find(w => w.status === 'APPROVED' || w.status === 'CONFIRMED' || w.status === 'DONE');
        // If no specifically approved one found, take the first one that isn't cancelled as a fallback
        const anyWfh = activeWfh || (wfhRes.data || []).find(w => w.status !== 'CANCELLED');
        
        dataStore.isWfh = !!anyWfh;
        dataStore.wfhData = anyWfh;
        dataStore.absenMasuk = (absenRes.data || []).find((a: any) => (a.type || a.tipe) === 'MASUK');
        dataStore.absenPulang = (absenRes.data || []).find((a: any) => (a.type || a.tipe) === 'PULANG');
        dataStore.reports = reportRes.data || [];
        dataStore.activities = activityRes.data || [];
        
      } else {
        const [wfhRes, absenRes, reportRencanaRes, reportHasilRes, activityRes] = await Promise.all([
          supabase.from('wfh_schedules').select('*', { count: 'exact', head: true }).eq('tanggal', today).neq('status', 'CANCELLED'),
          supabase.from('attendance').select('*', { count: 'exact', head: true }).or(`type.eq.MASUK,tipe.eq.MASUK`).gte('waktu_absen', startOfDay).lte('waktu_absen', endOfDay),
          supabase.from('work_reports').select('*', { count: 'exact', head: true }).eq('tanggal', today).eq('tipe', 'RENCANA'),
          supabase.from('work_reports').select('*', { count: 'exact', head: true }).eq('tanggal', today).eq('tipe', 'HASIL'),
          supabase.from('attendance').select('*, profiles!attendance_user_id_fkey(nama_lengkap)').order('waktu_absen', { ascending: false }).limit(5)
        ]);

        dataStore.wfhCount = wfhRes.count || 0;
        dataStore.absenCount = absenRes.count || 0;
        dataStore.reportRencanaCount = reportRencanaRes.count || 0;
        dataStore.reportHasilCount = reportHasilRes.count || 0;
        dataStore.activities = activityRes.data || [];
      }

      const weekDays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum'];
      const dynamicChartData = weekDays.map(day => ({ name: day, wfh: 0, absensi: 0 }));
      
      // Calculate start of current week (Monday)
      const currentDay = now.getDay();
      const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const mondayDate = new Date(now);
      mondayDate.setDate(now.getDate() + diffToMonday);
      mondayDate.setHours(0, 0, 0, 0);
      const startOfWeekStr = mondayDate.toISOString();

      if (profile.role === 'PEGAWAI') {
        const [wfhWeekRes, absenWeekRes] = await Promise.all([
          supabase.from('wfh_schedules').select('tanggal').eq('user_id', profile.id).gte('tanggal', startOfWeekStr.split('T')[0]),
          supabase.from('attendance').select('waktu_absen, tipe, type').eq('user_id', profile.id).gte('waktu_absen', startOfWeekStr)
        ]);

        (wfhWeekRes.data || []).forEach(w => {
          const wDay = new Date(w.tanggal).getDay();
          if (wDay >= 1 && wDay <= 5) dynamicChartData[wDay - 1].wfh += 10; // scale up for chart visibility
        });

        (absenWeekRes.data || []).forEach(a => {
          const aDay = new Date(a.waktu_absen).getDay();
          if (aDay >= 1 && aDay <= 5 && ((a.type || a.tipe) === 'MASUK')) dynamicChartData[aDay - 1].absensi += 10;
        });

      } else {
        const [wfhWeekRes, absenWeekRes] = await Promise.all([
          supabase.from('wfh_schedules').select('tanggal').gte('tanggal', startOfWeekStr.split('T')[0]).neq('status', 'CANCELLED'),
          supabase.from('attendance').select('waktu_absen, tipe, type').gte('waktu_absen', startOfWeekStr).or(`type.eq.MASUK,tipe.eq.MASUK`)
        ]);

        (wfhWeekRes.data || []).forEach(w => {
          const wDay = new Date(w.tanggal).getDay();
          if (wDay >= 1 && wDay <= 5) dynamicChartData[wDay - 1].wfh += 1;
        });

        (absenWeekRes.data || []).forEach(a => {
          const aDay = new Date(a.waktu_absen).getDay();
          if (aDay >= 1 && aDay <= 5) dynamicChartData[aDay - 1].absensi += 1;
        });
      }

      setChartData(dynamicChartData);
      setDashboardData(dataStore);
      setLoading(false);
    };
    
    fetchProfileAndData();
  }, [router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </DashboardLayout>
    );
  }

  const isPegawai = userProfile?.role === 'PEGAWAI';

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-none mb-1">
            {userProfile?.role === 'PEGAWAI' ? `Selamat Datang, ${userProfile?.nama_lengkap}` : 
             userProfile?.role === 'ATASAN' ? `Dashboard Monitoring - ${userProfile?.nama_lengkap}` : 
             'Beranda Dashboard Administrator'}
          </h2>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500 font-medium">Pemantauan Work From Home (WFH) - {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            {userProfile?.unit_kerja && (
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-tight">
                {userProfile.unit_kerja}
              </span>
            )}
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 auto-rows-[140px]">
          
          {isPegawai ? (
            // PEGAWAI VIEW
            <>
              <div className="md:col-span-4 md:row-span-2 dashboard-card flex flex-col justify-between">
                <div>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Status WFH Hari Ini</p>
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                    {dashboardData.isWfh ? 'Terjadwal WFH' : 'Tidak Terjadwal'}
                  </h2>
                  <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-2">
                    {dashboardData.isWfh ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertCircle size={12} className="text-amber-500" />} 
                    {dashboardData.isWfh ? `Status: ${dashboardData.wfhData?.status}` : 'Anda tidak dijadwalkan WFH hari ini'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mt-4">
                  <CalendarIcon size={20} />
                </div>
              </div>

              <div className="md:col-span-4 md:row-span-2 dashboard-card flex flex-col justify-between">
                <div>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Absensi Hari Ini</p>
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                    {dashboardData.absenMasuk ? 'Sudah Absen' : 'Belum Absen'}
                  </h2>
                  <p className={cn("text-[10px] font-bold mt-2", dashboardData.absenMasuk ? "text-emerald-500" : "text-rose-500")}>
                    {dashboardData.absenMasuk 
                      ? `Waktu Masuk: ${new Date(dashboardData.absenMasuk.waktu_absen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` 
                      : 'Harap lakukan absensi masuk'}
                  </p>
                </div>
                <button 
                  onClick={() => router.push('/dashboard/absensi')}
                  className={cn(
                    "w-full mt-4 py-2 rounded-xl text-xs font-bold transition-all",
                    dashboardData.absenMasuk
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  )}
                >
                  {dashboardData.absenMasuk ? 'Lihat Absensi' : 'Absen Sekarang'}
                </button>
              </div>

              <div className="md:col-span-4 md:row-span-2 bg-indigo-600 rounded-2xl p-6 shadow-xl shadow-indigo-600/20 text-white flex flex-col justify-between">
                <div>
                  <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-wider mb-2">Laporan Kinerja</p>
                  <h2 className="text-3xl font-bold tracking-tight">
                    {dashboardData.reports?.length > 0 ? `${dashboardData.reports.length} Laporan` : 'Kosong'}
                  </h2>
                  <p className="text-[10px] text-indigo-200 mt-2">
                    {dashboardData.reports?.length > 0 ? 'Sudah mengisi laporan hari ini' : 'Belum ada laporan hari ini'}
                  </p>
                </div>
                <button 
                  onClick={() => router.push('/dashboard/laporan')}
                  className="w-full py-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-all backdrop-blur-md"
                >
                  Buat Laporan
                </button>
              </div>
            </>
          ) : (
            // ADMIN / ATASAN VIEW
            <>
              <div className="md:col-span-4 md:row-span-2 dashboard-card flex flex-col justify-between">
                <div>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Terjadwal WFH</p>
                  <h2 className="text-4xl font-bold text-slate-900 tracking-tight">{dashboardData.wfhCount || 0}</h2>
                  <p className="text-[10px] text-slate-400 font-medium mt-2 flex items-center gap-1">
                    <CalendarIcon size={12} /> Total jadwal WFH hari ini
                  </p>
                </div>
                <div className="flex gap-1 h-2 bg-slate-100 rounded-full overflow-hidden mt-4">
                  <div className="w-full bg-indigo-500"></div>
                </div>
              </div>

              <div className="md:col-span-4 md:row-span-2 dashboard-card flex flex-col justify-between">
                <div>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Swafoto Terkirim</p>
                  <h2 className="text-4xl font-bold text-slate-900 tracking-tight">
                    {dashboardData.absenCount || 0} <span className="text-lg text-slate-400 font-normal">/ {dashboardData.wfhCount || 0}</span>
                  </h2>
                  <p className="text-[10px] text-amber-500 font-bold mt-2">
                    {((dashboardData.wfhCount || 0) - (dashboardData.absenCount || 0)) > 0 
                      ? `${(dashboardData.wfhCount || 0) - (dashboardData.absenCount || 0)} Pegawai belum absen masuk`
                      : 'Semua telah absen hari ini'}
                  </p>
                </div>
                <div className="flex -space-x-2 mt-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-slate-400">
                      <Camera size={12} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-4 md:row-span-2 bg-indigo-600 rounded-2xl p-6 shadow-xl shadow-indigo-600/20 text-white flex flex-col justify-between">
                <div>
                  <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-wider mb-2">Laporan Masuk Hari Ini</p>
                  <div className="flex justify-between items-end mb-2 gap-4">
                      <div>
                          <p className="text-[10px] text-indigo-200 uppercase tracking-widest mt-2">Rencana</p>
                          <h2 className="text-3xl font-bold tracking-tight">{dashboardData.reportRencanaCount || 0}</h2>
                      </div>
                      <div className="text-right">
                           <p className="text-[10px] text-indigo-200 uppercase tracking-widest mt-2">Hasil</p>
                           <h2 className="text-3xl font-bold tracking-tight">{dashboardData.reportHasilCount || 0}</h2>
                      </div>
                  </div>
                </div>
                <button 
                  onClick={() => router.push('/dashboard/approval')}
                  className="w-full py-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold transition-all backdrop-blur-md mt-2"
                >
                  Tinjau Semua
                </button>
              </div>
            </>
          )}

          {/* Chart Section */}
          <div className="md:col-span-8 md:row-span-4 dashboard-card">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-sm font-bold text-slate-800 tracking-tight">Statistik Mingguan {isPegawai ? 'Anda' : ''}</h4>
              <select className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-lg px-3 py-1 cursor-pointer outline-none uppercase tracking-wider">
                <option>Minggu Ini</option>
                <option>Minggu Lalu</option>
              </select>
            </div>
            <div className="h-64 sm:h-80 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorWfh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                  />
                  <Tooltip 
                    contentStyle={{ border: 'none', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey={isPegawai ? 'absensi' : 'wfh'} stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorWfh)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="md:col-span-4 md:row-span-4 dashboard-card flex flex-col">
             <h4 className="text-sm font-bold text-slate-800 mb-6 tracking-tight">Aktivitas Terkini {isPegawai ? 'Anda' : ''}</h4>
              <div className="space-y-5 flex-1 overflow-y-auto pr-1">
                {dashboardData.activities?.slice(0, 4).map((act: any, i: number) => (
                  <div key={i} className="flex gap-4 items-start p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-2 shrink-0",
                      (act.type || act.tipe) === 'MASUK' ? 'bg-emerald-500' : 'bg-indigo-500'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate leading-none mb-1">
                        {isPegawai ? userProfile?.nama_lengkap : (Array.isArray(act.profiles) ? act.profiles[0]?.nama_lengkap : act.profiles?.nama_lengkap) || 'Pegawai'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">Absensi {(act.type || act.tipe) === 'MASUK' ? 'Masuk' : 'Pulang'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400">
                        {new Date(act.waktu_absen).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                        {new Date(act.waktu_absen).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                
                {dashboardData.activities?.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">Belum ada aktivitas hari ini</p>
                )}
              </div>
              <button className="w-full mt-6 text-[10px] font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 py-3 border border-slate-200 rounded-xl transition-all uppercase tracking-widest">
                Tinjau Semua Aktivitas
              </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
