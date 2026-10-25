import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, CalendarDays, ClipboardCheck, BarChart3,
  BookOpen, User, LogOut, Menu, X, GraduationCap, Sparkles
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/today', icon: ClipboardCheck, label: "Today's Class" },
  { to: '/timetable', icon: CalendarDays, label: 'Timetable' },
  { to: '/attendance', icon: BookOpen, label: 'Attendance Log' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics & Bunk' },
  { to: '/subjects', icon: GraduationCap, label: 'Subjects' },
  { to: '/profile', icon: User, label: 'Profile' },
];

function NavItem({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-gradient-to-r from-[color:var(--yellow,#f59e0b)] to-[color:var(--red,#ef4444)] text-white shadow-lg shadow-orange-500/20 font-semibold'
            : 'text-[color:var(--color-muted)] hover:text-white hover:bg-white/5'
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
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const SidebarContent = ({ onNavigate }) => (
    <div className="flex flex-col h-full">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-[color:var(--color-line)]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[color:var(--yellow,#f59e0b)] to-[color:var(--red,#ef4444)] flex items-center justify-center text-white shadow-md shadow-orange-500/30">
          <GraduationCap size={20} />
        </div>
        <div>
          <h1 className="font-bold text-white text-base leading-tight">Bunkwell</h1>
          <p className="text-xs text-[color:var(--color-muted)] flex items-center gap-1">
            <Sparkles size={11} className="text-amber-400" /> Smart Attendance
          </p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navItems.map(item => (
          <NavItem key={item.to} {...item} onClick={onNavigate} />
        ))}
      </nav>

      {/* User info & Logout */}
      <div className="p-3 border-t border-[color:var(--color-line)] bg-black/20">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">{user?.name || 'Student'}</p>
            <p className="text-xs text-[color:var(--color-muted)] truncate">ID: {user?.studentId || user?.username}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: '#000', color: 'var(--text-light-grey)' }}>
      {/* Background ambient lighting */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background: 'radial-gradient(circle 500px at 0% 100%, rgba(0, 0, 255, 0.18), transparent 70%), radial-gradient(circle 500px at 100% 0%, rgba(238, 130, 238, 0.15), transparent 70%)',
        }}
      />

      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 border-r border-[color:var(--color-line)] bg-[color:var(--glass-bg-color)] backdrop-blur-[16px] sticky top-0 h-screen z-20">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-[#0d0e12] border-r border-[color:var(--color-line)] flex flex-col z-10 shadow-2xl">
            <div className="flex items-center justify-end px-4 pt-4">
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white">
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
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-line)] bg-[#0d0e12]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-amber-500 to-red-500 flex items-center justify-center text-white">
              <GraduationCap size={15} />
            </div>
            <span className="font-bold text-white text-base">Bunkwell</span>
          </div>
          <button onClick={() => setDrawerOpen(true)} className="p-2 rounded-lg text-slate-300 hover:text-white">
            <Menu size={22} />
          </button>
        </header>

        {/* Content outlet */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
