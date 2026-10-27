import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  MessageSquare, Send, Smile, Image as ImageIcon, Flame,
  Search, Shield, CheckCheck, Users, UserPlus, X, ChevronLeft,
  Pin, Sparkles, MoreVertical, Plus, Check, Clock, Timer,
  Trash2, User, RefreshCw
} from 'lucide-react';
import MassBunkCard from './MassBunkCard';
import MassBunkModal from './MassBunkModal';

const COLLEGE_EMOJIS = ['🔥', '💀', '😂', '🏃‍♂️', '😴', '🍺', '📚', '🤓', '🎉', '👍', '❤️', '🚨'];

const COLLEGE_GIFS = [
  { name: 'Mass Bunk Mood', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpucmt4dHR2MWxwaGVtd3lybXU0NHMzaWNwOWV4eTNrbWtiNXA0ZiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/mDFpdL1UxdV04/giphy.gif' },
  { name: 'Running from Class', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnY5ZjQxNjJ4M2ZpMjZ1Z2Z0cGZocm0wbTJmd2c4YmF1OG9rZ2w3ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/sRKg9r2YWeCTG5JTTo/giphy.gif' },
  { name: 'Sleeping in Lecture', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWk3Z2Z3Mjl5ZTR0Z3B4OGF5enNldzJnbW8wbjB3YmttMHltbXZjMSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/bEs40QRUpveOigusL5/giphy.gif' },
  { name: 'Attendance Safe 75%', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd24wYjF5eTRwNHc2dGxrdGhpbjFuaTFodndob2I1dDlhZ3lydDNtNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/artj92V8o75VPL7AeQ/giphy.gif' },
  { name: 'Exam Tomorrow', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYWZ0bnJicjRld3BhN3V2M3pqdW8zZTR4dTB3d284aWw3N2h3Ynd2eiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/26ufcVAp3AiJJsrIs/giphy.gif' }
];

const TIMER_OPTIONS = [
  { label: '30s', seconds: 30 },
  { label: '5m', seconds: 300 },
  { label: '1h', seconds: 3600 },
  { label: '24h', seconds: 86400 }
];

export default function WhatsAppChatView({ subjects = [] }) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'direct' | 'group' | 'members'
  
  // Snapchat Disappearing Timer
  const [disappearingTimer, setDisappearingTimer] = useState(300);
  const [showTimerMenu, setShowTimerMenu] = useState(false);

  // Trays & Modals
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const [showGifTray, setShowGifTray] = useState(false);
  const [showMassBunkModal, setShowMassBunkModal] = useState(false);

  // Members directory & Search
  const [searchUserId, setSearchUserId] = useState('');
  const [membersList, setMembersList] = useState([]);
  const [searchingMembers, setSearchingMembers] = useState(false);

  const messagesEndRef = useRef(null);

  // Load conversations
  const loadConversations = async () => {
    try {
      const res = await api.get('/chat/conversations');
      const convList = res.data.conversations || [];
      setConversations(convList);

      if (!activeConv && convList.length > 0) {
        const def = convList.find(c => c.isDefaultGroup) || convList[0];
        setActiveConv(def);
        setDisappearingTimer(def.disappearingTimer || 300);
      }
    } catch (err) {
      console.warn('Failed to load conversations:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load messages for active conversation
  const loadMessages = async (convId) => {
    if (!convId) return;
    try {
      const res = await api.get(`/chat/conversations/${convId}/messages`);
      setMessages(res.data.messages || []);
      if (res.data.disappearingTimer) {
        setDisappearingTimer(res.data.disappearingTimer);
      }
    } catch (err) {
      console.warn('Failed to load messages:', err.message);
    }
  };

  // Search Members by User ID
  const searchMembers = async (query = '') => {
    setSearchingMembers(true);
    try {
      const res = await api.get(`/chat/users?search=${encodeURIComponent(query)}`);
      setMembersList(res.data.users || []);
    } catch (e) {
    } finally {
      setSearchingMembers(false);
    }
  };

  useEffect(() => {
    loadConversations();
    searchMembers('');

    const interval = setInterval(() => {
      if (activeConv?._id) loadMessages(activeConv._id);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeConv?._id]);

  useEffect(() => {
    if (activeConv?._id) {
      loadMessages(activeConv._id);
      setDisappearingTimer(activeConv.disappearingTimer || 300);
    }
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend, type = 'text', extraPayload = {}) => {
    const content = textToSend || inputText;
    if (!content.trim() && type === 'text') return;
    if (!activeConv?._id) return;

    try {
      const res = await api.post(`/chat/conversations/${activeConv._id}/messages`, {
        content: content.trim(),
        type,
        customTimer: disappearingTimer,
        ...extraPayload
      });
      setMessages(prev => [...prev, res.data.message]);
      setInputText('');
      setShowEmojiTray(false);
      setShowGifTray(false);
      loadConversations();
    } catch (err) {
      toast.error('Failed to send message');
    }
  };

  const handleSetTimer = async (seconds) => {
    setDisappearingTimer(seconds);
    setShowTimerMenu(false);
    if (!activeConv?._id) return;

    try {
      await api.post(`/chat/conversations/${activeConv._id}/disappearing`, { seconds });
      const secLabel = TIMER_OPTIONS.find(o => o.seconds === seconds)?.label || `${seconds}s`;
      toast.success(`Disappearing timer set to ${secLabel} (Snapchat mode) ⏱️🔥`);
      handleSendMessage(`⏱️ Set messages to self-destruct after ${secLabel}.`, 'system');
    } catch (e) {
      toast.error('Failed to update timer');
    }
  };

  const handleStartChatByUserId = async (targetUsername) => {
    try {
      const res = await api.post('/chat/conversations/by-username', { username: targetUsername });
      setActiveConv(res.data.conversation);
      setActiveTab('chats');
      loadConversations();
      toast.success(`Started chat with @${targetUsername}!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start chat');
    }
  };

  const handleReactToMessage = async (msgId, emoji) => {
    try {
      await api.post(`/chat/messages/${msgId}/react`, { emoji });
      if (activeConv?._id) loadMessages(activeConv._id);
    } catch (e) {}
  };

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    const title = c.isGroup ? c.name : c.participants?.find(p => String(p._id) !== String(user?._id))?.username || c.name;
    const matchesSearch = (title || '').toLowerCase().includes(searchUserId.toLowerCase());
    if (activeTab === 'group') return matchesSearch && c.isGroup;
    if (activeTab === 'direct') return matchesSearch && !c.isGroup;
    return matchesSearch;
  });

  const getConvTitle = (conv) => {
    if (!conv) return '';
    if (conv.isGroup) return conv.name;
    const otherUser = conv.participants?.find(p => String(p._id) !== String(user?._id));
    return otherUser ? `@${otherUser.username}` : conv.name || 'Member';
  };

  // Remaining seconds calculation for a message
  const getRemainingSeconds = (msg) => {
    if (!msg.expiresAt) return null;
    const diff = Math.max(0, Math.round((new Date(msg.expiresAt).getTime() - Date.now()) / 1000));
    return diff;
  };

  return (
    <div className={`rounded-3xl border shadow-2xl flex flex-col h-[82vh] overflow-hidden transition-all ${
      isDark
        ? 'bg-[#0c1317] border-slate-700/80 text-white'
        : 'bg-[#f0f2f5] border-slate-300 text-slate-900'
    }`}>
      <div className="flex h-full w-full min-w-0">
        {/* Left Side: User Search, Tabs & Chat List */}
        <div className={`w-full sm:w-80 md:w-96 flex flex-col border-r h-full flex-shrink-0 transition-all ${
          activeConv && 'hidden sm:flex'
        } ${isDark ? 'border-slate-800 bg-[#111b21]' : 'border-slate-200 bg-white'}`}>
          {/* Header */}
          <div className={`p-3.5 border-b flex items-center justify-between gap-2 ${
            isDark ? 'border-slate-800 bg-[#202c33]' : 'border-slate-200 bg-[#f0f2f5]'
          }`}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
                💬
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base tracking-tight leading-tight">
                  Student Messenger
                </h3>
                <p className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                  <Flame size={11} className="fill-amber-400" />
                  <span>Snapchat Disappearing Chats</span>
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setActiveTab('members')}
              className={`p-2 rounded-xl transition-all ${
                activeTab === 'members'
                  ? 'bg-emerald-600 text-white'
                  : isDark ? 'bg-slate-700/80 text-slate-300 hover:text-white' : 'bg-white text-slate-700 border'
              }`}
              title="Search Members by User ID"
            >
              <UserPlus size={16} />
            </button>
          </div>

          {/* User ID Direct Search Bar */}
          <div className="p-2.5 border-b border-black/5 dark:border-white/5 space-y-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
              isDark ? 'bg-[#202c33] border-slate-700/60 text-white' : 'bg-[#f0f2f5] border-slate-200 text-slate-900'
            }`}>
              <Search size={14} className="text-slate-400" />
              <input
                type="text"
                placeholder="Search User ID (e.g. sonal, adwaith)..."
                value={searchUserId}
                onChange={(e) => {
                  setSearchUserId(e.target.value);
                  if (activeTab === 'members') searchMembers(e.target.value);
                }}
                className="w-full bg-transparent text-xs font-medium focus:outline-none placeholder-slate-400"
              />
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 text-[11px] font-bold">
              {[
                { id: 'chats', label: 'All Chats' },
                { id: 'direct', label: '1-on-1' },
                { id: 'group', label: 'Class Group' },
                { id: 'members', label: 'Find Members' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'members') searchMembers(searchUserId);
                  }}
                  className={`flex-1 py-1 px-1.5 rounded-lg text-center transition-all ${
                    activeTab === tab.id
                      ? 'bg-emerald-600 text-white font-extrabold shadow-sm'
                      : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-black hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Members Directory Tab View */}
          {activeTab === 'members' ? (
            <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/5 p-2 space-y-1">
              <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>Search by User ID:</span>
                <span className="text-emerald-500">{membersList.length} registered</span>
              </div>
              {searchingMembers ? (
                <div className="p-8 text-center text-xs text-slate-400">Searching User IDs...</div>
              ) : membersList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No member found with User ID "{searchUserId}".
                </div>
              ) : (
                membersList.map(member => (
                  <div
                    key={member._id}
                    className={`p-2.5 rounded-2xl flex items-center justify-between gap-2 transition-all ${
                      isDark ? 'hover:bg-[#202c33]' : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-sm flex-shrink-0 shadow-sm">
                        {member.username?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-xs truncate">
                          @{member.username}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Target: {member.attendanceTarget || 80}%
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartChatByUserId(member.username)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-sm active:scale-95 flex items-center gap-1"
                    >
                      <MessageSquare size={13} />
                      <span>Chat</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Conversations List */
            <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/5">
              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading chats...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                  <p>No chats found.</p>
                  <button
                    onClick={() => setActiveTab('members')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                  >
                    Find Members by User ID
                  </button>
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const title = getConvTitle(conv);
                  const isSelected = activeConv?._id === conv._id;
                  const isGroup = conv.isGroup;

                  return (
                    <button
                      key={conv._id}
                      onClick={() => setActiveConv(conv)}
                      className={`w-full p-3.5 text-left flex items-start gap-3 transition-all ${
                        isSelected
                          ? isDark ? 'bg-[#2a3942]' : 'bg-[#f0f2f5]'
                          : isDark ? 'hover:bg-[#202c33]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-black shadow-sm ${
                          isGroup
                            ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white'
                            : 'bg-blue-600 text-white'
                        }`}>
                          {isGroup ? (conv.avatar || '🎓') : title.replace('@', '').charAt(0).toUpperCase()}
                        </div>
                        {!isGroup && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#111b21]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-extrabold text-sm truncate flex items-center gap-1.5">
                            <span>{title}</span>
                            {conv.isDefaultGroup && (
                              <Pin size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                            )}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                            {conv.updatedAt ? new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 truncate flex items-center gap-1 ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          {conv.lastMessage?.senderName && (
                            <span className="font-bold text-slate-300 dark:text-slate-400">
                              {conv.lastMessage.senderName}:
                            </span>
                          )}
                          <span>{conv.lastMessage?.content || 'No messages yet'}</span>
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Right Side: Active Snapchat Disappearing Chat Room */}
        <div className={`flex-1 flex flex-col h-full min-w-0 ${
          !activeConv && 'hidden sm:flex'
        }`}>
          {activeConv ? (
            <>
              {/* Chat Top Bar */}
              <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 ${
                isDark ? 'bg-[#202c33] border-slate-800' : 'bg-[#f0f2f5] border-slate-200'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setActiveConv(null)}
                    className="sm:hidden p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0 shadow-sm ${
                    activeConv.isGroup ? 'bg-emerald-600' : 'bg-blue-600'
                  }`}>
                    {activeConv.isGroup ? (activeConv.avatar || '🎓') : getConvTitle(activeConv).replace('@', '').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-sm sm:text-base truncate">
                      {getConvTitle(activeConv)}
                    </h4>
                    <p className="text-[11px] text-amber-400 font-bold truncate flex items-center gap-1">
                      <Timer size={11} />
                      <span>Snapchat Disappearing Mode ({TIMER_OPTIONS.find(o => o.seconds === disappearingTimer)?.label || `${disappearingTimer}s`})</span>
                    </p>
                  </div>
                </div>

                {/* Header Controls: Disappearing Timer + Mass Bunk for Group */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Disappearing Timer Selector */}
                  <div className="relative">
                    <button
                      onClick={() => setShowTimerMenu(!showTimerMenu)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                        isDark ? 'bg-slate-800 border-slate-700 text-amber-300' : 'bg-white border-slate-300 text-amber-700'
                      }`}
                      title="Set Snapchat self-destruct timer"
                    >
                      <Timer size={13} />
                      <span>{TIMER_OPTIONS.find(o => o.seconds === disappearingTimer)?.label || `${disappearingTimer}s`}</span>
                    </button>

                    {showTimerMenu && (
                      <div className={`absolute right-0 top-full mt-1.5 w-36 rounded-2xl border shadow-xl p-1 z-50 animate-[slideDown_0.2s_ease-out] ${
                        isDark ? 'bg-[#182229] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}>
                        <p className="text-[10px] font-bold px-2 py-1 uppercase tracking-wider text-slate-400">
                          Auto-Delete Timer:
                        </p>
                        {TIMER_OPTIONS.map(opt => (
                          <button
                            key={opt.seconds}
                            onClick={() => handleSetTimer(opt.seconds)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-between ${
                              disappearingTimer === opt.seconds
                                ? 'bg-emerald-600 text-white'
                                : isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {disappearingTimer === opt.seconds && <Check size={13} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mass Bunk button in class group */}
                  {activeConv.isGroup && (
                    <button
                      onClick={() => setShowMassBunkModal(true)}
                      className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs shadow-md shadow-red-600/30 active:scale-95 transition-all"
                    >
                      <Flame size={14} className="fill-white" />
                      <span className="hidden sm:inline">🚨 Mass Bunk</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Message Feed */}
              <div
                className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3"
                style={{
                  backgroundColor: isDark ? '#0b141a' : '#efeae2',
                  backgroundImage: `radial-gradient(${isDark ? '#182229' : '#e0d8cc'} 1px, transparent 1px)`,
                  backgroundSize: '24px 24px'
                }}
              >
                {/* Snapchat Disappearing Notice Banner */}
                <div className="flex justify-center my-2">
                  <div className={`px-4 py-2 rounded-2xl border text-[11px] font-semibold text-center max-w-md shadow-sm ${
                    isDark ? 'bg-[#182229]/95 border-amber-500/30 text-amber-300' : 'bg-[#fff5db] border-amber-300 text-amber-900'
                  }`}>
                    <Timer size={13} className="inline mr-1 -mt-0.5 text-amber-400" />
                    Snapchat Mode Active: Messages in this chat self-destruct after {TIMER_OPTIONS.find(o => o.seconds === disappearingTimer)?.label || `${disappearingTimer}s`}. Nothing is permanently saved.
                  </div>
                </div>

                {/* Messages stream */}
                {messages.map((m, idx) => {
                  const isMine = String(m.sender) === String(user?._id);
                  const remSec = getRemainingSeconds(m);

                  if (m.type === 'poll' && m.pollId) {
                    return (
                      <div key={m._id || idx} className="my-2 max-w-lg mx-auto">
                        <MassBunkCard
                          poll={m.pollId}
                          currentUserId={user?._id}
                          onVoted={() => loadMessages(activeConv._id)}
                        />
                      </div>
                    );
                  }

                  if (m.type === 'system') {
                    return (
                      <div key={m._id || idx} className="flex justify-center my-1">
                        <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-black/20 dark:bg-white/10 text-slate-400">
                          {m.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m._id || idx}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 shadow-sm text-xs relative ${
                          isMine
                            ? isDark ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#d9fdd3] text-slate-900 rounded-tr-none'
                            : isDark ? 'bg-[#202c33] text-white rounded-tl-none' : 'bg-white text-slate-900 rounded-tl-none'
                        }`}
                      >
                        {/* Sender name for groups */}
                        {!isMine && activeConv.isGroup && (
                          <p className="text-[10px] font-black text-amber-400 mb-0.5">
                            @{m.senderName}
                          </p>
                        )}

                        {/* GIF media */}
                        {m.type === 'gif' && m.gifUrl && (
                          <div className="rounded-xl overflow-hidden my-1 max-w-xs">
                            <img src={m.gifUrl} alt="GIF" className="w-full h-auto object-cover rounded-xl" />
                          </div>
                        )}

                        {/* Content */}
                        <p className="whitespace-pre-wrap break-words leading-relaxed font-medium">
                          {m.content}
                        </p>

                        {/* Self-destruct timer pill & timestamp */}
                        <div className="flex items-center justify-end gap-1.5 mt-1 text-[9px] text-slate-400">
                          {remSec !== null && (
                            <span className="text-amber-400 font-mono font-bold flex items-center gap-0.5">
                              <Timer size={10} />
                              <span>{remSec > 60 ? `${Math.ceil(remSec / 60)}m` : `${remSec}s`}</span>
                            </span>
                          )}
                          <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMine && <CheckCheck size={13} className="text-blue-400 inline" />}
                        </div>

                        {/* Reactions */}
                        {m.reactions?.length > 0 && (
                          <div className="absolute -bottom-2.5 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-900/90 text-[10px] border border-white/20 shadow-sm">
                            {m.reactions.map((r, i) => (
                              <span key={i}>{r.emoji}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Reaction bar on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-0.5 px-2">
                        {['🔥', '😂', '💀', '👍'].map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => handleReactToMessage(m._id, emoji)}
                            className="text-xs hover:scale-125 transition-transform"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Emoji Tray */}
              {showEmojiTray && (
                <div className={`p-2.5 border-t flex flex-wrap gap-2 ${
                  isDark ? 'bg-[#1e2a30] border-slate-700' : 'bg-white border-slate-200'
                }`}>
                  {COLLEGE_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => handleSendMessage(emoji, 'text')}
                      className="text-2xl hover:scale-125 transition-transform p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* GIF Tray */}
              {showGifTray && (
                <div className={`p-3 border-t max-h-48 overflow-y-auto ${
                  isDark ? 'bg-[#1e2a30] border-slate-700' : 'bg-white border-slate-200'
                }`}>
                  <p className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
                    College Bunk GIFs
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {COLLEGE_GIFS.map((g, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(g.name, 'gif', { gifUrl: g.url })}
                        className="rounded-xl overflow-hidden hover:opacity-80 transition-opacity border border-black/10 relative group"
                      >
                        <img src={g.url} alt={g.name} className="w-full h-20 object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[10px] text-white p-1 text-center font-bold">
                          {g.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Bar */}
              <div className={`p-2.5 sm:p-3 border-t flex items-center gap-2 ${
                isDark ? 'bg-[#202c33] border-slate-800' : 'bg-[#f0f2f5] border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmojiTray(!showEmojiTray);
                    setShowGifTray(false);
                  }}
                  className={`p-2 rounded-xl transition-colors ${
                    showEmojiTray ? 'text-amber-400' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Emoji"
                >
                  <Smile size={20} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowGifTray(!showGifTray);
                    setShowEmojiTray(false);
                  }}
                  className={`p-2 rounded-xl transition-colors ${
                    showGifTray ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                  }`}
                  title="GIF"
                >
                  <ImageIcon size={20} />
                </button>

                <input
                  type="text"
                  placeholder="Type a disappearing message (burns after timer)..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendMessage();
                  }}
                  className={`flex-1 py-2 px-3.5 rounded-2xl text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-[#2a3942] border-slate-700/50 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim()}
                  className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 transition-all disabled:opacity-40 flex-shrink-0"
                >
                  <Send size={16} className="translate-x-0.5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-600/20 text-emerald-500 flex items-center justify-center">
                <MessageSquare size={32} />
              </div>
              <h3 className="font-black text-lg">Snapchat Disappearing Chats</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Search classmates by their User ID and send self-destructing messages that vanish after minutes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mass Bunk Initiator Modal */}
      <MassBunkModal
        isOpen={showMassBunkModal}
        onClose={() => setShowMassBunkModal(false)}
        subjects={subjects}
        onCreated={() => {
          if (activeConv?._id) loadMessages(activeConv._id);
        }}
      />
    </div>
  );
}
