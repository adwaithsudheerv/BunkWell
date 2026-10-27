import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Flame, Send, UserPlus, Clock, Trash2,
  ShieldCheck, CheckCheck, FileText, Zap, Eye,
  AlertCircle, Check, X, Shield, Lock
} from 'lucide-react';

const QUICK_CHITS = [
  '🤫 Is proxy marked for me?',
  '🏃‍♂️ Are you bunking next period?',
  '📝 Is faculty taking attendance now?',
  '☕ Meet at the canteen?',
  '🚨 Everyone bunking today?',
  '😴 Sleeping in this lecture, wake me up!'
];

const BURN_TIMERS = [
  { label: '10s Burn', seconds: 10 },
  { label: '30s Burn', seconds: 30 },
  { label: '2m Burn', seconds: 120 },
  { label: '5m Burn', seconds: 300 }
];

export default function GhostChitView({ subjects = [] }) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Connection Handshake State
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [requestInput, setRequestInput] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  // Democratic 2-Peer Vouch State
  const [vouchStatus, setVouchStatus] = useState({ isVerified: true, vouchCount: 2, classCode: 'MCA-A' });
  const [showVouchModal, setShowVouchModal] = useState(false);
  const [vouchTargetInput, setVouchTargetInput] = useState('');

  // Chit & Message State
  const [inputText, setInputText] = useState('');
  const [sendAsChit, setSendAsChit] = useState(false);
  const [burnTimer, setBurnTimer] = useState(30);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncPeriod, setSyncPeriod] = useState(1);
  const [syncSubject, setSyncSubject] = useState(subjects[0]?.name || 'Current Class');

  const messagesEndRef = useRef(null);

  // Load friends & pending connection requests
  const loadConnections = async () => {
    try {
      const res = await api.get('/chat/friends');
      setFriends(res.data.friends || []);
      setIncomingRequests(res.data.incoming || []);
      setOutgoingRequests(res.data.outgoing || []);
    } catch (e) {}
  };

  // Load vouch status
  const loadVouchStatus = async () => {
    try {
      const res = await api.get('/chat/vouch/status');
      setVouchStatus(res.data);
    } catch (e) {}
  };

  // Load 1-on-1 conversations (only accepted connections)
  const loadConversations = async () => {
    try {
      const res = await api.get('/chat/conversations');
      const list = res.data.conversations || [];
      setConversations(list);

      if (!activeConv && list.length > 0) {
        setActiveConv(list[0]);
        setBurnTimer(list[0].disappearingTimer || 30);
      }
    } catch (err) {
      console.warn('Failed to load channels:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load messages for the active conversation
  const loadMessages = async (convId) => {
    if (!convId) return;
    try {
      const res = await api.get(`/chat/conversations/${convId}/messages`);
      setMessages(res.data.messages || []);
      if (res.data.disappearingTimer) setBurnTimer(res.data.disappearingTimer);
    } catch (e) {}
  };

  useEffect(() => {
    loadConnections();
    loadConversations();
    loadVouchStatus();

    const interval = setInterval(() => {
      loadConnections();
      if (activeConv?._id) loadMessages(activeConv._id);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeConv?._id]);

  useEffect(() => {
    if (activeConv?._id) {
      loadMessages(activeConv._id);
    }
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send Connection / Chit Request by exact User ID
  const handleSendRequest = async (e) => {
    e?.preventDefault();
    const clean = requestInput.trim().replace('@', '');
    if (!clean) return;

    setSendingRequest(true);
    try {
      const res = await api.post('/chat/friends/request', { username: clean });
      toast.success(res.data.message || `Request sent to @${clean}!`);
      setRequestInput('');
      loadConnections();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send request');
    } finally {
      setSendingRequest(false);
    }
  };

  // Respond to incoming connection request (Accept / Reject)
  const handleRespondRequest = async (requestId, action) => {
    try {
      const res = await api.post('/chat/friends/respond', { requestId, action });
      toast.success(res.data.message);
      loadConnections();
      loadConversations();
    } catch (err) {
      toast.error('Failed to respond to request');
    }
  };

  // Give a Peer Vouch to a Classmate
  const handlePeerVouch = async (e) => {
    e?.preventDefault();
    const clean = vouchTargetInput.trim().replace('@', '');
    if (!clean) return;

    try {
      const res = await api.post('/chat/vouch/peer', { targetUsername: clean });
      toast.success(res.data.message);
      setVouchTargetInput('');
      setShowVouchModal(false);
      loadVouchStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to vouch');
    }
  };

  // Start or open 1-on-1 channel with an accepted friend
  const handleOpenChannelWithFriend = async (friendUsername) => {
    try {
      const res = await api.post('/chat/conversations/by-username', { username: friendUsername });
      const conv = res.data.conversation;
      setActiveConv(conv);
      setBurnTimer(conv.disappearingTimer || 30);
      loadConversations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Connection pending or locked');
    }
  };

  // Send regular ephemeral message or secret folded Chit
  const handleSendMessage = async (textToSend, forcedChit = false) => {
    const content = textToSend || inputText;
    if (!content.trim() || !activeConv?._id) return;

    const isChit = forcedChit || sendAsChit;

    try {
      const res = await api.post(`/chat/conversations/${activeConv._id}/messages`, {
        content: content.trim(),
        type: isChit ? 'chit' : 'text',
        isChit,
        burnSeconds: burnTimer,
        customTimer: burnTimer
      });

      setMessages(prev => [...prev, res.data.message]);
      setInputText('');
      setSendAsChit(false);
      loadConversations();

      if (isChit) {
        toast.success(`📜 Secret Chit passed to @${getPartnerUsername()}!`);
      }
    } catch (err) {
      toast.error('Failed to send');
    }
  };

  // Open & Unfold a Secret Chit (Starts its burn timer)
  const handleOpenChit = async (msgId) => {
    try {
      const res = await api.post(`/chat/messages/${msgId}/open-chit`);
      setMessages(prev => prev.map(m => m._id === msgId ? res.data.message : m));
      toast('🔥 Chit unfolded! Self-destruct countdown started.', { icon: '📜' });
    } catch (err) {
      toast.error('This chit has already burned away');
    }
  };

  // Send Bunk Buddy Sync Ping
  const handleSendBunkSync = async () => {
    if (!activeConv?._id) return;
    try {
      const res = await api.post(`/chat/conversations/${activeConv._id}/bunk-sync`, {
        period: syncPeriod,
        subject: syncSubject
      });
      setShowSyncModal(false);
      setMessages(prev => [...prev, res.data.message]);
      if (res.data.agreed) {
        toast.success('🤝 Bunk Synced! Both of you agreed to bunk!', { icon: '🔥' });
      } else {
        toast.success(`Bunk Sync Ping sent for Period ${syncPeriod}! 🏃‍♂️`);
      }
    } catch (e) {
      toast.error('Failed to send Bunk Sync');
    }
  };

  // Incinerate & Wipe Entire Session Clean
  const handleBurnSession = async () => {
    if (!activeConv?._id) return;
    if (!window.confirm(`Incinerate all messages with @${getPartnerUsername()}? Zero traces will remain.`)) return;

    try {
      await api.delete(`/chat/conversations/${activeConv._id}/burn`);
      setMessages([]);
      loadConversations();
      toast.success('🔥 Channel incinerated cleanly. Zero traces left.');
    } catch (e) {
      toast.error('Failed to burn channel');
    }
  };

  // Change burn timer
  const handleUpdateTimer = async (seconds) => {
    setBurnTimer(seconds);
    setShowTimerMenu(false);
    if (!activeConv?._id) return;

    try {
      await api.post(`/chat/conversations/${activeConv._id}/disappearing`, { seconds });
      const lbl = BURN_TIMERS.find(t => t.seconds === seconds)?.label || `${seconds}s`;
      toast.success(`Burn timer set to ${lbl} 🔥`);
    } catch (e) {}
  };

  const getPartner = () => {
    return activeConv?.participants?.find(p => String(p._id) !== String(user?._id));
  };

  const getPartnerUsername = () => {
    return getPartner()?.username || activeConv?.name || 'User';
  };

  // Remaining seconds calculation
  const getRemainingSecs = (msg) => {
    if (!msg.expiresAt) return null;
    const diff = Math.max(0, Math.round((new Date(msg.expiresAt).getTime() - Date.now()) / 1000));
    return diff;
  };

  return (
    <div className={`rounded-3xl border shadow-2xl flex flex-col h-[82vh] overflow-hidden transition-all select-none ${
      isDark
        ? 'bg-[#0a0d14] border-slate-800 text-white shadow-black/50'
        : 'bg-[#faf8f5] border-stone-300 text-stone-900 shadow-xl'
    }`}>
      {/* Top Bar: Class Scope, Vouch Status & Actions */}
      <div className={`p-3.5 border-b flex flex-wrap items-center justify-between gap-3 ${
        isDark ? 'border-white/10 bg-[#0f141f]/90' : 'border-stone-200 bg-white/90'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/25">
            <Flame size={20} className="fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm sm:text-base tracking-tight leading-tight">
                Ghost Terminal
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                <Shield size={10} />
                <span>{vouchStatus.classCode || 'MCA-A'}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <span>Private 1-on-1 Backchannel</span>
              <span>•</span>
              <span className={vouchStatus.isVerified ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {vouchStatus.isVerified ? '🛡️ 2-Peer Verified' : `⏳ ${vouchStatus.vouchCount}/2 Vouches`}
              </span>
            </p>
          </div>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-2">
          {/* Peer Vouch Trigger Button */}
          <button
            onClick={() => setShowVouchModal(true)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 ${
              isDark ? 'bg-white/5 border-white/10 text-slate-300 hover:text-white' : 'bg-stone-100 border-stone-200 text-stone-700'
            }`}
            title="Democratic Peer Vouch (Verify Classmate)"
          >
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">Vouch Classmate</span>
          </button>

          {/* Active Partner Info & Actions */}
          {activeConv && (
            <>
              <div className={`px-3 py-1.5 rounded-2xl border flex items-center gap-2 ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-stone-100 border-stone-200'
              }`}>
                <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-[11px] flex items-center justify-center">
                  {getPartnerUsername().charAt(0).toUpperCase()}
                </div>
                <span className="font-extrabold text-xs">@{getPartnerUsername()}</span>
              </div>

              {/* Burn Timer Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowTimerMenu(!showTimerMenu)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                    isDark
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                      : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                  }`}
                  title="Change Burn Timer"
                >
                  <Clock size={13} />
                  <span>{burnTimer}s Burn</span>
                </button>

                {showTimerMenu && (
                  <div className={`absolute right-0 top-full mt-2 w-36 rounded-2xl border shadow-xl p-1.5 z-50 backdrop-blur-xl ${
                    isDark ? 'bg-[#182030] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}>
                    {BURN_TIMERS.map(t => (
                      <button
                        key={t.seconds}
                        onClick={() => handleUpdateTimer(t.seconds)}
                        className={`w-full px-3 py-1.5 rounded-xl text-xs font-bold text-left transition-colors flex items-center justify-between ${
                          burnTimer === t.seconds
                            ? 'bg-red-500 text-white'
                            : isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                        }`}
                      >
                        <span>{t.label}</span>
                        {burnTimer === t.seconds && <Flame size={12} className="fill-white" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bunk Sync Ping Button */}
              <button
                onClick={() => setShowSyncModal(true)}
                className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold flex items-center gap-1 shadow-sm transition-all"
                title="Ping to Sync Bunk"
              >
                <Zap size={13} className="fill-white" />
                <span className="hidden sm:inline">Bunk Sync</span>
              </button>

              {/* Incinerate Channel Button */}
              <button
                onClick={handleBurnSession}
                className="p-2 rounded-xl text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all"
                title="Incinerate All Messages (Clean Slate)"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Incoming Connection Requests Banner (Zero Random Chatting Allowed) */}
      {incomingRequests.length > 0 && (
        <div className="p-3 bg-amber-500/10 border-b border-amber-500/30 space-y-2 animate-[fadeIn_0.2s_ease-out]">
          <span className="text-xs font-black text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
            <Lock size={13} />
            <span>Incoming Chit Requests ({incomingRequests.length})</span>
          </span>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {incomingRequests.map(req => (
              <div
                key={req._id}
                className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-black/30 dark:bg-white/5 border border-amber-500/20"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-black font-black text-xs flex items-center justify-center flex-shrink-0">
                    {req.sender?.username?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">@{req.sender?.username}</p>
                    <p className="text-[10px] text-slate-400">Wants to unlock 1-on-1 secret chits</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleRespondRequest(req._id, 'accept')}
                    className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-sm active:scale-95 transition-all"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRespondRequest(req._id, 'reject')}
                    className="px-2.5 py-1 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 font-bold text-xs"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Handshake Request Sender & Accepted Classmates Bar (NO PUBLIC USER DIRECTORY) */}
      <div className={`px-3.5 py-2.5 border-b flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 ${
        isDark ? 'border-white/5 bg-[#0b0f17]' : 'border-stone-200 bg-[#f5f2eb]'
      }`}>
        {/* Send Request by exact User ID */}
        <form onSubmit={handleSendRequest} className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
            isDark ? 'bg-white/5 border-white/10' : 'bg-white border-stone-300'
          }`}>
            <UserPlus size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Enter @username to request..."
              value={requestInput}
              onChange={(e) => setRequestInput(e.target.value)}
              className="bg-transparent text-xs font-semibold focus:outline-none placeholder-slate-400 w-44 sm:w-52"
            />
          </div>
          <button
            type="submit"
            disabled={!requestInput.trim() || sendingRequest}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-xs shadow-sm flex-shrink-0"
          >
            {sendingRequest ? '...' : 'Send Request'}
          </button>
        </form>

        {/* Accepted Friends Horizontal Bar (Only verified mutual connections) */}
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar pt-1 sm:pt-0">
          {friends.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic">
              No accepted classmates yet. Enter a classmate's User ID to connect!
            </p>
          ) : (
            friends.map(f => {
              const isSelected = getPartnerUsername().toLowerCase() === f.username.toLowerCase();
              return (
                <button
                  key={f._id}
                  onClick={() => handleOpenChannelWithFriend(f.username)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold flex-shrink-0 transition-all flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-400 shadow-sm scale-105 font-black'
                      : isDark
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10 border-white/5'
                      : 'bg-white text-stone-700 hover:bg-stone-100 border-stone-200'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-emerald-500 text-white font-black text-[9px] flex items-center justify-center">
                    ✓
                  </div>
                  <span>@{f.username}</span>
                  {isSelected && <Flame size={11} className="fill-white" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Secret Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!activeConv ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <FileText size={32} />
            </div>
            <h4 className="font-extrabold text-base">Select or Request a Classmate Above</h4>
            <p className="text-xs text-slate-400 max-w-sm">
              Zero public directories. To pass secret chits, enter your classmate's exact User ID to send a private Chit Request.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
            <p className="text-sm font-extrabold text-slate-400">
              Channel is 100% clean with @{getPartnerUsername()}
            </p>
            <p className="text-xs text-slate-500">
              Zero logs recorded. Pass a secret chit below to start. 🔥
            </p>
          </div>
        ) : (
          messages.map(msg => {
            const isMine = String(msg.sender) === String(user?._id) || msg.senderName === user?.username;
            const remaining = getRemainingSecs(msg);

            // 1. Folded Secret Chit Card
            if (msg.type === 'chit' || msg.isChit) {
              const isUnopened = !msg.isOpened && !isMine;

              return (
                <div
                  key={msg._id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} my-2`}
                >
                  <div className={`p-4 rounded-3xl border shadow-xl max-w-sm transition-all ${
                    isUnopened
                      ? 'bg-gradient-to-br from-amber-600/30 via-red-950/40 to-black border-amber-500/50 cursor-pointer hover:scale-[1.02]'
                      : isMine
                      ? 'bg-gradient-to-br from-amber-950/60 to-black/80 border-amber-500/30'
                      : 'bg-[#151c28] border-slate-700'
                  }`}>
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 mb-2">
                      <div className="flex items-center gap-1.5 text-xs font-black text-amber-400 uppercase tracking-wider">
                        <FileText size={14} />
                        <span>{isMine ? 'Secret Chit Sent' : 'Incoming Classroom Chit'}</span>
                      </div>
                      {remaining !== null && (
                        <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-red-400 animate-pulse">
                          <Flame size={12} className="fill-red-400" />
                          <span>{remaining}s left</span>
                        </span>
                      )}
                    </div>

                    {isUnopened ? (
                      <button
                        onClick={() => handleOpenChit(msg._id)}
                        className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <Eye size={15} />
                        <span>Tap to Unfold & Burn ({msg.burnSeconds || 30}s)</span>
                      </button>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white break-words">
                          {msg.content}
                        </p>
                        <p className="text-[10px] text-amber-400/80 font-mono">
                          {msg.isOpened ? '🔥 Unfolded — burning away' : 'Waiting for recipient to unfold'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // 2. Bunk Buddy Sync Card
            if (msg.type === 'bunk_sync') {
              const isAgreed = msg.bunkSync?.isAgreed;

              return (
                <div key={msg._id} className="flex justify-center my-3">
                  <div className={`p-4 rounded-3xl border shadow-xl max-w-md w-full text-center ${
                    isAgreed
                      ? 'bg-gradient-to-r from-emerald-950/80 via-black to-emerald-950/80 border-emerald-500/50 text-white'
                      : 'bg-gradient-to-r from-blue-950/80 via-black to-purple-950/80 border-blue-500/40 text-white'
                  }`}>
                    <div className="flex items-center justify-center gap-2 mb-1.5">
                      <Zap size={18} className={isAgreed ? 'text-emerald-400 fill-emerald-400' : 'text-blue-400 fill-blue-400'} />
                      <span className="font-black text-xs uppercase tracking-wider">
                        {isAgreed ? '🤝 Bunk Synced & Confirmed' : '🚨 Mutual Bunk Proposal'}
                      </span>
                    </div>
                    <p className="text-sm font-extrabold mb-2">
                      {msg.content}
                    </p>
                    {!isAgreed && !isMine && (
                      <button
                        onClick={handleSendBunkSync}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg active:scale-95 transition-all"
                      >
                        Agree to Bunk Together 🔥
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // 3. Regular Ephemeral Whisper Message
            return (
              <div
                key={msg._id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div className={`px-4 py-2.5 rounded-3xl max-w-sm sm:max-w-md shadow-md text-sm break-words relative ${
                  isMine
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : isDark ? 'bg-[#182232] text-slate-100 rounded-bl-none' : 'bg-white text-stone-900 border border-stone-200 rounded-bl-none'
                }`}>
                  <p className="font-medium leading-relaxed">{msg.content}</p>
                  <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] opacity-75 font-mono">
                    {remaining !== null && (
                      <span className="flex items-center gap-0.5 text-amber-300">
                        <Clock size={10} />
                        <span>{remaining}s</span>
                      </span>
                    )}
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Secret "Pass-The-Chit" Quick Chips */}
      {activeConv && (
        <div className={`px-3 py-2 border-t flex items-center gap-1.5 overflow-x-auto no-scrollbar ${
          isDark ? 'border-white/5 bg-[#0c101a]' : 'border-stone-200 bg-stone-50'
        }`}>
          <span className="text-[10px] font-bold text-amber-400 flex-shrink-0 uppercase flex items-center gap-1">
            <FileText size={11} />
            <span>Chits:</span>
          </span>
          {QUICK_CHITS.map((chit, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(chit, true)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex-shrink-0 border transition-all ${
                isDark
                  ? 'bg-white/5 hover:bg-amber-500/20 hover:border-amber-500/40 text-slate-300 hover:text-white border-white/5'
                  : 'bg-white hover:bg-amber-100 hover:border-amber-300 text-stone-700 border-stone-200'
              }`}
            >
              {chit}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      {activeConv && (
        <div className={`p-3 border-t flex items-center gap-2 ${
          isDark ? 'border-white/10 bg-[#0f1422]' : 'border-stone-200 bg-white'
        }`}>
          {/* Toggle Chit Mode */}
          <button
            onClick={() => setSendAsChit(!sendAsChit)}
            className={`p-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              sendAsChit
                ? 'bg-amber-500 text-black border-amber-400 shadow-md font-black'
                : isDark ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white' : 'bg-stone-100 border-stone-200 text-stone-600'
            }`}
            title="Toggle Secret Chit Mode (Folded & Burn)"
          >
            <FileText size={16} />
            <span className="hidden sm:inline">{sendAsChit ? 'Chit Mode ON' : 'Fold Chit'}</span>
          </button>

          <input
            type="text"
            placeholder={sendAsChit ? `Write secret chit for @${getPartnerUsername()}...` : `Whisper to @${getPartnerUsername()}...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className={`flex-1 p-2.5 rounded-2xl text-xs sm:text-sm font-medium border focus:outline-none transition-all ${
              sendAsChit
                ? 'border-amber-500/60 focus:ring-2 focus:ring-amber-500'
                : 'focus:ring-2 focus:ring-blue-500'
            } ${
              isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-stone-100 border-stone-300 text-stone-900'
            }`}
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim()}
            className={`p-3 rounded-2xl transition-all shadow-lg active:scale-90 ${
              sendAsChit
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Send size={16} />
          </button>
        </div>
      )}

      {/* Bunk Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`p-6 rounded-3xl border shadow-2xl max-w-sm w-full space-y-4 animate-[scaleUp_0.2s_ease-out] ${
            isDark ? 'bg-[#101624] border-slate-700 text-white' : 'bg-white border-stone-200 text-stone-900'
          }`}>
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Zap size={20} className="text-blue-500 fill-blue-500" />
                <h3 className="font-extrabold text-sm sm:text-base">
                  Bunk Sync with @{getPartnerUsername()}
                </h3>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Select Period:
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map(p => (
                    <button
                      key={p}
                      onClick={() => setSyncPeriod(p)}
                      className={`py-2 rounded-xl text-xs font-black transition-all ${
                        syncPeriod === p
                          ? 'bg-blue-600 text-white shadow-md'
                          : isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-stone-100'
                      }`}
                    >
                      P{p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                  Subject:
                </label>
                <select
                  value={syncSubject}
                  onChange={(e) => setSyncSubject(e.target.value)}
                  className={`w-full p-2.5 rounded-xl text-xs font-bold border focus:outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-stone-100 border-stone-300 text-stone-900'
                  }`}
                >
                  {subjects.length > 0 ? (
                    subjects.map(s => <option key={s._id} value={s.name}>{s.name}</option>)
                  ) : (
                    <option value="Current Class">Current Class</option>
                  )}
                </select>
              </div>
            </div>

            <button
              onClick={handleSendBunkSync}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Zap size={15} className="fill-white" />
              <span>Send Mutual Bunk Ping</span>
            </button>
          </div>
        </div>
      )}

      {/* Democratic 2-Peer Vouch Modal (No Single CR Monopoly) */}
      {showVouchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`p-6 rounded-3xl border shadow-2xl max-w-sm w-full space-y-4 animate-[scaleUp_0.2s_ease-out] ${
            isDark ? 'bg-[#101624] border-slate-700 text-white' : 'bg-white border-stone-200 text-stone-900'
          }`}>
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-400" />
                <h3 className="font-extrabold text-sm sm:text-base">
                  Democratic Peer Vouch
                </h3>
              </div>
              <button
                onClick={() => setShowVouchModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-400 leading-relaxed">
                Confirm a student sits in your class ({vouchStatus.classCode || 'MCA-A'}). Once 2 classmates vouch for them, they are officially verified to view and vote on class Mass Bunks.
              </p>
              <form onSubmit={handlePeerVouch} className="space-y-3 pt-2">
                <input
                  type="text"
                  placeholder="Enter classmate's @username..."
                  value={vouchTargetInput}
                  onChange={(e) => setVouchTargetInput(e.target.value)}
                  className={`w-full p-2.5 rounded-xl text-xs font-bold border focus:outline-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-stone-100 border-stone-300 text-stone-900'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!vouchTargetInput.trim()}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Vouch for Classmate</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
