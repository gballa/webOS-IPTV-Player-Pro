import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Tv, Calendar, Film, Play, ChevronRight, Mic, MicOff, Volume2, Sparkles, AlertCircle } from 'lucide-react';
import { Channel, Program, VodItem } from '../../types/iptv';
import { ChannelLogo } from '../Common/ChannelLogo';
import { VoiceSearchService, VoiceSearchState } from '../../services/VoiceSearchService';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  programs: Program[];
  vodItems: VodItem[];
  onSelectChannel: (channel: Channel, goFullscreen?: boolean) => void;
  onSelectVod: (vod: VodItem) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  channels,
  programs,
  vodItems,
  onSelectChannel,
  onSelectVod,
}) => {
  const [query, setQuery] = useState('');
  const [voiceState, setVoiceState] = useState<VoiceSearchState>(() => VoiceSearchService.getState());
  const inputRef = useRef<HTMLInputElement>(null);

  // Subscribe to voice search engine
  useEffect(() => {
    const unsubscribe = VoiceSearchService.subscribe((state) => {
      setVoiceState(state);
      // If voice recognized a final transcript, update search query immediately
      if (state.transcript && state.transcript.trim()) {
        setQuery(state.transcript.trim());
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      VoiceSearchService.stopListening();
      setQuery('');
    }
  }, [isOpen]);

  const toggleVoiceSearch = () => {
    if (voiceState.isListening) {
      VoiceSearchService.stopListening();
    } else {
      const started = VoiceSearchService.startListening((finalText) => {
        setQuery(finalText);
      });
      if (started) {
        inputRef.current?.focus();
      }
    }
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { channels: [], programs: [], vod: [] };

    const matchedChannels = channels.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.num.toString().includes(q) ||
      c.group.toLowerCase().includes(q)
    ).slice(0, 8);

    const matchedPrograms = programs.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q))
    ).slice(0, 6);

    const matchedVod = vodItems.filter(v =>
      v.title.toLowerCase().includes(q) ||
      (v.genre && v.genre.toLowerCase().includes(q))
    ).slice(0, 6);

    return {
      channels: matchedChannels,
      programs: matchedPrograms,
      vod: matchedVod,
    };
  }, [query, channels, programs, vodItems]);

  if (!isOpen) return null;

  const totalResults = results.channels.length + results.programs.length + results.vod.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 sm:p-8 select-none">
      <div className="bg-[#141419] border border-white/20 rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Search Input Bar with Voice Recognition */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 gap-2">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <Search className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--tv-accent)] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder={voiceState.isListening ? "Listening... Speak into remote microphone" : "Search live channels, TV guide, movies, or series..."}
              value={voiceState.isListening && voiceState.interimTranscript ? voiceState.interimTranscript : query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-transparent text-base sm:text-lg font-bold text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Voice-to-Text Button (Web Speech API) */}
            <button
              onClick={toggleVoiceSearch}
              title={
                !voiceState.isSupported
                  ? 'Voice search is not supported on this browser/firmware'
                  : voiceState.isListening
                  ? 'Click to stop listening'
                  : 'Speak to search (LG Magic Remote mic)'
              }
              className={`tv-focusable relative px-3 py-2 rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                voiceState.isListening
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/50 animate-pulse'
                  : voiceState.isSupported
                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/15 hover:border-[var(--tv-accent)]'
                  : 'bg-white/5 text-zinc-500 border border-white/5 opacity-60 cursor-not-allowed'
              }`}
            >
              {voiceState.isListening ? (
                <>
                  <Mic className="w-4 h-4 animate-bounce text-white" />
                  <span className="hidden sm:inline">Listening...</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-rose-400" />
                  <span className="hidden sm:inline">Voice</span>
                </>
              )}
            </button>

            {/* Clear button if text exists */}
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Close modal */}
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Voice Listening Waveform Banner */}
        {voiceState.isListening && (
          <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-rose-500/20 via-purple-500/20 to-cyan-500/20 border border-rose-500/30 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <span className="w-1.5 h-4 bg-rose-400 rounded-full animate-pulse" />
                <span className="w-1.5 h-6 bg-purple-400 rounded-full animate-pulse delay-75" />
                <span className="w-1.5 h-3 bg-cyan-400 rounded-full animate-pulse delay-150" />
                <span className="w-1.5 h-5 bg-rose-400 rounded-full animate-pulse delay-100" />
              </div>
              <div className="text-xs text-white">
                <span className="font-bold text-rose-300">Remote Microphone Active:</span>{' '}
                <span className="text-zinc-300 italic">
                  {voiceState.interimTranscript || 'Say channel or movie title (e.g. "NASA TV", "Tears of Steel")...'}
                </span>
              </div>
            </div>
            <button
              onClick={() => VoiceSearchService.stopListening()}
              className="text-[11px] font-bold text-rose-300 underline hover:text-white ml-2"
            >
              Done
            </button>
          </div>
        )}

        {/* Voice Error Notification */}
        {voiceState.error && !voiceState.isListening && (
          <div className="mt-3 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{voiceState.error}</span>
          </div>
        )}

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {!query.trim() ? (
            <div className="py-12 text-center text-zinc-400 text-sm space-y-3">
              <div className="flex justify-center items-center space-x-2 text-zinc-500">
                <Mic className="w-5 h-5 text-rose-400" />
                <span>•</span>
                <Tv className="w-5 h-5 text-cyan-400" />
                <span>•</span>
                <Film className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                Type on keyboard or press <strong className="text-white">Voice</strong> to speak into your TV remote microphone.
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                {['NASA TV', 'Sports', 'Euronews', 'Sintel', 'Science', '4K'].map((sample) => (
                  <button
                    key={sample}
                    onClick={() => setQuery(sample)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300 border border-white/10"
                  >
                    "{sample}"
                  </button>
                ))}
              </div>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              No matching live channels or titles found for "{query}".
            </div>
          ) : (
            <>
              {/* Channel Results */}
              {results.channels.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[var(--tv-accent)] mb-2">
                    <Tv className="w-4 h-4" />
                    <span>Live Television Channels ({results.channels.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {results.channels.map(ch => (
                      <div
                        key={ch.id}
                        onClick={() => {
                          onSelectChannel(ch, true);
                          onClose();
                        }}
                        className="tv-focusable p-3 rounded-xl bg-white/5 hover:bg-white/15 cursor-pointer flex items-center justify-between border border-white/5"
                      >
                        <div className="flex items-center space-x-3 truncate flex-1 min-w-0 pr-2">
                          <span className="font-mono text-[var(--tv-accent)] text-xs font-bold w-6 shrink-0">
                            #{ch.num.toString().padStart(2, '0')}
                          </span>
                          <ChannelLogo
                            channelName={ch.name}
                            logoUrl={ch.logo}
                            size="xs"
                          />
                          <div className="truncate min-w-0 flex-1">
                            <div className="text-xs font-bold text-white truncate">{ch.name}</div>
                            <div className="text-[10px] text-zinc-400 truncate">{ch.group}</div>
                          </div>
                        </div>
                        <Play className="w-3.5 h-3.5 text-[var(--tv-accent)] shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Program Schedule Results */}
              {results.programs.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
                    <Calendar className="w-4 h-4" />
                    <span>TV Guide Scheduled Programs ({results.programs.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {results.programs.map(prog => {
                      const channel = channels.find(c => c.id === prog.channelId);
                      return (
                        <div
                          key={prog.id}
                          onClick={() => {
                            if (channel) {
                              onSelectChannel(channel, true);
                              onClose();
                            }
                          }}
                          className="tv-focusable p-3 rounded-xl bg-white/5 hover:bg-white/15 cursor-pointer flex items-center justify-between border border-white/5"
                        >
                          <div>
                            <div className="text-xs font-bold text-white">{prog.title}</div>
                            <div className="text-[10px] text-zinc-400">
                              {channel ? `on ${channel.name}` : ''} • {prog.category || 'General'}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-500" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* VOD Results */}
              {results.vod.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                    <Film className="w-4 h-4" />
                    <span>Movies & Series ({results.vod.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {results.vod.map(vod => (
                      <div
                        key={vod.id}
                        onClick={() => {
                          onSelectVod(vod);
                          onClose();
                        }}
                        className="tv-focusable p-3 rounded-xl bg-white/5 hover:bg-white/15 cursor-pointer flex items-center justify-between border border-white/5"
                      >
                        <div className="truncate">
                          <div className="text-xs font-bold text-white truncate">{vod.title}</div>
                          <div className="text-[10px] text-zinc-400">{vod.year} • {vod.genre}</div>
                        </div>
                        <Play className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer tip */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center space-x-2">
            <span className="text-[var(--tv-accent)]">● OK to play</span>
            <span>•</span>
            <span className="text-rose-400">● Mic key for voice speech</span>
          </div>
          <span className="font-mono text-zinc-500">Back button to close</span>
        </div>
      </div>
    </div>
  );
};
