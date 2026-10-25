import axios from 'axios';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    // If running in Capacitor Android Native App or Render domain
    if (window.Capacitor || window.location.protocol === 'capacitor:' || window.location.hostname.includes('onrender.com')) {
      return 'https://bunkwell-backend.onrender.com/api';
    }
    // Local development browser
    if (window.location.hostname === 'localhost' && window.location.port === '5173') {
      return 'http://localhost:5000/api';
    }
  }
  return 'https://bunkwell-backend.onrender.com/api';
};

const API_BASE = getBaseUrl();

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('bunkwell_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('bunkwell_token');
      localStorage.removeItem('bunkwell_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
