import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Trash2,
  Bot,
  User,
  Cpu,
  Tv,
  Trophy,
  Zap,
  Layers,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import { AiService, ChatMessage, AssistantRole, GeminiModelId } from '../../services/AiService';

interface AiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelsCount?: number;
}

export const AiChatModal: React.FC<AiChatModalProps> = ({
  isOpen,
  onClose,
  channelsCount = 0,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content: `Hello! I am your **webOS IPTV AI Assistant** powered by Google Gemini.\n\nAsk me for channel recommendations, technical stream analysis (HEVC, bitrates, audio codecs), buffer optimization, or live sports schedules!`,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<AssistantRole>('concierge');
  const [model, setModel] = useState<GeminiModelId>('gemini-3.5-flash');
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setIsLoading(true);

    try {
      // Format messages for server-side /api/chat endpoint
      const apiPayload = newHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await AiService.sendMessage(apiPayload, model, role);

      const assistantMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        content: res.text,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message || 'Failed to contact Gemini API. Please check your network or API key.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        content: `Conversation cleared. How can I help you with your IPTV streaming today?`,
        timestamp: Date.now(),
      },
    ]);
    setError(null);
  };

  const starterPrompts = [
    { label: 'Recommend 4K Movies', text: 'Recommend top 4K UHD movies available for on-demand streaming.' },
    { label: 'Explain HEVC vs AVC', text: 'What are the bitrate and quality differences between HEVC (H.265) and AVC (H.264) on LG webOS TVs?' },
    { label: 'Buffer for Live Sports', text: 'What is the optimal buffer size preset for watching live soccer/football without delay or freeze?' },
    { label: 'Audio Codec Guide', text: 'Explain Dolby Atmos and 5.1 Surround passthrough over eARC on Smart TVs.' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn select-none">
      <div className="bg-[#10121a] border border-white/15 rounded-3xl max-w-3xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Strip */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/40 shrink-0">
          <div className="flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg"
              style={{
                background: 'var(--tv-accent-gradient, var(--tv-accent))',
                boxShadow: '0 4px 14px var(--tv-accent-glow)',
              }}
            >
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-base text-white tracking-wide">
                  Gemini TV Assistant
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--tv-accent-subtle)] text-[var(--tv-accent)] border border-[var(--tv-accent-border)]">
                  MULTI-TURN
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                10-Foot AI Concierge for LG webOS Smart TVs
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearHistory}
              className="tv-focusable p-2 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition-colors"
              title="Clear Conversation History"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="tv-focusable p-2 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition-colors"
              title="Close (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Persona Role & Model Control Bar */}
        <div className="px-6 py-2.5 bg-white/5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Role selector */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-zinc-400 text-[11px] font-semibold mr-1">Role:</span>
            <button
              onClick={() => setRole('concierge')}
              className={`tv-focusable px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center space-x-1 transition-all ${
                role === 'concierge'
                  ? 'bg-[var(--tv-accent)] text-black shadow-sm'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              <Tv className="w-3 h-3" />
              <span>TV Concierge</span>
            </button>
            <button
              onClick={() => setRole('tech')}
              className={`tv-focusable px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center space-x-1 transition-all ${
                role === 'tech'
                  ? 'bg-[var(--tv-accent)] text-black shadow-sm'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              <Cpu className="w-3 h-3" />
              <span>Codec & Tech</span>
            </button>
            <button
              onClick={() => setRole('sports')}
              className={`tv-focusable px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center space-x-1 transition-all ${
                role === 'sports'
                  ? 'bg-[var(--tv-accent)] text-black shadow-sm'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3 h-3" />
              <span>Live Sports</span>
            </button>
          </div>

          {/* Model selector */}
          <div className="flex items-center space-x-1 text-xs">
            <span className="text-zinc-400 text-[11px] font-semibold mr-1">Model:</span>
            <button
              onClick={() => setModel('gemini-3.5-flash')}
              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold transition-all ${
                model === 'gemini-3.5-flash'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="gemini-3.5-flash: Balanced & versatile for general tasks"
            >
              3.5-Flash (General)
            </button>
            <button
              onClick={() => setModel('gemini-3.1-flash-lite')}
              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold transition-all ${
                model === 'gemini-3.1-flash-lite'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="gemini-3.1-flash-lite: Ultra-fast responses for quick queries"
            >
              3.1-Lite (Fast)
            </button>
            <button
              onClick={() => setModel('gemini-3.1-pro-preview')}
              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold transition-all ${
                model === 'gemini-3.1-pro-preview'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="gemini-3.1-pro-preview: Deep reasoning for complex stream architecture"
            >
              3.1-Pro (Complex)
            </button>
          </div>
        </div>

        {/* Scrollable Conversation Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isUser
                      ? 'bg-white/10 text-white'
                      : 'bg-[var(--tv-accent-subtle)] text-[var(--tv-accent)] border border-[var(--tv-accent-border)]'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-[80%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-[var(--tv-accent)] text-black font-semibold shadow-md'
                      : 'bg-white/5 border border-white/10 text-zinc-200'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  <span
                    className={`text-[9px] block mt-1.5 opacity-60 font-mono ${
                      isUser ? 'text-black' : 'text-zinc-400'
                    }`}
                  >
                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--tv-accent-subtle)] border border-[var(--tv-accent-border)] flex items-center justify-center text-[var(--tv-accent)]">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[var(--tv-accent)] animate-bounce" />
                <span
                  className="w-2 h-2 rounded-full bg-[var(--tv-accent)] animate-bounce"
                  style={{ animationDelay: '0.15s' }}
                />
                <span
                  className="w-2 h-2 rounded-full bg-[var(--tv-accent)] animate-bounce"
                  style={{ animationDelay: '0.3s' }}
                />
                <span className="text-xs text-zinc-400 ml-2">Gemini is thinking...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => handleSend(messages[messages.length - 1]?.content)}
                className="px-2 py-1 rounded bg-red-500/30 text-white font-bold text-[11px]"
              >
                Retry
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Starter Prompts Strip */}
        {messages.length <= 3 && !isLoading && (
          <div className="px-6 py-2 border-t border-white/5 flex items-center space-x-2 overflow-x-auto shrink-0">
            <span className="text-[10px] text-zinc-500 font-bold uppercase shrink-0">Try:</span>
            {starterPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p.text)}
                className="tv-focusable px-3 py-1 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 text-[11px] font-medium whitespace-nowrap transition-colors border border-white/10"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-4 border-t border-white/10 bg-black/30 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-3"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={`Ask Gemini about ${role === 'tech' ? 'codecs & bitrates' : role === 'sports' ? 'live sports fixtures' : 'movies, channels & shows'}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-white/5 border border-white/15 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--tv-accent)]"
            />

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="tv-focusable px-5 py-3 rounded-2xl bg-[var(--tv-accent)] text-black font-extrabold text-xs sm:text-sm flex items-center space-x-2 shadow-lg disabled:opacity-40 transition-all hover:scale-105"
            >
              <span>Send</span>
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
