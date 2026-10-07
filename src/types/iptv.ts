export interface Channel {
  id: string;
  num: number;
  name: string;
  logo?: string;
  group: string;
  streamUrl: string;
  epgId?: string;
  isFavorite?: boolean;
  isHidden?: boolean;
  catchupDays?: number;
  catchupSource?: string;
  hdr?: 'SDR' | 'HDR10' | 'HLG' | 'DolbyVision';
  resolution?: '4K' | '1080p' | '720p' | 'SD';
  codec?: string;        // e.g. 'HEVC / H.265', 'H.264 / AVC', 'AV1'
  audioCodec?: string;   // e.g. 'Dolby Atmos', 'E-AC3 5.1', 'AAC-LC'
  bitrateKbps?: number;  // e.g. 14500, 8200, 4500
  fps?: number;          // e.g. 50, 60, 24
}

export interface Program {
  id: string;
  channelId: string;
  title: string;
  description: string;
  start: number; // Unix timestamp in ms
  end: number;   // Unix timestamp in ms
  category?: string;
  poster?: string;
  rating?: string;
}

export interface VodItem {
  id: string;
  title: string;
  type: 'movie' | 'series';
  poster?: string;
  backdrop?: string;
  rating?: number;
  year?: string;
  genre?: string;
  plot?: string;
  streamUrl: string;
  duration?: number; // seconds
  watchProgressSec?: number; // Continue watching progress
  inWatchlist?: boolean;
  seasons?: {
    seasonNumber: number;
    episodes: {
      id: string;
      episodeNumber: number;
      title: string;
      streamUrl: string;
      duration?: number;
      overview?: string;
    }[];
  }[];
}

export interface PlaylistSource {
  id: string;
  name: string;
  type: 'm3u_url' | 'm3u_file' | 'xtream';
  url?: string;
  content?: string;
  xtreamConfig?: {
    host: string;
    user: string;
    pass: string;
  };
  enabled: boolean;
  lastUpdated?: number;
  channelCount?: number;
}

export type PlayerEngineType = 'native' | 'hls' | 'mpegts' | 'shaka' | 'auto';

export interface StreamMetrics {
  resolution: string;
  fps: number;
  bitrateKbps: number;
  droppedFrames: number;
  bufferSecs: number;
  videoCodec: string;
  audioCodec: string;
  hdrType: string;
  engine: 'Native HTML5' | 'hls.js' | 'mpegts.js' | 'Shaka Player';
}

export interface MediaTrack {
  id: number;
  name: string;
  lang: string;
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error';

export type AppTab = 'home' | 'live' | 'epg' | 'vod' | 'series' | 'favorites' | 'settings';

export type AppTheme = 'dark' | 'light' | 'oled' | 'soft_dark';
export type UiDensity = 'comfortable' | 'compact';
export type AccentColorId = 'teal' | 'emerald' | 'blue' | 'purple' | 'gold' | 'ruby' | 'pink' | 'coral';

export interface AccentOption {
  id: AccentColorId;
  label: string;
  hex: string;
  rgb: string;
  description: string;
}

export interface AppSettings {
  theme: AppTheme; // 'dark' (default), 'oled', 'soft_dark', 'light'
  accentColor: AccentColorId;
  accentColorHex: string;
  accentColorRgb?: string;
  fontScale: number; // 0.85 to 1.50
  uiDensity: UiDensity; // 'comfortable' or 'compact'
  playerEngine: PlayerEngineType; // Default = 'native'
  bufferSizeSec: number;
  aggressiveBufferManagement?: boolean; // Tighter buffer eviction, low latency & memory protection
  autoRecoveryRetries: number;
  parentalPin: string;
  parentalControlActive: boolean;
  lockedCategories?: string[]; // Channel categories / groups hidden or locked by PIN
  lockedVodGenres?: string[]; // VOD genres or categories hidden or locked by PIN
  lockedChannelIds?: string[]; // Individual channel IDs locked by PIN
  hideLockedContent?: boolean; // Whether to completely hide locked channels and VODs from list
  sleepTimerMinutes?: number; // Configured sleep timer duration (minutes, e.g. 30, 60, 90, 120)
  lanPort: number;
  activeLanguage: string;
  showLivePreview: boolean;
}

export interface ReminderItem {
  id: string;
  channelId: string;
  channelName: string;
  programTitle: string;
  startTime: number;
}
