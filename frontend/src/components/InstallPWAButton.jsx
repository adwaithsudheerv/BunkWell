import { useState, useEffect } from 'react';
import { Download, Monitor, Smartphone, Share2, X, CheckCircle2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';

export default function InstallPWAButton({ className = "" }) {
  // If running inside the native Android mobile app, never show download/install option
  if (Capacitor.isNativePlatform()) return null;

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [platform, setPlatform] = useState('desktop'); // 'desktop' | 'android' | 'ios'

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success('BunkClub installed to your device! 🎉');
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      // Show clear visual install guide modal
      setShowModal(true);
    }
  };

  if (isInstalled) return null;

  return (
    <>
      <button
        onClick={handleInstallClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all ${className}`}
        title="Install BunkClub App"
      >
        <Download size={14} />
        <span>Install App</span>
      </button>

      {/* Visual Install Guide Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.15s_ease-out]">
          <div className="w-full max-w-md rounded-3xl modal-surface shadow-2xl p-6 relative">
            {/* Close button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
                <Download size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Install BunkClub App</h3>
                <p className="text-xs text-slate-400">Add to your phone or desktop screen</p>
              </div>
            </div>

            {/* Platform selector */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-white/5 rounded-xl mb-4 text-xs font-semibold">
              <button
                onClick={() => setPlatform('desktop')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  platform === 'desktop' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Monitor size={13} /> Desktop
              </button>
              <button
                onClick={() => setPlatform('android')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  platform === 'android' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone size={13} /> Android
              </button>
              <button
                onClick={() => setPlatform('ios')}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  platform === 'ios' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Share2 size={13} /> iPhone
              </button>
            </div>

            {/* Instructions based on platform */}
            {platform === 'desktop' && (
              <div className="space-y-3 bg-white/[0.03] p-4 rounded-2xl border border-white/5 text-xs text-slate-300">
                <p className="font-semibold text-white">How to install on Windows / Mac (Chrome or Edge):</p>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">1</span>
                  <span>Look at the right side of your <strong>browser URL address bar</strong> at the top.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">2</span>
                  <span>Click the <strong>Install icon (⊕ or desktop monitor icon)</strong> in the address bar.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">3</span>
                  <span>Or click the browser menu (⋮) $\rightarrow$ <strong>"Install BunkClub..."</strong>.</span>
                </div>
              </div>
            )}

            {platform === 'android' && (
              <div className="space-y-3 bg-white/[0.03] p-4 rounded-2xl border border-white/5 text-xs text-slate-300">
                <p className="font-semibold text-white">How to install on Android (Chrome):</p>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">1</span>
                  <span>Tap the <strong>three dots (⋮)</strong> menu on the top-right in Chrome.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">2</span>
                  <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">3</span>
                  <span>Confirm by tapping <strong>Install</strong>. The app icon will appear on your home screen!</span>
                </div>
              </div>
            )}

            {platform === 'ios' && (
              <div className="space-y-3 bg-white/[0.03] p-4 rounded-2xl border border-white/5 text-xs text-slate-300">
                <p className="font-semibold text-white">How to install on iPhone / iPad (Safari):</p>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">1</span>
                  <span>Tap the <strong>Share button (box with upward arrow)</strong> at the bottom of Safari.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">2</span>
                  <span>Scroll down and tap <strong>"Add to Home Screen" ➕</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">3</span>
                  <span>Tap <strong>Add</strong> on the top-right. BunkClub will launch in standalone fullscreen!</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}