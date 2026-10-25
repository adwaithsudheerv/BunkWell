import axios from 'axios';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
    return 'https://bunkwell-backend.onrender.com/api';
  }
  return 'http://localhost:5000/api';
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
