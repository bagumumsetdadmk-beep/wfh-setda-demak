'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  ClipboardCheck, 
  FileText, 
  LogOut, 
  ChevronRight,
  Menu,
  X,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { supabase, Profile } from '@/lib/supabase';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Pegawai', href: '/dashboard/pegawai', icon: Users },
  { label: 'Jadwal WFH', href: '/dashboard/jadwal', icon: Calendar },
  { label: 'Absensi', href: '/dashboard/absensi', icon: ClipboardCheck },
  { label: 'Laporan Kerja', href: '/dashboard/laporan', icon: FileText },
  { label: 'Persetujuan', href: '/dashboard/approval', icon: Bell },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const getProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (data) {
          setUserProfile(data as Profile);
        } else {
          // Jika profile tidak ditemukan (misal: user dibuat manual via Supabase Dashboard)
          // Berikan fallback profile sementara agar tidak stagnan di "Loading..."
          const email = session.user.email || '';
          const isEmailAdmin = email.toLowerCase().includes('admin');
          
          const fallbackProfile: Profile = {
            id: session.user.id,
            nip: email.split('@')[0] || 'UNKNOWN_NIP',
            nama_lengkap: isEmailAdmin ? 'Administrator' : email.split('@')[0],
            role: isEmailAdmin ? 'ADMIN' : 'PEGAWAI',
            jabatan: isEmailAdmin ? 'Sistem Admin' : 'Pegawai',
          };
          
          setUserProfile(fallbackProfile);
          
          // Opsional: Coba insert ke tabel profiles agar sinkron
          try {
            const { data: newData } = await supabase
              .from('profiles')
              .insert(fallbackProfile)
              .select()
              .single();
            if (newData) setUserProfile(newData as Profile);
          } catch (e) {
            console.error('Failed to auto-insert missing profile', e);
          }
        }
      } else {
        router.push('/');
      }
    };
    getProfile();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const allowedNavItems = navItems.filter(item => {
    if (!userProfile) return true;
    
    // Admin sees everything except Absensi and Laporan Kerja
    if (userProfile.role === 'ADMIN') {
      const restrictedForAdmin = ['Absensi', 'Laporan Kerja'];
      return !restrictedForAdmin.includes(item.label);
    }

    // Atasan sees only Dashboard, Jadwal WFH, and Persetujuan
    if (userProfile.role === 'ATASAN') {
      const allowedForAtasan = ['Dashboard', 'Jadwal WFH', 'Persetujuan'];
      return allowedForAtasan.includes(item.label);
    }

    // Pegawai sees everything except Pegawai and Persetujuan
    if (userProfile.role === 'PEGAWAI') {
      const restrictedForPegawai = ['Pegawai', 'Persetujuan'];
      return !restrictedForPegawai.includes(item.label);
    }

    return true;
  });

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar - Desktop */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="hidden md:flex flex-col bg-white text-slate-600 border-r border-slate-200"
      >
        <div className="p-6 flex items-center gap-3 border-b border-slate-50">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-600/20 overflow-hidden">
            <img 
              src="/logo-sidebar.png" 
              alt="L" 
              className="w-full h-full object-contain p-1"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const span = document.createElement('span');
                  span.className = "font-bold text-white";
                  span.innerText = "D";
                  parent.appendChild(span);
                }
              }}
            />
          </div>
          {isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col"
            >
              <span className="font-display font-bold text-slate-800 leading-none">SETDA DEMAK</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">E-WFH Portal</span>
            </motion.div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {allowedNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all group font-medium text-sm",
                  isActive 
                    ? "bg-indigo-50 text-indigo-700" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon size={20} className={cn("shrink-0", isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-indigo-500")} />
                {isSidebarOpen && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-50">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all font-medium text-sm"
          >
            <LogOut size={20} className="shrink-0" />
            {isSidebarOpen && <span>Keluar</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 md:flex hidden transition-colors"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-sm font-bold text-slate-800 hidden md:block leading-none">
                Setda Kabupaten Demak
              </h1>
              <p className="text-[10px] text-slate-500 font-medium hidden md:block mt-1">E-WFH Monitoring System</p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800 leading-tight">
                {userProfile ? userProfile.nama_lengkap : 'Loading...'}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                {userProfile ? (userProfile.jabatan || userProfile.role) : ''}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
               {userProfile ? userProfile.nama_lengkap.substring(0, 2) : '..'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
