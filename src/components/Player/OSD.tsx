import React, { useState, useEffect } from 'react';
import { Play, Pause, Rewind, FastForward, Radio, Heart, Activity, Volume2, List, Shield, Sparkles } from 'lucide-react';
import { Channel, Program, StreamMetrics } from '../../types/iptv';
import { ChannelLogo } from '../Common/ChannelLogo';

interface OSDProps {
  isVisible: boolean;
  channel: Channel;
  currentProgram?: Program;
  nextProgram?: Program;
  isPlaying: boolean;
  isLive: boolean;
  currentTime: number;
  duration: number;
  isFavorite: boolean;
  metrics: StreamMetrics | null;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onGoToLive: () => void;
  onToggleFavorite: () => void;
  onOpenAudioSubs: () => void;
  onOpenStreamInfo: () => void;
  onOpenChannelPicker: () => void;
  onInteract: () => void;
}

export const OSD: React.FC<OSDProps> = ({
  isVisible,
  channel,
  currentProgram,
  nextProgram,
  isPlaying,
  isLive,
  currentTime,
  duration,
  isFavorite,
  metrics,
  onTogglePlay,
  onSeek,
  onGoToLive,
  onToggleFavorite,
  onOpenAudioSubs,
  onOpenStreamInfo,
  onOpenChannelPicker,
  onInteract,
}) => {
  const [nowProgress, setNowProgress] = useState(45);

  useEffect(() => {
    if (currentProgram && currentProgram.start && currentProgram.end) {
      const now = Date.now();
      const total = currentProgram.end - currentProgram.start;
      const elapsed = now - currentProgram.start;
      const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
      setNowProgress(Math.round(pct));
    }
  }, [currentProgram]);

  if (!isVisible) return null;

  const formatSecs = (sec: number) => {
    if (isNaN(sec) || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isDvrActive = !isLive || duration > 0;

  return (
    <div
      onMouseMove={onInteract}
      className="absolute inset-0 z-40 flex flex-col justify-between pointer-events-auto bg-gradient-to-t from-black/95 via-transparent to-black/80 p-8 select-none transition-opacity duration-200"
    >
      {/* Top Bar: Channel Header & Quick Badges */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <ChannelLogo
            channelName={channel.name}
            logoUrl={channel.logo}
            size="lg"
            className="w-14 h-14 rounded-2xl shadow-lg border-white/20"
          />
          <div>
            <div className="flex items-center space-x-3">
              <span className="text-2xl font-black text-[var(--tv-accent)] font-mono">CH {channel.num}</span>
              <h1 className="text-2xl font-black text-white text-shadow-tv">{channel.name}</h1>
              <button
                onClick={onToggleFavorite}
                className="p-1 rounded-full hover:bg-white/10 text-white/70 hover:text-red-400"
              >
                <Heart
                  className={`w-5 h-5 ${isFavorite ? 'text-red-500 fill-red-500' : 'text-zinc-400'}`}
                />
              </button>
            </div>
            <div className="flex items-center space-x-3 text-xs text-zinc-300 mt-0.5">
              <span className="font-semibold text-zinc-400">{channel.group}</span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded bg-white/10 font-bold text-white uppercase text-[10px]">
                {channel.resolution || '1080p'}
              </span>
              {channel.hdr && channel.hdr !== 'SDR' && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[10px]">
                  {channel.hdr}
                </span>
              )}
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                {metrics?.engine || 'Native HTML5'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Badge & Right Controls */}
        <div className="flex items-center space-x-3">
          {isLive ? (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-red-600/30 border border-red-500 text-red-400 text-xs font-black uppercase tracking-wider animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span>LIVE</span>
            </div>
          ) : (
            <button
              onClick={onGoToLive}
              className="tv-focusable flex items-center space-x-2 px-3 py-1.5 rounded-full bg-cyan-500 text-black font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/30"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>RETURN TO LIVE</span>
            </button>
          )}

          <button
            onClick={onOpenChannelPicker}
            className="tv-focusable flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white backdrop-blur-md"
          >
            <List className="w-4 h-4" />
            <span>Channels</span>
          </button>
        </div>
      </div>

      {/* Bottom Area: Program Info, Seekbar & Controls */}
      <div className="space-y-4">
        {/* EPG Program Summary */}
        <div className="flex items-end justify-between bg-black/50 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
          <div className="max-w-2xl">
            <div className="flex items-center space-x-2 text-xs text-cyan-400 font-bold uppercase tracking-wider mb-1">
              <span>NOW PLAYING</span>
              {currentProgram?.category && (
                <span className="px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 text-[10px]">
                  {currentProgram.category}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mb-1">
              {currentProgram?.title || 'Live Transmission Broadcast'}
            </h2>
            <p className="text-xs text-zinc-300 line-clamp-2">
              {currentProgram?.description ||
                'Continuous high-definition feed broadcasting live programs and scheduled media.'}
            </p>
          </div>

          {nextProgram && (
            <div className="text-right text-xs max-w-xs pl-4 border-l border-white/10">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">UP NEXT</span>
              <div className="font-semibold text-zinc-200 truncate">{nextProgram.title}</div>
            </div>
          )}
        </div>

        {/* Live DVR Seekbar */}
        <div className="space-y-1.5">
          <div className="relative h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer">
            <div
              className="absolute left-0 top-0 bottom-0 bg-[var(--tv-accent)] rounded-full transition-all duration-200"
              style={{ width: `${nowProgress}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[11px] font-mono text-zinc-400">
            <span>
              {isDvrActive ? formatSecs(currentTime) : 'Live Progress'} ({nowProgress}%)
            </span>
            <span>
              {isLive ? 'Live Edge (0s delay)' : `DVR Timeshift: -${formatSecs(Math.max(0, duration - currentTime))}`}
            </span>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onSeek(currentTime - 10)}
              className="tv-focusable p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white"
              title="Rewind 10 seconds"
            >
              <Rewind className="w-5 h-5" />
            </button>
            <button
              onClick={onTogglePlay}
              className="tv-focusable p-4 rounded-2xl bg-[var(--tv-accent)] hover:brightness-110 text-black shadow-lg shadow-[var(--tv-accent-glow)]"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-black" /> : <Play className="w-6 h-6 fill-black" />}
            </button>
            <button
              onClick={() => onSeek(currentTime + 10)}
              className="tv-focusable p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white"
              title="Forward 10 seconds"
            >
              <FastForward className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenAudioSubs}
              className="tv-focusable flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white"
            >
              <Volume2 className="w-4 h-4 text-[var(--tv-accent)]" />
              <span>Audio / Sub</span>
            </button>
            <button
              onClick={onOpenStreamInfo}
              className="tv-focusable flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white"
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Diagnostics</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
