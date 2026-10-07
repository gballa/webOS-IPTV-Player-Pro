import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Channel, Program, AppSettings } from '../../types/iptv';
import { VirtualList } from '../Common/VirtualList';
import {
  Search,
  Heart,
  Clock,
  Play,
  Radio,
  Eye,
  Volume2,
  VolumeX,
  Maximize2,
  Layers,
  Sparkles,
  RotateCcw,
  Check,
  Tv,
  Cpu,
  Gauge,
  Wifi,
  Activity,
  HardDrive,
  Lock,
  List,
  LayoutList,
} from 'lucide-react';
import { globalRemote, RemoteEvent } from '../../services/RemoteController';
import { NumberOverlay } from '../Player/NumberOverlay';
import { PinEntryModal } from '../Common/PinEntryModal';
import { ChannelLogo } from '../Common/ChannelLogo';

interface ChannelBrowserProps {
  channels: Channel[];
  programs: Program[];
  favoriteIds: string[];
  recentIds: string[];
  currentChannel: Channel;
  showLivePreview: boolean;
  settings?: AppSettings;
  onSelectChannel: (channel: Channel, goFullscreen?: boolean) => void;
  onToggleFavorite: (channelId: string) => void;
  onOpenFullscreen: () => void;
}

export function getChannelTechSpecs(ch: Channel) {
  let codec = ch.codec;
  let bitrateKbps = ch.bitrateKbps;
  let fps = ch.fps || (ch.resolution === '4K' ? 60 : 50);
  let audioCodec = ch.audioCodec;

  if (!codec) {
    if (ch.resolution === '4K') {
      codec = 'HEVC / H.265';
    } else if (ch.resolution === '720p') {
      codec = 'H.264 / AVC';
    } else {
      codec = 'H.264 / AVC';
    }
  }

  if (!bitrateKbps) {
    if (ch.resolution === '4K') {
      bitrateKbps = ch.hdr ? 18500 : 15000;
    } else if (ch.resolution === '720p') {
      bitrateKbps = 3600;
    } else {
      bitrateKbps = 6400;
    }
  }

  if (!audioCodec) {
    if (ch.resolution === '4K') {
      audioCodec = 'E-AC3 Atmos';
    } else {
      audioCodec = 'AAC 5.1';
    }
  }

  const bitrateMbps = (bitrateKbps / 1000).toFixed(1);

  return {
    codec,
    audioCodec,
    bitrateKbps,
    bitrateMbps: `${bitrateMbps} Mbps`,
    fps: `${fps}fps`,
    resLabel: ch.resolution === '4K' ? '4K UHD' : ch.resolution || '1080p',
  };
}

export const ChannelBrowser: React.FC<ChannelBrowserProps> = ({
  channels,
  programs,
  favoriteIds,
  recentIds,
  currentChannel,
  showLivePreview,
  settings,
  onSelectChannel,
  onToggleFavorite,
  onOpenFullscreen,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [activePane, setActivePane] = useState<'groups' | 'channels'>('channels');
  const [groupIndex, setGroupIndex] = useState(0);
  const [previewMuted, setPreviewMuted] = useState(true);
  const [density, setDensity] = useState<'compact' | 'comfortable'>(
    settings?.uiDensity || 'compact'
  );
  const [sortBy, setSortBy] = useState<'num' | 'name' | 'quality'>('num');
  const [viewportHeight, setViewportHeight] = useState(680);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Remote Number Dialing State (Jump to channel by remote keys)
  const [dialBuffer, setDialBuffer] = useState('');
  const dialTimeoutRef = useRef<any>(null);

  // Parental Controls State
  const [unlockedCategories, setUnlockedCategories] = useState<Set<string>>(new Set());
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingLockTarget, setPendingLockTarget] = useState<string | null>(null);

  // Check if a category is protected by Parental Controls
  const isCategoryLocked = (groupName: string) => {
    if (!settings?.parentalControlActive) return false;
    if (unlockedCategories.has(groupName)) return false;
    const lockedList = settings?.lockedCategories || [];
    return lockedList.some((k) => groupName.toLowerCase().includes(k.toLowerCase()));
  };

  // Dynamic responsive viewport height for strict virtualization
  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(Math.max(480, window.innerHeight - 175));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input for large catalogs (10,000+ channels)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setFocusedIndex(0);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Groups extraction and O(N) pre-computed category counts
  const { groups, groupCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set('ALL', channels.length);
    counts.set('FAVORITES', favoriteIds.length);
    counts.set('RECENTS', recentIds.length);

    for (let i = 0; i < channels.length; i++) {
      const g = channels[i].group || 'General';
      counts.set(g, (counts.get(g) || 0) + 1);
    }

    const uniqueGroups = Array.from(counts.keys())
      .filter((k) => k !== 'ALL' && k !== 'FAVORITES' && k !== 'RECENTS')
      .filter((k) => {
        if (settings?.parentalControlActive && settings?.hideLockedContent) {
          return !isCategoryLocked(k);
        }
        return true;
      })
      .sort();

    return {
      groups: ['ALL', 'FAVORITES', 'RECENTS', ...uniqueGroups],
      groupCounts: counts,
    };
  }, [channels, favoriteIds.length, recentIds.length, settings?.parentalControlActive, settings?.hideLockedContent, unlockedCategories, settings?.lockedCategories]);

  // Fast O(1) lookup sets for 10,000+ channel virtualization
  const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const recSet = useMemo(() => new Set(recentIds), [recentIds]);

  // Filtered and Sorted channels
  const filteredChannels = useMemo(() => {
    const list = channels.filter((ch) => {
      if (settings?.parentalControlActive && settings?.hideLockedContent) {
        if (isCategoryLocked(ch.group)) return false;
      }

      if (selectedGroup === 'FAVORITES') {
        if (!favSet.has(ch.id)) return false;
      } else if (selectedGroup === 'RECENTS') {
        if (!recSet.has(ch.id)) return false;
      } else if (selectedGroup !== 'ALL') {
        if (ch.group !== selectedGroup) return false;
      }

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        return (
          ch.name.toLowerCase().includes(q) ||
          ch.num.toString().includes(q) ||
          ch.group.toLowerCase().includes(q)
        );
      }
      return true;
    });

    if (sortBy === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === 'quality') {
      return [...list].sort((a, b) => {
        const scoreA =
          (a.resolution === '4K' ? 2 : 1) + (a.hdr && a.hdr !== 'SDR' ? 1 : 0);
        const scoreB =
          (b.resolution === '4K' ? 2 : 1) + (b.hdr && b.hdr !== 'SDR' ? 1 : 0);
        return scoreB - scoreA;
      });
    }
    return [...list].sort((a, b) => a.num - b.num);
  }, [channels, selectedGroup, favSet, recSet, debouncedSearch, sortBy, settings?.parentalControlActive, settings?.hideLockedContent, unlockedCategories, settings?.lockedCategories]);

  const focusedChannel = filteredChannels[focusedIndex] || currentChannel;

  // Precomputed O(1) program schedule map for all channels
  const scheduleMap = useMemo(() => {
    const map = new Map<string, {
      curProg: Program | null;
      nxtProg: Program | null;
      progressPercent: number;
      timeRemainingStr: string;
      timeRangeStr: string;
    }>();

    const nowTime = Date.now();
    const progsByChannel = new Map<string, Program[]>();
    for (let i = 0; i < programs.length; i++) {
      const p = programs[i];
      let arr = progsByChannel.get(p.channelId);
      if (!arr) {
        arr = [];
        progsByChannel.set(p.channelId, arr);
      }
      arr.push(p);
    }

    for (const [chId, chProgs] of progsByChannel.entries()) {
      const curProg =
        chProgs.find((p) => p.start <= nowTime && p.end > nowTime) ||
        chProgs[0] ||
        null;
      const nxtProg =
        chProgs.find((p) => p.start >= nowTime) ||
        (chProgs.length > 1 ? chProgs[1] : null);

      let progressPercent = 50;
      let timeRemainingStr = '';
      let timeRangeStr = '';

      if (curProg && curProg.end > curProg.start) {
        const elapsed = Math.max(0, nowTime - curProg.start);
        const total = curProg.end - curProg.start;
        progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
        const minsLeft = Math.max(1, Math.round((curProg.end - nowTime) / 60000));
        timeRemainingStr = `${minsLeft}m left`;
        const startStr = new Date(curProg.start).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const endStr = new Date(curProg.end).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        timeRangeStr = `${startStr}–${endStr}`;
      }

      map.set(chId, {
        curProg,
        nxtProg,
        progressPercent,
        timeRemainingStr,
        timeRangeStr,
      });
    }

    return map;
  }, [programs]);

  // Instant O(1) lookup
  const getChannelSchedule = (channelId: string) => {
    return (
      scheduleMap.get(channelId) || {
        curProg: null,
        nxtProg: null,
        progressPercent: 50,
        timeRemainingStr: '',
        timeRangeStr: '',
      }
    );
  };

  const focusedSchedule = useMemo(() => {
    if (!focusedChannel) return null;
    return getChannelSchedule(focusedChannel.id);
  }, [focusedChannel, programs]);

  const focusedTech = useMemo(() => {
    if (!focusedChannel) return null;
    return getChannelTechSpecs(focusedChannel);
  }, [focusedChannel]);

  // Remote Number Dialing (Jump to channel by number keys)
  const handleNumberInput = (digit: number) => {
    setDialBuffer((prev) => {
      const updated = prev + digit.toString();
      clearTimeout(dialTimeoutRef.current);

      const targetNum = parseInt(updated, 10);
      const exactIdx = filteredChannels.findIndex((c) => c.num === targetNum);
      if (exactIdx !== -1) {
        setFocusedIndex(exactIdx);
      } else {
        const prefixIdx = filteredChannels.findIndex((c) =>
          c.num.toString().startsWith(updated)
        );
        if (prefixIdx !== -1) {
          setFocusedIndex(prefixIdx);
        }
      }

      dialTimeoutRef.current = setTimeout(() => {
        const num = parseInt(updated, 10);
        const finalMatch =
          filteredChannels.find((c) => c.num === num) ||
          channels.find((c) => c.num === num);
        if (finalMatch) {
          if (isCategoryLocked(finalMatch.group)) {
            setPendingLockTarget(finalMatch.group);
            setIsPinModalOpen(true);
          } else {
            onSelectChannel(finalMatch, true);
          }
        }
        setDialBuffer('');
      }, 1500);

      return updated;
    });
  };

  // Handle remote keys for Channel Browser
  useEffect(() => {
    const unsubscribe = globalRemote.subscribe((event: RemoteEvent) => {
      switch (event.action) {
        case 'NUMBER':
          if (event.numberKey !== undefined && event.numberKey >= 0 && event.numberKey <= 9) {
            handleNumberInput(event.numberKey);
          }
          break;
        case 'LEFT':
          if (activePane === 'channels') {
            setActivePane('groups');
          }
          break;
        case 'RIGHT':
          if (activePane === 'groups') {
            setActivePane('channels');
          }
          break;
        case 'UP':
          if (activePane === 'groups') {
            setGroupIndex((prev) => {
              const next = Math.max(0, prev - 1);
              setSelectedGroup(groups[next]);
              setFocusedIndex(0);
              return next;
            });
          } else {
            setFocusedIndex((prev) => Math.max(0, prev - 1));
          }
          break;
        case 'DOWN':
          if (activePane === 'groups') {
            setGroupIndex((prev) => {
              const next = Math.min(groups.length - 1, prev + 1);
              setSelectedGroup(groups[next]);
              setFocusedIndex(0);
              return next;
            });
          } else {
            setFocusedIndex((prev) => Math.min(filteredChannels.length - 1, prev + 1));
          }
          break;
        case 'CH_UP':
          setFocusedIndex((prev) => Math.max(0, prev - 50));
          break;
        case 'CH_DOWN':
          setFocusedIndex((prev) => Math.min(filteredChannels.length - 1, prev + 50));
          break;
        case 'ENTER':
          if (dialBuffer) {
            clearTimeout(dialTimeoutRef.current);
            const num = parseInt(dialBuffer, 10);
            const target =
              filteredChannels.find((c) => c.num === num) ||
              channels.find((c) => c.num === num) ||
              filteredChannels[focusedIndex];
            if (target) {
              if (isCategoryLocked(target.group)) {
                setPendingLockTarget(target.group);
                setIsPinModalOpen(true);
              } else {
                onSelectChannel(target, true);
              }
            }
            setDialBuffer('');
            return;
          }

          if (activePane === 'groups') {
            const targetGroup = groups[groupIndex];
            if (isCategoryLocked(targetGroup)) {
              setPendingLockTarget(targetGroup);
              setIsPinModalOpen(true);
              return;
            }
            setSelectedGroup(targetGroup);
            setActivePane('channels');
          } else if (filteredChannels[focusedIndex]) {
            const ch = filteredChannels[focusedIndex];
            if (isCategoryLocked(ch.group)) {
              setPendingLockTarget(ch.group);
              setIsPinModalOpen(true);
            } else {
              onSelectChannel(ch, true);
            }
          }
          break;
        case 'GREEN':
          if (filteredChannels[focusedIndex]) {
            onToggleFavorite(filteredChannels[focusedIndex].id);
          }
          break;
        case 'PLAY':
          if (filteredChannels[focusedIndex]) {
            const ch = filteredChannels[focusedIndex];
            if (isCategoryLocked(ch.group)) {
              setPendingLockTarget(ch.group);
              setIsPinModalOpen(true);
            } else {
              onSelectChannel(ch, true);
            }
          }
          break;
      }
    });

    return () => unsubscribe();
  }, [filteredChannels, focusedIndex, activePane, groupIndex, groups, dialBuffer, onSelectChannel, onToggleFavorite, settings, unlockedCategories]);

  // PageUp / PageDown & Home / End keyboard listeners for large channel catalogs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleNumberInput(parseInt(e.key, 10));
        return;
      }

      if (e.key === 'PageUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(0, prev - 50));
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(filteredChannels.length - 1, prev + 50));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setFocusedIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setFocusedIndex(Math.max(0, filteredChannels.length - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredChannels.length, dialBuffer]);

  // Preview video source update
  useEffect(() => {
    if (showLivePreview && previewVideoRef.current && focusedChannel) {
      previewVideoRef.current.src = focusedChannel.streamUrl;
      previewVideoRef.current.play().catch(() => {});
    }
  }, [focusedChannel?.streamUrl, showLivePreview]);

  // Precompute technical stream specifications for all channels to ensure zero lag in 10,000+ virtualization
  const techSpecsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getChannelTechSpecs>>();
    for (let i = 0; i < channels.length; i++) {
      map.set(channels[i].id, getChannelTechSpecs(channels[i]));
    }
    return map;
  }, [channels]);

  // Exact fixed item height for strict virtualization performance
  // Compact: 56px (generous vertical clearance to prevent any overlapping text)
  // Comfortable: 74px (expanded 10-foot TV viewing)
  const itemHeight = density === 'compact' ? 56 : 74;

  return (
    <div className="flex-1 flex overflow-hidden bg-[var(--tv-bg-primary)] select-none">
      {/* 1. Left Sidebar: Channel Groups */}
      <div className="w-64 border-r border-[var(--tv-border)] bg-[var(--tv-bg-surface)] p-3.5 flex flex-col shrink-0">
        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setFocusedIndex(0);
            }}
            className="w-full bg-[var(--tv-bg-elevated)] border border-[var(--tv-border)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--tv-text-primary)] placeholder-zinc-500 focus:outline-none focus:border-[var(--tv-accent)]"
          />
        </div>

        {/* Group list */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 py-1 flex items-center space-x-1.5">
            <Layers className="w-3 h-3 text-[var(--tv-accent)]" />
            <span>Categories ({groups.length})</span>
          </div>

          {groups.map((group, gIdx) => {
            const isSelected = selectedGroup === group;
            const isFocusedGroup = activePane === 'groups' && groupIndex === gIdx;
            const locked = isCategoryLocked(group);

            return (
              <button
                key={group}
                onClick={() => {
                  if (locked) {
                    setPendingLockTarget(group);
                    setIsPinModalOpen(true);
                    return;
                  }
                  setSelectedGroup(group);
                  setGroupIndex(gIdx);
                  setActivePane('channels');
                  setFocusedIndex(0);
                }}
                className={`tv-focusable w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between border transition-all ${
                  isFocusedGroup
                    ? 'border-[var(--tv-accent)] shadow-md shadow-[var(--tv-accent-glow)]'
                    : 'border-transparent'
                } ${
                  isSelected
                    ? 'bg-[var(--tv-accent)] text-black font-extrabold shadow-md shadow-[var(--tv-accent-glow)]'
                    : 'text-[var(--tv-text-secondary)] hover:bg-white/10 hover:text-[var(--tv-text-primary)]'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  {group === 'FAVORITES' && (
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        isSelected ? 'fill-black' : 'fill-[var(--tv-accent)] text-[var(--tv-accent)]'
                      }`}
                    />
                  )}
                  {group === 'RECENTS' && <Clock className="w-3.5 h-3.5" />}
                  {locked && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                  <span className="truncate">{group === 'ALL' ? 'All Channels' : group}</span>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                  {locked && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">
                      Lock
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      isSelected ? 'bg-black/20 text-black font-bold' : 'text-zinc-400'
                    }`}
                  >
                    {(groupCounts.get(group) || 0).toLocaleString()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Remote Guide Footer */}
        <div className="pt-2.5 border-t border-[var(--tv-border)] text-[10px] text-zinc-400 space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tv-accent)]" />
            <span>← / → Switch Groups & Streams</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Green: Toggle Favorite</span>
          </div>
        </div>
      </div>

      {/* 2. Centre: Virtualized Channel List */}
      <div className="flex-1 p-5 flex flex-col overflow-hidden">
        {/* Header Bar: Line 1 = List Name & Counter, Line 2 = Controls & Filters */}
        <div className="flex flex-col gap-2.5 mb-3 pb-2.5 border-b border-white/10 shrink-0">
          {/* Line 1: Dedicated List Name Header on its own line */}
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="w-2.5 h-6 rounded-full bg-[var(--tv-accent)] shadow-[0_0_10px_var(--tv-accent)] shrink-0" />
              <h2 className="text-xl sm:text-2xl font-black text-[var(--tv-text-primary)] tracking-tight truncate">
                {selectedGroup === 'ALL' ? 'All Channels' : selectedGroup}
              </h2>
              <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold bg-[var(--tv-accent)]/15 text-[var(--tv-accent)] border border-[var(--tv-accent)]/30 shrink-0">
                <span>{filteredChannels.length.toLocaleString()}</span>
                <span className="font-sans font-medium text-[11px] opacity-80">
                  {filteredChannels.length === 1 ? 'stream' : 'streams'}
                </span>
              </div>
            </div>

            {searchQuery && (
              <div className="text-xs text-zinc-400 font-medium truncate shrink-0 hidden sm:block">
                Filtered: <span className="text-white font-bold font-mono">"{searchQuery}"</span>
              </div>
            )}
          </div>

          {/* Line 2: Density, Sort & Stepper Controls rearranged neatly down below */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Density & Sort Controls strictly inline */}
            <div className="flex items-center space-x-2 shrink-0">
              {/* Density Selector with Icons */}
              <div className="flex items-center space-x-1 bg-white/5 border border-white/10 rounded-xl p-1 shadow-sm">
                <button
                  onClick={() => setDensity('compact')}
                  className={`h-7 px-2.5 rounded-lg font-bold transition-all flex items-center justify-center ${
                    density === 'compact'
                      ? 'bg-[var(--tv-accent)] text-black shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Compact view (dense list)"
                  aria-label="Compact view"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDensity('comfortable')}
                  className={`h-7 px-2.5 rounded-lg font-bold transition-all flex items-center justify-center ${
                    density === 'comfortable'
                      ? 'bg-[var(--tv-accent)] text-black shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Comfortable view (detailed 10-foot TV rows)"
                  aria-label="Comfortable view"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
              </div>

              {/* Sort Selector kept strictly inline */}
              <div className="flex items-center space-x-1 bg-white/5 border border-white/10 rounded-xl p-1 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-400 px-1.5 uppercase tracking-wider">Sort</span>
                <button
                  onClick={() => setSortBy('num')}
                  className={`h-7 px-2.5 rounded-lg font-bold transition-all flex items-center justify-center ${
                    sortBy === 'num'
                      ? 'bg-[var(--tv-accent)] text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Sort by Channel Number"
                >
                  #
                </button>
                <button
                  onClick={() => setSortBy('name')}
                  className={`h-7 px-2.5 rounded-lg font-bold transition-all flex items-center justify-center ${
                    sortBy === 'name'
                      ? 'bg-[var(--tv-accent)] text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Sort by Name A–Z"
                >
                  A–Z
                </button>
                <button
                  onClick={() => setSortBy('quality')}
                  className={`h-7 px-2.5 rounded-lg font-bold transition-all flex items-center justify-center ${
                    sortBy === 'quality'
                      ? 'bg-[var(--tv-accent)] text-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Sort by 4K UHD Quality"
                >
                  4K
                </button>
              </div>
            </div>

            {/* Quick Channel Steppers for 10K+ lists */}
            {filteredChannels.length > 50 && (
              <div className="flex items-center space-x-1 bg-white/5 border border-white/10 rounded-xl p-1 shadow-sm">
                <span className="text-[10px] font-bold text-zinc-400 px-1.5 uppercase tracking-wider hidden sm:inline">Jump</span>
                {filteredChannels.length > 500 && (
                  <button
                    onClick={() => setFocusedIndex((prev) => Math.max(0, prev - 500))}
                    className="px-1.5 py-1 rounded-lg font-mono text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-white/10"
                    title="Jump back 500 channels"
                  >
                    -500
                  </button>
                )}
                <button
                  onClick={() => setFocusedIndex((prev) => Math.max(0, prev - 50))}
                  className="px-2 py-1 rounded-lg font-mono text-[11px] font-bold text-zinc-300 hover:text-white hover:bg-white/10"
                  title="Jump back 50 channels (PageUp / Channel Down)"
                >
                  -50
                </button>
                <button
                  onClick={() => setFocusedIndex((prev) => Math.min(filteredChannels.length - 1, prev + 50))}
                  className="px-2 py-1 rounded-lg font-mono text-[11px] font-bold text-zinc-300 hover:text-white hover:bg-white/10"
                  title="Jump forward 50 channels (PageDown / Channel Up)"
                >
                  +50
                </button>
                {filteredChannels.length > 500 && (
                  <button
                    onClick={() => setFocusedIndex((prev) => Math.min(filteredChannels.length - 1, prev + 500))}
                    className="px-1.5 py-1 rounded-lg font-mono text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-white/10"
                    title="Jump forward 500 channels"
                  >
                    +500
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Strict Virtualized Channel List */}
        <div className="flex-1 overflow-hidden" style={{ contain: 'strict' }}>
          {filteredChannels.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500">
              <Radio className="w-12 h-12 mb-3 stroke-[1.5]" />
              <p className="text-sm font-semibold">No channels found matching current criteria</p>
            </div>
          ) : (
            <VirtualList
              items={filteredChannels}
              itemHeight={itemHeight}
              viewportHeight={viewportHeight}
              overscan={6}
              focusedIndex={activePane === 'channels' ? focusedIndex : -1}
              getItemKey={(ch) => ch.id}
              renderItem={(ch, idx, isFocused) => {
                const isFav = favSet.has(ch.id);
                const isCurrent = ch.id === currentChannel.id;
                const schedule = getChannelSchedule(ch.id);
                const tech = techSpecsMap.get(ch.id) || getChannelTechSpecs(ch);

                const isLockedChannel = isCategoryLocked(ch.group);

                if (density === 'compact') {
                  return (
                    <div
                      key={ch.id}
                      id={`ch-card-${ch.id}`}
                      onClick={() => {
                        setFocusedIndex(idx);
                        setActivePane('channels');
                        if (isLockedChannel) {
                          setPendingLockTarget(ch.group);
                          setIsPinModalOpen(true);
                        } else {
                          onSelectChannel(ch, true);
                        }
                      }}
                      onMouseEnter={() => {
                        setFocusedIndex(idx);
                        setActivePane('channels');
                      }}
                      className={`tv-focusable mx-1 h-[50px] my-[2px] rounded-xl px-3 py-1 flex flex-col justify-center cursor-pointer border transition-all duration-150 relative overflow-hidden select-none ${
                        isFocused
                          ? 'bg-[var(--tv-accent-subtle)] border-[var(--tv-accent)] shadow-lg shadow-[var(--tv-accent-glow)] ring-1 ring-[var(--tv-accent)]'
                          : isCurrent
                          ? 'bg-[var(--tv-accent-subtle)] border-[var(--tv-accent-border)]'
                          : 'bg-[var(--tv-bg-surface)] border-[var(--tv-border)] hover:bg-[var(--tv-bg-elevated)]'
                      }`}
                    >
                      {/* Subtle broadcast progress line indicator */}
                      <div
                        className="absolute bottom-0 left-0 h-[2px] bg-[var(--tv-accent)] opacity-50 pointer-events-none transition-all duration-300"
                        style={{ width: `${schedule.progressPercent}%` }}
                      />

                      {/* Line 1: Station Identification & Technical Specifications */}
                      <div className="flex items-center justify-between min-w-0 w-full overflow-hidden leading-tight">
                        {/* Left: Number, Station Logo, Name & Live Indicator */}
                        <div className="flex items-center space-x-2 min-w-0 flex-1 pr-2 overflow-hidden">
                          <span className="font-mono text-[11px] font-black text-[var(--tv-accent)] w-7 text-right shrink-0 whitespace-nowrap">
                            #{ch.num.toString().padStart(2, '0')}
                          </span>

                          <ChannelLogo
                            channelName={ch.name}
                            logoUrl={ch.logo}
                            size="xs"
                          />

                          <span className="text-xs font-bold text-white truncate whitespace-nowrap min-w-0 flex-1">
                            {ch.name}
                          </span>

                          {isLockedChannel && (
                            <span className="flex items-center space-x-1 text-[8.5px] font-bold text-amber-300 shrink-0 px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/30 whitespace-nowrap">
                              <Lock className="w-2.5 h-2.5" />
                              <span>LOCKED</span>
                            </span>
                          )}

                          <span className="text-[9px] text-zinc-400 bg-white/5 border border-white/5 px-1 rounded truncate whitespace-nowrap max-w-[80px] shrink-0 hidden 2xl:inline">
                            {ch.group}
                          </span>
                        </div>

                        {/* Right: Favorite Control */}
                        <div className="flex items-center shrink-0">
                          {/* Favorite Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(ch.id);
                            }}
                            className="p-1 rounded hover:bg-white/15 transition-colors shrink-0"
                            title={isFav ? 'Remove Favorite (Green)' : 'Add Favorite (Green)'}
                          >
                            <Heart
                              className={`w-3.5 h-3.5 ${
                                isFav
                                  ? 'text-[var(--tv-accent)] fill-[var(--tv-accent)]'
                                  : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Line 2: Program Metadata (Current Program + Airing Time Remaining + Next Program) */}
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-0.5 min-w-0 w-full overflow-hidden leading-tight">
                        <div className="flex items-center space-x-1.5 min-w-0 flex-1 overflow-hidden pr-2">
                          <span className="text-zinc-500 font-mono text-[8.5px] uppercase font-bold shrink-0 whitespace-nowrap hidden sm:inline">
                            NOW:
                          </span>
                          {schedule.curProg ? (
                            <>
                              <span className="text-[10px] font-medium text-zinc-200 truncate whitespace-nowrap min-w-0 flex-1">
                                {schedule.curProg.title}
                              </span>
                              {schedule.timeRemainingStr && (
                                <span className="text-[var(--tv-accent)] font-mono text-[9px] font-semibold shrink-0 whitespace-nowrap">
                                  · {schedule.timeRemainingStr}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-zinc-500 text-[10px] italic truncate whitespace-nowrap min-w-0 flex-1">
                              Continuous Live Broadcast
                            </span>
                          )}
                        </div>

                        {/* Next Program Preview */}
                        {schedule.nxtProg && (
                          <div className="hidden 2xl:flex items-center space-x-1 text-zinc-500 text-[9px] shrink-0 max-w-[150px] overflow-hidden whitespace-nowrap pl-2">
                            <span className="shrink-0 text-zinc-500">Next:</span>
                            <span className="text-zinc-400 truncate whitespace-nowrap font-medium">
                              {schedule.nxtProg.title}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Comfortable Mode: 68px inner card (74px slot height)
                return (
                  <div
                    key={ch.id}
                    id={`ch-card-${ch.id}`}
                    onClick={() => {
                      setFocusedIndex(idx);
                      setActivePane('channels');
                      if (isLockedChannel) {
                        setPendingLockTarget(ch.group);
                        setIsPinModalOpen(true);
                      } else {
                        onSelectChannel(ch, true);
                      }
                    }}
                    onMouseEnter={() => {
                      setFocusedIndex(idx);
                      setActivePane('channels');
                    }}
                    className={`tv-focusable mx-1 h-[68px] my-[2px] rounded-xl p-2.5 flex items-center justify-between cursor-pointer border transition-all duration-150 relative overflow-hidden select-none ${
                      isFocused
                        ? 'bg-[var(--tv-accent-subtle)] border-[var(--tv-accent)] shadow-lg shadow-[var(--tv-accent-glow)] ring-1 ring-[var(--tv-accent)]'
                        : isCurrent
                        ? 'bg-[var(--tv-accent-subtle)] border-[var(--tv-accent-border)]'
                        : 'bg-[var(--tv-bg-surface)] border-[var(--tv-border)] hover:bg-[var(--tv-bg-elevated)]'
                    }`}
                  >
                    {/* Broadcast progress line indicator */}
                    <div
                      className="absolute bottom-0 left-0 h-[2.5px] bg-[var(--tv-accent)] opacity-50 pointer-events-none transition-all duration-300"
                      style={{ width: `${schedule.progressPercent}%` }}
                    />

                    {/* Left: Number + Logo + Titles */}
                    <div className="flex items-center space-x-3 min-w-0 flex-1 pr-3 overflow-hidden">
                      <span className="font-mono text-sm font-black text-[var(--tv-accent)] w-8 text-right shrink-0 whitespace-nowrap">
                        #{ch.num.toString().padStart(2, '0')}
                      </span>

                      <ChannelLogo
                        channelName={ch.name}
                        logoUrl={ch.logo}
                        size="md"
                      />

                      <div className="min-w-0 flex-1 flex flex-col justify-center space-y-1 overflow-hidden">
                        <div className="flex items-center space-x-2 min-w-0 overflow-hidden leading-snug">
                          <span className="text-xs font-bold text-white truncate whitespace-nowrap min-w-0 flex-1">
                            {ch.name}
                          </span>
                          {isLockedChannel && (
                            <span className="flex items-center space-x-1 text-[8.5px] font-bold text-amber-300 shrink-0 px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/30 whitespace-nowrap">
                              <Lock className="w-2.5 h-2.5" />
                              <span>LOCKED</span>
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-400 bg-white/5 border border-white/5 px-1.5 py-0.2 rounded truncate whitespace-nowrap max-w-[90px] shrink-0 hidden 2xl:inline">
                            {ch.group}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2 text-[10px] text-zinc-400 min-w-0 overflow-hidden leading-snug">
                          {schedule.curProg ? (
                            <>
                              <span className="text-zinc-200 font-semibold truncate whitespace-nowrap min-w-0 flex-1">
                                {schedule.curProg.title}
                              </span>
                              {schedule.timeRemainingStr && (
                                <span className="text-[var(--tv-accent)] font-semibold font-mono shrink-0 whitespace-nowrap">
                                  · {schedule.timeRemainingStr}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-zinc-500 italic truncate whitespace-nowrap min-w-0 flex-1">
                              Continuous Live Feed
                            </span>
                          )}
                          {schedule.nxtProg && (
                            <span className="truncate whitespace-nowrap text-zinc-500 shrink-0 hidden xl:inline max-w-[180px]">
                              | Next: {schedule.nxtProg.title}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Favorite Control */}
                    <div className="flex items-center shrink-0">
                      {/* Favorite Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(ch.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/15 transition-colors shrink-0"
                        title={isFav ? 'Remove Favorite (Green)' : 'Add Favorite (Green)'}
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            isFav
                              ? 'text-[var(--tv-accent)] fill-[var(--tv-accent)]'
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>
      </div>

      {/* 3. Right: Live Preview Pane & Technical Stream Inspector */}
      {showLivePreview && focusedChannel && (
        <div className="w-80 border-l border-[var(--tv-border)] bg-[var(--tv-bg-surface)] p-4 flex flex-col shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[var(--tv-accent)]">
              <Eye className="w-3.5 h-3.5" />
              <span>Stream Inspector</span>
            </div>
            <button
              onClick={() => setPreviewMuted(!previewMuted)}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300"
              title={previewMuted ? 'Unmute' : 'Mute'}
            >
              {previewMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Mini Preview Video Player */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-white/15 shadow-xl mb-3 group shrink-0">
            <video
              ref={previewVideoRef}
              muted={previewMuted}
              playsInline
              autoPlay
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[var(--tv-accent)] text-[9px] font-black uppercase text-black flex items-center space-x-1 shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
              <span>LIVE</span>
            </div>

            <button
              onClick={onOpenFullscreen}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity font-bold text-xs space-x-1.5"
            >
              <Maximize2 className="w-4 h-4 text-[var(--tv-accent)]" />
              <span>Open Fullscreen</span>
            </button>
          </div>

          {/* Channel Info & Now Playing */}
          <div className="space-y-3 flex-1 pr-1">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm font-black text-[var(--tv-accent)]">
                  #{focusedChannel.num}
                </span>
                <h3 className="text-sm font-bold text-white truncate">
                  {focusedChannel.name}
                </h3>
              </div>
              <span className="text-[11px] text-zinc-400">{focusedChannel.group}</span>
            </div>

            {/* Now Playing EPG details */}
            <div className="p-3 rounded-xl bg-[var(--tv-bg-elevated)] border border-[var(--tv-border)] space-y-1.5 text-xs">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tv-accent)] flex items-center justify-between">
                <span>CURRENT PROGRAM</span>
                {focusedSchedule?.timeRemainingStr && (
                  <span className="font-mono text-[var(--tv-accent)] font-semibold">
                    {focusedSchedule.timeRemainingStr}
                  </span>
                )}
              </div>
              <div className="text-xs font-bold text-white">
                {focusedSchedule?.curProg?.title || 'Live Transmission'}
              </div>
              <p className="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed">
                {focusedSchedule?.curProg?.description ||
                  'Real-time broadcast streamed in high quality via the native video decoding pipeline.'}
              </p>
            </div>

            {/* Comprehensive Technical Stream Info Card */}
            {focusedTech && (
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2 text-xs">
                <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 flex items-center space-x-1">
                  <Cpu className="w-3 h-3 text-[var(--tv-accent)]" />
                  <span>Technical Stream Diagnostics</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-[9px] text-zinc-500 uppercase block">Video Codec</span>
                    <span className="text-white font-bold">{focusedTech.codec}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 uppercase block">Bitrate</span>
                    <span className="text-[var(--tv-accent)] font-bold">{focusedTech.bitrateMbps}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 uppercase block">Resolution / FPS</span>
                    <span className="text-white">{focusedTech.resLabel} @ {focusedTech.fps}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-500 uppercase block">Audio Track</span>
                    <span className="text-zinc-300">{focusedTech.audioCodec}</span>
                  </div>
                </div>

                {settings && (
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-400">
                    <span>Engine: <strong className="text-white uppercase">{settings.playerEngine}</strong></span>
                    <span>Buffer: <strong className="text-[var(--tv-accent)]">{settings.bufferSizeSec}s</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Up Next */}
            {focusedSchedule?.nxtProg && (
              <div className="p-2.5 rounded-xl bg-[var(--tv-bg-elevated)] border border-[var(--tv-border)] text-xs text-zinc-400">
                <span className="text-[9px] uppercase font-bold text-zinc-500 block mb-0.5">
                  UP NEXT
                </span>
                <span className="text-white font-medium truncate block text-xs">
                  {focusedSchedule.nxtProg.title}
                </span>
              </div>
            )}

            {/* Watch Fullscreen Button */}
            <button
              onClick={() => onSelectChannel(focusedChannel, true)}
              className="tv-focusable w-full py-2.5 rounded-xl bg-[var(--tv-accent)] hover:brightness-110 text-black font-black text-xs flex items-center justify-center space-x-2 shadow-lg shadow-[var(--tv-accent-glow)] mt-2"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>Watch Fullscreen (OK)</span>
            </button>
          </div>
        </div>
      )}

      {/* Visual Remote Number Dialing Overlay */}
      <NumberOverlay inputBuffer={dialBuffer} />

      {/* Parental PIN Entry Security Modal */}
      <PinEntryModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingLockTarget(null);
        }}
        onSuccess={() => {
          if (pendingLockTarget) {
            setUnlockedCategories((prev) => new Set([...prev, pendingLockTarget]));
            const targetCh =
              filteredChannels.find((c) => c.group === pendingLockTarget) ||
              channels.find((c) => c.group === pendingLockTarget);
            if (targetCh) {
              onSelectChannel(targetCh, true);
            }
          }
          setIsPinModalOpen(false);
          setPendingLockTarget(null);
        }}
        correctPin={settings?.parentalPin || '0000'}
        targetName={pendingLockTarget ? `Channel Category: ${pendingLockTarget}` : 'Protected Live Stream'}
        description="Enter your 4-digit security PIN to unlock this protected channel group."
      />
    </div>
  );
};
