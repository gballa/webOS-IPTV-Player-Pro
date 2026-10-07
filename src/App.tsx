import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Channel, Program, VodItem, AppTab, AppSettings, PlaylistSource } from './types/iptv';
import { StorageService } from './services/StorageService';
import { IndexedDbService } from './services/IndexedDbService';
import { DEFAULT_CHANNELS, generateSyntheticEpg, SAMPLE_VOD } from './services/DefaultChannels';
import { globalRemote, RemoteEvent } from './services/RemoteController';
import { TopNavBar } from './components/Navigation/TopNavBar';
import { RemoteSimModal } from './components/Navigation/RemoteSimModal';
import { SearchModal } from './components/Navigation/SearchModal';
import { ChannelBrowser } from './components/LiveTv/ChannelBrowser';
import { VideoPlayer } from './components/Player/VideoPlayer';
import { EpgGuide } from './components/Epg/EpgGuide';
import { VodBrowser } from './components/Vod/VodBrowser';
import { SettingsView } from './components/Settings/SettingsView';
import { HomeScreen } from './components/Home/HomeScreen';
import { QuickPageSwitcher } from './components/Navigation/QuickPageSwitcher';
import { SleepTimerOverlay } from './components/Player/SleepTimerOverlay';
import { NumberOverlay } from './components/Player/NumberOverlay';
import { PinEntryModal } from './components/Common/PinEntryModal';

import { ACCENT_OPTIONS } from './services/StorageService';

function getAccentRgb(hex: string, id: string): string {
  const match = ACCENT_OPTIONS.find(o => o.id === id);
  if (match) return match.rgb;
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return '0, 210, 255';
}

export default function App() {
  // App state with high-capacity IndexedDB fallback
  const [channels, setChannels] = useState<Channel[]>(() => StorageService.getChannels());
  const [playlists, setPlaylists] = useState<PlaylistSource[]>(() => StorageService.getPlaylists());
  const [settings, setSettings] = useState<AppSettings>(() => StorageService.getSettings());
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => StorageService.getFavoriteIds());
  const [recentIds, setRecentIds] = useState<string[]>(() => StorageService.getRecentChannelIds());
  const [programs, setPrograms] = useState<Program[]>(() => generateSyntheticEpg(channels));
  const [vodMovies, setVodMovies] = useState<VodItem[]>(() =>
    SAMPLE_VOD.filter((v) => v.type === 'movie')
  );
  const [vodSeries, setVodSeries] = useState<VodItem[]>(() =>
    SAMPLE_VOD.filter((v) => v.type === 'series')
  );

  // Unified VOD pool
  const allVodItems = useMemo(
    () => [...vodMovies, ...vodSeries],
    [vodMovies, vodSeries]
  );

  // Asynchronously hydrate from IndexedDB on startup (supports 100,000+ items without memory limit)
  useEffect(() => {
    IndexedDbService.getChannels().then((loaded) => {
      if (loaded && loaded.length > 0) {
        setChannels(loaded);
        if (!currentChannel || currentChannel.id === DEFAULT_CHANNELS[0].id) {
          setCurrentChannel(loaded[0]);
        }
      }
    });

    IndexedDbService.getVodMovies().then((movies) => {
      if (movies && movies.length > 0) {
        setVodMovies(movies);
      }
    });

    IndexedDbService.getVodSeries().then((series) => {
      if (series && series.length > 0) {
        setVodSeries(series);
      }
    });
  }, []);

  // Navigation
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [currentChannel, setCurrentChannel] = useState<Channel>(() => channels[0] || DEFAULT_CHANNELS[0]);
  const [isFullscreenPlayer, setIsFullscreenPlayer] = useState(false);
  const [isRemoteSimOpen, setIsRemoteSimOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false);

  // Sleep Timer countdown engine
  const [sleepTimerRemainingSec, setSleepTimerRemainingSec] = useState<number | null>(() => {
    return settings.sleepTimerMinutes && settings.sleepTimerMinutes > 0
      ? settings.sleepTimerMinutes * 60
      : null;
  });

  // Global channel number direct jump buffer & parental lock
  const [globalNumberBuffer, setGlobalNumberBuffer] = useState('');
  const globalNumberTimeoutRef = React.useRef<any>(null);
  const [isGlobalPinOpen, setIsGlobalPinOpen] = useState(false);
  const [pendingGlobalChannel, setPendingGlobalChannel] = useState<Channel | null>(null);

  // Sleep timer ticker: counts down every second and turns off player on expiry
  useEffect(() => {
    if (sleepTimerRemainingSec === null || sleepTimerRemainingSec <= 0) return;

    const interval = setInterval(() => {
      setSleepTimerRemainingSec((prev) => {
        if (prev === null || prev <= 1) {
          // Timer expired: stop player / exit fullscreen
          setIsFullscreenPlayer(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerRemainingSec]);

  const handleSetSleepTimer = useCallback((minutes: number) => {
    if (minutes <= 0) {
      setSleepTimerRemainingSec(null);
      const updated = { ...settings, sleepTimerMinutes: 0 };
      setSettings(updated);
      StorageService.saveSettings(updated);
    } else {
      setSleepTimerRemainingSec(minutes * 60);
      const updated = { ...settings, sleepTimerMinutes: minutes };
      setSettings(updated);
      StorageService.saveSettings(updated);
    }
  }, [settings]);

  const handleCancelSleepTimer = useCallback(() => {
    setSleepTimerRemainingSec(null);
    const updated = { ...settings, sleepTimerMinutes: 0 };
    setSettings(updated);
    StorageService.saveSettings(updated);
  }, [settings]);

  // Check if channel is locked by parental control settings
  const isChannelLockedByParental = useCallback(
    (channel: Channel) => {
      if (!settings.parentalControlActive) return false;
      const lockedList = settings.lockedCategories || [];
      return lockedList.some((k) => channel.group.toLowerCase().includes(k.toLowerCase()));
    },
    [settings.parentalControlActive, settings.lockedCategories]
  );

  // Jump to channel directly by remote number keys
  const handleGlobalNumberInput = useCallback(
    (digit: number) => {
      setGlobalNumberBuffer((prev) => {
        const updated = prev + digit.toString();
        clearTimeout(globalNumberTimeoutRef.current);
        globalNumberTimeoutRef.current = setTimeout(() => {
          const targetNum = parseInt(updated, 10);
          const match =
            channels.find((c) => c.num === targetNum) ||
            channels.find((c) => c.num.toString().startsWith(updated));
          if (match) {
            if (isChannelLockedByParental(match)) {
              setPendingGlobalChannel(match);
              setIsGlobalPinOpen(true);
            } else {
              setCurrentChannel(match);
              setIsFullscreenPlayer(true);
            }
          }
          setGlobalNumberBuffer('');
        }, 1400);
        return updated;
      });
    },
    [channels, isChannelLockedByParental]
  );

  const ALL_TABS: { id: AppTab; title: string; num: number }[] = useMemo(() => [
    { id: 'home', title: 'Home', num: 1 },
    { id: 'live', title: 'Live TV', num: 2 },
    { id: 'epg', title: 'TV Guide (EPG)', num: 3 },
    { id: 'vod', title: 'Movies', num: 4 },
    { id: 'series', title: 'Series', num: 5 },
    { id: 'favorites', title: 'Favorites', num: 6 },
    { id: 'settings', title: 'Settings', num: 7 },
  ], []);

  const handleCycleTab = useCallback((direction: 'next' | 'prev') => {
    setActiveTab((curr) => {
      const idx = ALL_TABS.findIndex((t) => t.id === curr);
      const nextIdx =
        direction === 'next'
          ? (idx + 1) % ALL_TABS.length
          : (idx - 1 + ALL_TABS.length) % ALL_TABS.length;
      return ALL_TABS[nextIdx].id;
    });
  }, [ALL_TABS]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isFullscreenPlayer) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setIsQuickSwitcherOpen((prev) => !prev);
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setActiveTab('home');
      } else if (e.key === '[' || e.key === ',') {
        e.preventDefault();
        handleCycleTab('prev');
      } else if (e.key === ']' || e.key === '.') {
        e.preventDefault();
        handleCycleTab('next');
      } else if (!isQuickSwitcherOpen && activeTab !== 'live' && activeTab !== 'favorites') {
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          handleGlobalNumberInput(parseInt(e.key, 10));
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFullscreenPlayer, isQuickSwitcherOpen, activeTab, handleCycleTab, handleGlobalNumberInput]);

  // Apply theme, accent color, font scale, and layout density system-wide
  useEffect(() => {
    const accentId = settings.accentColor || 'teal';
    const hex = settings.accentColorHex || '#00d2ff';
    const rgb = settings.accentColorRgb || getAccentRgb(hex, accentId);

    document.documentElement.setAttribute('data-theme', settings.theme);
    document.documentElement.setAttribute('data-accent', accentId);
    document.documentElement.setAttribute('data-density', settings.uiDensity);
    document.documentElement.style.setProperty('--tv-accent', hex);
    document.documentElement.style.setProperty('--tv-accent-rgb', rgb);
    document.documentElement.style.setProperty('--tv-accent-glow', `rgba(${rgb}, 0.45)`);
    document.documentElement.style.setProperty('--tv-accent-subtle', `rgba(${rgb}, 0.15)`);
    document.documentElement.style.setProperty('--tv-accent-border', `rgba(${rgb}, 0.38)`);
    document.documentElement.style.setProperty('--tv-font-scale', settings.fontScale.toString());
  }, [settings]);

  // Regenerate synthetic EPG if channels change
  useEffect(() => {
    setPrograms(generateSyntheticEpg(channels));
  }, [channels]);

  // Toggle favorite
  const handleToggleFavorite = useCallback((channelId: string) => {
    const updated = StorageService.toggleFavorite(channelId);
    setFavoriteIds(updated);
  }, []);

  // Channel select
  const handleSelectChannel = useCallback((channel: Channel, goFullscreen: boolean = false) => {
    setCurrentChannel(channel);
    StorageService.addRecentChannel(channel.id);
    setRecentIds(StorageService.getRecentChannelIds());
    if (goFullscreen) {
      setIsFullscreenPlayer(true);
    }
  }, []);

  // VOD item play
  const handlePlayVod = useCallback((item: VodItem, streamUrl?: string) => {
    const vodChannel: Channel = {
      id: item.id,
      num: 999,
      name: item.title,
      group: item.type === 'movie' ? 'Movies (VOD)' : 'Series (VOD)',
      streamUrl: streamUrl || item.streamUrl,
      resolution: '4K',
      hdr: 'DolbyVision',
    };
    setCurrentChannel(vodChannel);
    setIsFullscreenPlayer(true);
  }, []);

  // Catch-up play
  const handlePlayCatchup = useCallback((program: Program, channel: Channel) => {
    const catchupChannel: Channel = {
      ...channel,
      name: `${channel.name} [Catch-up: ${program.title}]`,
      streamUrl: channel.streamUrl,
    };
    setCurrentChannel(catchupChannel);
    setIsFullscreenPlayer(true);
  }, []);

  // Global remote control handler
  useEffect(() => {
    const unsubscribe = globalRemote.subscribe((event: RemoteEvent) => {
      if (isFullscreenPlayer) return;

      switch (event.action) {
        case 'RED':
          setActiveTab('epg');
          break;
        case 'BLUE':
          setActiveTab('settings');
          break;
        case 'YELLOW':
          setIsSearchOpen((prev) => !prev);
          break;
        case 'GREEN':
          if (currentChannel) {
            handleToggleFavorite(currentChannel.id);
          }
          break;
        case 'CH_UP':
          handleCycleTab('next');
          break;
        case 'CH_DOWN':
          handleCycleTab('prev');
          break;
        case 'GUIDE':
          setActiveTab('epg');
          break;
        case 'BACK':
          if (isQuickSwitcherOpen) {
            setIsQuickSwitcherOpen(false);
          } else if (isSearchOpen) {
            setIsSearchOpen(false);
          } else if (isRemoteSimOpen) {
            setIsRemoteSimOpen(false);
          } else if (activeTab !== 'home') {
            setActiveTab('home');
          }
          break;
        case 'NUMBER':
          if (event.numberKey !== undefined && event.numberKey >= 0 && event.numberKey <= 9) {
            if (isQuickSwitcherOpen && event.numberKey >= 1 && event.numberKey <= 7) {
              const target = ALL_TABS.find((t) => t.num === event.numberKey);
              if (target) {
                setActiveTab(target.id);
                setIsQuickSwitcherOpen(false);
              }
            } else if (activeTab !== 'live' && activeTab !== 'favorites') {
              handleGlobalNumberInput(event.numberKey);
            }
          }
          break;
      }
    });

    return () => unsubscribe();
  }, [isFullscreenPlayer, isRemoteSimOpen, isSearchOpen, isQuickSwitcherOpen, activeTab, currentChannel, ALL_TABS, handleToggleFavorite, handleCycleTab, handleGlobalNumberInput]);

  // Find active program for current channel
  const { currentProgram, nextProgram } = useMemo(() => {
    const now = Date.now();
    const chProgs = programs.filter(p => p.channelId === currentChannel.id);
    const curr = chProgs.find(p => p.start <= now && p.end > now) || chProgs[0];
    const nxt = chProgs.find(p => p.start >= now);
    return { currentProgram: curr, nextProgram: nxt };
  }, [currentChannel.id, programs]);

  const handleImportChannels = (newChannels: Channel[], sourceName: string) => {
    const merged = [...channels, ...newChannels];
    setChannels(merged);
    IndexedDbService.saveChannels(merged);
  };

  const handleImportCatalog = useCallback(
    (
      result: { channels: Channel[]; movies: VodItem[]; series: VodItem[]; groups: string[] },
      sourceName: string
    ) => {
      if (result.channels && result.channels.length > 0) {
        setChannels(result.channels);
      }
      if (result.movies && result.movies.length > 0) {
        setVodMovies(result.movies);
      }
      if (result.series && result.series.length > 0) {
        setVodSeries(result.series);
      }
    },
    []
  );

  const handleClearDatabase = useCallback(() => {
    setChannels(DEFAULT_CHANNELS);
    setVodMovies(SAMPLE_VOD.filter((v) => v.type === 'movie'));
    setVodSeries(SAMPLE_VOD.filter((v) => v.type === 'series'));
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[var(--tv-bg-primary)] text-white select-none">
      {/* Fullscreen Video Player Mode */}
      {isFullscreenPlayer ? (
        <VideoPlayer
          channel={currentChannel}
          channels={channels}
          currentProgram={currentProgram}
          nextProgram={nextProgram}
          settings={settings}
          favoriteIds={favoriteIds}
          onChannelChange={(ch) => handleSelectChannel(ch, true)}
          onToggleFavorite={handleToggleFavorite}
          onOpenEpg={() => {
            setIsFullscreenPlayer(false);
            setActiveTab('epg');
          }}
          onOpenSettings={() => {
            setIsFullscreenPlayer(false);
            setActiveTab('settings');
          }}
          onExitPlayer={() => setIsFullscreenPlayer(false)}
          sleepTimerRemainingSec={sleepTimerRemainingSec}
          onSetSleepTimer={handleSetSleepTimer}
          onCancelSleepTimer={handleCancelSleepTimer}
        />
      ) : (
        <>
          {/* Top 10-Foot Navigation Bar */}
          <TopNavBar
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
            }}
            onOpenRemoteSim={() => setIsRemoteSimOpen(true)}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenQuickSwitcher={() => setIsQuickSwitcherOpen(true)}
            favoritesCount={favoriteIds.length}
          />

          {/* Active Tab Views */}
          <main className="flex-1 flex overflow-hidden">
            {activeTab === 'home' && (
              <HomeScreen
                channels={channels}
                programs={programs}
                vodItems={allVodItems}
                favoriteIds={favoriteIds}
                recentIds={recentIds}
                playlists={playlists}
                settings={settings}
                currentChannel={currentChannel}
                onNavigateTab={setActiveTab}
                onSelectChannel={handleSelectChannel}
                onSelectVod={handlePlayVod}
                onOpenSearch={() => setIsSearchOpen(true)}
                onToggleFavorite={handleToggleFavorite}
              />
            )}

            {activeTab === 'live' && (
              <ChannelBrowser
                channels={channels}
                programs={programs}
                favoriteIds={favoriteIds}
                recentIds={recentIds}
                currentChannel={currentChannel}
                showLivePreview={settings.showLivePreview}
                settings={settings}
                onSelectChannel={handleSelectChannel}
                onToggleFavorite={handleToggleFavorite}
                onOpenFullscreen={() => setIsFullscreenPlayer(true)}
              />
            )}

            {activeTab === 'epg' && (
              <EpgGuide
                channels={channels}
                programs={programs}
                currentChannel={currentChannel}
                onSelectChannel={handleSelectChannel}
                onPlayCatchup={handlePlayCatchup}
              />
            )}

            {activeTab === 'vod' && (
              <VodBrowser
                vodItems={allVodItems}
                movies={vodMovies}
                series={vodSeries}
                onPlayVod={handlePlayVod}
                defaultType="movie"
                settings={settings}
              />
            )}

            {activeTab === 'series' && (
              <VodBrowser
                vodItems={allVodItems}
                movies={vodMovies}
                series={vodSeries}
                onPlayVod={handlePlayVod}
                defaultType="series"
                settings={settings}
              />
            )}

            {activeTab === 'favorites' && (
              <ChannelBrowser
                channels={channels.filter(c => favoriteIds.includes(c.id))}
                programs={programs}
                favoriteIds={favoriteIds}
                recentIds={recentIds}
                currentChannel={currentChannel}
                showLivePreview={settings.showLivePreview}
                settings={settings}
                onSelectChannel={handleSelectChannel}
                onToggleFavorite={handleToggleFavorite}
                onOpenFullscreen={() => setIsFullscreenPlayer(true)}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                settings={settings}
                playlists={playlists}
                channels={channels}
                onUpdateSettings={(s) => {
                  setSettings(s);
                  StorageService.saveSettings(s);
                }}
                onUpdatePlaylists={(p) => {
                  setPlaylists(p);
                  StorageService.savePlaylists(p);
                }}
                onImportChannels={handleImportChannels}
                onImportCatalog={handleImportCatalog}
                onClearDatabase={handleClearDatabase}
                sleepTimerRemainingSec={sleepTimerRemainingSec}
                onSetSleepTimer={handleSetSleepTimer}
                onCancelSleepTimer={handleCancelSleepTimer}
              />
            )}
          </main>
        </>
      )}

      {/* Floating Sleep Timer HUD in non-fullscreen */}
      {!isFullscreenPlayer && (
        <SleepTimerOverlay
          remainingSeconds={sleepTimerRemainingSec}
          onSetTimerMinutes={handleSetSleepTimer}
          onCancelTimer={handleCancelSleepTimer}
        />
      )}

      {/* Direct Channel Number Dialing Overlay */}
      <NumberOverlay inputBuffer={globalNumberBuffer} />

      {/* Parental PIN Entry Modal for Direct Channel Dialing */}
      <PinEntryModal
        isOpen={isGlobalPinOpen}
        onClose={() => {
          setIsGlobalPinOpen(false);
          setPendingGlobalChannel(null);
        }}
        onSuccess={() => {
          if (pendingGlobalChannel) {
            handleSelectChannel(pendingGlobalChannel, true);
          }
          setIsGlobalPinOpen(false);
          setPendingGlobalChannel(null);
        }}
        correctPin={settings.parentalPin || '0000'}
        targetName={
          pendingGlobalChannel
            ? `#${pendingGlobalChannel.num} - ${pendingGlobalChannel.name} (${pendingGlobalChannel.group})`
            : 'Protected Channel'
        }
        description="Enter your 4-digit security PIN to tune to this locked channel."
      />

      {/* Quick 10-Foot Page Switcher Modal */}
      <QuickPageSwitcher
        isOpen={isQuickSwitcherOpen}
        onClose={() => setIsQuickSwitcherOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
        }}
        channelsCount={channels.length}
        favoritesCount={favoriteIds.length}
        moviesCount={vodMovies.length}
        seriesCount={vodSeries.length}
        currentChannel={currentChannel}
        playerEngine={settings.playerEngine}
        bufferSec={settings.bufferSizeSec}
        sleepTimerRemainingSec={sleepTimerRemainingSec}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      {/* Virtual Remote Control Simulator Modal */}
      <RemoteSimModal
        isOpen={isRemoteSimOpen}
        onClose={() => setIsRemoteSimOpen(false)}
      />

      {/* Global 10-Foot Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        channels={channels}
        programs={programs}
        vodItems={allVodItems}
        onSelectChannel={handleSelectChannel}
        onSelectVod={handlePlayVod}
      />
    </div>
  );
}
