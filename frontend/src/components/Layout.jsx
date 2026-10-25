import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard, CalendarDays, ClipboardCheck, BarChart3,
  BookOpen, User, LogOut, Menu, X, Sun, Moon
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import InstallPWAButton from './InstallPWAButton';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/today', icon: ClipboardCheck, label: "Today's Class" },
  { to: '/timetable', icon: CalendarDays, label: 'Timetable' },
  { to: '/attendance', icon: BookOpen, label: 'Attendance Log' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics & Bunk' },
  { to: '/subjects', icon: BookOpen, label: 'Subjects' },
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
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const SidebarContent = ({ onNavigate }) => (
    <div className="flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className={`flex items-center justify-between px-5 py-5 border-b ${isDark ? 'border-white/10' : 'border-[#e6e1d6]'}`}>
        <Link to="/dashboard" className="flex items-center">
          <img
            src={isDark ? '/logo-white.png' : '/logo-dark.png'}
            alt="BunkClub"
            className="h-7 w-auto object-contain"
          />
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

      {/* PWA Install Button */}
      <div className="px-3 pt-3">
        <InstallPWAButton className="w-full justify-center py-2" />
      </div>

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
          <Link to="/dashboard" className="flex items-center">
            <img
              src={isDark ? '/logo-white.png' : '/logo-dark.png'}
              alt="BunkClub"
              className="h-7 w-auto object-contain"
            />
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-lg ${isDark ? 'text-slate-300' : 'text-black'}`}
            >
              {isDark ? <Sun size={17} className="text-blue-400" /> : <Moon size={17} className="text-black" />}
            </button>
            <InstallPWAButton className="py-1 px-2.5 text-[11px]" />
            <button
              onClick={() => setDrawerOpen(true)}
              className={`p-2 rounded-lg ${isDark ? 'text-slate-300 hover:text-white' : 'text-black hover:bg-[#ede7db]'}`}
            >
              <Menu size={22} />
            </button>
          </div>
        </header>

        {/* Content outlet */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}