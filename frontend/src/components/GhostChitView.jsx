import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Flame, Send, UserPlus, Clock, Trash2,
  ShieldCheck, CheckCheck, FileText, Zap, Eye,
  AlertCircle, Check, X, Shield, Lock, ChevronLeft,
  MessageCircle, CornerDownLeft, Sparkles
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

  // Navigation / View State
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Accepted Classmates (Side by side) & Requests
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [requestInput, setRequestInput] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  // Vouch State
  const [vouchStatus, setVouchStatus] = useState({ isVerified: true, vouchCount: 2, classCode: 'MCA-A' });
  const [showVouchModal, setShowVouchModal] = useState(false);
  const [vouchTargetInput, setVouchTargetInput] = useState('');

  // Personal Space Inputs
  const [inputText, setInputText] = useState('');
  const [isViewOnceMode, setIsViewOnceMode] = useState(true); // Default to one-time viewable format!
  const [burnTimer, setBurnTimer] = useState(30);
  const [showTimerMenu, setShowTimerMenu] = useState(false);

  // Bunk Sync Modal
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncPeriod, setSyncPeriod] = useState(1);
  const [syncSubject, setSyncSubject] = useState(subjects[0]?.name || 'Current Class');

  // One-Time Direct Reply Pop-up Model
  const [activeQuickReplyMsg, setActiveQuickReplyMsg] = useState(null);
  const [quickReplyText, setQuickReplyText] = useState('');

  const messagesEndRef = useRef(null);

  // Load friends & pending connection requests
  const loadConnections = async () => {
    try {
      const res = await api.get('/chat/friends');
      setFriends(res.data.friends || []);
      setIncomingRequests(res.data.incoming || []);
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

      // Auto-select first friend's conversation if none active and screen is desktop
      if (!activeConv && list.length > 0 && window.innerWidth >= 768) {
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
    }, 2500);

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

  // Send Connection Request
  const handleSendRequest = async (e) => {
    e?.preventDefault();
    const clean = requestInput.trim().replace('@', '');
    if (!clean) return;

    setSendingRequest(true);
    try {
      const res = await api.post('/chat/friends/request', { username: clean });
      toast.success(res.data.message || `Request sent to @${clean}!`);
      setRequestInput('');
      setShowAddModal(false);
      loadConnections();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send request');
    } finally {
      setSendingRequest(false);
    }
  };

  // Respond to incoming connection request
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

  // Open a friend's personal space
  const handleSelectFriend = async (friendUsername) => {
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

  // Send message (Supports View-Once / 1-Time Chit format)
  const handleSendMessage = async (textToSend, forcedViewOnce = false, replyToMsgId = null) => {
    const content = textToSend || inputText;
    if (!content.trim() || !activeConv?._id) return;

    const isViewOnce = forcedViewOnce || isViewOnceMode;

    try {
      const res = await api.post(`/chat/conversations/${activeConv._id}/messages`, {
        content: content.trim(),
        type: isViewOnce ? 'chit' : 'text',
        isViewOnce,
        isChit: isViewOnce,
        burnSeconds: isViewOnce ? 15 : burnTimer,
        customTimer: burnTimer,
        replyToMsgId
      });

      // If this was a reply to a viewed message, delete it locally
      if (replyToMsgId) {
        setMessages(prev => prev.filter(m => m._id !== replyToMsgId));
        setActiveQuickReplyMsg(null);
        setQuickReplyText('');
        toast.success('Replied & burned original chit! 🔥');
      }

      setMessages(prev => [...prev, res.data.message]);
      setInputText('');
      loadConversations();
    } catch (err) {
      toast.error('Failed to send');
    }
  };

  // Open & Unfold a View-Once Chit (Triggers direct reply & 15s burn)
  const handleOpenViewOnce = async (msg) => {
    try {
      const res = await api.post(`/chat/messages/${msg._id}/open-chit`);
      setMessages(prev => prev.map(m => m._id === msg._id ? res.data.message : m));
      // Pop up direct reply input right then and there!
      setActiveQuickReplyMsg(res.data.message);
      toast('① One-time view unlocked! Reply now before it burns out.', { icon: '🔥' });
    } catch (err) {
      toast.error('This chit has already burned out');
    }
  };

  // Submit Direct Reply to burned message
  const handleQuickReplySubmit = async (e) => {
    e?.preventDefault();
    if (!quickReplyText.trim() || !activeQuickReplyMsg) return;
    await handleSendMessage(quickReplyText, true, activeQuickReplyMsg._id);
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
      toast.success('🔥 Personal space incinerated cleanly.');
    } catch (e) {
      toast.error('Failed to burn channel');
    }
  };

  // Peer Vouch
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

  const getPartner = () => {
    return activeConv?.participants?.find(p => String(p._id) !== String(user?._id));
  };

  const getPartnerUsername = () => {
    return getPartner()?.username || activeConv?.name || 'User';
  };

  const getRemainingSecs = (msg) => {
    if (!msg.expiresAt) return null;
    const diff = Math.max(0, Math.round((new Date(msg.expiresAt).getTime() - Date.now()) / 1000));
    return diff;
  };

  return (
    <div className={`rounded-3xl border shadow-2xl flex flex-col md:flex-row h-[84vh] overflow-hidden transition-all select-none ${
      isDark
        ? 'bg-[#090d14] border-slate-800 text-white shadow-black/60'
        : 'bg-[#faf8f5] border-stone-300 text-stone-900 shadow-xl'
    }`}>
      {/* ======================================================== */}
      {/* LEFT COLUMN: Accepted Contacts Side by Side */}
      {/* ======================================================== */}
      <div className={`w-full md:w-80 lg:w-96 flex flex-col border-r h-full flex-shrink-0 transition-all ${
        activeConv && 'hidden md:flex'
      } ${
        isDark ? 'border-white/10 bg-[#0d121c]' : 'border-stone-200 bg-[#f7f5ef]'
      }`}>
        {/* Left Header */}
        <div className={`p-4 border-b flex items-center justify-between gap-2 ${
          isDark ? 'border-white/10 bg-[#121824]' : 'border-stone-200 bg-white'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base tracking-tight">
                Whispr
              </h3>
              <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {vouchStatus.classCode || 'MCA-A'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              1-on-1 Private Whisprs (One-Time Viewable)
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="p-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-md active:scale-95 transition-all"
            title="Connect with Classmate by User ID"
          >
            <UserPlus size={16} />
          </button>
        </div>

        {/* Incoming Chit Requests Alert */}
        {incomingRequests.length > 0 && (
          <div className="p-3 bg-amber-500/10 border-b border-amber-500/30 space-y-2">
            <span className="text-xs font-black text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
              <Lock size={12} />
              <span>Chit Requests ({incomingRequests.length})</span>
            </span>
            {incomingRequests.map(req => (
              <div key={req._id} className="flex items-center justify-between p-2 rounded-xl bg-black/20 dark:bg-white/5 border border-amber-500/20">
                <span className="text-xs font-extrabold text-white">@{req.sender?.username}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleRespondRequest(req._id, 'accept')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-extrabold text-[11px]"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRespondRequest(req._id, 'reject')}
                    className="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 font-bold text-[11px]"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Accepted Contacts List (Side by Side) */}
        <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/5">
          {friends.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
                <UserPlus size={24} />
              </div>
              <p className="text-xs font-extrabold text-slate-400">No accepted classmates yet</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-extrabold text-xs shadow-md"
              >
                Enter @username to Connect
              </button>
            </div>
          ) : (
            friends.map(f => {
              const conv = conversations.find(c =>
                c.participants?.some(p => String(p._id) === String(f._id))
              );
              const isSelected = activeConv?._id === conv?._id || getPartnerUsername().toLowerCase() === f.username.toLowerCase();

              return (
                <button
                  key={f._id}
                  onClick={() => handleSelectFriend(f.username)}
                  className={`w-full p-3.5 text-left flex items-center gap-3 transition-all ${
                    isSelected
                      ? isDark ? 'bg-[#182232] border-l-4 border-blue-500' : 'bg-white shadow-sm border-l-4 border-blue-600'
                      : isDark ? 'hover:bg-white/5' : 'hover:bg-stone-100'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-base shadow-sm">
                      {f.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0d121c]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-extrabold text-sm truncate">
                        @{f.username}
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400">
                        {conv?.updatedAt ? new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1">
                      {conv?.lastMessage?.content ? (
                        <span>{conv.lastMessage.content}</span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <Flame size={12} className="fill-amber-400" />
                          <span>Tap to open personal space</span>
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Left Footer: Democratic 2-Peer Vouch */}
        <div className={`p-3 border-t flex items-center justify-between text-xs font-bold ${
          isDark ? 'border-white/10 bg-[#0f1422]' : 'border-stone-200 bg-white'
        }`}>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck size={14} />
            <span>{vouchStatus.isVerified ? '2-Peer Verified Class' : `${vouchStatus.vouchCount}/2 Vouches`}</span>
          </div>
          <button
            onClick={() => setShowVouchModal(true)}
            className="text-[11px] text-blue-400 hover:underline font-bold"
          >
            Vouch Classmate
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT COLUMN: Personal Space (The Dedicated Chat Space)  */}
      {/* ======================================================== */}
      <div className={`flex-1 flex flex-col h-full min-w-0 ${
        !activeConv && 'hidden md:flex'
      } ${
        isDark ? 'bg-[#090d14]' : 'bg-[#faf8f5]'
      }`}>
        {!activeConv ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <MessageCircle size={32} />
            </div>
            <h4 className="font-black text-lg">Select a Classmate from the Left</h4>
            <p className="text-xs text-slate-400 max-w-sm">
              Your personal chat space. All messages follow the <strong>ChitChat format</strong> — one-time viewable that burn out upon viewing or replying.
            </p>
          </div>
        ) : (
          <>
            {/* Personal Space Header */}
            <div className={`p-3.5 border-b flex items-center justify-between gap-3 ${
              isDark ? 'border-white/10 bg-[#0d121c]/90' : 'border-stone-200 bg-white/90'
            }`}>
              <div className="flex items-center gap-3">
                {/* Mobile Back Button */}
                <button
                  onClick={() => setActiveConv(null)}
                  className="md:hidden p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-sm">
                  {getPartnerUsername().charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                    @{getPartnerUsername()}
                  </h3>
                  <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <span>Personal Space</span>
                    <span>•</span>
                    <span>One-Time Viewable ChitChat</span>
                  </p>
                </div>
              </div>

              {/* Actions Header */}
              <div className="flex items-center gap-2">
                {/* Burn Timer */}
                <button
                  onClick={() => setShowTimerMenu(!showTimerMenu)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                    isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-300 text-amber-800'
                  }`}
                >
                  <Clock size={13} />
                  <span>{burnTimer}s Burn</span>
                </button>

                {/* Bunk Sync */}
                <button
                  onClick={() => setShowSyncModal(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold flex items-center gap-1"
                >
                  <Zap size={13} className="fill-white" />
                  <span className="hidden sm:inline">Bunk Sync</span>
                </button>

                {/* Incinerate Session */}
                <button
                  onClick={handleBurnSession}
                  className="p-2 rounded-xl text-red-400 hover:bg-red-500/20 border border-red-500/30"
                  title="Incinerate All Messages"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Direct Reply Pop-up Card (Direct reply Heads-Up card) */}
            {activeQuickReplyMsg && (
              <div className="p-3.5 bg-gradient-to-r from-amber-600 via-red-600 to-amber-700 text-white shadow-2xl animate-[slideDown_0.2s_ease-out]">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider mb-1">
                  <span className="flex items-center gap-1.5">
                    <Flame size={14} className="fill-white animate-bounce" />
                    <span>One-Time Chit from @{activeQuickReplyMsg.senderName}</span>
                  </span>
                  <button
                    onClick={() => setActiveQuickReplyMsg(null)}
                    className="p-1 rounded-lg hover:bg-white/20"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm font-bold bg-black/30 p-2.5 rounded-xl backdrop-blur-sm mb-2">
                  "{activeQuickReplyMsg.content}"
                </p>
                {/* Reply then and there itself */}
                <form onSubmit={handleQuickReplySubmit} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Reply then and there itself (original will burn out)..."
                    value={quickReplyText}
                    onChange={(e) => setQuickReplyText(e.target.value)}
                    className="flex-1 p-2 rounded-xl text-xs font-bold bg-white text-black focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-black text-white hover:bg-stone-900 font-extrabold text-xs shadow-md flex items-center gap-1"
                  >
                    <span>Reply & Burn</span>
                    <CornerDownLeft size={13} />
                  </button>
                </form>
              </div>
            )}

            {/* Main Chat Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <p className="text-sm font-extrabold text-slate-400">
                    Personal space is 100% clean
                  </p>
                  <p className="text-xs text-slate-500">
                    Send a <strong>One-Time Chit</strong> below. Once viewed or replied to, it incinerates into ashes! 🔥
                  </p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMine = String(msg.sender) === String(user?._id) || msg.senderName === user?.username;
                  const remaining = getRemainingSecs(msg);
                  const isViewOnce = msg.isViewOnce || msg.type === 'chit' || msg.isChit;

                  // 1. One-Time Viewable ChitChat Card
                  if (isViewOnce) {
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
                            ? 'bg-gradient-to-br from-amber-950/60 to-black/80 border-amber-500/30 text-white'
                            : 'bg-[#151c28] border-slate-700 text-white'
                        }`}>
                          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 mb-2">
                            <span className="flex items-center gap-1.5 text-xs font-black text-amber-400 uppercase tracking-wider">
                              <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-black text-[11px] flex items-center justify-center">
                                ①
                              </span>
                              <span>{isMine ? 'One-Time Chit Sent' : 'Incoming One-Time Chit'}</span>
                            </span>
                            {remaining !== null && (
                              <span className="text-[11px] font-mono font-bold text-red-400 animate-pulse flex items-center gap-1">
                                <Flame size={12} className="fill-red-400" />
                                <span>{remaining}s left</span>
                              </span>
                            )}
                          </div>

                          {isUnopened ? (
                            <button
                              onClick={() => handleOpenViewOnce(msg)}
                              className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                            >
                              <Eye size={15} />
                              <span>Tap to View & Reply (Burns Out)</span>
                            </button>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-sm font-semibold break-words">
                                {msg.content}
                              </p>
                              <p className="text-[10px] text-amber-400/80 font-mono">
                                🔥 {msg.isOpened ? 'Viewed — will burn out when replied or timed out' : 'Waiting for recipient'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // 2. Bunk Sync Proposal
                  if (msg.type === 'bunk_sync') {
                    const isAgreed = msg.bunkSync?.isAgreed;
                    return (
                      <div key={msg._id} className="flex justify-center my-3">
                        <div className={`p-4 rounded-3xl border shadow-xl max-w-md w-full text-center ${
                          isAgreed
                            ? 'bg-gradient-to-r from-emerald-950/80 via-black to-emerald-950/80 border-emerald-500/50 text-white'
                            : 'bg-gradient-to-r from-blue-950/80 via-black to-purple-950/80 border-blue-500/40 text-white'
                        }`}>
                          <p className="text-xs font-black uppercase text-amber-400 mb-1">
                            {isAgreed ? '🤝 Bunk Synced & Confirmed' : '🚨 Mutual Bunk Proposal'}
                          </p>
                          <p className="text-sm font-extrabold mb-2">{msg.content}</p>
                          {!isAgreed && !isMine && (
                            <button
                              onClick={handleSendBunkSync}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg"
                            >
                              Agree to Bunk Together 🔥
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // 3. Regular Ephemeral Message
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

            {/* Quick Chits Drawer */}
            <div className={`px-3 py-2 border-t flex items-center gap-1.5 overflow-x-auto no-scrollbar ${
              isDark ? 'border-white/5 bg-[#0b0f18]' : 'border-stone-200 bg-stone-50'
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
                      ? 'bg-white/5 hover:bg-amber-500/20 text-slate-300 hover:text-white border-white/5'
                      : 'bg-white hover:bg-amber-100 text-stone-700 border-stone-200'
                  }`}
                >
                  {chit}
                </button>
              ))}
            </div>

            {/* Personal Space Input Bar */}
            <div className={`p-3 border-t flex items-center gap-2 ${
              isDark ? 'border-white/10 bg-[#0d121c]' : 'border-stone-200 bg-white'
            }`}>
              {/* One-Time Viewable Toggle (ChitChat format) */}
              <button
                onClick={() => setIsViewOnceMode(!isViewOnceMode)}
                className={`p-2.5 rounded-2xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  isViewOnceMode
                    ? 'bg-amber-500 text-black border-amber-400 shadow-md font-black'
                    : isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-stone-100 border-stone-200 text-stone-600'
                }`}
                title="Toggle One-Time Viewable ChitChat (Burns out after viewing)"
              >
                <span className="w-4 h-4 rounded-full bg-black/20 text-black font-black text-[10px] flex items-center justify-center">
                  ①
                </span>
                <span className="hidden sm:inline">{isViewOnceMode ? '1-Time View ON' : '1-Time View'}</span>
              </button>

              <input
                type="text"
                placeholder={isViewOnceMode ? `Send one-time viewable chit to @${getPartnerUsername()}...` : `Whisper to @${getPartnerUsername()}...`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className={`flex-1 p-2.5 rounded-2xl text-xs sm:text-sm font-medium border focus:outline-none transition-all ${
                  isViewOnceMode
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
                  isViewOnceMode
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/30'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30'
                } disabled:opacity-40`}
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODALS: Connect by User ID, Peer Vouch & Bunk Sync        */}
      {/* ======================================================== */}

      {/* Connect by User ID Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`p-6 rounded-3xl border shadow-2xl max-w-sm w-full space-y-4 animate-[scaleUp_0.2s_ease-out] ${
            isDark ? 'bg-[#101624] border-slate-700 text-white' : 'bg-white border-stone-200 text-stone-900'
          }`}>
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus size={20} className="text-blue-500" />
                <h3 className="font-extrabold text-sm sm:text-base">Connect with Classmate</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Zero public directories. Enter your classmate's exact User ID to send a private Chit Request:
            </p>

            <form onSubmit={handleSendRequest} className="space-y-3">
              <input
                type="text"
                placeholder="Enter exact @username..."
                value={requestInput}
                onChange={(e) => setRequestInput(e.target.value)}
                className={`w-full p-2.5 rounded-xl text-xs font-bold border focus:outline-none ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-stone-100 border-stone-300 text-stone-900'
                }`}
                autoFocus
              />
              <button
                type="submit"
                disabled={!requestInput.trim() || sendingRequest}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-extrabold text-xs shadow-md"
              >
                {sendingRequest ? 'Sending...' : 'Send Chit Request'}
              </button>
            </form>
          </div>
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
                <h3 className="font-extrabold text-sm sm:text-base">Bunk Sync with @{getPartnerUsername()}</h3>
              </div>
              <button onClick={() => setShowSyncModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Select Period:</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map(p => (
                    <button
                      key={p}
                      onClick={() => setSyncPeriod(p)}
                      className={`py-2 rounded-xl text-xs font-black transition-all ${
                        syncPeriod === p ? 'bg-blue-600 text-white shadow-md' : isDark ? 'bg-white/5' : 'bg-stone-100'
                      }`}
                    >
                      P{p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Subject:</label>
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
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md"
            >
              Send Mutual Bunk Ping
            </button>
          </div>
        </div>
      )}

      {/* Peer Vouch Modal */}
      {showVouchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`p-6 rounded-3xl border shadow-2xl max-w-sm w-full space-y-4 animate-[scaleUp_0.2s_ease-out] ${
            isDark ? 'bg-[#101624] border-slate-700 text-white' : 'bg-white border-stone-200 text-stone-900'
          }`}>
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-400" />
                <h3 className="font-extrabold text-sm sm:text-base">Democratic 2-Peer Vouch</h3>
              </div>
              <button onClick={() => setShowVouchModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Vouch for a classmate in {vouchStatus.classCode || 'MCA-A'}. 2 peer vouches verify them for class Mass Bunks.
            </p>

            <form onSubmit={handlePeerVouch} className="space-y-3">
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
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-xs shadow-md"
              >
                Vouch for Classmate
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
