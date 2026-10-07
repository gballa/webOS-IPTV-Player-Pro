import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PlaybackEngine } from '../../services/PlaybackEngine';
import { Channel, Program, StreamMetrics, MediaTrack, AppSettings } from '../../types/iptv';
import { OSD } from './OSD';
import { StreamInfoModal } from './StreamInfoModal';
import { AudioSubtitleSelector } from './AudioSubtitleSelector';
import { ChannelQuickPicker } from './ChannelQuickPicker';
import { NumberOverlay } from './NumberOverlay';
import { SleepTimerOverlay } from './SleepTimerOverlay';
import { PinEntryModal } from '../Common/PinEntryModal';
import { globalRemote, RemoteEvent } from '../../services/RemoteController';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface VideoPlayerProps {
  channel: Channel;
  channels: Channel[];
  currentProgram?: Program;
  nextProgram?: Program;
  settings: AppSettings;
  favoriteIds: string[];
  onChannelChange: (newChannel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
  onOpenEpg?: () => void;
  onOpenSettings?: () => void;
  onExitPlayer?: () => void;
  sleepTimerRemainingSec?: number | null;
  onSetSleepTimer?: (minutes: number) => void;
  onCancelSleepTimer?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  channels,
  currentProgram,
  nextProgram,
  settings,
  favoriteIds,
  onChannelChange,
  onToggleFavorite,
  onOpenEpg,
  onOpenSettings,
  onExitPlayer,
  sleepTimerRemainingSec,
  onSetSleepTimer,
  onCancelSleepTimer,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<PlaybackEngine | null>(null);

  // Playback States
  const [status, setStatus] = useState<'loading' | 'playing' | 'paused' | 'buffering' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<StreamMetrics | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLive, setIsLive] = useState(true);

  // Tracks
  const [audioTracks, setAudioTracks] = useState<MediaTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<MediaTrack[]>([]);
  const [currentAudioId, setCurrentAudioId] = useState(0);
  const [currentSubtitleId, setCurrentSubtitleId] = useState(-1);

  // UI Overlays
  const [isOsdVisible, setIsOsdVisible] = useState(true);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [isQuickPickerOpen, setIsQuickPickerOpen] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);

  // Direct Number Dialing
  const [numberBuffer, setNumberBuffer] = useState('');
  const numberTimeoutRef = useRef<any>(null);
  const osdTimerRef = useRef<any>(null);

  // Reset & show OSD with 5-second auto-hide
  const triggerOsd = useCallback(() => {
    setIsOsdVisible(true);
    clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => {
      setIsOsdVisible(false);
    }, 5000);
  }, []);

  // Initialize playback engine
  useEffect(() => {
    if (!videoRef.current) return;

    const engine = new PlaybackEngine(
      {
        onStatusChange: (newStatus, err) => {
          setStatus(newStatus);
          if (err) setErrorMessage(err);
          else if (newStatus === 'playing') setErrorMessage(null);
        },
        onMetricsUpdate: (m) => setMetrics(m),
        onTracksDiscovered: (aTracks, sTracks) => {
          setAudioTracks(aTracks);
          setSubtitleTracks(sTracks);
        },
        onAutoRecoveryAttempt: (attempt, max, action) => {
          setRecoveryNotice(`Watchdog: Auto-recovery attempt ${attempt}/${max} (${action})`);
          setTimeout(() => setRecoveryNotice(null), 4000);
        },
        onRequestNextChannel: () => {
          handleNextChannel();
        },
      },
      {
        playerEngine: settings.playerEngine,
        bufferSizeSec: settings.bufferSizeSec,
        aggressiveBufferManagement: settings.aggressiveBufferManagement,
        maxRecoveryAttempts: settings.autoRecoveryRetries,
      }
    );

    engine.attachVideo(videoRef.current);
    engineRef.current = engine;

    // Load stream URL
    engine.loadStream(channel.streamUrl);

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [channel.streamUrl, settings.playerEngine, settings.autoRecoveryRetries]);

  // Dynamically configure streaming behavior in real-time when buffer size or aggressive management changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateBufferConfig(
        settings.bufferSizeSec,
        !!settings.aggressiveBufferManagement
      );
    }
  }, [settings.bufferSizeSec, settings.aggressiveBufferManagement]);

  // Video time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      const d = videoRef.current.duration;
      setDuration(isNaN(d) ? 0 : d);
      // If duration is infinite or 0, it's live
      if (!isFinite(d) || d === 0) {
        setIsLive(true);
      }
    }
  };

  const handleNextChannel = useCallback(() => {
    const currentIdx = channels.findIndex(c => c.id === channel.id);
    const nextIdx = (currentIdx + 1) % channels.length;
    onChannelChange(channels[nextIdx]);
    triggerOsd();
  }, [channels, channel.id, onChannelChange, triggerOsd]);

  const handlePrevChannel = useCallback(() => {
    const currentIdx = channels.findIndex(c => c.id === channel.id);
    const prevIdx = (currentIdx - 1 + channels.length) % channels.length;
    onChannelChange(channels[prevIdx]);
    triggerOsd();
  }, [channels, channel.id, onChannelChange, triggerOsd]);

  // Parental Control State for Number Dialing
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingChannel, setPendingChannel] = useState<Channel | null>(null);

  const isCategoryLocked = useCallback(
    (groupName: string) => {
      if (!settings.parentalControlActive) return false;
      const lockedList = settings.lockedCategories || [];
      return lockedList.some((k) => groupName.toLowerCase().includes(k.toLowerCase()));
    },
    [settings.parentalControlActive, settings.lockedCategories]
  );

  // Channel direct jump logic
  const handleNumberInput = useCallback((digit: number) => {
    setNumberBuffer((prev) => {
      const updated = prev + digit.toString();
      clearTimeout(numberTimeoutRef.current);
      numberTimeoutRef.current = setTimeout(() => {
        const targetNum = parseInt(updated, 10);
        const match = channels.find(c => c.num === targetNum);
        if (match) {
          if (isCategoryLocked(match.group)) {
            setPendingChannel(match);
            setIsPinModalOpen(true);
          } else {
            onChannelChange(match);
          }
        }
        setNumberBuffer('');
      }, 1400);
      return updated;
    });
  }, [channels, onChannelChange, isCategoryLocked]);

  // Remote key handling
  useEffect(() => {
    const unsubscribe = globalRemote.subscribe((event: RemoteEvent) => {
      // If modal is open, let Back key close modal
      if (event.action === 'BACK') {
        if (isInfoModalOpen) {
          setIsInfoModalOpen(false);
          return;
        }
        if (isAudioModalOpen) {
          setIsAudioModalOpen(false);
          return;
        }
        if (isQuickPickerOpen) {
          setIsQuickPickerOpen(false);
          return;
        }
        if (isOsdVisible) {
          setIsOsdVisible(false);
          return;
        }
        // If nothing open, exit full player back to live browse
        onExitPlayer?.();
        return;
      }

      // Quick Color keys
      if (event.action === 'RED') {
        onOpenEpg?.();
        return;
      }
      if (event.action === 'GREEN') {
        onToggleFavorite(channel.id);
        triggerOsd();
        return;
      }
      if (event.action === 'YELLOW') {
        setIsInfoModalOpen(prev => !prev);
        return;
      }
      if (event.action === 'BLUE') {
        onOpenSettings?.();
        return;
      }

      // Numbers 0-9
      if (event.action === 'NUMBER' && event.numberKey !== undefined) {
        handleNumberInput(event.numberKey);
        return;
      }

      // Channel Step
      if (event.action === 'CH_UP') {
        handleNextChannel();
        return;
      }
      if (event.action === 'CH_DOWN') {
        handlePrevChannel();
        return;
      }

      // D-Pad
      switch (event.action) {
        case 'UP':
          handlePrevChannel();
          break;
        case 'DOWN':
          handleNextChannel();
          break;
        case 'LEFT':
          // Seek -10s
          if (videoRef.current) {
            videoRef.current.currentTime -= 10;
            setIsLive(false);
          }
          triggerOsd();
          break;
        case 'RIGHT':
          // Seek +10s
          if (videoRef.current) {
            videoRef.current.currentTime += 10;
          }
          triggerOsd();
          break;
        case 'ENTER':
          if (!isOsdVisible) {
            triggerOsd();
          } else {
            togglePlay();
          }
          break;
        case 'PLAY':
        case 'PAUSE':
        case 'PLAY_PAUSE':
          togglePlay();
          triggerOsd();
          break;
      }
    });

    return () => unsubscribe();
  }, [
    isOsdVisible,
    isInfoModalOpen,
    isAudioModalOpen,
    isQuickPickerOpen,
    channel.id,
    handleNextChannel,
    handlePrevChannel,
    handleNumberInput,
    onOpenEpg,
    onOpenSettings,
    onExitPlayer,
    onToggleFavorite,
    triggerOsd,
  ]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setStatus('playing');
    } else {
      videoRef.current.pause();
      setStatus('paused');
      setIsLive(false);
    }
  };

  const handleSeek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, seconds);
      setIsLive(false);
      triggerOsd();
    }
  };

  const handleGoToLive = () => {
    if (videoRef.current && duration > 0) {
      videoRef.current.currentTime = duration;
      setIsLive(true);
      triggerOsd();
    }
  };

  return (
    <div
      onClick={triggerOsd}
      className="relative w-full h-full bg-black overflow-hidden select-none cursor-default"
    >
      {/* Native HTML5 <video> Element */}
      <video
        ref={videoRef}
        onTimeUpdate={handleTimeUpdate}
        className="w-full h-full object-contain bg-black"
        playsInline
        autoPlay
      />

      {/* Buffering Spinner */}
      {status === 'loading' || status === 'buffering' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none z-30">
          <div
            className="w-16 h-16 rounded-full border-4 animate-spin"
            style={{
              borderColor: 'var(--tv-accent-subtle)',
              borderTopColor: 'var(--tv-accent)',
            }}
          ></div>
          <span className="mt-4 text-xs font-bold uppercase tracking-widest text-[var(--tv-accent)]">
            {status === 'loading' ? 'Tuning Stream...' : 'Buffering...'}
          </span>
        </div>
      ) : null}

      {/* Error / Fallback Banner */}
      {status === 'error' && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-40 px-6 py-4 rounded-2xl bg-red-950/90 border border-red-500 text-white flex items-center space-x-3 shadow-2xl backdrop-blur-md">
          <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
          <div>
            <div className="text-sm font-bold">Stream Playback Error</div>
            <div className="text-xs text-red-200">{errorMessage || 'Stream offline or inaccessible'}</div>
          </div>
          <button
            onClick={() => engineRef.current?.loadStream(channel.streamUrl)}
            className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-black text-xs font-bold flex items-center space-x-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Watchdog Auto Recovery Toast */}
      {recoveryNotice && (
        <div
          className="absolute top-8 left-1/2 -translate-x-1/2 z-40 px-5 py-2.5 rounded-xl border text-xs font-semibold shadow-xl backdrop-blur-md animate-pulse"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            borderColor: 'var(--tv-accent)',
            color: 'var(--tv-accent)',
            boxShadow: '0 8px 30px var(--tv-accent-glow)',
          }}
        >
          {recoveryNotice}
        </div>
      )}

      {/* Direct Channel Number Overlay */}
      <NumberOverlay inputBuffer={numberBuffer} />

      {/* Sleep Timer Floating Overlay HUD & Imminent Expiration Warning */}
      <SleepTimerOverlay
        remainingSeconds={sleepTimerRemainingSec ?? null}
        onSetTimerMinutes={onSetSleepTimer ?? (() => {})}
        onCancelTimer={onCancelSleepTimer ?? (() => {})}
      />

      {/* Parental PIN Entry Modal for Locked Channels */}
      <PinEntryModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingChannel(null);
        }}
        onSuccess={() => {
          if (pendingChannel) {
            onChannelChange(pendingChannel);
          }
          setIsPinModalOpen(false);
          setPendingChannel(null);
        }}
        correctPin={settings.parentalPin || '0000'}
        targetName={pendingChannel ? `#${pendingChannel.num} - ${pendingChannel.name} (${pendingChannel.group})` : 'Protected Channel'}
        description="Enter your 4-digit security PIN to tune to this locked channel."
      />

      {/* On-Screen Display (OSD) */}
      <OSD
        isVisible={isOsdVisible}
        channel={channel}
        currentProgram={currentProgram}
        nextProgram={nextProgram}
        isPlaying={status === 'playing'}
        isLive={isLive}
        currentTime={currentTime}
        duration={duration}
        isFavorite={favoriteIds.includes(channel.id)}
        metrics={metrics}
        onTogglePlay={togglePlay}
        onSeek={handleSeek}
        onGoToLive={handleGoToLive}
        onToggleFavorite={() => onToggleFavorite(channel.id)}
        onOpenAudioSubs={() => setIsAudioModalOpen(true)}
        onOpenStreamInfo={() => setIsInfoModalOpen(true)}
        onOpenChannelPicker={() => setIsQuickPickerOpen(true)}
        onInteract={triggerOsd}
      />

      {/* Audio & Subtitles Track Drawer */}
      <AudioSubtitleSelector
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
        audioTracks={audioTracks}
        subtitleTracks={subtitleTracks}
        currentAudioId={currentAudioId}
        currentSubtitleId={currentSubtitleId}
        onSelectAudio={(id) => {
          setCurrentAudioId(id);
          engineRef.current?.setAudioTrack(id);
        }}
        onSelectSubtitle={(id) => {
          setCurrentSubtitleId(id);
          engineRef.current?.setSubtitleTrack(id);
        }}
      />

      {/* Technical Stream Diagnostics Modal */}
      <StreamInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        metrics={metrics}
        channelName={channel.name}
      />

      {/* Quick Channel Picker Left Drawer */}
      <ChannelQuickPicker
        isOpen={isQuickPickerOpen}
        onClose={() => setIsQuickPickerOpen(false)}
        channels={channels}
        currentChannelId={channel.id}
        onSelectChannel={onChannelChange}
        favoriteIds={favoriteIds}
      />
    </div>
  );
};
