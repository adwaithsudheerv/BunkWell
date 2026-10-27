import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  MessageSquare, Send, Smile, Image as ImageIcon, Flame,
  Search, Shield, CheckCheck, Users, UserPlus, X, ChevronLeft,
  Pin, Sparkles, MoreVertical, Plus, Check
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

export default function WhatsAppChatView({ defaultPoll = null, subjects = [] }) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const [showGifTray, setShowGifTray] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showMassBunkModal, setShowMassBunkModal] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ incoming: [], friends: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [friendUsername, setFriendUsername] = useState('');
  const messagesEndRef = useRef(null);

  // Load conversations
  const loadConversations = async () => {
    try {
      const res = await api.get('/chat/conversations');
      const convList = res.data.conversations || [];
      setConversations(convList);

      // Select default group if none selected
      if (!activeConv && convList.length > 0) {
        const def = convList.find(c => c.isDefaultGroup) || convList[0];
        setActiveConv(def);
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
    } catch (err) {
      console.warn('Failed to load messages:', err.message);
    }
  };

  // Load friends & discoverable users
  const loadFriendsAndUsers = async () => {
    try {
      const [fRes, uRes] = await Promise.all([
        api.get('/chat/friends'),
        api.get('/chat/users')
      ]);
      setFriendRequests({
        incoming: fRes.data.incoming || [],
        friends: fRes.data.friends || []
      });
      setRegisteredUsers(uRes.data.users || []);
    } catch (e) {}
  };

  useEffect(() => {
    loadConversations();
    loadFriendsAndUsers();

    // Poll for new messages every 3 seconds
    const interval = setInterval(() => {
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

  const handleSendMessage = async (textToSend, type = 'text', extraPayload = {}) => {
    const content = textToSend || inputText;
    if (!content.trim() && type === 'text') return;
    if (!activeConv?._id) return;

    try {
      const res = await api.post(`/chat/conversations/${activeConv._id}/messages`, {
        content: content.trim(),
        type,
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

  const handleSendFriendRequest = async () => {
    if (!friendUsername.trim()) return;
    try {
      const res = await api.post('/chat/friends/request', { username: friendUsername.trim() });
      toast.success(res.data.message);
      setFriendUsername('');
      loadFriendsAndUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    }
  };

  const handleRespondRequest = async (requestId, action) => {
    try {
      const res = await api.post('/chat/friends/respond', { requestId, action });
      toast.success(res.data.message);
      loadFriendsAndUsers();
      loadConversations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const handleStartDirectChat = async (targetUserId) => {
    try {
      const res = await api.post('/chat/conversations', { recipientId: targetUserId });
      setActiveConv(res.data.conversation);
      setShowNewChatModal(false);
      loadConversations();
    } catch (err) {
      toast.error('Failed to start chat');
    }
  };

  const handleReactToMessage = async (msgId, emoji) => {
    try {
      await api.post(`/chat/messages/${msgId}/react`, { emoji });
      if (activeConv?._id) loadMessages(activeConv._id);
    } catch (e) {}
  };

  // Filtered conversation list
  const filteredConversations = conversations.filter(c => {
    const name = c.isGroup ? c.name : c.participants?.find(p => String(p._id) !== String(user?._id))?.username || c.name;
    return (name || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getConvTitle = (conv) => {
    if (!conv) return '';
    if (conv.isGroup) return conv.name;
    const otherUser = conv.participants?.find(p => String(p._id) !== String(user?._id));
    return otherUser ? `@${otherUser.username}` : conv.name || 'Student';
  };

  return (
    <div className={`rounded-3xl border shadow-2xl flex flex-col h-[78vh] sm:h-[82vh] overflow-hidden transition-all ${
      isDark
        ? 'bg-[#0c1317] border-slate-700/80 text-white'
        : 'bg-[#f0f2f5] border-slate-300 text-slate-900'
    }`}>
      <div className="flex h-full w-full min-w-0">
        {/* Left Side: Conversations & Groups List (WhatsApp Model) */}
        <div className={`w-full sm:w-80 md:w-96 flex flex-col border-r h-full flex-shrink-0 transition-all ${
          activeConv && 'hidden sm:flex'
        } ${isDark ? 'border-slate-800 bg-[#111b21]' : 'border-slate-200 bg-white'}`}>
          {/* Top Bar */}
          <div className={`p-3.5 border-b flex items-center justify-between gap-2 ${
            isDark ? 'border-slate-800 bg-[#202c33]' : 'border-slate-200 bg-[#f0f2f5]'
          }`}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
                💬
              </div>
              <h3 className="font-extrabold text-base tracking-tight">
                Chats & Groups
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowMassBunkModal(true)}
                className="flex items-center gap-1 py-1.5 px-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-[11px] shadow-sm transition-all active:scale-95"
                title="Initiate Class Mass Bunk"
              >
                <Flame size={13} className="fill-white" />
                <span>🚨 Mass Bunk</span>
              </button>
              <button
                onClick={() => setShowNewChatModal(true)}
                className={`p-2 rounded-xl transition-all ${
                  isDark ? 'bg-slate-700/80 hover:bg-slate-700 text-white' : 'bg-white hover:bg-slate-100 text-slate-800 border'
                }`}
                title="New Chat / Find Students"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Pending Requests Alert */}
          {friendRequests.incoming.length > 0 && (
            <div className="p-2.5 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-amber-500 dark:text-amber-300 truncate">
                👋 {friendRequests.incoming.length} incoming chat request{friendRequests.incoming.length > 1 ? 's' : ''}!
              </span>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="px-2 py-0.5 rounded-lg bg-amber-500 text-black font-extrabold text-[10px] whitespace-nowrap"
              >
                Review
              </button>
            </div>
          )}

          {/* Search Bar */}
          <div className="p-2.5 border-b border-black/5 dark:border-white/5">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
              isDark ? 'bg-[#202c33] border-slate-700/60 text-white' : 'bg-[#f0f2f5] border-slate-200 text-slate-900'
            }`}>
              <Search size={14} className="text-slate-400" />
              <input
                type="text"
                placeholder="Search chats, groups, or students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs font-medium focus:outline-none placeholder-slate-400"
              />
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/5">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading chats...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No chats found. Tap "+" to start chatting!
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
        </div>

        {/* Right Side: Active Conversation Room */}
        <div className={`flex-1 flex flex-col h-full min-w-0 ${
          !activeConv && 'hidden sm:flex'
        }`}>
          {activeConv ? (
            <>
              {/* WhatsApp Active Chat Header */}
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
                    <h4 className="font-extrabold text-sm sm:text-base truncate flex items-center gap-1.5">
                      <span>{getConvTitle(activeConv)}</span>
                    </h4>
                    <p className="text-[11px] text-emerald-500 dark:text-emerald-400 font-bold truncate flex items-center gap-1">
                      <span>Online • 🔒 End-to-end secured</span>
                    </p>
                  </div>
                </div>

                {/* Header Action: 🚨 Mass Bunk */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setShowMassBunkModal(true)}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs shadow-md shadow-red-600/30 active:scale-95 transition-all"
                  >
                    <Flame size={14} className="fill-white" />
                    <span className="hidden sm:inline">🚨 Mass Bunk</span>
                  </button>
                </div>
              </div>

              {/* Message Feed (WhatsApp Wallpaper aesthetic) */}
              <div
                className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3"
                style={{
                  backgroundColor: isDark ? '#0b141a' : '#efeae2',
                  backgroundImage: `radial-gradient(${isDark ? '#182229' : '#e0d8cc'} 1px, transparent 1px)`,
                  backgroundSize: '24px 24px'
                }}
              >
                {/* Security E2E Badge */}
                <div className="flex justify-center my-2">
                  <div className={`px-4 py-2 rounded-2xl border text-[11px] font-semibold text-center max-w-md shadow-sm ${
                    isDark ? 'bg-[#182229]/90 border-slate-700/50 text-amber-300' : 'bg-[#ffeecd] border-amber-200 text-amber-900'
                  }`}>
                    <Shield size={13} className="inline mr-1 -mt-0.5" />
                    Messages and mass bunk votes in this chat are end-to-end secured with 256-bit BunkClub Encryption.
                  </div>
                </div>

                {/* Messages stream */}
                {messages.map((m, idx) => {
                  const isMine = String(m.sender) === String(user?._id);

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
                        {/* Sender name for group chats */}
                        {!isMine && activeConv.isGroup && (
                          <p className="text-[10px] font-black text-amber-400 mb-0.5">
                            @{m.senderName}
                          </p>
                        )}

                        {/* GIF render */}
                        {m.type === 'gif' && m.gifUrl && (
                          <div className="rounded-xl overflow-hidden my-1 max-w-xs">
                            <img src={m.gifUrl} alt="GIF" className="w-full h-auto object-cover rounded-xl" />
                          </div>
                        )}

                        {/* Content */}
                        <p className="whitespace-pre-wrap break-words leading-relaxed font-medium">
                          {m.content}
                        </p>

                        {/* Timestamp & read receipts */}
                        <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-400">
                          <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMine && (
                            <CheckCheck size={13} className="text-blue-400 inline" />
                          )}
                        </div>

                        {/* Reactions bar */}
                        {m.reactions?.length > 0 && (
                          <div className="absolute -bottom-2.5 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-900/90 text-[10px] border border-white/20 shadow-sm">
                            {m.reactions.map((r, i) => (
                              <span key={i}>{r.emoji}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quick Emoji Reaction Pill on hover/touch */}
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

              {/* Input Bar (WhatsApp style) */}
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
                  placeholder="Type a message or bunk plan..."
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
              <h3 className="font-black text-lg">BunkClub Messenger</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Select a college group or classmate to start chatting and coordinating mass bunks.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Chat / Find Students Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className={`w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border transition-all animate-[slideUp_0.3s_ease-out] ${
            isDark ? 'bg-[#111b21] border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-black/10 dark:border-white/10">
              <h3 className="font-black text-base flex items-center gap-2">
                <UserPlus size={18} className="text-emerald-500" />
                <span>Connect with Classmates</span>
              </h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className={`p-1 rounded-lg ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-black'}`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Incoming Requests */}
            {friendRequests.incoming.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">
                  Pending Chat Requests
                </p>
                {friendRequests.incoming.map(reqDoc => (
                  <div
                    key={reqDoc._id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20"
                  >
                    <div>
                      <p className="font-extrabold text-xs">@{reqDoc.sender?.username}</p>
                      <p className="text-[10px] text-slate-400">Wants to chat with you</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRespondRequest(reqDoc._id, 'accept')}
                        className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRespondRequest(reqDoc._id, 'reject')}
                        className="px-2.5 py-1 rounded-xl bg-red-600/20 text-red-400 font-bold text-xs"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Send Request by Username */}
            <div className="mb-4">
              <label className="text-xs font-bold block mb-1 uppercase tracking-wider text-slate-400">
                Send Request by Username
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. sonal, adwaith..."
                  value={friendUsername}
                  onChange={(e) => setFriendUsername(e.target.value)}
                  className={`flex-1 p-2.5 rounded-xl text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark ? 'bg-[#202c33] border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-black'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleSendFriendRequest}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Discover Students */}
            <div>
              <p className="text-xs font-bold block mb-2 uppercase tracking-wider text-slate-400">
                Classmates in BunkClub
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {registeredUsers.length === 0 ? (
                  <p className="text-xs text-slate-400">No other students registered yet.</p>
                ) : (
                  registeredUsers.map(u => (
                    <div
                      key={u._id}
                      className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                          {u.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-extrabold text-xs">@{u.username}</p>
                          <p className="text-[10px] text-slate-400">Student</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleStartDirectChat(u._id)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm"
                      >
                        Chat
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
