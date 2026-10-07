import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppTab, Channel } from '../../types/iptv';
import {
  Home,
  Tv,
  Calendar,
  Film,
  Clapperboard,
  Heart,
  Settings,
  X,
  Sparkles,
  ArrowRight,
  Zap,
  Search,
  Check,
  Radio,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';
import { globalRemote, RemoteEvent } from '../../services/RemoteController';

interface QuickPageSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  channelsCount: number;
  favoritesCount: number;
  playerEngine: string;
  bufferSec: number;
  moviesCount?: number;
  seriesCount?: number;
  currentChannel?: Channel;
  sleepTimerRemainingSec?: number | null;
  onOpenSearch?: () => void;
}

export interface PageItem {
  id: AppTab;
  num: number;
  label: string;
  badge: string;
  icon: React.ReactNode;
  detail: string;
  features: string[];
}

export const QuickPageSwitcher: React.FC<QuickPageSwitcherProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  channelsCount,
  favoritesCount,
  playerEngine,
  bufferSec,
  moviesCount = 0,
  seriesCount = 0,
  currentChannel,
  sleepTimerRemainingSec,
  onOpenSearch,
}) => {
  const pages: PageItem[] = useMemo(
    () => [
      {
        id: 'home',
        num: 1,
        label: 'Home',
        badge: 'Dashboard',
        icon: <Home className="w-6 h-6" />,
        detail: 'Central entertainment hub featuring on-air channels, live stream player, and system telemetry.',
        features: ['Main Dashboard', 'Top Channels', 'Instant PiP'],
      },
      {
        id: 'live',
        num: 2,
        label: 'Live TV',
        badge: currentChannel
          ? `CH ${currentChannel.num} • Live`
          : `${channelsCount >= 1000 ? `${(channelsCount / 1000).toFixed(1)}k` : channelsCount} Streams`,
        icon: <Tv className="w-6 h-6" />,
        detail: 'Multi-group broadcast browser with strict 10K+ virtualization, stream codecs, bitrates, and live preview.',
        features: ['Virtual List', 'Stream Diagnostics', 'Jump Steppers'],
      },
      {
        id: 'epg',
        num: 3,
        label: 'TV Guide',
        badge: 'EPG Schedule',
        icon: <Calendar className="w-6 h-6" />,
        detail: 'Electronic program schedule grid with live program progress, future listings, and catch-up streams.',
        features: ['Multi-Day EPG', 'Catch-Up Play', 'Reminders'],
      },
      {
        id: 'vod',
        num: 4,
        label: 'Movies',
        badge: `${moviesCount > 0 ? `${moviesCount} Films` : '4K Cinema'}`,
        icon: <Film className="w-6 h-6" />,
        detail: 'On-demand 4K cinema library with Dolby Vision, HDR10, high-bitrate surround sound audio, and genre filters.',
        features: ['Dolby Vision', 'Virtual Grid', 'Resume Progress'],
      },
      {
        id: 'series',
        num: 5,
        label: 'Series',
        badge: `${seriesCount > 0 ? `${seriesCount} Series` : 'Boxsets'}`,
        icon: <Clapperboard className="w-6 h-6" />,
        detail: 'Complete TV serial boxsets with multi-season navigators, episode rosters, and binge playback.',
        features: ['Seasons & Episodes', 'Next Episode', 'Watchlist'],
      },
      {
        id: 'favorites',
        num: 6,
        label: 'Favorites',
        badge: `${favoritesCount} Saved`,
        icon: <Heart className="w-6 h-6" />,
        detail: 'Personalized quick-access portfolio of your preferred stations and high-priority broadcasts.',
        features: ['Quick Zap', 'Green Key Toggle', 'Custom Sort'],
      },
      {
        id: 'settings',
        num: 7,
        label: 'Settings',
        badge:
          sleepTimerRemainingSec && sleepTimerRemainingSec > 0
            ? `Sleep ${Math.ceil(sleepTimerRemainingSec / 60)}m`
            : `${playerEngine.toUpperCase()} • ${bufferSec}s`,
        icon: <Settings className="w-6 h-6" />,
        detail: 'Hardware decoding pipeline, dynamic buffer tuning, LAN Companion QR code, parental PIN lock, and sleep timer.',
        features: ['Buffer Tuning', 'Parental PIN', 'Sleep Timer'],
      },
    ],
    [channelsCount, favoritesCount, moviesCount, seriesCount, playerEngine, bufferSec, currentChannel, sleepTimerRemainingSec]
  );

  // Focused card index for 10-foot remote D-Pad navigation
  const [focusedIndex, setFocusedIndex] = useState(() => {
    const idx = pages.findIndex((p) => p.id === activeTab);
    return idx >= 0 ? idx : 0;
  });
  const [focusedZone, setFocusedZone] = useState<'cards' | 'actions'>('cards');

  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const actionButtonRef = useRef<HTMLButtonElement | null>(null);

  // Reset focused index when switcher opens
  useEffect(() => {
    if (isOpen) {
      const idx = pages.findIndex((p) => p.id === activeTab);
      const target = idx >= 0 ? idx : 0;
      setFocusedIndex(target);
      setFocusedZone('cards');
      // Focus element for TV spatial navigation accessibility
      setTimeout(() => {
        cardRefs.current[target]?.focus();
        cardRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }, 50);
    }
  }, [isOpen, activeTab, pages]);

  const getGridCols = () => {
    if (typeof window === 'undefined') return 7;
    const w = window.innerWidth;
    if (w >= 1280) return 7;
    if (w >= 768) return 4;
    if (w >= 640) return 3;
    return 2;
  };

  // Handle remote controller D-Pad navigation & number keys
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = globalRemote.subscribe((event: RemoteEvent) => {
      switch (event.action) {
        case 'LEFT':
          if (focusedZone === 'cards') {
            setFocusedIndex((prev) => {
              const next = prev > 0 ? prev - 1 : pages.length - 1;
              cardRefs.current[next]?.focus();
              cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              return next;
            });
          }
          break;
        case 'RIGHT':
          if (focusedZone === 'cards') {
            setFocusedIndex((prev) => {
              const next = prev < pages.length - 1 ? prev + 1 : 0;
              cardRefs.current[next]?.focus();
              cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              return next;
            });
          }
          break;
        case 'DOWN':
          if (focusedZone === 'cards') {
            const cols = getGridCols();
            if (focusedIndex + cols < pages.length) {
              const next = focusedIndex + cols;
              setFocusedIndex(next);
              cardRefs.current[next]?.focus();
              cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
              setFocusedZone('actions');
              actionButtonRef.current?.focus();
            }
          }
          break;
        case 'UP':
          if (focusedZone === 'actions') {
            setFocusedZone('cards');
            cardRefs.current[focusedIndex]?.focus();
            cardRefs.current[focusedIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          } else if (focusedZone === 'cards') {
            const cols = getGridCols();
            if (focusedIndex - cols >= 0) {
              const next = focusedIndex - cols;
              setFocusedIndex(next);
              cardRefs.current[next]?.focus();
              cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
          break;
        case 'ENTER':
          if (pages[focusedIndex]) {
            onSelectTab(pages[focusedIndex].id);
            onClose();
          }
          break;
        case 'BACK':
          onClose();
          break;
        case 'NUMBER':
          if (event.numberKey && event.numberKey >= 1 && event.numberKey <= 7) {
            const target = pages.find((p) => p.num === event.numberKey);
            if (target) {
              onSelectTab(target.id);
              onClose();
            }
          }
          break;
        case 'RED':
          onSelectTab('epg');
          onClose();
          break;
        case 'GREEN':
          onSelectTab('favorites');
          onClose();
          break;
        case 'YELLOW':
          onClose();
          if (onOpenSearch) onOpenSearch();
          break;
        case 'BLUE':
          onSelectTab('settings');
          onClose();
          break;
      }
    });

    return () => unsubscribe();
  }, [isOpen, focusedIndex, focusedZone, pages, onSelectTab, onClose, onOpenSearch]);

  // Physical keyboard listener (Numbers 1-7, Arrow keys, Enter, Esc, Q)
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      const code = e.keyCode || e.which;

      // Number keys 1-7
      let num = -1;
      if (code >= 49 && code <= 55) {
        num = code - 48;
      } else if (code >= 97 && code <= 103) {
        num = code - 96;
      }

      if (num >= 1 && num <= 7) {
        e.preventDefault();
        const target = pages.find((p) => p.num === num);
        if (target) {
          onSelectTab(target.id);
          onClose();
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedZone('cards');
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : pages.length - 1;
          cardRefs.current[next]?.focus();
          cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          return next;
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedZone('cards');
        setFocusedIndex((prev) => {
          const next = prev < pages.length - 1 ? prev + 1 : 0;
          cardRefs.current[next]?.focus();
          cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          return next;
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (focusedZone === 'cards') {
          const cols = getGridCols();
          if (focusedIndex + cols < pages.length) {
            const next = focusedIndex + cols;
            setFocusedIndex(next);
            cardRefs.current[next]?.focus();
            cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            setFocusedZone('actions');
            actionButtonRef.current?.focus();
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (focusedZone === 'actions') {
          setFocusedZone('cards');
          cardRefs.current[focusedIndex]?.focus();
          cardRefs.current[focusedIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else if (focusedZone === 'cards') {
          const cols = getGridCols();
          if (focusedIndex - cols >= 0) {
            const next = focusedIndex - cols;
            setFocusedIndex(next);
            cardRefs.current[next]?.focus();
            cardRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pages[focusedIndex]) {
          onSelectTab(pages[focusedIndex].id);
          onClose();
        }
      } else if (e.key === 'Escape' || e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, focusedIndex, focusedZone, pages, onSelectTab, onClose]);

  if (!isOpen) return null;

  const activeFocusedPage = pages[focusedIndex] || pages[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl select-none p-3 sm:p-5 lg:p-7 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl rounded-3xl bg-[#090b13] border border-white/20 p-5 sm:p-6 shadow-2xl flex flex-col space-y-4 max-h-[94vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[var(--tv-accent-subtle)] border border-[var(--tv-accent-border)] flex items-center justify-center text-[var(--tv-accent)] shadow-lg shadow-[var(--tv-accent-glow)] shrink-0">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                  Quick Page Switcher
                </h2>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-[var(--tv-accent)] text-black shrink-0 shadow-sm">
                  Keys 1 – 7
                </span>
                {currentChannel && (
                  <span className="hidden md:flex items-center space-x-1.5 text-xs text-zinc-300 bg-white/5 border border-white/15 rounded-full px-3 py-0.5 shrink-0">
                    <Radio className="w-3.5 h-3.5 text-[var(--tv-accent)] animate-pulse" />
                    <span className="text-zinc-400 font-mono">CH {currentChannel.num}:</span>
                    <span className="font-bold text-white truncate max-w-[140px]">
                      {currentChannel.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 font-mono text-[var(--tv-accent)] font-semibold">
                      {currentChannel.resolution || '1080p'}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block truncate mt-0.5">
                Use TV remote D-Pad [<span className="text-white font-bold">◄ ▲ ▼ ►</span>] &amp; [
                <span className="text-white font-bold">OK</span>], or press remote number keys [
                <span className="text-white font-bold">1–7</span>] to jump.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 ml-3">
            {onOpenSearch && (
              <button
                onClick={() => {
                  onClose();
                  onOpenSearch();
                }}
                className="tv-focusable hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white text-xs font-semibold border border-white/10 transition-colors"
                title="Search (Yellow Key)"
              >
                <Search className="w-3.5 h-3.5 text-amber-400" />
                <span>Search</span>
                <span className="text-[10px] font-mono text-zinc-500">[Y]</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="tv-focusable p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all shrink-0"
              title="Close Switcher (Back / Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 7-Card Balanced TV Launcher Deck */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-3.5 shrink-0">
          {pages.map((page, idx) => {
            const isCurrent = activeTab === page.id;
            const isFocused = focusedIndex === idx && focusedZone === 'cards';

            return (
              <button
                key={page.id}
                ref={(el) => { cardRefs.current[idx] = el; }}
                onClick={() => {
                  onSelectTab(page.id);
                  onClose();
                }}
                onMouseEnter={() => {
                  setFocusedIndex(idx);
                  setFocusedZone('cards');
                }}
                className={`tv-focusable text-left h-[200px] p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 cursor-pointer flex flex-col justify-between group relative overflow-hidden outline-none ${
                  isFocused
                    ? 'bg-[var(--tv-accent-subtle)] border-[var(--tv-accent)] shadow-2xl shadow-[var(--tv-accent-glow)] ring-2 ring-[var(--tv-accent)] scale-[1.03] z-10'
                    : isCurrent
                    ? 'bg-white/10 border-[var(--tv-accent-border)] shadow-md'
                    : 'bg-black/50 border-white/10 hover:border-white/25 hover:bg-white/10'
                }`}
              >
                {/* Active Indicator Top Accent Bar */}
                {isCurrent && (
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--tv-accent)]" />
                )}

                {/* Top Row: Remote Key Badge & Status Tag */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-black text-xs transition-colors shadow-sm ${
                        isFocused || isCurrent
                          ? 'bg-[var(--tv-accent)] text-black'
                          : 'bg-white/15 text-white group-hover:bg-[var(--tv-accent)] group-hover:text-black'
                      }`}
                    >
                      {page.num}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 font-bold hidden sm:inline">
                      Key {page.num}
                    </span>
                  </div>

                  {isCurrent ? (
                    <span className="flex items-center space-x-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[var(--tv-accent)] text-black shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-zinc-500 font-bold group-hover:text-zinc-300">
                      [{page.num}]
                    </span>
                  )}
                </div>

                {/* Center: Large High-Contrast Icon & Titles */}
                <div className="my-auto flex flex-col items-center justify-center text-center py-1">
                  <div
                    className={`p-3 rounded-2xl mb-2 transition-transform duration-150 ${
                      isFocused ? 'scale-110 shadow-lg shadow-[var(--tv-accent-glow)]' : ''
                    } ${
                      isCurrent || isFocused
                        ? 'bg-[var(--tv-accent)] text-black'
                        : 'bg-white/5 border border-white/10 text-[var(--tv-accent)] group-hover:border-[var(--tv-accent)]'
                    }`}
                  >
                    {page.icon}
                  </div>
                  <div className="text-sm sm:text-base font-black text-white group-hover:text-[var(--tv-accent)] transition-colors truncate w-full px-1">
                    {page.label}
                  </div>
                  <div className="text-xs font-semibold text-[var(--tv-accent)] truncate w-full px-1 mt-0.5">
                    {page.badge}
                  </div>
                </div>

                {/* Card Bottom: Key Prompt & Action */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-400 font-mono w-full">
                  <span className="text-zinc-400">Remote: [{page.num}]</span>
                  <span
                    className={`font-bold flex items-center space-x-0.5 ${
                      isFocused ? 'text-[var(--tv-accent)]' : 'text-zinc-300'
                    }`}
                  >
                    <span>OK</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Live Contextual Preview Banner for the Focused Page */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3.5 min-w-0 flex-1">
            <div className="p-3 rounded-2xl bg-[var(--tv-accent-subtle)] border border-[var(--tv-accent-border)] text-[var(--tv-accent)] shrink-0 hidden sm:flex">
              {activeFocusedPage.icon}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                <span className="text-sm font-black text-white tracking-wide uppercase">
                  Page {activeFocusedPage.num}: {activeFocusedPage.label}
                </span>
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-black/60 text-[var(--tv-accent)] border border-[var(--tv-accent-border)]">
                  {activeFocusedPage.badge}
                </span>
                {activeTab === activeFocusedPage.id && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Currently Open
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-300 leading-snug line-clamp-1">
                {activeFocusedPage.detail}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
            {activeFocusedPage.features.map((feat) => (
              <span
                key={feat}
                className="hidden lg:inline text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-white/10 text-zinc-300"
              >
                {feat}
              </span>
            ))}
            <button
              ref={actionButtonRef}
              onClick={() => {
                onSelectTab(activeFocusedPage.id);
                onClose();
              }}
              className={`tv-focusable px-5 py-2.5 rounded-xl font-black text-xs flex items-center space-x-2 transition-all cursor-pointer ${
                focusedZone === 'actions'
                  ? 'bg-[var(--tv-accent)] text-black ring-2 ring-white shadow-xl shadow-[var(--tv-accent-glow)] scale-[1.03]'
                  : 'bg-[var(--tv-accent)] text-black shadow-lg shadow-[var(--tv-accent-glow)] hover:brightness-110'
              }`}
            >
              <span>Launch {activeFocusedPage.label}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/20 text-black font-bold">
                [OK]
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Footer TV Remote Color Key Legend */}
        <div className="pt-2 flex flex-wrap items-center justify-between text-xs text-zinc-400 border-t border-white/10 gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
              Color Keys:
            </span>
            <button
              onClick={() => {
                onSelectTab('epg');
                onClose();
              }}
              className="tv-focusable flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-[11px] font-medium transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Red: TV Guide [3]</span>
            </button>
            <button
              onClick={() => {
                onSelectTab('favorites');
                onClose();
              }}
              className="tv-focusable flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-medium transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Green: Favorites [6]</span>
            </button>
            <button
              onClick={() => {
                onClose();
                if (onOpenSearch) onOpenSearch();
              }}
              className="tv-focusable flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Yellow: Search</span>
            </button>
            <button
              onClick={() => {
                onSelectTab('settings');
                onClose();
              }}
              className="tv-focusable flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-medium transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Blue: Settings [7]</span>
            </button>
          </div>

          <div className="flex items-center space-x-2.5 text-[11px] font-mono text-zinc-500">
            <span>[◄ ►] Navigate</span>
            <span>·</span>
            <span>[▲ ▼] Actions</span>
            <span>·</span>
            <span>[1–7] Direct Jump</span>
            <span>·</span>
            <span>[Back / Esc] Exit</span>
          </div>
        </div>
      </div>
    </div>
  );
};
