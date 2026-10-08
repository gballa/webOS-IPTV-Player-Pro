import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Channel, Program, VodItem, AppTab, AppSettings, PlaylistSource } from '../../types/iptv';
import {
  Tv,
  Calendar,
  Film,
  Clapperboard,
  Search,
  Settings,
  Heart,
  Clock,
  Play,
  Radio,
  ChevronRight,
  ChevronLeft,
  Gauge,
  QrCode,
  ArrowRight,
  Hash,
  Moon,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Check,
  Flame,
  Info,
} from 'lucide-react';
import { LanCompanionService } from '../../services/LanCompanionService';

interface HomeScreenProps {
  channels: Channel[];
  programs: Program[];
  vodItems: VodItem[];
  favoriteIds: string[];
  recentIds: string[];
  playlists?: PlaylistSource[];
  settings: AppSettings;
  currentChannel?: Channel | null;
  onNavigateTab: (tab: AppTab) => void;
  onSelectChannel: (channel: Channel, goFullscreen?: boolean) => void;
  onSelectVod: (vod: VodItem) => void;
  onOpenSearch: () => void;
  onToggleFavorite?: (channelId: string) => void;
  sleepTimerRemainingSec?: number | null;
  onSetSleepTimer?: (minutes: number) => void;
  onCancelSleepTimer?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  channels,
  programs,
  vodItems,
  favoriteIds,
  recentIds,
  playlists = [],
  settings,
  currentChannel,
  onNavigateTab,
  onSelectChannel,
  onSelectVod,
  onOpenSearch,
  onToggleFavorite,
  sleepTimerRemainingSec,
  onSetSleepTimer,
  onCancelSleepTimer,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [spotlightIndex, setSpotlightIndex] = useState<number>(0);

  // Modals & Popovers
  const [isChannelJumpOpen, setIsChannelJumpOpen] = useState(false);
  const [jumpInput, setJumpInput] = useState('');
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [isLanModalOpen, setIsLanModalOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isCopiedLanUrl, setIsCopiedLanUrl] = useState(false);

  // Live real-time clock ticker
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
      setCurrentDateStr(
        now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
      );
    };
    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Pre-generate QR code for LAN Companion modal
  const companionUrl = useMemo(
    () => LanCompanionService.getCompanionBaseUrl(settings.lanPort || 8080),
    [settings.lanPort]
  );

  useEffect(() => {
    if (isLanModalOpen && !qrCodeDataUrl) {
      LanCompanionService.generateQrCode(companionUrl).then(setQrCodeDataUrl);
    }
  }, [isLanModalOpen, companionUrl, qrCodeDataUrl]);

  const now = Date.now();

  // Favorite & Recent Channels
  const favoriteChannels = useMemo(
    () => channels.filter((c) => favoriteIds.includes(c.id)),
    [channels, favoriteIds]
  );
  const recentChannels = useMemo(
    () => channels.filter((c) => recentIds.includes(c.id)),
    [channels, recentIds]
  );

  // Precomputed O(1) program lookup map
  const scheduleMap = useMemo(() => {
    const map = new Map<
      string,
      { current: Program | null; next: Program | null; progressPercent: number; timeRemainingMin: number }
    >();
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
      const curr =
        chProgs.find((p) => p.start <= now && p.end > now) ||
        chProgs[0] ||
        null;
      const nxt = chProgs.find((p) => p.start >= now) || chProgs[1] || null;

      let progressPercent = 45;
      let timeRemainingMin = 25;
      if (curr && curr.end > curr.start) {
        const total = curr.end - curr.start;
        const elapsed = Math.max(0, now - curr.start);
        progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
        timeRemainingMin = Math.max(1, Math.round((curr.end - now) / 60000));
      }

      map.set(chId, { current: curr, next: nxt, progressPercent, timeRemainingMin });
    }

    return map;
  }, [programs, now]);

  const getProgramInfo = (channelId: string) => {
    return (
      scheduleMap.get(channelId) || {
        current: null,
        next: null,
        progressPercent: 50,
        timeRemainingMin: 25,
      }
    );
  };

  // Build Spotlight Items: mixes top live channels with top 4K VOD premiere items
  const spotlightItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: 'live' | 'vod';
      channel?: Channel;
      vod?: VodItem;
      title: string;
      subtitle: string;
      badgeText: string;
      description: string;
      backdropUrl: string;
      logoUrl?: string;
      progress?: number;
      specs: string[];
    }> = [];

    // 1. Featured live channel (active or first favorite or first in list)
    const featuredLive = currentChannel || favoriteChannels[0] || channels[0];
    if (featuredLive) {
      const prog = getProgramInfo(featuredLive.id);
      items.push({
        id: `live-${featuredLive.id}`,
        type: 'live',
        channel: featuredLive,
        title: prog.current?.title || `${featuredLive.name} Live Broadcast`,
        subtitle: `Channel #${featuredLive.num} · ${featuredLive.name}`,
        badgeText: 'Live Broadcast Spotlight',
        description:
          prog.current?.description ||
          `High-definition broadcast stream with instant hardware decoding powered by ${settings.playerEngine.toUpperCase()}.`,
        backdropUrl:
          'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80',
        logoUrl: featuredLive.logo,
        progress: prog.progressPercent,
        specs: [
          featuredLive.group || 'Live TV',
          featuredLive.resolution || '1080p',
          featuredLive.fps ? `${featuredLive.fps} FPS` : '60 FPS',
          featuredLive.audioCodec || 'Dolby Atmos',
          `${prog.timeRemainingMin}m remaining`,
        ],
      });
    }

    // 2. Featured Cinema Movies / Series from VOD
    vodItems.slice(0, 3).forEach((vod, idx) => {
      items.push({
        id: `vod-${vod.id}`,
        type: 'vod',
        vod: vod,
        title: vod.title,
        subtitle: `${vod.year || '2024'} · ${vod.genre || 'Cinema'} · ★ ${vod.rating || '8.8'}`,
        badgeText: vod.type === 'series' ? 'TV Boxset Premiere' : '4K UHD Cinema Feature',
        description:
          vod.plot ||
          'Mastered in ultra-high bitrate 4K with cinema spatial sound. Stream instantly on-demand.',
        backdropUrl:
          vod.backdrop ||
          vod.poster ||
          'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600&auto=format&fit=crop&q=80',
        progress: vod.watchProgressSec && vod.duration ? Math.round((vod.watchProgressSec / vod.duration) * 100) : undefined,
        specs: [
          vod.type === 'series' ? 'Series' : 'Movie',
          vod.genre || 'Cinema',
          vod.year || '2024',
          '4K Dolby Vision',
          'Dolby Atmos 5.1',
        ],
      });
    });

    return items;
  }, [currentChannel, favoriteChannels, channels, vodItems, settings.playerEngine]);

  // Current spotlight item
  const currentSpotlight = spotlightItems[spotlightIndex] || spotlightItems[0];

  // Auto-cycle spotlight every 12 seconds if not interacted
  useEffect(() => {
    if (spotlightItems.length <= 1) return;
    const interval = setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % spotlightItems.length);
    }, 12000);
    return () => clearInterval(interval);
  }, [spotlightItems.length]);

  // Channel groups for "On Air Now"
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => {
      if (c.group) set.add(c.group);
    });
    return ['All', ...Array.from(set).slice(0, 7)];
  }, [channels]);

  // Filtered channels for "On Air Now"
  const onAirChannels = useMemo(() => {
    if (selectedCategory === 'All') return channels.slice(0, 10);
    return channels.filter((c) => c.group === selectedCategory).slice(0, 10);
  }, [channels, selectedCategory]);

  // Continue Watching items
  const continueWatchingItems = useMemo(() => {
    if (vodItems.length === 0) return [];
    return [
      { ...vodItems[0], progressPercent: 68, timeLeft: '42 min left' },
      { ...(vodItems[1] || vodItems[0]), progressPercent: 35, timeLeft: '1h 14m left' },
      { ...(vodItems[2] || vodItems[0]), progressPercent: 88, timeLeft: '12 min left' },
    ].slice(0, Math.min(3, vodItems.length));
  }, [vodItems]);

  // Upcoming Prime-Time Highlights (Next programs across top channels)
  const primeTimeHighlights = useMemo(() => {
    const highlights: Array<{
      channel: Channel;
      program: Program;
      timeStr: string;
      isFav: boolean;
    }> = [];

    const topChannels = [...favoriteChannels, ...channels].slice(0, 4);
    for (const ch of topChannels) {
      const info = getProgramInfo(ch.id);
      if (info.next) {
        highlights.push({
          channel: ch,
          program: info.next,
          timeStr: new Date(info.next.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isFav: favoriteIds.includes(ch.id),
        });
      }
    }
    return highlights;
  }, [favoriteChannels, channels, favoriteIds, scheduleMap]);

  // Quick Access Hub Tiles
  const quickTiles = [
    {
      id: 'live' as AppTab,
      label: 'Live TV',
      count: `${channels.length} Channels`,
      desc: 'Instant channel zapping & multi-group browsing',
      icon: <Tv className="w-5 h-5 text-[var(--tv-accent)]" />,
      action: () => onNavigateTab('live'),
    },
    {
      id: 'epg' as AppTab,
      label: 'TV Guide (EPG)',
      count: 'Multi-Day Schedule',
      desc: 'Interactive timeline grid, catch-up & reminders',
      icon: <Calendar className="w-5 h-5 text-[var(--tv-accent)]" />,
      action: () => onNavigateTab('epg'),
    },
    {
      id: 'vod' as AppTab,
      label: 'Cinema Movies',
      count: `${vodItems.filter((v) => v.type === 'movie').length || 18} Titles`,
      desc: '4K UHD HDR On-Demand Hollywood & European cinema',
      icon: <Film className="w-5 h-5 text-[var(--tv-accent)]" />,
      action: () => onNavigateTab('vod'),
    },
    {
      id: 'series' as AppTab,
      label: 'TV Boxsets',
      count: `${vodItems.filter((v) => v.type === 'series').length || 12} Series`,
      desc: 'Multi-season drama, documentaries & episodes',
      icon: <Clapperboard className="w-5 h-5 text-[var(--tv-accent)]" />,
      action: () => onNavigateTab('series'),
    },
    {
      id: 'favorites' as AppTab,
      label: 'Pinned Favorites',
      count: `${favoriteIds.length} Bookmarked`,
      desc: 'Quick-access curated list of your top stations',
      icon: <Heart className="w-5 h-5 text-[var(--tv-accent)]" />,
      action: () => onNavigateTab('favorites'),
    },
    {
      id: 'settings' as AppTab,
      label: 'System & Engine',
      count: `${settings.playerEngine.toUpperCase()}`,
      desc: `${settings.bufferSizeSec}s Cache · Theme · LAN Mobile Pairing`,
      icon: <Settings className="w-5 h-5 text-[var(--tv-accent)]" />,
      action: () => onNavigateTab('settings'),
    },
  ];

  // Channel match for quick jump
  const matchedChannel = useMemo(() => {
    if (!jumpInput) return null;
    const num = parseInt(jumpInput, 10);
    if (isNaN(num)) return null;
    return channels.find((c) => c.num === num) || null;
  }, [jumpInput, channels]);

  const handleExecuteJump = () => {
    if (matchedChannel) {
      onSelectChannel(matchedChannel, true);
      setIsChannelJumpOpen(false);
      setJumpInput('');
    }
  };

  const formatSleepMinutes = (sec?: number | null) => {
    if (!sec || sec <= 0) return 'Off';
    const mins = Math.ceil(sec / 60);
    return `${mins}m left`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[var(--tv-bg-primary)] px-4 sm:px-6 lg:px-8 py-5 select-none space-y-7">
      {/* Top Atmosphere & Quick Command Center */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 lg:p-5 rounded-2xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] shadow-xl">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shadow-md shrink-0"
            style={{
              background: 'var(--tv-accent-gradient, var(--tv-accent))',
              boxShadow: '0 4px 16px var(--tv-accent-glow)',
            }}
          >
            <Tv className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center space-x-2 text-xs text-[var(--tv-text-secondary)] font-medium">
              <span>{currentDateStr || 'Today'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-white font-bold">{currentTimeStr}</span>
              <span aria-hidden="true">·</span>
              <span className="text-[var(--tv-accent)] font-semibold">LG webOS Pro</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Entertainment Dashboard
            </h1>
          </div>
        </div>

        {/* Action & Diagnostics Command Center */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs">
          {/* Channel Count Stat */}
          <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 flex items-center space-x-2 text-[var(--tv-text-secondary)]">
            <Radio className="w-3.5 h-3.5 text-[var(--tv-accent)]" />
            <span>
              <strong className="text-white font-bold">{channels.length}</strong> Channels
            </span>
          </div>

          {/* Player Engine */}
          <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 flex items-center space-x-1.5 text-[var(--tv-text-secondary)]">
            <Gauge className="w-3.5 h-3.5 text-[var(--tv-accent)]" />
            <span className="font-mono uppercase text-white font-bold">{settings.playerEngine}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--tv-accent)]">{settings.bufferSizeSec}s Buffer</span>
          </div>

          {/* Quick Channel Jump Button */}
          <button
            onClick={() => setIsChannelJumpOpen(true)}
            className="tv-focusable px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Jump to channel number (0-9)"
          >
            <Hash className="w-3.5 h-3.5 text-[var(--tv-accent)]" />
            <span>Channel Jump</span>
          </button>

          {/* Sleep Timer Quick Button */}
          <button
            onClick={() => setIsSleepModalOpen(true)}
            className={`tv-focusable px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer ${
              sleepTimerRemainingSec && sleepTimerRemainingSec > 0
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-white/10 hover:bg-white/15 text-white'
            }`}
            title="Set Sleep Timer"
          >
            <Moon className="w-3.5 h-3.5 text-amber-400" />
            <span>Sleep: {formatSleepMinutes(sleepTimerRemainingSec)}</span>
          </button>

          {/* LAN Remote Companion Button */}
          <button
            onClick={() => setIsLanModalOpen(true)}
            className="tv-focusable px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Open LAN mobile companion QR code"
          >
            <QrCode className="w-3.5 h-3.5 text-[var(--tv-accent)]" />
            <span>LAN Remote</span>
          </button>

          {/* Quick Search Button */}
          <button
            onClick={onOpenSearch}
            className="tv-focusable px-3.5 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 text-black transition-all shadow-md cursor-pointer"
            style={{
              backgroundColor: 'var(--tv-accent)',
              boxShadow: '0 2px 10px var(--tv-accent-glow)',
            }}
          >
            <Search className="w-3.5 h-3.5 stroke-[3]" />
            <span>Search (Yellow)</span>
          </button>
        </div>
      </section>

      {/* Cinematic Dynamic Spotlight Hero */}
      {currentSpotlight && (
        <section className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-[var(--tv-border)] bg-[#07090e] shadow-2xl min-h-[340px] sm:min-h-[380px] flex flex-col justify-end">
          {/* Full High-Fidelity Backdrop Image */}
          <div className="absolute inset-0 z-0">
            <img
              src={currentSpotlight.backdropUrl}
              alt={currentSpotlight.title}
              className="w-full h-full object-cover object-center filter brightness-[0.4] transition-all duration-700"
            />
            {/* Smooth Cinematic Gradient Wash */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#07090e] via-[#07090e]/75 to-black/25" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07090e] via-[#07090e]/50 to-transparent" />
          </div>

          {/* Dynamic Spotlight Glow */}
          <div
            className="absolute top-0 right-0 w-80 sm:w-96 h-80 sm:h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ backgroundColor: 'var(--tv-accent)' }}
          />

          {/* Hero Content Area */}
          <div className="relative z-10 p-6 sm:p-8 lg:p-10 max-w-4xl space-y-4">
            {/* Top Unboxed Editorial Kicker & Technical Specs */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--tv-text-secondary)]">
              <span className="text-[var(--tv-accent)] font-bold uppercase tracking-wider">
                {currentSpotlight.badgeText}
              </span>
              {currentSpotlight.specs.map((spec, i) => (
                <React.Fragment key={i}>
                  <span aria-hidden="true">·</span>
                  <span className="text-zinc-300 font-medium">{spec}</span>
                </React.Fragment>
              ))}
            </div>

            {/* Title & Channel Subtitle */}
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight drop-shadow-md">
                {currentSpotlight.title}
              </h2>
              <div className="text-sm font-semibold text-[var(--tv-accent)] flex items-center space-x-2">
                <span>{currentSpotlight.subtitle}</span>
              </div>
            </div>

            {/* Synopsis */}
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed line-clamp-2 max-w-2xl drop-shadow">
              {currentSpotlight.description}
            </p>

            {/* Progress Bar (if live show or continue watching) */}
            {currentSpotlight.progress !== undefined && (
              <div className="space-y-1.5 max-w-md pt-1">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                  <span>{currentSpotlight.type === 'live' ? 'Live On Air' : 'Playback'}</span>
                  <span className="text-[var(--tv-accent)] font-semibold">
                    {currentSpotlight.progress}% Elapsed
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${currentSpotlight.progress}%`,
                      backgroundColor: 'var(--tv-accent)',
                      boxShadow: '0 0 8px var(--tv-accent-glow)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {currentSpotlight.type === 'live' && currentSpotlight.channel && (
                <>
                  <button
                    onClick={() => onSelectChannel(currentSpotlight.channel!, true)}
                    className="tv-focusable px-6 py-3 rounded-xl font-black text-sm text-black flex items-center space-x-2.5 transition-transform hover:scale-105 shadow-xl cursor-pointer"
                    style={{
                      backgroundColor: 'var(--tv-accent)',
                      boxShadow: '0 4px 18px var(--tv-accent-glow)',
                    }}
                  >
                    <Play className="w-4 h-4 fill-black" />
                    <span>Watch Live (OK)</span>
                  </button>

                  <button
                    onClick={() => onNavigateTab('epg')}
                    className="tv-focusable px-5 py-3 rounded-xl font-bold text-sm text-white bg-white/10 hover:bg-white/15 border border-white/15 flex items-center space-x-2 transition-colors cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-[var(--tv-accent)]" />
                    <span>Channel Guide (EPG)</span>
                  </button>

                  {onToggleFavorite && (
                    <button
                      onClick={() => onToggleFavorite(currentSpotlight.channel!.id)}
                      className="tv-focusable p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-colors cursor-pointer"
                      title={
                        favoriteIds.includes(currentSpotlight.channel!.id)
                          ? 'Remove from favorites'
                          : 'Add to favorites'
                      }
                    >
                      <Heart
                        className={`w-5 h-5 ${
                          favoriteIds.includes(currentSpotlight.channel!.id)
                            ? 'fill-[var(--tv-accent)] text-[var(--tv-accent)]'
                            : 'text-zinc-300'
                        }`}
                      />
                    </button>
                  )}
                </>
              )}

              {currentSpotlight.type === 'vod' && currentSpotlight.vod && (
                <>
                  <button
                    onClick={() => onSelectVod(currentSpotlight.vod!)}
                    className="tv-focusable px-6 py-3 rounded-xl font-black text-sm text-black flex items-center space-x-2.5 transition-transform hover:scale-105 shadow-xl cursor-pointer"
                    style={{
                      backgroundColor: 'var(--tv-accent)',
                      boxShadow: '0 4px 18px var(--tv-accent-glow)',
                    }}
                  >
                    <Play className="w-4 h-4 fill-black" />
                    <span>Play Premiere Now (OK)</span>
                  </button>

                  <button
                    onClick={() => onNavigateTab('vod')}
                    className="tv-focusable px-5 py-3 rounded-xl font-bold text-sm text-white bg-white/10 hover:bg-white/15 border border-white/15 flex items-center space-x-2 transition-colors cursor-pointer"
                  >
                    <Film className="w-4 h-4 text-[var(--tv-accent)]" />
                    <span>Explore VOD Catalog</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Spotlight Slide Navigator Controls */}
          {spotlightItems.length > 1 && (
            <div className="absolute bottom-6 right-6 z-20 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <button
                onClick={() =>
                  setSpotlightIndex((prev) => (prev - 1 + spotlightItems.length) % spotlightItems.length)
                }
                className="p-1 rounded-full text-zinc-400 hover:text-white transition-colors"
                title="Previous Spotlight"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center space-x-1.5 px-1">
                {spotlightItems.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSpotlightIndex(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      spotlightIndex === idx
                        ? 'w-5 bg-[var(--tv-accent)]'
                        : 'w-1.5 bg-white/30 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={() => setSpotlightIndex((prev) => (prev + 1) % spotlightItems.length)}
                className="p-1 rounded-full text-zinc-400 hover:text-white transition-colors"
                title="Next Spotlight"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>
      )}

      {/* Section 1: Main Entertainment Hub Tiles */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
              <Tv className="w-4 h-4 text-[var(--tv-accent)]" />
              <span>Main Entertainment Hub</span>
            </h2>
            <p className="text-xs text-[var(--tv-text-secondary)]">
              Jump directly into full-screen browsing across your IPTV library
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickTiles.map((tile) => (
            <button
              key={tile.label}
              onClick={tile.action}
              className="tv-focusable text-left p-3.5 rounded-xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] hover:border-[var(--tv-accent-border)] hover:bg-[var(--tv-bg-elevated)] transition-all cursor-pointer flex flex-col justify-between group shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-[var(--tv-accent-subtle)] border border-[var(--tv-accent-border)]">
                  {tile.icon}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-[var(--tv-accent)] transition-colors" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-black text-white group-hover:text-[var(--tv-accent)] transition-colors">
                  {tile.label}
                </div>
                <div className="text-[11px] font-semibold text-zinc-300">{tile.count}</div>
                <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
                  {tile.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Section 2: Recently Watched & Continue Watching Shelf */}
      {(recentChannels.length > 0 || continueWatchingItems.length > 0) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[var(--tv-accent)]" />
                <span>Recently Watched & Resume Playing</span>
              </h2>
              <p className="text-xs text-[var(--tv-text-secondary)]">
                Fast-zap back to your recent stations or continue your VOD cinema
              </p>
            </div>
            {recentChannels.length > 0 && (
              <button
                onClick={() => onNavigateTab('live')}
                className="text-xs font-bold text-[var(--tv-accent)] hover:underline flex items-center space-x-1"
              >
                <span>View All History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Recent Channels */}
            {recentChannels.slice(0, 2).map((ch) => {
              const prog = getProgramInfo(ch.id);
              return (
                <div
                  key={`rec-${ch.id}`}
                  onClick={() => onSelectChannel(ch, true)}
                  className="tv-focusable p-3 rounded-xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] hover:border-[var(--tv-accent)] cursor-pointer flex items-center space-x-3 transition-all"
                >
                  <div className="w-11 h-11 rounded-lg bg-black/50 border border-white/10 p-1 flex items-center justify-center shrink-0">
                    {ch.logo ? (
                      <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain" />
                    ) : (
                      <Radio className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5 text-[10px] text-[var(--tv-accent)] font-mono font-bold">
                      <span>#{ch.num}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-zinc-400 uppercase">{ch.group || 'Live'}</span>
                    </div>
                    <div className="text-xs font-bold text-white truncate">{ch.name}</div>
                    <div className="text-[11px] text-zinc-300 truncate mt-0.5">
                      {prog.current?.title || 'Live Transmission'}
                    </div>
                  </div>
                  <Play className="w-4 h-4 text-[var(--tv-accent)] shrink-0" />
                </div>
              );
            })}

            {/* Continue Watching VOD items */}
            {continueWatchingItems.slice(0, 2).map((item) => (
              <div
                key={`cont-${item.id}`}
                onClick={() => onSelectVod(item)}
                className="tv-focusable group rounded-xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] hover:border-[var(--tv-accent)] cursor-pointer flex items-center space-x-3 p-2.5 transition-all"
              >
                <div className="w-16 h-11 rounded-lg bg-zinc-900 relative overflow-hidden shrink-0">
                  <img
                    src={item.backdrop || item.poster}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Play className="w-3.5 h-3.5 fill-white text-white" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{item.title}</div>
                  <div className="text-[10px] text-zinc-400 flex items-center space-x-1.5 mt-0.5">
                    <span>{item.genre || 'Cinema'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--tv-accent)]">{item.timeLeft}</span>
                  </div>
                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${item.progressPercent}%`,
                        backgroundColor: 'var(--tv-accent)',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Live TV "On Air Now" with Interactive Category Filter */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2 text-sm font-black text-white uppercase tracking-wider">
              <Radio className="w-4 h-4 text-[var(--tv-accent)]" />
              <span>On Air Now — Live Television</span>
            </div>
            <p className="text-xs text-[var(--tv-text-secondary)]">
              Click any channel to launch immediate fullscreen playback
            </p>
          </div>

          {/* Interactive Category Filter Buttons */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
            {availableGroups.map((grp) => (
              <button
                key={grp}
                onClick={() => setSelectedCategory(grp)}
                className={`tv-focusable px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === grp
                    ? 'bg-[var(--tv-accent)] text-black shadow-md'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                {grp}
              </button>
            ))}
          </div>
        </div>

        {/* Live Channels Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {onAirChannels.map((ch) => {
            const prog = getProgramInfo(ch.id);
            const isFav = favoriteIds.includes(ch.id);

            return (
              <div
                key={ch.id}
                onClick={() => onSelectChannel(ch, true)}
                className="tv-focusable group relative p-3.5 rounded-xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] hover:border-[var(--tv-accent)] cursor-pointer shadow-sm flex flex-col justify-between transition-all"
              >
                <div className="flex items-start justify-between space-x-2 mb-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-black/50 border border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      {ch.logo ? (
                        <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain" />
                      ) : (
                        <Radio className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono text-[var(--tv-accent)] font-bold">
                        #{ch.num.toString().padStart(2, '0')}
                      </div>
                      <div className="text-xs font-bold text-white truncate">{ch.name}</div>
                    </div>
                  </div>

                  {isFav && (
                    <Heart className="w-3.5 h-3.5 fill-[var(--tv-accent)] text-[var(--tv-accent)] shrink-0 mt-0.5" />
                  )}
                </div>

                <div className="space-y-1 pt-1.5 border-t border-white/5">
                  <div className="text-xs font-semibold text-zinc-200 truncate">
                    {prog.current?.title || 'Live Transmission'}
                  </div>
                  {prog.next && (
                    <div className="text-[10px] text-zinc-400 truncate">
                      Next: {prog.next.title}
                    </div>
                  )}

                  {/* Program progress bar */}
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${prog.progressPercent}%`,
                        backgroundColor: 'var(--tv-accent)',
                      }}
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="truncate">{ch.group || 'Live'}</span>
                  <span className="text-[var(--tv-accent)] font-semibold flex items-center space-x-1 group-hover:underline">
                    <span>Watch</span>
                    <Play className="w-3 h-3 fill-[var(--tv-accent)] inline" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 4: Prime-Time Tonight & Schedule Guide Highlights */}
      {primeTimeHighlights.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-[var(--tv-accent)]" />
                <span>Prime-Time Schedule & Coming Up Tonight</span>
              </h2>
              <p className="text-xs text-[var(--tv-text-secondary)]">
                Upcoming broadcast premieres across your favorite and top channels
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('epg')}
              className="text-xs font-bold text-[var(--tv-accent)] hover:underline flex items-center space-x-1"
            >
              <span>Open Full TV Guide</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {primeTimeHighlights.map(({ channel, program, timeStr, isFav }) => (
              <div
                key={`prime-${program.id}`}
                onClick={() => onSelectChannel(channel, true)}
                className="tv-focusable p-3.5 rounded-xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] hover:border-[var(--tv-accent)] cursor-pointer flex flex-col justify-between space-y-2 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="w-6 h-6 rounded-md bg-black/40 border border-white/10 p-0.5 flex items-center justify-center shrink-0">
                      {channel.logo ? (
                        <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain" />
                      ) : (
                        <Radio className="w-3 h-3 text-zinc-400" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-white truncate">{channel.name}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[var(--tv-accent)] shrink-0">
                    {timeStr}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-zinc-100 truncate">{program.title}</div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                    {program.description}
                  </p>
                </div>

                <div className="pt-1 flex items-center justify-between text-[10px] text-zinc-400 border-t border-white/5">
                  <span>{program.category || 'General'}</span>
                  <span className="text-[var(--tv-accent)] font-semibold flex items-center space-x-1">
                    <span>Tune In</span>
                    <ChevronRight className="w-3 h-3 inline" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 5: Featured VOD Cinema & Boxsets */}
      {vodItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Flame className="w-4 h-4 text-[var(--tv-accent)]" />
                <span>Featured 4K Cinema & TV Boxsets</span>
              </h2>
              <p className="text-xs text-[var(--tv-text-secondary)]">
                Stream master quality Hollywood & independent productions on-demand
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('vod')}
              className="text-xs font-bold text-[var(--tv-accent)] hover:underline flex items-center space-x-1"
            >
              <span>Explore All Cinema</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            {vodItems.slice(0, 4).map((vod) => (
              <div
                key={`vod-grid-${vod.id}`}
                onClick={() => onSelectVod(vod)}
                className="tv-focusable group relative rounded-xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] overflow-hidden cursor-pointer shadow-md hover:border-[var(--tv-accent)] transition-all flex flex-col"
              >
                <div className="aspect-video w-full bg-zinc-900 relative overflow-hidden">
                  <img
                    src={vod.backdrop || vod.poster}
                    alt={vod.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shadow-xl"
                      style={{ backgroundColor: 'var(--tv-accent)' }}
                    >
                      <Play className="w-4 h-4 fill-black text-black ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-bold text-amber-400">
                    ★ {vod.rating || '8.5'}
                  </div>
                </div>

                <div className="p-3 flex-1 flex flex-col justify-between space-y-1">
                  <div>
                    <div className="text-xs font-bold text-white truncate">{vod.title}</div>
                    <div className="text-[11px] text-zinc-400 flex items-center space-x-1.5 mt-0.5">
                      <span>{vod.year || '2024'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{vod.genre || 'Cinema'}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-400 line-clamp-1">
                    {vod.plot || 'Mastered 4K HDR playback'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer webOS Remote Legend Bar */}
      <footer className="pt-4 pb-2 border-t border-[var(--tv-border)] flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[var(--tv-text-secondary)]">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shadow-sm"></span>
            <strong className="text-white">Red:</strong> TV Guide EPG
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-sm"></span>
            <strong className="text-white">Green:</strong> Toggle Favorite
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm"></span>
            <strong className="text-white">Yellow:</strong> Search
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shadow-sm"></span>
            <strong className="text-white">Blue:</strong> Settings & Engine
          </span>
        </div>

        <div className="flex items-center space-x-3 text-zinc-400 font-mono text-[11px]">
          <span>Numbers 0–9 direct channel jump</span>
          <span aria-hidden="true">·</span>
          <span>OK: Fullscreen</span>
          <span aria-hidden="true">·</span>
          <span>Back: Return</span>
        </div>
      </footer>

      {/* Modal 1: Quick Channel Number Jump Pad */}
      {isChannelJumpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Hash className="w-5 h-5 text-[var(--tv-accent)]" />
                <h3 className="text-base font-bold text-white">Direct Channel Jump</h3>
              </div>
              <button
                onClick={() => {
                  setIsChannelJumpOpen(false);
                  setJumpInput('');
                }}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Input and Channel Match Display */}
            <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-center space-y-1">
              <div className="font-mono text-3xl font-black text-[var(--tv-accent)] tracking-wider">
                #{jumpInput || '--'}
              </div>
              <div className="text-xs text-zinc-300 truncate">
                {matchedChannel
                  ? `${matchedChannel.name} (${matchedChannel.group || 'Live'})`
                  : jumpInput
                  ? 'No matching channel found'
                  : 'Enter channel number (1–999)'}
              </div>
            </div>

            {/* Numeric Keypad for Remote & Mouse */}
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  onClick={() => setJumpInput((prev) => (prev.length < 4 ? prev + n : prev))}
                  className="tv-focusable py-3 rounded-xl bg-white/5 hover:bg-white/15 text-lg font-bold text-white transition-colors"
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setJumpInput((prev) => prev.slice(0, -1))}
                className="tv-focusable py-3 rounded-xl bg-white/5 hover:bg-white/15 text-xs font-bold text-zinc-400 transition-colors"
              >
                DEL
              </button>
              <button
                onClick={() => setJumpInput((prev) => (prev.length < 4 ? prev + '0' : prev))}
                className="tv-focusable py-3 rounded-xl bg-white/5 hover:bg-white/15 text-lg font-bold text-white transition-colors"
              >
                0
              </button>
              <button
                onClick={() => setJumpInput('')}
                className="tv-focusable py-3 rounded-xl bg-white/5 hover:bg-white/15 text-xs font-bold text-zinc-400 transition-colors"
              >
                CLEAR
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={handleExecuteJump}
                disabled={!matchedChannel}
                className={`tv-focusable flex-1 py-2.5 rounded-xl font-bold text-sm text-black flex items-center justify-center space-x-2 transition-all ${
                  matchedChannel
                    ? 'opacity-100 cursor-pointer shadow-lg'
                    : 'opacity-40 cursor-not-allowed'
                }`}
                style={{
                  backgroundColor: 'var(--tv-accent)',
                  boxShadow: matchedChannel ? '0 2px 10px var(--tv-accent-glow)' : 'none',
                }}
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Tune Channel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Quick Sleep Timer Modal */}
      {isSleepModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Moon className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Sleep Timer</h3>
              </div>
              <button
                onClick={() => setIsSleepModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Automatically stops playback and puts the screen to sleep after your chosen duration.
            </p>

            {/* Current Status */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Current Status:</span>
              <span className="font-bold text-amber-400">
                {formatSleepMinutes(sleepTimerRemainingSec)}
              </span>
            </div>

            {/* Duration Options */}
            <div className="grid grid-cols-2 gap-2">
              {[15, 30, 45, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  onClick={() => {
                    if (onSetSleepTimer) onSetSleepTimer(mins);
                    setIsSleepModalOpen(false);
                  }}
                  className="tv-focusable py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/15 text-xs font-bold text-white transition-colors text-center"
                >
                  {mins} Minutes
                </button>
              ))}
            </div>

            {/* Cancel Button */}
            {sleepTimerRemainingSec && sleepTimerRemainingSec > 0 && (
              <button
                onClick={() => {
                  if (onCancelSleepTimer) onCancelSleepTimer();
                  setIsSleepModalOpen(false);
                }}
                className="w-full py-2.5 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs font-bold transition-colors"
              >
                Cancel Sleep Timer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal 3: LAN Remote Mobile Companion Modal */}
      {isLanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between text-left">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-[var(--tv-accent)]" />
                <h3 className="text-base font-bold text-white">LAN Remote Mobile Companion</h3>
              </div>
              <button
                onClick={() => setIsLanModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 text-left leading-relaxed">
              Scan with your smartphone camera on the same Wi-Fi network to use your phone as a remote control and push M3U/Xtream playlists.
            </p>

            {/* QR Code Container */}
            <div className="w-48 h-48 mx-auto p-2 bg-white rounded-2xl shadow-inner flex items-center justify-center">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="LAN Companion QR Code" className="w-full h-full" />
              ) : (
                <div className="text-xs text-zinc-600 animate-pulse">Generating QR Code...</div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-black/50 border border-white/10 text-left space-y-1">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                Direct Mobile Browser URL:
              </div>
              <div className="font-mono text-xs text-[var(--tv-accent)] font-bold break-all">
                {companionUrl}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(companionUrl);
                  setIsCopiedLanUrl(true);
                  setTimeout(() => setIsCopiedLanUrl(false), 2000);
                }}
                className="tv-focusable flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors"
              >
                {isCopiedLanUrl ? 'Copied to Clipboard!' : 'Copy URL'}
              </button>
              <button
                onClick={() => {
                  window.open(companionUrl, '_blank');
                }}
                className="tv-focusable flex-1 py-2.5 rounded-xl text-xs font-bold text-black"
                style={{ backgroundColor: 'var(--tv-accent)' }}
              >
                Open in Browser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
