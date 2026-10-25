import { useState, useEffect } from 'react';
import { Download, CheckCircle2, Smartphone, Share2, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InstallPWAButton({ className = "" }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

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
    } else if (isIOS) {
      setShowIOSPrompt(true);
    } else {
      toast('To install: click the browser menu (⋮) and select "Install app" or "Add to Home Screen"', {
        icon: '📱',
        duration: 5000,
      });
    }
  };

  if (isInstalled) return null;

  return (
    <>
      <button
        onClick={handleInstallClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-red-500 text-white text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md shadow-orange-500/20 ${className}`}
        title="Download BunkClub to phone or desktop"
      >
        <Download size={14} className="animate-bounce" />
        <span>Install App</span>
      </button>

      {/* iOS Instructions Modal */}
      {showIOSPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-[#141414] border border-[#262626] p-6 text-white text-center relative">
            <button
              onClick={() => setShowIOSPrompt(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
            <Smartphone size={36} className="mx-auto text-amber-400 mb-3" />
            <h3 className="font-bold text-base mb-2">Install BunkClub on iOS</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Safari doesn't allow one-tap installs, but you can add it in 2 quick steps:
            </p>
            <div className="space-y-3 text-left text-xs bg-white/5 p-3.5 rounded-xl border border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">1</span>
                <span>Tap the <strong>Share</strong> button <Share2 size={13} className="inline text-blue-400 ml-1" /> in Safari</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">2</span>
                <span>Scroll down and tap <strong>"Add to Home Screen"</strong> ➕</span>
              </div>
            </div>
            <button
              onClick={() => setShowIOSPrompt(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-xs"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}