import React, { useState, useEffect } from 'react';
import { Home, Tv, Film, Clapperboard, Settings, Radio, Wifi, Clock, Search, Zap } from 'lucide-react';
import { AppTab } from '../../types/iptv';

interface TopNavBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenRemoteSim: () => void;
  onOpenSearch: () => void;
  onOpenQuickSwitcher: () => void;
  favoritesCount?: number;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  activeTab,
  onTabChange,
  onOpenRemoteSim,
  onOpenSearch,
  onOpenQuickSwitcher,
}) => {
  const [timeStr, setTimeStr] = useState(() => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  // Digital clock that synchronizes and updates every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };

    updateTime();

    // Calculate milliseconds until the next minute boundary
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    let minuteInterval: ReturnType<typeof setInterval> | null = null;
    const timeout = setTimeout(() => {
      updateTime();
      // Tick every minute (60,000 ms)
      minuteInterval = setInterval(updateTime, 60000);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(timeout);
      if (minuteInterval) clearInterval(minuteInterval);
    };
  }, []);

  const navItems: { id: AppTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'live', label: 'Live TV', icon: <Tv className="w-4 h-4" /> },
    { id: 'vod', label: 'Movies', icon: <Film className="w-4 h-4" /> },
    { id: 'series', label: 'Series', icon: <Clapperboard className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <header className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between border-b border-white/10 bg-[#0a0a0c]/90 backdrop-blur-xl z-30 select-none shrink-0 gap-4">
      {/* Brand & Badge */}
      <button
        onClick={() => onTabChange('home')}
        className="flex items-center space-x-3 text-left cursor-pointer group focus:outline-none shrink-0"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-105"
          style={{
            background: 'var(--tv-accent-gradient, var(--tv-accent))',
            boxShadow: '0 4px 14px var(--tv-accent-glow)',
          }}
        >
          <Tv className="w-5 h-5 text-black stroke-[2.5]" />
        </div>
        <div className="flex flex-col justify-center">
          <div className="flex items-center space-x-2 leading-none">
            <span className="font-extrabold tracking-wider text-sm sm:text-base text-white group-hover:text-[var(--tv-accent)] transition-colors">
              webOS IPTV
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-black rounded-md bg-[var(--tv-accent-subtle)] text-[var(--tv-accent)] border border-[var(--tv-accent-border)] leading-none uppercase">
              PRO
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 font-medium block mt-1 tracking-tight">
            LG webOS Edition
          </span>
        </div>
      </button>

      {/* Primary Navigation Bar Dock */}
      <div className="flex items-center space-x-1.5 min-w-0">
        <nav className="flex items-center p-1 bg-white/[0.04] border border-white/10 rounded-2xl shadow-inner backdrop-blur-md">
          {navItems.map((item, idx) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`tv-focusable h-8 px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all duration-150 ${
                  isActive
                    ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                    : 'text-zinc-300 hover:text-white hover:bg-white/10'
                }`}
                title={`Switch to ${item.label} (Remote ${idx + 1})`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="hidden md:inline truncate">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                      isActive
                        ? 'bg-black text-[var(--tv-accent)]'
                        : 'bg-[var(--tv-accent-subtle)] text-[var(--tv-accent)] border border-[var(--tv-accent-border)]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Page Switcher Launcher */}
        <button
          onClick={onOpenQuickSwitcher}
          className="tv-focusable h-10 px-2.5 sm:px-3 rounded-2xl bg-white/[0.04] hover:bg-white/10 text-white text-xs font-bold flex items-center space-x-1.5 transition-all border border-white/10 shadow-inner shrink-0"
          title="Open Quick Page Switcher (Press Q / Tab)"
        >
          <Zap className="w-3.5 h-3.5 text-[var(--tv-accent)]" />
          <span className="hidden xl:inline text-zinc-200">Pages</span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/50 text-[var(--tv-accent)] border border-white/10">
            1–7
          </span>
        </button>
      </div>

      {/* Right Controls: Search, Remote Simulator, Network & Clock */}
      <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
        {/* Search button */}
        <button
          onClick={onOpenSearch}
          title="Search Channels & VOD (Yellow Remote Key)"
          className="tv-focusable h-10 px-2.5 sm:px-3 rounded-2xl bg-white/[0.04] hover:bg-white/10 border border-white/10 hover:border-yellow-400/50 text-xs font-semibold text-zinc-200 transition-all flex items-center space-x-1.5 shadow-inner"
        >
          <Search className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          <span className="hidden lg:inline">Search</span>
        </button>

        {/* Remote simulator toggle button */}
        <button
          onClick={onOpenRemoteSim}
          title="Open On-Screen Remote Simulator"
          className="tv-focusable h-10 px-2.5 sm:px-3 rounded-2xl bg-white/[0.04] hover:bg-white/10 border border-white/10 hover:border-[var(--tv-accent)] text-xs font-semibold text-zinc-200 transition-all flex items-center space-x-1.5 shadow-inner"
        >
          <Radio className="w-3.5 h-3.5 text-[var(--tv-accent)] animate-pulse shrink-0" />
          <span className="hidden lg:inline">Remote</span>
        </button>

        {/* Network status indicator */}
        <div
          className="hidden 2xl:flex h-10 items-center space-x-1.5 text-xs text-zinc-300 bg-white/[0.04] px-3 rounded-2xl border border-white/10 shadow-inner"
          title="High-Speed Stream Connection Online"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] font-medium text-zinc-300">Online</span>
        </div>

        {/* Digital Clock Display (Synchronized to minute boundary) */}
        <div
          className="h-10 px-3.5 rounded-2xl bg-black/70 border border-white/15 text-white shadow-md flex items-center space-x-2 font-mono shrink-0 select-none"
          title="Digital Clock (Updates automatically every minute)"
        >
          <Clock className="w-3.5 h-3.5 text-[var(--tv-accent)] shrink-0" />
          <span className="text-xs sm:text-sm font-extrabold text-white tracking-widest drop-shadow-sm">
            {timeStr}
          </span>
        </div>
      </div>
    </header>
  );
};
