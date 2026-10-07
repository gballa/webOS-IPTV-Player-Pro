import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Tv, Calendar, Film, Play, ChevronRight } from 'lucide-react';
import { Channel, Program, VodItem } from '../../types/iptv';
import { ChannelLogo } from '../Common/ChannelLogo';

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
    }
  }, [isOpen]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-8 select-none">
      <div className="bg-[#141419] border border-white/20 rounded-3xl max-w-3xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Search Input Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center space-x-3 flex-1 mr-4">
            <Search className="w-6 h-6 text-cyan-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search live channels, TV guide, movies, or series..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-transparent text-lg font-bold text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {!query.trim() ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              Type on your keyboard or remote to search channels, TV schedule, and movies.
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
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
                    <Tv className="w-4 h-4" />
                    <span>Live Television Channels ({results.channels.length})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
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
                          <span className="font-mono text-cyan-400 text-xs font-bold w-6 shrink-0">
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
                        <Play className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
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
                  <div className="grid grid-cols-2 gap-2">
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
          <span>Press remote OK to play result</span>
          <span className="font-mono text-zinc-500">Back button to close</span>
        </div>
      </div>
    </div>
  );
};
