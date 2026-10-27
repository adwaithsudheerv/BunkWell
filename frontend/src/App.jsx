import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TimetablePage from './pages/TimetablePage';
import AttendancePage from './pages/AttendancePage';
import AnalyticsPage from './pages/AnalyticsPage';
import SubjectsPage from './pages/SubjectsPage';
import ProfilePage from './pages/ProfilePage';
import TodayPage from './pages/TodayPage';
import AdminPanelPage from './pages/AdminPanelPage';
import ChatPage from './pages/ChatPage';
import MassBunkPage from './pages/MassBunkPage';
import OfflineBanner from './components/OfflineBanner';
import { autoInitializeNotifications } from './lib/nativeNotifications';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#090b0e' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#0047FF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading BunkClub...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#07090e' }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#0047FF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
  if (!user) return children;
  return user.role === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#05070a' }}>
      <p style={{ color: '#38bdf8', fontSize: '0.9rem', fontFamily: 'monospace' }}>Authenticating Admin Channel...</p>
    </div>
  );
  if (!user || user.role !== 'admin') return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  useEffect(() => {
    // Automatically enable native notification channels and permissions on install & startup
    autoInitializeNotifications();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'rgb(10 14 18 / 0.95)',
                color: '#f2f4f6',
                border: '1px solid rgb(255 255 255 / 0.1)',
                borderRadius: '14px',
                backdropFilter: 'blur(20px)',
                fontSize: '0.9rem',
              },
              success: { iconTheme: { primary: '#0047FF', secondary: '#ffffff' } },
            }}
          />
          <OfflineBanner />
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminPanelPage /></AdminRoute>} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="mass-bunk" element={<MassBunkPage />} />
              <Route path="today" element={<TodayPage />} />
              <Route path="timetable" element={<TimetablePage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="subjects" element={<SubjectsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
