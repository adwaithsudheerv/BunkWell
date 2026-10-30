import axios from 'axios';
import offlineSync from './offlineSync';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // ONLY use localhost:5000 when developing in desktop browser with Vite (port 5173)
    if (window.location.hostname === 'localhost' && window.location.port === '5173') {
      return 'http://localhost:5000/api';
    }
  }

  // Standalone Android APK, Render Production, and all mobile/production environments
  return 'https://bunkwell-backend.onrender.com/api';
};

const API_BASE = getBaseUrl();

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 45000,
});

offlineSync.setApiClient(api);

// Attach JWT token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('bunkwell_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response Interceptor: Stale-While-Revalidate Caching & Offline Queuing
api.interceptors.response.use(
  res => {
    // Cache all successful GET queries locally for offline use
    if (res.config?.method?.toLowerCase() === 'get' && res.config.url) {
      offlineSync.saveCache(res.config.url, res.data);
    }
    return res;
  },
  err => {
    const isNetworkError = !err.response || err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || err.code === 'ECONNABORTED';
    const config = err.config;

    // 1. Handle GET requests offline: Serve from local cache
    if (isNetworkError && config?.method?.toLowerCase() === 'get') {
      const cachedData = offlineSync.getCache(config.url);
      if (cachedData) {
        console.warn(`[Offline Mode] Serving ${config.url} from local offline cache.`);
        return Promise.resolve({
          data: cachedData,
          status: 200,
          statusText: 'OK (Offline Cache)',
          headers: {},
          config,
          isOffline: true
        });
      }
    }

    // 2. Handle Attendance Mutations offline: Queue for background sync
    if (isNetworkError && config && (config.method?.toLowerCase() === 'post' || config.method?.toLowerCase() === 'put')) {
      const isAttendanceMutation = config.url?.includes('/attendance/');
      if (isAttendanceMutation) {
        let payload = null;
        try {
          payload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        } catch (e) {
          payload = config.data;
        }

        offlineSync.enqueueAction(config.url, config.method, payload);

        return Promise.resolve({
          data: {
            success: true,
            message: 'Saved offline! Will automatically sync when connected ⚡',
            isOfflineQueued: true
          },
          status: 200,
          statusText: 'OK (Queued Offline)',
          headers: {},
          config,
          isOffline: true
        });
      }
    }

    // Handle 401: Only redirect to /login for protected API routes, never on /auth endpoints
    if (err.response?.status === 401 && !config?.url?.includes('/auth/')) {
      localStorage.removeItem('bunkwell_token');
      localStorage.removeItem('bunkwell_user');
      window.location.href = '/login';
    }

    return Promise.reject(err);
  }
);

export default api;
