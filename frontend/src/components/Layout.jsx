import { Outlet, NavLink, useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard, CalendarDays, ClipboardCheck, BarChart3,
  BookOpen, User, LogOut, Menu, X, Sun, Moon, Zap, GraduationCap
} from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import InstallPWAButton from './InstallPWAButton';
import DailyWrapUpModal from './DailyWrapUpModal';
import AppUpdateModal from './AppUpdateModal';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/subjects', icon: GraduationCap, label: 'Subjects' },
  { to: '/timetable', icon: CalendarDays, label: 'Timetable' },
  { to: '/attendance', icon: BookOpen, label: 'Attendance Log' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics & Bunk' },
  { to: '/profile', icon: User, label: 'Profile' },
];

function NavItem({ to, icon: Icon, label, onClick, isDark }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 font-bold'
            : isDark
            ? 'text-slate-400 hover:text-white hover:bg-white/5'
            : 'text-stone-700 hover:text-black hover:bg-[#ede7db] font-semibold'
        }`
      }
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();

  // Master Admin must never see student layout or dashboard
  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wrapUpOpen, setWrapUpOpen] = useState(false);

  // Evening 6:00 PM auto pop-up reconciliation check
  useEffect(() => {
    try {
      const now = new Date();
      const hourKolkata = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(now), 10);
      const dateKey = now.toISOString().split('T')[0];
      const hasDismissedToday = localStorage.getItem('wrapup_prompt_' + dateKey) === 'true';
      const isAlreadyDone = localStorage.getItem('wrapup_done_' + dateKey) === 'true';

      if (hourKolkata >= 18 && !hasDismissedToday && !isAlreadyDone) {
        setWrapUpOpen(true);
        localStorage.setItem('wrapup_prompt_' + dateKey, 'true');
      }
    } catch (e) {
      console.warn('Auto wrap-up check error:', e);
    }
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const SidebarContent = ({ onNavigate }) => (
    <div className="flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className={`flex items-center justify-between px-5 py-5 border-b ${isDark ? 'border-white/10' : 'border-[#e6e1d6]'}`}>
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-black/90 border border-blue-500/30 flex items-center justify-center overflow-hidden shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <img
              src="/logo-blue.png"
              alt="BunkClub"
              className="w-7 h-7 object-contain"
            />
          </div>
          <span className="bunkclub-brand text-2xl tracking-tight font-extrabold select-none">
            <span className={isDark ? "text-white" : "text-[#0a0a0c]"}>Bunk</span>
            <span className="text-blue-500">Club</span>
          </span>
        </Link>
        {/* Dark / Light Mode Toggle */}
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-xl transition-all ${
            isDark
              ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
              : 'bg-[#ede7db] hover:bg-[#e2dcce] text-black font-bold'
          }`}
          title={isDark ? 'Switch to Day Mode (Cream & Black)' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun size={17} className="text-blue-400" /> : <Moon size={17} className="text-black" />}
        </button>
      </div>

      {/* PWA Install Button (Web Only) */}
      {!Capacitor.isNativePlatform() && (
        <div className="px-3 pt-3">
          <InstallPWAButton className="w-full justify-center py-2" />
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <NavItem key={item.to} {...item} onClick={onNavigate} isDark={isDark} />
        ))}
      </nav>

      {/* User info & Logout */}
      <div className={`p-3 border-t ${isDark ? 'border-white/10 bg-black/40' : 'border-[#e6e1d6] bg-[#f5f1e8]'}`}>
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm">
            {(user?.username || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-bold truncate leading-tight ${isDark ? 'text-white' : 'text-black'}`}>
              @{user?.username || 'user'}
            </p>
            <p className={`text-[11px] truncate ${isDark ? 'text-blue-400 font-medium' : 'text-blue-600 font-bold'}`}>
              24/7 Cloud Tracker
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>

        {/* Creator Attribution */}
        <div className={`mt-2 pt-2 border-t ${isDark ? 'border-white/5' : 'border-black/5'} text-[10px] px-2 text-center`}>
          <p className={isDark ? 'text-slate-400' : 'text-stone-600'}>
            Architected by <span className="font-bold text-blue-500">Adwaith Sudheer</span>
          </p>
          <a
            href="mailto:adwaithsudheerv@gmail.com"
            className="text-slate-500 hover:text-blue-400 truncate block mt-0.5 transition-colors"
          >
            adwaithsudheerv@gmail.com
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-screen flex transition-colors duration-200 ${
        isDark ? 'bg-[#090b0e] text-slate-100' : 'bg-[#f8f6f0] text-[#0a0a0c]'
      }`}
    >
      {/* Background ambient lighting for Dark Mode */}
      {isDark && (
        <div
          className="fixed inset-0 pointer-events-none -z-10"
          style={{
            background: 'radial-gradient(circle 600px at 0% 100%, rgba(0, 71, 255, 0.12), transparent 70%), radial-gradient(circle 600px at 100% 0%, rgba(37, 99, 235, 0.08), transparent 70%)',
          }}
        />
      )}

      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden lg:flex flex-col w-64 flex-shrink-0 sticky top-0 h-screen z-20 transition-colors duration-200 ${
          isDark
            ? 'border-r border-white/10 bg-[#0c0e14]/90 backdrop-blur-xl'
            : 'border-r border-[#e6e1d6] bg-[#fbf9f4]/95 backdrop-blur-xl shadow-sm text-black'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside
            className={`absolute left-0 top-0 h-full w-72 flex flex-col z-10 shadow-2xl transition-colors ${
              isDark ? 'bg-[#0c0e14] border-r border-white/10' : 'bg-[#fbf9f4] border-r border-[#e6e1d6] text-black'
            }`}
          >
            <div className="flex items-center justify-end px-4 pt-4">
              <button
                onClick={() => setDrawerOpen(false)}
                className={`p-1.5 rounded-lg ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-black'}`}
              >
                <X size={20} />
              </button>
            </div>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header
          className={`lg:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-10 backdrop-blur-md transition-colors ${
            isDark ? 'border-white/10 bg-[#0c0e14]/90' : 'border-[#e6e1d6] bg-[#fbf9f4]/95 text-black'
          }`}
        >
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-black/90 border border-blue-500/30 flex items-center justify-center overflow-hidden shadow-sm shadow-blue-500/20">
              <img
                src="/logo-blue.png"
                alt="BunkClub"
                className="w-6 h-6 object-contain"
              />
            </div>
            <span className="bunkclub-brand text-xl sm:text-2xl tracking-tight font-extrabold select-none">
              <span className={isDark ? "text-white" : "text-[#0a0a0c]"}>Bunk</span>
              <span className="text-blue-500">Club</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-lg ${isDark ? 'text-slate-300' : 'text-black'}`}
            >
              {isDark ? <Sun size={17} className="text-blue-400" /> : <Moon size={17} className="text-black" />}
            </button>
            {!Capacitor.isNativePlatform() && (
              <InstallPWAButton className="py-1 px-2.5 text-[11px]" />
            )}
            <button
              onClick={() => setDrawerOpen(true)}
              className={`p-2 rounded-lg ${isDark ? 'text-slate-300 hover:text-white' : 'text-black hover:bg-[#ede7db]'}`}
            >
              <Menu size={22} />
            </button>
          </div>
        </header>

        {/* Content outlet */}
        <main className="flex-1 p-3 sm:p-4 lg:p-8 max-w-7xl mx-auto w-full pb-24 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Fixed Native Mobile Bottom Navigation Bar (Thumb-reach Ergonomics) */}
      <nav
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-2xl px-2 py-1.5 flex items-center justify-around transition-all ${
          isDark
            ? 'bg-[#090b0e]/95 border-white/10 text-slate-400'
            : 'bg-[#faf8f5]/95 border-black/10 text-slate-600 shadow-xl'
        }`}
      >
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
              isActive ? 'text-blue-500 scale-105' : 'hover:text-white'
            }`
          }
        >
          <LayoutDashboard size={19} />
          <span>Home</span>
        </NavLink>

        <NavLink
          to="/subjects"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
              isActive ? 'text-blue-500 scale-105' : 'hover:text-white'
            }`
          }
        >
          <GraduationCap size={19} />
          <span>Subjects</span>
        </NavLink>

        {/* Center Hero Daily Wrap-Up Button */}
        <button
          type="button"
          onClick={() => setWrapUpOpen(true)}
          className="flex flex-col items-center justify-center -mt-5 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/40 active:scale-90 transition-all border-2 border-[#090b0e] flex-shrink-0"
          title="Daily Attendance Reconciliation"
        >
          <Zap size={20} className="fill-white" />
        </button>

        <NavLink
          to="/timetable"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
              isActive ? 'text-blue-500 scale-105' : 'hover:text-white'
            }`
          }
        >
          <CalendarDays size={19} />
          <span>Schedule</span>
        </NavLink>

        <NavLink
          to="/attendance"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
              isActive ? 'text-blue-500 scale-105' : 'hover:text-white'
            }`
          }
        >
          <BookOpen size={19} />
          <span>Register</span>
        </NavLink>
      </nav>

      {/* Floating Daily Wrap-Up Button (Desktop Only) */}
      <button
        onClick={() => setWrapUpOpen(true)}
        className="hidden lg:flex fixed bottom-6 right-6 z-40 items-center gap-2 px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-xl shadow-blue-500/35 active:scale-95 transition-all hover:scale-105 border border-blue-400/30"
        title="1-Tap Attendance Reconcile"
      >
        <Zap size={15} className="fill-white" />
        <span>Daily Wrap-Up</span>
      </button>

      <DailyWrapUpModal isOpen={wrapUpOpen} onClose={() => setWrapUpOpen(false)} />
      <AppUpdateModal />
    </div>
  );
}