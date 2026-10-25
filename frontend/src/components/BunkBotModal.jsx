import { useState, useRef, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
  Sparkles, Send, X, Bot, User, ShieldCheck, AlertTriangle,
  Clock, Zap, Calendar, RefreshCw
} from 'lucide-react';

const QUICK_PROMPTS = [
  'Can I safely bunk today?',
  'Will bunking 2 classes now hurt my final semester exams?',
  'Can I take a 3-day weekend trip next month?',
  'Which subject has the most safe bunks left?',
  'Give me a strategy to sleep late on Mondays'
];

// Helper component that formats bold text, bullet points, headers, and eliminates all raw asterisks (**)
function FormattedMessage({ text }) {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed text-xs">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Header ###
        if (trimmed.startsWith('###')) {
          const content = trimmed.replace(/^###\s*/, '');
          return (
            <div key={idx} className="font-extrabold text-sm text-white pt-1 pb-0.5">
              {renderInline(content)}
            </div>
          );
        }

        // Bullet point • or * or -
        if (trimmed.startsWith('•') || trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          const content = trimmed.replace(/^[•*-]\s*/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5">
              <span className="text-blue-400 font-bold mt-0.5 flex-shrink-0">•</span>
              <span className="flex-1 text-slate-200">{renderInline(content)}</span>
            </div>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} className="text-slate-200">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

// Parses **bold** and *italic* into actual styled JSX tags
function renderInline(str) {
  if (!str) return '';

  const parts = [];
  let remaining = str;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    const italicMatch = remaining.match(/\*(.*?)\*/);

    if (boldMatch && (!italicMatch || boldMatch.index <= italicMatch.index)) {
      if (boldMatch.index > 0) {
        parts.push(remaining.substring(0, boldMatch.index));
      }
      parts.push(
        <strong key={key++} className="font-bold text-white">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
    } else if (italicMatch) {
      if (italicMatch.index > 0) {
        parts.push(remaining.substring(0, italicMatch.index));
      }
      parts.push(
        <em key={key++} className="italic text-slate-300">
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.substring(italicMatch.index + italicMatch[0].length);
    } else {
      parts.push(remaining);
      break;
    }
  }

  return parts;
}

export default function BunkBotModal({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hey! I'm BunkBot, your AI attendance and bunk strategist.\n\nI have live access to your attendance targets, timetable blocks, and full-semester duration.\n\nAsk me anything like "Can I bunk today?" or tap one of the quick suggestions below!`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const now = new Date();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      const day = now.toLocaleDateString('en-US', { weekday: 'long' });
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const res = await api.post('/bunkbot/chat', {
        message: text,
        history: messages,
        day,
        date,
        timezone: tz,
      });

      const botReply = res.data.reply;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: botReply,
        provider: res.data.provider
      }]);
    } catch (err) {
      toast.error('BunkBot error: ' + (err.response?.data?.message || err.message));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I had trouble connecting to the brain. Please try asking again in a moment!"
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.15s_ease-out]">
      <div className="w-full max-w-lg rounded-3xl modal-surface shadow-2xl flex flex-col h-[85vh] sm:h-[620px] overflow-hidden border border-white/10 relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30 flex-shrink-0">
              <Bot size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-sm sm:text-base text-white">BunkBot AI</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30 flex items-center gap-1">
                  <Sparkles size={10} /> Smart AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Live attendance & semester forecast strategist</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {messages.map((m, idx) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={idx}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={14} />
                  </div>
                )}

                <div
                  className={`rounded-2xl px-3.5 py-2.5 max-w-[85%] shadow-sm ${
                    isUser
                      ? 'bg-blue-600 text-white font-medium rounded-br-none'
                      : 'glass-card border border-white/10 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {isUser ? m.content : <FormattedMessage text={m.content} />}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-2.5 items-center text-slate-400 text-xs">
              <div className="w-7 h-7 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center flex-shrink-0 animate-pulse">
                <Bot size={14} />
              </div>
              <div className="glass-card px-3.5 py-2 rounded-2xl border border-white/10 flex items-center gap-2">
                <RefreshCw size={12} className="animate-spin text-blue-500" />
                <span>BunkBot is analyzing your attendance math…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-3 pt-2 pb-1 overflow-x-auto scrollbar-none flex gap-1.5 border-t border-white/5 bg-black/20">
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(prompt)}
              className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-slate-300 hover:text-white border border-white/5 whitespace-nowrap transition-colors flex-shrink-0"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-white/[0.02] border-t border-white/10 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask BunkBot: 'Can I bunk today?' or 'How are you?'"
            className="flex-1 bg-black/30 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
            disabled={loading}
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-50 transition-all shadow-md shadow-blue-500/20 active:scale-95 flex-shrink-0"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
