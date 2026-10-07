import { Channel, AppSettings, PlaylistSource, ReminderItem, AccentOption } from '../types/iptv';
import { DEFAULT_CHANNELS } from './DefaultChannels';

const CHANNELS_KEY = 'webos_iptv_channels_v1';
const PLAYLISTS_KEY = 'webos_iptv_playlists_v1';
const SETTINGS_KEY = 'webos_iptv_settings_v1';
const FAVORITES_KEY = 'webos_iptv_favorites_v1';
const RECENT_KEY = 'webos_iptv_recent_channels_v1';
const REMINDERS_KEY = 'webos_iptv_reminders_v1';

export const ACCENT_OPTIONS: AccentOption[] = [
  {
    id: 'teal',
    label: 'Teal Pro',
    hex: '#00d2ff',
    rgb: '0, 210, 255',
    description: 'Signature webOS electric teal, maximum OLED contrast & vivid focus glow',
  },
  {
    id: 'emerald',
    label: 'Emerald Jade',
    hex: '#10b981',
    rgb: '16, 185, 129',
    description: 'Vibrant natural emerald green, crisp and easy on the eyes',
  },
  {
    id: 'blue',
    label: 'Ocean Electric',
    hex: '#3b82f6',
    rgb: '59, 130, 246',
    description: 'Deep high-definition sapphire blue for a cinematic experience',
  },
  {
    id: 'purple',
    label: 'Royal Violet',
    hex: '#a855f7',
    rgb: '168, 85, 247',
    description: 'Sophisticated amethyst glow popular in luxury TV interfaces',
  },
  {
    id: 'gold',
    label: 'Sunset Amber',
    hex: '#f59e0b',
    rgb: '245, 158, 11',
    description: 'Warm golden amber, ideal for nighttime and low-light living rooms',
  },
  {
    id: 'ruby',
    label: 'Crimson Ruby',
    hex: '#ef4444',
    rgb: '239, 68, 68',
    description: 'High-energy cinematic scarlet red with intense presence',
  },
  {
    id: 'pink',
    label: 'Neon Rose',
    hex: '#ec4899',
    rgb: '236, 72, 153',
    description: 'Punchy magenta glow with modern OLED luminescence',
  },
  {
    id: 'coral',
    label: 'Solar Coral',
    hex: '#f97316',
    rgb: '249, 115, 22',
    description: 'Bright citrus coral orange with high daytime visibility',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontScale: 1,
  uiDensity: 'comfortable',
  playerEngine: 'native', // Default engine is Native HTML5 pipeline
  bufferSizeSec: 30,
  aggressiveBufferManagement: false,
  autoRecoveryRetries: 3,
  parentalPin: '0000',
  parentalControlActive: false,
  lockedCategories: ['Adult', 'XXX', '18+', 'For Adults'],
  lockedVodGenres: ['Adult', '18+'],
  lockedChannelIds: [],
  hideLockedContent: false,
  sleepTimerMinutes: 0,
  lanPort: 8080,
  activeLanguage: 'en',
  showLivePreview: true,
  accentColor: 'teal',
  accentColorHex: '#00d2ff',
  accentColorRgb: '0, 210, 255',
};

export class StorageService {
  static getChannels(): Channel[] {
    try {
      const raw = localStorage.getItem(CHANNELS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_CHANNELS;
  }

  static saveChannels(channels: Channel[]) {
    try {
      // Keep only up to 5,000 channels in primary memory store to stay within webOS bounds
      const bounded = channels.slice(0, 5000);
      localStorage.setItem(CHANNELS_KEY, JSON.stringify(bounded));
    } catch (e) {
      console.warn('Storage quota exceeded, pruning channels', e);
    }
  }

  static getPlaylists(): PlaylistSource[] {
    try {
      const raw = localStorage.getItem(PLAYLISTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [
      {
        id: 'default-curated',
        name: 'Curated UHD & News Live',
        type: 'm3u_url',
        enabled: true,
        channelCount: DEFAULT_CHANNELS.length,
        lastUpdated: Date.now(),
      },
    ];
  }

  static savePlaylists(playlists: PlaylistSource[]) {
    try {
      localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
    } catch (e) {
      console.error('Failed to save playlists', e);
    }
  }

  static getSettings(): AppSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  }

  static saveSettings(settings: AppSettings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }

  static getFavoriteIds(): string[] {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return DEFAULT_CHANNELS.filter(c => c.isFavorite).map(c => c.id);
  }

  static toggleFavorite(channelId: string): string[] {
    const favs = this.getFavoriteIds();
    const idx = favs.indexOf(channelId);
    let updated: string[];
    if (idx !== -1) {
      updated = favs.filter(id => id !== channelId);
    } else {
      updated = [...favs, channelId];
    }
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    return updated;
  }

  static getRecentChannelIds(): string[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [];
  }

  static addRecentChannel(channelId: string) {
    try {
      const recents = this.getRecentChannelIds().filter(id => id !== channelId);
      recents.unshift(channelId);
      localStorage.setItem(RECENT_KEY, JSON.stringify(recents.slice(0, 20)));
    } catch {
      // ignore
    }
  }

  static getReminders(): ReminderItem[] {
    try {
      const raw = localStorage.getItem(REMINDERS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [];
  }

  static addReminder(reminder: ReminderItem) {
    const list = this.getReminders().filter(r => r.id !== reminder.id);
    list.push(reminder);
    try {
      localStorage.setItem(REMINDERS_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  static removeReminder(id: string) {
    const list = this.getReminders().filter(r => r.id !== id);
    try {
      localStorage.setItem(REMINDERS_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }
}
