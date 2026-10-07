import React, { useState, useMemo, useEffect } from 'react';
import { Channel, Program } from '../../types/iptv';
import { Calendar, Clock, Play, Bell, History, Radio, ChevronRight, Check, Search } from 'lucide-react';
import { StorageService } from '../../services/StorageService';
import { globalRemote, RemoteEvent } from '../../services/RemoteController';
import { VirtualList } from '../Common/VirtualList';

interface EpgGuideProps {
  channels: Channel[];
  programs: Program[];
  currentChannel: Channel;
  onSelectChannel: (channel: Channel, goFullscreen?: boolean) => void;
  onPlayCatchup?: (program: Program, channel: Channel) => void;
}

export const EpgGuide: React.FC<EpgGuideProps> = ({
  channels,
  programs,
  currentChannel,
  onSelectChannel,
  onPlayCatchup,
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState(currentChannel.id);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [reminderSet, setReminderSet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewportHeight, setViewportHeight] = useState(600);

  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(Math.max(400, window.innerHeight - 200));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const q = searchQuery.toLowerCase().trim();
    return channels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.num.toString().includes(q) ||
        c.group.toLowerCase().includes(q)
    );
  }, [channels, searchQuery]);

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) || channels[0];

  // Programs for selected channel sorted chronologically
  const channelPrograms = useMemo(() => {
    return programs
      .filter(p => p.channelId === selectedChannelId)
      .sort((a, b) => a.start - b.start);
  }, [programs, selectedChannelId]);

  // Set default program to currently airing program
  useEffect(() => {
    const now = Date.now();
    const current = channelPrograms.find(p => p.start <= now && p.end > now) || channelPrograms[0];
    if (current) {
      setSelectedProgram(current);
    }
  }, [channelPrograms]);

  // Check if reminder is already set
  useEffect(() => {
    if (selectedProgram) {
      const reminders = StorageService.getReminders();
      setReminderSet(reminders.some(r => r.id === selectedProgram.id));
    }
  }, [selectedProgram]);

  // Remote key navigation in EPG
  useEffect(() => {
    const unsubscribe = globalRemote.subscribe((event: RemoteEvent) => {
      switch (event.action) {
        case 'UP': {
          // Move up in channel list
          const idx = channels.findIndex(c => c.id === selectedChannelId);
          if (idx > 0) {
            setSelectedChannelId(channels[idx - 1].id);
          }
          break;
        }
        case 'DOWN': {
          // Move down in channel list
          const idx = channels.findIndex(c => c.id === selectedChannelId);
          if (idx < channels.length - 1) {
            setSelectedChannelId(channels[idx + 1].id);
          }
          break;
        }
        case 'ENTER':
          if (selectedProgram) {
            const now = Date.now();
            if (selectedProgram.end <= now && onPlayCatchup) {
              // Past program -> Catch-up
              onPlayCatchup(selectedProgram, selectedChannel);
            } else {
              // Current or future -> tune live channel
              onSelectChannel(selectedChannel, true);
            }
          }
          break;
        case 'GREEN': {
          // Jump to currently playing program (today / live now)
          const now = Date.now();
          const live = channelPrograms.find(p => p.start <= now && p.end > now);
          if (live) setSelectedProgram(live);
          break;
        }
      }
    });

    return () => unsubscribe();
  }, [channels, selectedChannelId, selectedProgram, selectedChannel, channelPrograms, onSelectChannel, onPlayCatchup]);

  const handleToggleReminder = () => {
    if (!selectedProgram) return;
    if (reminderSet) {
      StorageService.removeReminder(selectedProgram.id);
      setReminderSet(false);
    } else {
      StorageService.addReminder({
        id: selectedProgram.id,
        channelId: selectedChannel.id,
        channelName: selectedChannel.name,
        programTitle: selectedProgram.title,
        startTime: selectedProgram.start,
      });
      setReminderSet(true);
    }
  };

  const now = Date.now();

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0a0a0c]">
      {/* Pane 1 (Left): Channels List */}
      <div className="w-80 border-r border-white/10 bg-[#0f0f14]/80 p-3.5 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center space-x-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-[var(--tv-accent)]" />
            <span>Channels Schedule</span>
          </div>
          <span className="text-[11px] font-mono font-bold text-[var(--tv-accent)]">
            {filteredChannels.length}
          </span>
        </div>

        {/* Search Bar for fast navigation across 10K+ channels */}
        <div className="relative mb-2.5">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--tv-accent)]"
          />
        </div>

        <div className="flex-1 overflow-hidden" style={{ contain: 'strict' }}>
          {filteredChannels.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
              No channels match "{searchQuery}"
            </div>
          ) : (
            <VirtualList
              items={filteredChannels}
              itemHeight={62}
              viewportHeight={viewportHeight}
              overscan={4}
              getItemKey={(ch) => ch.id}
              focusedIndex={filteredChannels.findIndex((c) => c.id === selectedChannelId)}
              renderItem={(ch) => {
                const isSelected = ch.id === selectedChannelId;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChannelId(ch.id)}
                    className={`tv-focusable w-full h-[58px] p-2.5 my-[2px] rounded-xl text-left flex items-center justify-between border transition-all ${
                      isSelected
                        ? 'bg-[var(--tv-accent)] text-black border-[var(--tv-accent)] shadow-md shadow-[var(--tv-accent-glow)] font-bold'
                        : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate min-w-0 pr-1">
                      <span
                        className={`text-xs font-mono font-black shrink-0 ${
                          isSelected ? 'text-black' : 'text-[var(--tv-accent)]'
                        }`}
                      >
                        {ch.num.toString().padStart(2, '0')}
                      </span>
                      <div className="truncate min-w-0">
                        <div className="text-xs font-bold truncate leading-tight">{ch.name}</div>
                        <div
                          className={`text-[10px] truncate ${
                            isSelected ? 'text-black/80' : 'text-zinc-500'
                          }`}
                        >
                          {ch.group}
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-black' : 'text-zinc-600'
                      }`}
                    />
                  </button>
                );
              }}
            />
          )}
        </div>
      </div>

      {/* Pane 2 (Center): Timeline Schedule Grid */}
      <div className="flex-1 p-6 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <span className="font-mono text-[var(--tv-accent)]">CH {selectedChannel.num}</span>
              <span>{selectedChannel.name}</span>
            </h2>
            <span className="px-2 py-0.5 rounded bg-white/10 text-xs font-semibold text-zinc-400">
              {selectedChannel.group}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Green: Now Playing</span>
          </div>
        </div>

        {/* Chronological timeline entries */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-2">
          {channelPrograms.map((prog) => {
            const isCurrentlyAiring = prog.start <= now && prog.end > now;
            const isPast = prog.end <= now;
            const isSelected = selectedProgram?.id === prog.id;

            return (
              <div
                key={prog.id}
                onClick={() => setSelectedProgram(prog)}
                className={`tv-focusable p-4 rounded-2xl cursor-pointer border transition-all ${
                  isSelected
                    ? 'bg-white/15 border-[var(--tv-accent)] shadow-xl shadow-[var(--tv-accent-glow)]'
                    : isCurrentlyAiring
                    ? 'bg-[var(--tv-accent-subtle)] border-[var(--tv-accent-border)] text-white'
                    : 'bg-white/5 border-white/5 hover:bg-white/10 text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-[var(--tv-accent)]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatTime(prog.start)} - {formatTime(prog.end)}</span>
                    </div>

                    {isCurrentlyAiring && (
                      <span className="px-2 py-0.5 rounded bg-red-600/30 border border-red-500 text-red-400 text-[10px] font-black uppercase tracking-wider animate-pulse">
                        LIVE NOW
                      </span>
                    )}

                    {isPast && (
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                        Catch-Up Available
                      </span>
                    )}
                  </div>

                  {prog.category && (
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      {prog.category}
                    </span>
                  )}
                </div>

                <div className="text-base font-bold text-white mb-1">{prog.title}</div>
                <p className="text-xs text-zinc-400 line-clamp-2">{prog.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pane 3 (Right): Program Detail & Action Pane */}
      <div className="w-96 border-l border-white/10 bg-[#0f0f14]/90 p-6 flex flex-col justify-between shrink-0">
        {selectedProgram ? (
          <>
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[var(--tv-accent)]">
                <Clock className="w-4 h-4" />
                <span>Program Details</span>
              </div>

              <div>
                <span className="text-xs font-mono font-bold text-zinc-400 block mb-1">
                  {formatTime(selectedProgram.start)} - {formatTime(selectedProgram.end)}
                </span>
                <h3 className="text-xl font-bold text-white mb-2 leading-tight">
                  {selectedProgram.title}
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-xs font-semibold text-zinc-300">
                    {selectedProgram.category || 'General'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/10 text-xs font-semibold text-zinc-300">
                    {selectedProgram.rating || 'TV-G'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 leading-relaxed max-h-56 overflow-y-auto">
                {selectedProgram.description || 'No detailed broadcast synopsis provided.'}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-6 border-t border-white/10">
              {selectedProgram.end <= now ? (
                <button
                  onClick={() => onPlayCatchup?.(selectedProgram, selectedChannel)}
                  className="tv-focusable w-full py-3.5 rounded-2xl bg-[var(--tv-accent)] hover:brightness-110 text-black font-extrabold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-[var(--tv-accent-glow)]"
                >
                  <History className="w-4 h-4" />
                  <span>Play Catch-Up Timeshift</span>
                </button>
              ) : selectedProgram.start <= now && selectedProgram.end > now ? (
                <button
                  onClick={() => onSelectChannel(selectedChannel, true)}
                  className="tv-focusable w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-red-600/30"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Tune Live Broadcast</span>
                </button>
              ) : (
                <button
                  onClick={handleToggleReminder}
                  className={`tv-focusable w-full py-3.5 rounded-2xl font-extrabold text-sm flex items-center justify-center space-x-2 transition-colors ${
                    reminderSet
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                >
                  {reminderSet ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Reminder Scheduled</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4" />
                      <span>Set Program Reminder</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => onSelectChannel(selectedChannel, true)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300"
              >
                Watch Current Channel Feed
              </button>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm">
            Select a program to view details
          </div>
        )}
      </div>
    </div>
  );
};
