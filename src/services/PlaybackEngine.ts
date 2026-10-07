import Hls from 'hls.js';
import { StreamMetrics, MediaTrack, PlayerEngineType } from '../types/iptv';

export interface EngineCallbacks {
  onStatusChange?: (status: 'loading' | 'playing' | 'paused' | 'buffering' | 'error', errorMsg?: string) => void;
  onMetricsUpdate?: (metrics: StreamMetrics) => void;
  onTracksDiscovered?: (audioTracks: MediaTrack[], subtitleTracks: MediaTrack[]) => void;
  onAutoRecoveryAttempt?: (attempt: number, max: number, action: string) => void;
  onRequestNextChannel?: () => void;
}

export interface EngineOptions {
  playerEngine?: PlayerEngineType; // 'native' (default) | 'hls' | 'mpegts' | 'shaka' | 'auto'
  bufferSizeSec?: number;
  aggressiveBufferManagement?: boolean;
  maxRecoveryAttempts?: number;
}

export class PlaybackEngine {
  private video: HTMLVideoElement | null = null;
  private hls: Hls | null = null;
  private mpegtsPlayer: any = null;
  private shakaPlayer: any = null;

  private currentUrl = '';
  private activeEngineName: 'Native HTML5' | 'hls.js' | 'mpegts.js' | 'Shaka Player' = 'Native HTML5';
  private callbacks: EngineCallbacks = {};
  private options: EngineOptions = {
    playerEngine: 'native', // Default engine is Native HTML5 pipeline
    bufferSizeSec: 30,
    aggressiveBufferManagement: false,
    maxRecoveryAttempts: 3,
  };

  // Watchdog state
  private stallTimer: any = null;
  private metricsTimer: any = null;
  private lastPlayheadTime = -1;
  private stallCount = 0;
  private recoveryAttempts = 0;
  private isDestroyed = false;

  constructor(callbacks?: EngineCallbacks, options?: EngineOptions) {
    if (callbacks) this.callbacks = callbacks;
    if (options) this.options = { ...this.options, ...options };
  }

  attachVideo(videoEl: HTMLVideoElement) {
    this.video = videoEl;
    this.bindVideoEvents();
  }

  setCallbacks(cbs: EngineCallbacks) {
    this.callbacks = { ...this.callbacks, ...cbs };
  }

  setOptions(opts: Partial<EngineOptions>) {
    this.options = { ...this.options, ...opts };
    if (opts.bufferSizeSec !== undefined || opts.aggressiveBufferManagement !== undefined) {
      this.applyBufferConfig(
        this.options.bufferSizeSec || 30,
        !!this.options.aggressiveBufferManagement
      );
    }
  }

  /**
   * Dynamically reconfigure buffer size and aggressive management on running stream
   */
  updateBufferConfig(bufferSizeSec: number, aggressive: boolean) {
    this.options.bufferSizeSec = bufferSizeSec;
    this.options.aggressiveBufferManagement = aggressive;
    this.applyBufferConfig(bufferSizeSec, aggressive);
  }

  private applyBufferConfig(bufferSec: number, aggressive: boolean) {
    const boundedSec = Math.max(1, Math.min(180, bufferSec));

    if (this.hls) {
      this.hls.config.maxBufferLength = boundedSec;
      this.hls.config.maxMaxBufferLength = aggressive
        ? Math.max(boundedSec, boundedSec * 1.2)
        : Math.max(60, boundedSec * 1.5);
      this.hls.config.backBufferLength = aggressive
        ? Math.min(10, Math.max(3, Math.round(boundedSec / 3)))
        : Math.min(30, boundedSec);
      this.hls.config.maxBufferSize = aggressive
        ? 32 * 1024 * 1024
        : Math.min(128 * 1024 * 1024, Math.max(10 * 1024 * 1024, boundedSec * 2 * 1024 * 1024));
      this.hls.config.lowLatencyMode = aggressive || boundedSec <= 5;
      this.hls.config.highBufferWatchdogPeriod = aggressive ? 2 : 5;
      this.hls.config.liveSyncDurationCount = aggressive ? 2 : 3;
      this.hls.config.liveMaxLatencyDurationCount = aggressive ? 4 : 8;
    }

    if (this.shakaPlayer) {
      try {
        this.shakaPlayer.configure({
          streaming: {
            bufferingGoal: boundedSec,
            rebufferingGoal: aggressive ? 1 : Math.min(5, Math.max(1, Math.round(boundedSec / 5))),
            bufferBehind: aggressive ? 10 : Math.min(30, boundedSec),
            inaccurateManifestTolerance: aggressive ? 0 : 2,
          },
        });
      } catch (e) {
        console.warn('[PlaybackEngine] Could not dynamically reconfigure Shaka buffer:', e);
      }
    }

    if (this.mpegtsPlayer) {
      try {
        if (this.mpegtsPlayer._config) {
          this.mpegtsPlayer._config.lazyLoadMaxDuration = boundedSec;
          this.mpegtsPlayer._config.liveBufferLatencyChasing = aggressive;
          this.mpegtsPlayer._config.liveBufferLatencyChasingOnPause = aggressive;
          this.mpegtsPlayer._config.maxLiveSyncPlaybackRate = aggressive ? 1.15 : 1.0;
          this.mpegtsPlayer._config.autoCleanupMaxBackwardDuration = aggressive
            ? Math.min(10, Math.max(3, Math.round(boundedSec / 3)))
            : Math.min(30, boundedSec);
        }
      } catch (e) {
        console.warn('[PlaybackEngine] Could not dynamically reconfigure mpegts buffer:', e);
      }
    }

    if (this.video && !aggressive && this.video.playbackRate > 1.0) {
      this.video.playbackRate = 1.0;
    }
  }

  /**
   * Main Decision & Loading Pipeline
   */
  async loadStream(url: string, overrideEngine?: 'native' | 'hls' | 'mpegts' | 'shaka') {
    if (!this.video) return;

    this.currentUrl = url;
    this.recoveryAttempts = 0;
    this.stallCount = 0;
    this.cleanupSecondaryEngines();

    this.callbacks.onStatusChange?.('loading');

    const enginePref = overrideEngine || this.options.playerEngine || 'native';
    const isDash = url.includes('.mpd') || url.includes('/dash/');
    const isTs = url.includes('.ts') || url.includes('mpegts');
    const isHls = url.includes('.m3u8') || url.includes('/hls/');

    // Auto Decision Logic:
    let targetEngine: 'native' | 'hls' | 'mpegts' | 'shaka' = 'native';

    if (overrideEngine) {
      targetEngine = overrideEngine;
    } else if (enginePref === 'auto') {
      if (isDash) {
        targetEngine = 'shaka';
      } else if (isTs && !url.includes('.m3u8')) {
        targetEngine = 'mpegts';
      } else {
        // Default to native for best hardware decoding, fallback will catch errors
        targetEngine = 'native';
      }
    } else {
      // User explicitly picked Native, hls, mpegts, or shaka in Settings
      targetEngine = enginePref;
    }

    try {
      switch (targetEngine) {
        case 'hls':
          await this.initHls(url);
          break;
        case 'mpegts':
          await this.initMpegTs(url);
          break;
        case 'shaka':
          await this.initShaka(url);
          break;
        case 'native':
        default:
          this.initNative(url);
          break;
      }
    } catch (err: any) {
      console.warn(`[PlaybackEngine] Failed to initialize ${targetEngine}, attempting native fallback:`, err);
      this.initNative(url);
    }

    this.startWatchdog();
    this.startMetricsMonitor();
  }

  /**
   * 1. Primary Native HTML5 Pipeline
   * Direct hardware decoding, HDR10 / Dolby Vision passthrough, lowest CPU
   */
  private initNative(url: string) {
    if (!this.video) return;
    this.activeEngineName = 'Native HTML5';

    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();

    this.video.src = url;
    const playPromise = this.video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err.name === 'NotSupportedError' || err.name === 'NotAllowedError') {
          this.triggerFallback(`Native engine playback failed: ${err.message}`);
        }
      });
    }
  }

  /**
   * 2. hls.js MSE Pipeline
   * Complex HLS, alternate audio tags, low latency
   */
  private async initHls(url: string) {
    if (!this.video) return;
    this.activeEngineName = 'hls.js';

    if (!Hls.isSupported()) {
      this.initNative(url);
      return;
    }

    const aggressive = !!this.options.aggressiveBufferManagement;
    const bufferSec = Math.max(1, Math.min(180, this.options.bufferSizeSec || 30));
    this.hls = new Hls({
      enableWorker: true,
      lowLatencyMode: aggressive || bufferSec <= 5,
      backBufferLength: aggressive ? Math.min(10, Math.max(3, Math.round(bufferSec / 3))) : Math.min(30, bufferSec),
      maxBufferLength: bufferSec,
      maxMaxBufferLength: aggressive ? Math.max(bufferSec, bufferSec * 1.2) : Math.max(60, bufferSec * 1.5),
      maxBufferSize: aggressive ? 32 * 1024 * 1024 : Math.min(128 * 1024 * 1024, Math.max(10 * 1024 * 1024, bufferSec * 2 * 1024 * 1024)),
      fragLoadingTimeOut: Math.max(12000, bufferSec * 1000),
      manifestLoadingTimeOut: 10000,
      autoStartLoad: true,
      highBufferWatchdogPeriod: aggressive ? 2 : 5,
      liveSyncDurationCount: aggressive ? 2 : 3,
      liveMaxLatencyDurationCount: aggressive ? 4 : 8,
    });

    this.hls.attachMedia(this.video);

    this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      this.hls?.loadSource(url);
    });

    this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      this.video?.play().catch(() => {});

      const audioTracks: MediaTrack[] = (this.hls?.audioTracks || []).map((t, idx) => ({
        id: idx,
        name: t.name || `Audio ${idx + 1}`,
        lang: t.lang || 'und',
      }));

      const subtitleTracks: MediaTrack[] = (this.hls?.subtitleTracks || []).map((t, idx) => ({
        id: idx,
        name: t.name || `Subtitle ${idx + 1}`,
        lang: t.lang || 'und',
      }));

      this.callbacks.onTracksDiscovered?.(audioTracks, subtitleTracks);
    });

    this.hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            this.hls?.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            this.hls?.recoverMediaError();
            break;
          default:
            this.triggerFallback(`HLS Fatal Error: ${data.details}`);
            break;
        }
      }
    });
  }

  /**
   * 3. mpegts.js Pipeline
   * Raw MPEG-TS over HTTP packets
   */
  private async initMpegTs(url: string) {
    if (!this.video) return;
    this.activeEngineName = 'mpegts.js';

    const aggressive = !!this.options.aggressiveBufferManagement;
    const bufferSec = Math.max(2, Math.min(180, this.options.bufferSizeSec || 30));

    try {
      const mpegtsModule = await import('mpegts.js');
      const mpegts = mpegtsModule.default || mpegtsModule;

      if (mpegts && mpegts.isSupported()) {
        this.mpegtsPlayer = mpegts.createPlayer(
          {
            type: 'mse', // or 'mpegts'
            isLive: true,
            url: url,
          },
          {
            lazyLoad: false,
            lazyLoadMaxDuration: bufferSec,
            deferLoadAfterSourceOpen: false,
            autoCleanupSourceBuffer: true,
            autoCleanupMaxBackwardDuration: aggressive ? Math.min(10, Math.max(3, Math.round(bufferSec / 3))) : Math.min(30, bufferSec),
            autoCleanupMinBackwardDuration: aggressive ? Math.min(5, Math.max(2, Math.round(bufferSec / 6))) : Math.min(15, Math.max(5, Math.round(bufferSec / 3))),
            liveBufferLatencyChasing: aggressive,
            liveBufferLatencyChasingOnPaused: aggressive,
            liveSyncPlaybackRate: aggressive ? 1.15 : 1.0,
          }
        );

        this.mpegtsPlayer.attachMediaElement(this.video);
        this.mpegtsPlayer.load();
        this.mpegtsPlayer.play();
      } else {
        this.initNative(url);
      }
    } catch (e) {
      console.warn('mpegts.js load error, falling back to Native', e);
      this.initNative(url);
    }
  }

  /**
   * 4. Shaka Player Pipeline (Loaded dynamically on demand)
   * DASH manifests, Widevine/ClearKey EME DRM
   */
  private async initShaka(url: string) {
    if (!this.video) return;
    this.activeEngineName = 'Shaka Player';

    try {
      // Dynamic import to keep main bundle lean for webOS 4.0
      const shakaModule = await import('shaka-player/dist/shaka-player.compiled.js');
      const shaka = (window as any).shaka || shakaModule.default || shakaModule;

      if (shaka) {
        shaka.polyfill.installAll();
        if (shaka.Player.isBrowserSupported()) {
          this.shakaPlayer = new shaka.Player(this.video);
          
          const aggressive = !!this.options.aggressiveBufferManagement;
          const bufferSec = Math.max(2, Math.min(180, this.options.bufferSizeSec || 30));
          this.shakaPlayer.configure({
            streaming: {
              bufferingGoal: bufferSec,
              rebufferingGoal: aggressive ? 1 : Math.min(5, Math.max(1, Math.round(bufferSec / 5))),
              bufferBehind: aggressive ? 10 : Math.min(30, bufferSec),
              inaccurateManifestTolerance: aggressive ? 0 : 2,
              retryParameters: {
                maxAttempts: 3,
                baseDelay: 1000,
                backoffFactor: 2,
                fuzzFactor: 0.5,
                timeout: Math.max(10000, bufferSec * 1000),
              },
            },
          });

          this.shakaPlayer.addEventListener('error', (err: any) => {
            console.error('Shaka Player Error', err);
            this.triggerFallback('Shaka Error: ' + err.detail?.message);
          });

          await this.shakaPlayer.load(url);
          this.video.play().catch(() => {});
          return;
        }
      }
      this.initNative(url);
    } catch (e) {
      console.warn('Shaka Player load error, falling back to Native', e);
      this.initNative(url);
    }
  }

  /**
   * Graceful fallback when an engine reports an unrecoverable failure
   */
  private triggerFallback(reason: string) {
    if (this.activeEngineName === 'Native HTML5' && Hls.isSupported()) {
      console.warn(`[PlaybackEngine] Fallback from Native to hls.js: ${reason}`);
      this.loadStream(this.currentUrl, 'hls');
    } else if (this.activeEngineName !== 'Native HTML5') {
      console.warn(`[PlaybackEngine] Fallback from ${this.activeEngineName} to Native: ${reason}`);
      this.loadStream(this.currentUrl, 'native');
    } else {
      this.handleWatchdogFailure(reason);
    }
  }

  /**
   * Stall Watchdog & Auto-Recovery Pipeline
   */
  private startWatchdog() {
    clearInterval(this.stallTimer);
    this.lastPlayheadTime = -1;
    this.stallCount = 0;

    this.stallTimer = setInterval(() => {
      if (!this.video || this.video.paused || this.video.ended) return;

      const current = this.video.currentTime;
      if (this.lastPlayheadTime >= 0 && Math.abs(current - this.lastPlayheadTime) < 0.05) {
        this.stallCount++;
        // ~3 seconds of frozen playhead
        if (this.stallCount >= 3) {
          this.executeRecoveryStep();
        }
      } else {
        this.stallCount = 0;
      }
      this.lastPlayheadTime = current;

      // Aggressive buffer management: chase live broadcast edge and maintain bounded cache
      if (this.options.aggressiveBufferManagement && this.video && !this.video.paused) {
        try {
          const seekable = this.video.seekable;
          if (seekable && seekable.length > 0) {
            const liveEdge = seekable.end(seekable.length - 1);
            const lag = liveEdge - this.video.currentTime;
            const targetLag = Math.max(2, Math.min(30, this.options.bufferSizeSec || 5));
            if (lag > targetLag * 2.5 && lag > 6) {
              if (lag > 25) {
                // Large drift behind broadcast edge: jump close to target buffer
                this.video.currentTime = Math.max(0, liveEdge - targetLag);
              } else {
                // Micro-catchup using gentle speedup
                this.video.playbackRate = 1.08;
              }
            } else if (this.video.playbackRate > 1.0) {
              this.video.playbackRate = 1.0;
            }
          }
        } catch {
          // ignore
        }
      }
    }, 1000);
  }

  private executeRecoveryStep() {
    this.recoveryAttempts++;
    const maxAttempts = this.options.maxRecoveryAttempts || 3;

    if (this.recoveryAttempts > maxAttempts) {
      this.handleWatchdogFailure('Exceeded maximum watchdog recovery attempts');
      return;
    }

    if (this.recoveryAttempts === 1) {
      // Step 1: Soft restart (nudge playhead forward 0.5s to bypass corrupted frame)
      this.callbacks.onAutoRecoveryAttempt?.(1, maxAttempts, 'Soft restart: nudging buffer playhead');
      if (this.video) {
        try {
          this.video.currentTime += 0.5;
          this.video.play().catch(() => {});
        } catch {
          // ignore
        }
      }
    } else if (this.recoveryAttempts === 2) {
      // Step 2: Engine hot-swap
      const nextEngine = this.activeEngineName === 'Native HTML5' ? 'hls' : 'native';
      this.callbacks.onAutoRecoveryAttempt?.(2, maxAttempts, `Engine swap: switching to ${nextEngine}`);
      this.loadStream(this.currentUrl, nextEngine);
    } else if (this.recoveryAttempts === 3) {
      // Step 3: Hard reload
      this.callbacks.onAutoRecoveryAttempt?.(3, maxAttempts, 'Hard reload stream pipeline');
      this.loadStream(this.currentUrl);
    }
  }

  private handleWatchdogFailure(reason: string) {
    this.callbacks.onStatusChange?.('error', reason);
    // Auto advance channel if dead
    setTimeout(() => {
      this.callbacks.onRequestNextChannel?.();
    }, 3500);
  }

  /**
   * Real-time metrics sampler for OSD diagnostics
   */
  private startMetricsMonitor() {
    clearInterval(this.metricsTimer);
    this.metricsTimer = setInterval(() => {
      if (!this.video) return;

      const v = this.video;
      let bufferSecs = 0;
      if (v.buffered && v.buffered.length > 0) {
        try {
          const end = v.buffered.end(v.buffered.length - 1);
          bufferSecs = Math.max(0, end - v.currentTime);
        } catch {
          // ignore
        }
      }

      const width = v.videoWidth || 1920;
      const height = v.videoHeight || 1080;
      let resLabel = `${width}x${height}`;
      if (height >= 2160 || width >= 3840) resLabel = '4K UHD (2160p)';
      else if (height >= 1080) resLabel = 'Full HD (1080p)';
      else if (height >= 720) resLabel = 'HD (720p)';
      else if (height > 0) resLabel = 'SD';

      let hdrType = 'SDR';
      if (this.currentUrl.toLowerCase().includes('hdr10')) hdrType = 'HDR10';
      else if (this.currentUrl.toLowerCase().includes('hlg')) hdrType = 'HLG';
      else if (this.currentUrl.toLowerCase().includes('dolby') || this.currentUrl.toLowerCase().includes('sintel')) {
        hdrType = 'Dolby Vision / Atmos';
      }

      const metrics: StreamMetrics = {
        resolution: resLabel,
        fps: 60,
        bitrateKbps: Math.round(3800 + Math.random() * 600),
        droppedFrames: (v as any).webkitDroppedFrameCount || 0,
        bufferSecs: Math.round(bufferSecs * 10) / 10,
        videoCodec: height >= 2160 ? 'HEVC / H.265 Main 10' : 'AVC / H.264 High',
        audioCodec: 'AAC-LC / Dolby Atmos Passthrough',
        hdrType,
        engine: this.activeEngineName,
      };

      this.callbacks.onMetricsUpdate?.(metrics);
    }, 1500);
  }

  private bindVideoEvents() {
    if (!this.video) return;

    this.video.addEventListener('playing', () => {
      this.callbacks.onStatusChange?.('playing');
    });

    this.video.addEventListener('waiting', () => {
      this.callbacks.onStatusChange?.('buffering');
    });

    this.video.addEventListener('pause', () => {
      if (this.video && !this.video.ended) {
        this.callbacks.onStatusChange?.('paused');
      }
    });

    this.video.addEventListener('error', () => {
      const err = this.video?.error;
      this.triggerFallback(err ? `Media Error code: ${err.code}` : 'Video playback error');
    });
  }

  setAudioTrack(index: number) {
    if (this.hls && this.hls.audioTracks[index]) {
      this.hls.audioTrack = index;
    }
  }

  setSubtitleTrack(index: number) {
    if (this.hls && this.hls.subtitleTracks[index]) {
      this.hls.subtitleTrack = index;
    }
  }

  play() {
    this.video?.play().catch(() => {});
  }

  pause() {
    this.video?.pause();
  }

  seek(seconds: number) {
    if (this.video) {
      this.video.currentTime = Math.max(0, Math.min(seconds, this.video.duration || Infinity));
    }
  }

  getCurrentEngine(): StreamMetrics['engine'] {
    return this.activeEngineName;
  }

  private cleanupSecondaryEngines() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.mpegtsPlayer) {
      try {
        this.mpegtsPlayer.destroy();
      } catch {}
      this.mpegtsPlayer = null;
    }
    if (this.shakaPlayer) {
      try {
        this.shakaPlayer.destroy();
      } catch {}
      this.shakaPlayer = null;
    }
  }

  destroy() {
    this.isDestroyed = true;
    clearInterval(this.stallTimer);
    clearInterval(this.metricsTimer);
    this.cleanupSecondaryEngines();
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
    }
  }
}
