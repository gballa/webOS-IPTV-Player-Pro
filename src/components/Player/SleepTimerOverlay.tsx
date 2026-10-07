import React, { useState } from 'react';
import { Moon, Clock, X, Plus, AlertCircle, Play } from 'lucide-react';

interface SleepTimerOverlayProps {
  remainingSeconds: number | null; // null if sleep timer disabled
  onSetTimerMinutes: (minutes: number) => void;
  onCancelTimer: () => void;
}

export const SleepTimerOverlay: React.FC<SleepTimerOverlayProps> = ({
  remainingSeconds,
  onSetTimerMinutes,
  onCancelTimer,
}) => {
  const [isOpenMenu, setIsOpenMenu] = useState(false);

  if (remainingSeconds === null || remainingSeconds <= 0) {
    return null;
  }

  const formatRemaining = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isWarning = remainingSeconds <= 60;

  return (
    <>
      {/* Floating Visual Countdown HUD Badge */}
      <div className="fixed top-6 right-6 z-40 pointer-events-auto">
        <button
          onClick={() => setIsOpenMenu(true)}
          className={`tv-focusable flex items-center space-x-2 px-3 py-1.5 rounded-full border shadow-xl backdrop-blur-md transition-all cursor-pointer ${
            isWarning
              ? 'bg-amber-500/30 border-amber-400 text-amber-200 animate-pulse ring-2 ring-amber-400'
              : 'bg-black/75 border-white/20 text-white hover:border-[var(--tv-accent)] hover:bg-black/90'
          }`}
          title="Sleep Timer Active (Click to adjust)"
        >
          <Moon className={`w-3.5 h-3.5 ${isWarning ? 'text-amber-300' : 'text-[var(--tv-accent)]'}`} />
          <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Sleep</span>
          <span className="font-mono text-xs font-black text-white">{formatRemaining(remainingSeconds)}</span>
        </button>
      </div>

      {/* Imminent Expiration Alert (Final 60 seconds) */}
      {isWarning && (
        <div
          role="alert"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-auto animate-fadeIn select-none"
        >
          <div className="px-6 py-3 rounded-2xl bg-black/95 border-2 border-amber-400 shadow-2xl backdrop-blur-xl flex items-center space-x-3.5 text-white">
            <AlertCircle className="w-5 h-5 text-amber-400 animate-bounce shrink-0" />
            <div>
              <div className="text-xs font-extrabold text-amber-300">
                Sleep Timer Expiring in {remainingSeconds}s
              </div>
              <div className="text-[11px] text-zinc-300">Player will turn off automatically.</div>
            </div>
            <button
              onClick={() => onSetTimerMinutes(30)}
              className="tv-focusable px-3 py-1.5 rounded-xl bg-amber-400 text-black text-xs font-black hover:bg-amber-300 transition-colors"
            >
              +30m Stay Awake
            </button>
            <button
              onClick={onCancelTimer}
              className="tv-focusable px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sleep Timer Settings Modal / Popover */}
      {isOpenMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md select-none p-4 animate-fadeIn"
          onClick={() => setIsOpenMenu(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-[#0e101a] border border-white/20 p-5 shadow-2xl flex flex-col space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--tv-accent-subtle)] border border-[var(--tv-accent-border)] flex items-center justify-center text-[var(--tv-accent)]">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Sleep Timer</h3>
                  <p className="text-[11px] text-zinc-400">Scheduled playback shutoff</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenMenu(false)}
                className="tv-focusable p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center py-2 bg-black/40 rounded-2xl border border-white/5">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold mb-0.5">
                Time Remaining
              </div>
              <div className="text-3xl font-black font-mono text-[var(--tv-accent)]">
                {formatRemaining(remainingSeconds)}
              </div>
            </div>

            {/* Presets Grid */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Select Duration
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[15, 30, 45, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      onSetTimerMinutes(mins);
                      setIsOpenMenu(false);
                    }}
                    className="tv-focusable py-2.5 rounded-xl bg-white/10 hover:bg-[var(--tv-accent)] hover:text-black text-xs font-bold font-mono transition-colors border border-white/5"
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 pt-2">
              <button
                onClick={() => {
                  const currentMins = Math.round(remainingSeconds / 60);
                  onSetTimerMinutes(currentMins + 15);
                }}
                className="tv-focusable flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white flex items-center justify-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add 15m</span>
              </button>
              <button
                onClick={() => {
                  onCancelTimer();
                  setIsOpenMenu(false);
                }}
                className="tv-focusable flex-1 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold"
              >
                Cancel Timer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
