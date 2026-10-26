import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('bunkwell_token');
    const savedUser = localStorage.getItem('bunkwell_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        // ignore
      }
      // Verify token is still valid
      api.get('/auth/me')
        .then(res => setUser(res.data.user))
        .catch(() => { logout(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const checkUsername = async (username) => {
    const res = await api.post('/auth/check-username', { username });
    return res.data;
  };

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('bunkwell_token', res.data.token);
    localStorage.setItem('bunkwell_user', JSON.stringify(res.data.user));
    if (res.data.user?.username) {
      localStorage.setItem('bunkclub_last_username', res.data.user.username);
    }
    setUser(res.data.user);
    return res.data;
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    localStorage.setItem('bunkwell_token', res.data.token);
    localStorage.setItem('bunkwell_user', JSON.stringify(res.data.user));
    if (res.data.user?.username) {
      localStorage.setItem('bunkclub_last_username', res.data.user.username);
    }
    setUser(res.data.user);
    return res.data;
  };

  const resetPasswordDirect = async (username, currentPassword, newPassword) => {
    const res = await api.post('/auth/reset-password-direct', { username, currentPassword, newPassword });
    if (res.data.token) {
      localStorage.setItem('bunkwell_token', res.data.token);
      localStorage.setItem('bunkwell_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
    }
    return res.data;
  };

  const sendOTP = async (identifier) => {
    const res = await api.post('/auth/send-otp', { identifier });
    return res.data;
  };

  const verifyOTP = async (identifier, otp) => {
    const res = await api.post('/auth/verify-otp', { identifier, otp });
    return res.data;
  };

  const resetPasswordWithOTP = async (identifier, otp, newPassword) => {
    const res = await api.post('/auth/reset-password-otp', { identifier, otp, newPassword });
    if (res.data.token) {
      localStorage.setItem('bunkwell_token', res.data.token);
      localStorage.setItem('bunkwell_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
    }
    return res.data;
  };

  const logout = () => {
    if (user?.username) {
      localStorage.setItem('bunkclub_last_username', user.username);
    }
    localStorage.removeItem('bunkwell_token');
    localStorage.removeItem('bunkwell_user');
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('bunkwell_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      checkUsername,
      login,
      register,
      resetPasswordDirect,
      sendOTP,
      verifyOTP,
      resetPasswordWithOTP,
      logout,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
