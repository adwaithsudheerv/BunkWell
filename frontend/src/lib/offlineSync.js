// Offline Synchronization Engine for BunkClub (Web + Android Native)

const CACHE_PREFIX = 'bunk_cache_';
const QUEUE_KEY = 'bunk_sync_queue';

class OfflineSyncManager {
  constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.listeners = new Set();
    this.isSyncing = false;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyListeners();
        this.flushQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyListeners();
      });

      // Background periodic sync check every 15 seconds
      setInterval(() => {
        if (this.isOnline && this.getQueueLength() > 0 && !this.isSyncing) {
          this.flushQueue();
        }
      }, 15000);
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback({ isOnline: this.isOnline, pendingCount: this.getQueueLength() });
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    const state = { isOnline: this.isOnline, pendingCount: this.getQueueLength() };
    this.listeners.forEach(cb => cb(state));
  }

  // --- Local Cache Management ---
  saveCache(url, data) {
    try {
      if (!url) return;
      const cleanKey = CACHE_PREFIX + url.split('?')[0];
      localStorage.setItem(cleanKey, JSON.stringify({
        timestamp: Date.now(),
        data
      }));
    } catch (e) {
      console.warn('Cache write failed:', e);
    }
  }

  getCache(url) {
    try {
      if (!url) return null;
      const cleanKey = CACHE_PREFIX + url.split('?')[0];
      const raw = localStorage.getItem(cleanKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  // --- Offline Mutation Queue ---
  enqueueAction(url, method, data) {
    try {
      const queue = this.getQueue();
      const item = {
        id: 'sync_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        url,
        method: method.toLowerCase(),
        data,
        createdAt: Date.now()
      };
      queue.push(item);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      
      // Perform optimistic update on cached datasets
      this.applyOptimisticUpdate(url, data);

      this.notifyListeners();
      return item;
    } catch (e) {
      console.error('Failed to queue offline action:', e);
      return null;
    }
  }

  getQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  getQueueLength() {
    return this.getQueue().length;
  }

  // Optimistic In-Memory & LocalStorage Update for Instant Feedback
  applyOptimisticUpdate(url, payload) {
    try {
      if (url.includes('/attendance/quick-mark') && payload) {
        const { subjectId, status } = payload;
        const subjectsData = this.getCache('/subjects');
        if (subjectsData && subjectsData.subjects) {
          const sub = subjectsData.subjects.find(s => s._id === subjectId);
          if (sub) {
            sub.totalClasses = (sub.totalClasses || 0) + 1;
            if (status === 'attended') {
              sub.attendedClasses = (sub.attendedClasses || 0) + 1;
            } else if (status === 'missed') {
              if (!sub.bunkHistory) sub.bunkHistory = [];
              sub.bunkHistory.unshift({ date: new Date().toISOString(), period: 1 });
            }
            this.saveCache('/subjects', subjectsData);
          }
        }
      }

      if (url.includes('/attendance/mark') && payload) {
        const { subjectId, status } = payload;
        // Update today's schedule cache
        const todayData = this.getCache('/timetable/today');
        if (todayData && todayData.schedule && todayData.schedule.periods) {
          const period = todayData.schedule.periods.find(p => 
            p.periodNumber === payload.periodNumber || (p.subjectId && (p.subjectId._id === subjectId || p.subjectId === subjectId))
          );
          if (period) {
            period.status = status;
            this.saveCache('/timetable/today', todayData);
          }
        }

        // Also update subjects totals
        const subjectsData = this.getCache('/subjects');
        if (subjectsData && subjectsData.subjects) {
          const sub = subjectsData.subjects.find(s => s._id === subjectId);
          if (sub) {
            sub.totalClasses = (sub.totalClasses || 0) + 1;
            if (status === 'present' || status === 'attended') {
              sub.attendedClasses = (sub.attendedClasses || 0) + 1;
            } else if (status === 'absent' || status === 'missed') {
              if (!sub.bunkHistory) sub.bunkHistory = [];
              sub.bunkHistory.unshift({ date: new Date().toISOString(), period: payload.periodNumber || 1 });
            }
            this.saveCache('/subjects', subjectsData);
          }
        }
      }
    } catch (e) {
      console.warn('Optimistic cache update error:', e);
    }
  }

  setApiClient(client) {
    this.apiClient = client;
  }

  // Flush Queue to Remote Backend
  async flushQueue(apiClient) {
    if (this.isSyncing) return;
    const queue = this.getQueue();
    if (queue.length === 0) return;

    const client = apiClient || this.apiClient;
    if (!client) {
      console.warn('[OfflineSync] API client not ready yet, skipping queue flush.');
      return;
    }

    this.isSyncing = true;
    console.log(`[OfflineSync] Syncing ${queue.length} pending actions to cloud...`);

    const remaining = [];

    for (const item of queue) {
      try {
        await client.request({
          url: item.url,
          method: item.method,
          data: item.data,
          headers: { 'X-Offline-Replay': 'true' }
        });
        console.log(`[OfflineSync] Successfully synced: ${item.method.toUpperCase()} ${item.url}`);
      } catch (err) {
        // If network still failing, preserve action in queue
        if (!err.response) {
          remaining.push(item);
        } else {
          console.warn(`[OfflineSync] Server rejected synced action:`, err.response?.data);
        }
      }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    this.isSyncing = false;
    this.notifyListeners();

    if (remaining.length === 0 && queue.length > 0) {
      window.dispatchEvent(new CustomEvent('bunk_sync_completed', { detail: { count: queue.length } }));
    }
  }
}

export const offlineSync = new OfflineSyncManager();
export default offlineSync;
