import React, { useState, useMemo, useEffect } from 'react';
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
  Shield,
  Layers,
  Gauge,
  Wifi,
  Activity,
  QrCode,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

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
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  // Live real-time clock
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
    const map = new Map<string, { current: Program | null; next: Program | null; progressPercent: number; timeRemainingMin: number }>();
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
      const nxt = chProgs.find((p) => p.start >= now) || null;

      let progressPercent = 50;
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

  // Instant O(1) program info lookup
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

  // Featured Spotlight Channel (hero item)
  const heroChannel = useMemo(() => {
    if (currentChannel) return currentChannel;
    if (favoriteChannels.length > 0) return favoriteChannels[0];
    return channels[0] || null;
  }, [currentChannel, favoriteChannels, channels]);

  const heroProgram = heroChannel ? getProgramInfo(heroChannel.id) : null;

  // Categories present in channel catalog
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((c) => {
      if (c.group) set.add(c.group);
    });
    return ['All', ...Array.from(set).slice(0, 6)];
  }, [channels]);

  // Filtered channels for "On Air Now"
  const onAirChannels = useMemo(() => {
    if (selectedCategory === 'All') return channels.slice(0, 10);
    return channels.filter((c) => c.group === selectedCategory).slice(0, 10);
  }, [channels, selectedCategory]);

  // Continue Watching Mock/Real VOD
  const continueWatchingItems = useMemo(() => {
    if (vodItems.length === 0) return [];
    return [
      { ...vodItems[0], progressPercent: 68, timeLeft: '42 min left' },
      { ...vodItems[1] || vodItems[0], progressPercent: 35, timeLeft: '1h 14m left' },
      { ...vodItems[2] || vodItems[0], progressPercent: 88, timeLeft: '12 min left' },
    ].slice(0, Math.min(3, vodItems.length));
  }, [vodItems]);

  // Quick Access Hub Tiles
  const quickTiles = [
    {
      id: 'live' as AppTab,
      label: 'Live TV',
      count: `${channels.length} Channels`,
      desc: 'Instant channel zapping & multi-group browsing',
      icon: <Tv className="w-6 h-6 text-[var(--tv-accent)]" />,
      action: () => onNavigateTab('live'),
      accentBadge: 'Direct Stream',
    },
    {
      id: 'epg' as AppTab,
      label: 'TV Guide (EPG)',
      count: 'Multi-Day Schedule',
      desc: 'Timeline grid, catch-up replays & reminders',
      icon: <Calendar className="w-6 h-6 text-[var(--tv-accent)]" />,
      action: () => onNavigateTab('epg'),
      accentBadge: 'Interactive Grid',
    },
    {
      id: 'vod' as AppTab,
      label: 'Cinema Movies',
      count: `${vodItems.filter((v) => v.type === 'movie').length || 18} Titles`,
      desc: '4K UHD HDR On-Demand Hollywood & European cinema',
      icon: <Film className="w-6 h-6 text-[var(--tv-accent)]" />,
      action: () => onNavigateTab('vod'),
      accentBadge: '4K Dolby Vision',
    },
    {
      id: 'series' as AppTab,
      label: 'TV Boxsets',
      count: `${vodItems.filter((v) => v.type === 'series').length || 12} Series`,
      desc: 'Multi-season drama, documentaries & episodes',
      icon: <Clapperboard className="w-6 h-6 text-[var(--tv-accent)]" />,
      action: () => onNavigateTab('series'),
      accentBadge: 'Binge Ready',
    },
    {
      id: 'favorites' as AppTab,
      label: 'Pinned Favorites',
      count: `${favoriteIds.length} Pinned`,
      desc: 'Curated quick-access list of your top stations',
      icon: <Heart className="w-6 h-6 text-[var(--tv-accent)]" />,
      action: () => onNavigateTab('favorites'),
      accentBadge: 'Quick Access',
    },
    {
      id: 'settings' as AppTab,
      label: 'System & Engine',
      count: `${settings.playerEngine.toUpperCase()}`,
      desc: 'Buffer depth, theme accents, LAN mobile pairing',
      icon: <Settings className="w-6 h-6 text-[var(--tv-accent)]" />,
      action: () => onNavigateTab('settings'),
      accentBadge: `${settings.bufferSizeSec}s Cache`,
    },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[var(--tv-bg-primary)] px-8 py-6 select-none space-y-8">
      {/* Top Informational Status Strip */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] shadow-xl">
        <div className="flex items-center space-x-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
            style={{
              background: 'var(--tv-accent-gradient, var(--tv-accent))',
              boxShadow: '0 4px 18px var(--tv-accent-glow)',
            }}
          >
            <Tv className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-[var(--tv-text-secondary)]">
              <span>{currentDateStr || 'Today'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-[var(--tv-text-primary)] font-bold">{currentTimeStr}</span>
              <span aria-hidden="true">·</span>
              <span className="text-[var(--tv-accent)] font-semibold">LG webOS Pro</span>
            </div>
            <h1 className="text-xl font-black text-[var(--tv-text-primary)] tracking-tight">
              Entertainment Dashboard
            </h1>
          </div>
        </div>

        {/* Informational Diagnostics & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Active Channels Count */}
          <div className="px-3.5 py-1.5 rounded-xl bg-black/40 border border-white/10 flex items-center space-x-2 text-[var(--tv-text-secondary)]">
            <Radio className="w-3.5 h-3.5 text-[var(--tv-accent)]" />
            <span>
              <strong className="text-white font-bold">{channels.length}</strong> Channels
            </span>
          </div>

          {/* Engine & Buffer */}
          <div className="px-3.5 py-1.5 rounded-xl bg-black/40 border border-white/10 flex items-center space-x-2 text-[var(--tv-text-secondary)]">
            <Gauge className="w-3.5 h-3.5 text-[var(--tv-accent)]" />
            <span>
              Engine: <strong className="text-white font-bold uppercase">{settings.playerEngine}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--tv-accent)] font-semibold">{settings.bufferSizeSec}s Buffer</span>
          </div>

          {/* Mobile Companion LAN */}
          <button
            onClick={() => onNavigateTab('settings')}
            className="tv-focusable px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white flex items-center space-x-2 transition-colors"
            title="Open LAN pairing settings"
          >
            <QrCode className="w-3.5 h-3.5 text-[var(--tv-accent)]" />
            <span>LAN Companion</span>
          </button>

          {/* Search Trigger */}
          <button
            onClick={onOpenSearch}
            className="tv-focusable px-4 py-1.5 rounded-xl font-bold flex items-center space-x-2 text-black transition-all shadow-md"
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

      {/* Hero Spotlight: Featured Live Broadcast */}
      {heroChannel && (
        <section className="relative rounded-3xl overflow-hidden border border-[var(--tv-border)] bg-gradient-to-r from-[#0d1017] via-[#121722] to-[#0a0c12] p-8 shadow-2xl">
          {/* Subtle Accent Glow Aura */}
          <div
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-15 pointer-events-none"
            style={{ backgroundColor: 'var(--tv-accent)' }}
          />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            {/* Left 2 Cols: Broadcast Metadata */}
            <div className="lg:col-span-2 space-y-4">
              {/* Category and Technical Specs */}
              <div className="flex items-center space-x-3 text-xs text-[var(--tv-text-secondary)]">
                <span className="text-[var(--tv-accent)] font-bold uppercase tracking-wider">
                  Featured Live Stream
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-white">{heroChannel.group || 'Live TV'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-zinc-300">Channel {heroChannel.num}</span>
                <span aria-hidden="true">·</span>
                <span className="text-zinc-400 font-medium">4K UHD · Dolby Atmos</span>
              </div>

              {/* Title & Channel Header */}
              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-black text-white leading-tight tracking-tight">
                  {heroProgram?.current?.title || `${heroChannel.name} Live Broadcast`}
                </h2>
                <div className="text-sm font-semibold text-[var(--tv-accent)] flex items-center space-x-2">
                  <span>{heroChannel.name}</span>
                  {heroProgram?.current && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-zinc-300 font-normal">
                        {heroProgram.timeRemainingMin} min remaining
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Synopsis */}
              <p className="text-xs md:text-sm text-zinc-300 max-w-2xl leading-relaxed line-clamp-2">
                {heroProgram?.current?.description ||
                  `High-definition broadcast transmission with ultra-low latency playback powered by the ${settings.playerEngine.toUpperCase()} engine.`}
              </p>

              {/* Live Program Progress Bar */}
              {heroProgram && (
                <div className="space-y-1.5 max-w-xl pt-1">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                    <span>
                      {heroProgram.current
                        ? new Date(heroProgram.current.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Live'}
                    </span>
                    <span className="text-[var(--tv-accent)] font-semibold">
                      {heroProgram.progressPercent}% Elapsed
                    </span>
                    <span>
                      {heroProgram.current
                        ? new Date(heroProgram.current.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'On Air'}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${heroProgram.progressPercent}%`,
                        backgroundColor: 'var(--tv-accent)',
                        boxShadow: '0 0 8px var(--tv-accent-glow)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center space-x-4 pt-2">
                <button
                  onClick={() => onSelectChannel(heroChannel, true)}
                  className="tv-focusable px-6 py-3 rounded-2xl font-black text-sm text-black flex items-center space-x-3 transition-transform hover:scale-105 shadow-xl"
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
                  className="tv-focusable px-5 py-3 rounded-2xl font-bold text-sm text-white bg-white/10 hover:bg-white/15 border border-white/15 flex items-center space-x-2 transition-colors"
                >
                  <Calendar className="w-4 h-4 text-[var(--tv-accent)]" />
                  <span>Full Guide (EPG)</span>
                </button>

                {onToggleFavorite && (
                  <button
                    onClick={() => onToggleFavorite(heroChannel.id)}
                    className="tv-focusable p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-colors"
                    title={favoriteIds.includes(heroChannel.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        favoriteIds.includes(heroChannel.id)
                          ? 'fill-[var(--tv-accent)] text-[var(--tv-accent)]'
                          : 'text-zinc-300'
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* Right Col: Channel Brand & Next Show Preview */}
            <div className="hidden lg:flex flex-col items-center justify-center p-6 rounded-2xl bg-black/40 border border-white/10 text-center space-y-4">
              <div className="w-24 h-24 rounded-2xl bg-black/60 border border-white/15 p-3 flex items-center justify-center shadow-inner">
                {heroChannel.logo ? (
                  <img
                    src={heroChannel.logo}
                    alt={heroChannel.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Radio className="w-10 h-10 text-[var(--tv-accent)]" />
                )}
              </div>

              <div>
                <div className="text-base font-bold text-white">{heroChannel.name}</div>
                <div className="text-xs text-zinc-400 font-mono mt-0.5">Preset #{heroChannel.num}</div>
              </div>

              {heroProgram?.next && (
                <div className="w-full pt-3 border-t border-white/10 text-left">
                  <div className="text-[10px] uppercase font-bold text-[var(--tv-accent)] tracking-wider">
                    Coming Up Next
                  </div>
                  <div className="text-xs font-semibold text-white truncate mt-0.5">
                    {heroProgram.next.title}
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                    {new Date(heroProgram.next.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Section 1: Entertainment Hub (Quick Navigation Grid) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[var(--tv-accent)]" />
              <span>Main Entertainment Hub</span>
            </h2>
            <p className="text-xs text-[var(--tv-text-secondary)]">
              Select any section to jump directly into full-screen browsing
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {quickTiles.map((tile) => (
            <button
              key={tile.label}
              onClick={tile.action}
              className="tv-focusable text-left p-4 rounded-2xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] hover:border-[var(--tv-accent-border)] hover:bg-[var(--tv-bg-elevated)] transition-all cursor-pointer flex flex-col justify-between group shadow-md"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-[var(--tv-accent-subtle)] border border-[var(--tv-accent-border)]">
                  {tile.icon}
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-[var(--tv-accent)] transition-colors" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-black text-white group-hover:text-[var(--tv-accent)] transition-colors">
                  {tile.label}
                </div>
                <div className="text-xs font-semibold text-zinc-300">{tile.count}</div>
                <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                  {tile.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Section 2: Live Channels "On Air Now" with Interactive Category Filter */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2 text-base font-black text-white uppercase tracking-wider">
              <Radio className="w-4 h-4 text-[var(--tv-accent)]" />
              <span>On Air Now — Live Television</span>
            </div>
            <p className="text-xs text-[var(--tv-text-secondary)]">
              Click any channel to launch immediate fullscreen playback
            </p>
          </div>

          {/* Interactive Category Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
            {availableGroups.map((grp) => (
              <button
                key={grp}
                onClick={() => setSelectedCategory(grp)}
                className={`tv-focusable px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  selectedCategory === grp
                    ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                {grp}
              </button>
            ))}
          </div>
        </div>

        {/* Channels Grid / Horizontal Carousel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {onAirChannels.map((ch) => {
            const prog = getProgramInfo(ch.id);
            const isFav = favoriteIds.includes(ch.id);

            return (
              <div
                key={ch.id}
                onClick={() => onSelectChannel(ch, true)}
                className="tv-focusable group relative p-4 rounded-2xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] hover:border-[var(--tv-accent)] cursor-pointer shadow-md flex flex-col justify-between transition-all"
              >
                <div className="flex items-start justify-between space-x-2 mb-2.5">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-black/50 border border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      {ch.logo ? (
                        <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain" />
                      ) : (
                        <Radio className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-[var(--tv-accent)] font-bold">
                        #{ch.num.toString().padStart(2, '0')}
                      </div>
                      <div className="text-sm font-bold text-white truncate">{ch.name}</div>
                    </div>
                  </div>

                  {isFav && (
                    <Heart className="w-3.5 h-3.5 fill-[var(--tv-accent)] text-[var(--tv-accent)] shrink-0 mt-1" />
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <div className="text-xs font-semibold text-zinc-200 truncate">
                    {prog.current?.title || 'Live Transmission'}
                  </div>
                  {prog.next && (
                    <div className="text-[10px] text-zinc-400 truncate">
                      Next: {prog.next.title}
                    </div>
                  )}

                  {/* Progress bar */}
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

                <div className="pt-2.5 flex items-center justify-between text-[11px] text-zinc-400">
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

      {/* Section 3: Continue Watching & On-Demand Highlights */}
      {continueWatchingItems.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[var(--tv-accent)]" />
                <span>Continue Watching & On-Demand Catalog</span>
              </h2>
              <p className="text-xs text-[var(--tv-text-secondary)]">
                Pick up where you left off in 4K HDR playback
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('vod')}
              className="text-xs font-bold text-[var(--tv-accent)] hover:underline flex items-center space-x-1"
            >
              <span>Explore All VOD</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {continueWatchingItems.map((item) => (
              <div
                key={`home-continue-${item.id}`}
                onClick={() => onSelectVod(item)}
                className="tv-focusable group relative rounded-2xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] overflow-hidden cursor-pointer shadow-lg hover:border-[var(--tv-accent)] transition-all"
              >
                <div className="aspect-video w-full bg-zinc-900 relative">
                  <img
                    src={item.backdrop || item.poster}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center shadow-xl"
                      style={{ backgroundColor: 'var(--tv-accent)' }}
                    >
                      <Play className="w-5 h-5 fill-black text-black ml-0.5" />
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/80">
                    <div
                      className="h-full"
                      style={{
                        width: `${item.progressPercent}%`,
                        backgroundColor: 'var(--tv-accent)',
                      }}
                    />
                  </div>
                </div>

                <div className="p-3.5 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <div className="text-sm font-bold text-white truncate">{item.title}</div>
                    <div className="text-xs text-zinc-400 flex items-center space-x-2 mt-0.5">
                      <span>{item.genre || 'Cinema'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[var(--tv-accent)] font-medium">{item.timeLeft}</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-[var(--tv-accent)] shrink-0">
                    {item.progressPercent}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 4: Pinned Favorites Shelf (if user has favorites) */}
      {favoriteChannels.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Heart className="w-4 h-4 fill-[var(--tv-accent)] text-[var(--tv-accent)]" />
                <span>Your Favorite Channels ({favoriteChannels.length})</span>
              </h2>
              <p className="text-xs text-[var(--tv-text-secondary)]">
                Instant access to bookmarked stations
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('favorites')}
              className="text-xs font-bold text-[var(--tv-accent)] hover:underline flex items-center space-x-1"
            >
              <span>Manage Favorites</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {favoriteChannels.slice(0, 6).map((ch) => (
              <button
                key={`home-fav-${ch.id}`}
                onClick={() => onSelectChannel(ch, true)}
                className="tv-focusable p-3 rounded-2xl bg-[var(--tv-bg-surface)] border border-[var(--tv-border)] hover:border-[var(--tv-accent)] text-left flex flex-col justify-between space-y-2 shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-black/40 border border-white/10 p-1 flex items-center justify-center shrink-0">
                    {ch.logo ? (
                      <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain" />
                    ) : (
                      <Radio className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                  <span className="font-mono text-xs font-black text-[var(--tv-accent)]">
                    #{ch.num}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{ch.name}</div>
                  <div className="text-[10px] text-zinc-400 truncate">{ch.group}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Footer webOS Remote Legend & Tips */}
      <footer className="pt-6 pb-2 border-t border-[var(--tv-border)] flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[var(--tv-text-secondary)]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shadow-sm"></span>
            <strong className="text-white">Red:</strong> EPG TV Guide
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-sm"></span>
            <strong className="text-white">Green:</strong> Toggle Favorite
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm"></span>
            <strong className="text-white">Yellow:</strong> Global Search
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shadow-sm"></span>
            <strong className="text-white">Blue:</strong> Settings & Engine
          </span>
        </div>

        <div className="flex items-center space-x-3 text-zinc-400 font-mono text-[11px]">
          <span>Numbers 0–9 direct channel input</span>
          <span aria-hidden="true">·</span>
          <span>Back: Return to previous</span>
        </div>
      </footer>
    </div>
  );
};
