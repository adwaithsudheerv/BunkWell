import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, Cloud } from 'lucide-react';
import offlineSync from '../lib/offlineSync';
import toast from 'react-hot-toast';

export default function OfflineBanner() {
  const [syncState, setSyncState] = useState({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: offlineSync.getQueueLength()
  });
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const unsubscribe = offlineSync.subscribe(setSyncState);

    const handleSyncDone = (e) => {
      const count = e.detail?.count || 1;
      setJustSynced(true);
      toast.success(`Synced ${count} offline updates with cloud! ☁️`, { id: 'offline-sync-done' });
      setTimeout(() => setJustSynced(false), 4000);
    };

    window.addEventListener('bunk_sync_completed', handleSyncDone);

    return () => {
      unsubscribe();
      window.removeEventListener('bunk_sync_completed', handleSyncDone);
    };
  }, []);

  if (syncState.isOnline && syncState.pendingCount === 0 && !justSynced) {
    return null;
  }

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 animate-fade-in pointer-events-none">
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xl border backdrop-blur-md pointer-events-auto transition-all bg-[#0d121f]/95 border-blue-500/30 text-white">
        {!syncState.isOnline ? (
          <>
            <WifiOff size={14} className="text-amber-400 animate-pulse" />
            <span className="text-amber-300">Offline Mode</span>
            <span className="text-[10px] text-slate-400 bg-white/10 px-2 py-0.5 rounded-full">
              {syncState.pendingCount > 0 ? `${syncState.pendingCount} queued` : 'Saved locally'}
            </span>
          </>
        ) : syncState.pendingCount > 0 ? (
          <>
            <RefreshCw size={14} className="text-blue-400 animate-spin" />
            <span className="text-blue-300">Syncing {syncState.pendingCount} updates to cloud...</span>
          </>
        ) : justSynced ? (
          <>
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span className="text-emerald-300">All offline changes synced!</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
