import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, PlaylistSource, Channel, VodItem } from '../../types/iptv';
import { StorageService, ACCENT_OPTIONS } from '../../services/StorageService';
import { LanCompanionService } from '../../services/LanCompanionService';
import { PlaylistParser } from '../../services/PlaylistParser';
import { XtreamService } from '../../services/XtreamService';
import { StreamingPlaylistParser, StreamingParseProgress } from '../../services/StreamingPlaylistParser';
import { IndexedDbService } from '../../services/IndexedDbService';
import {
  Sliders,
  Palette,
  Tv,
  QrCode,
  Shield,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  Upload,
  Globe,
  Lock,
  Cpu,
  Info,
  Sparkles,
  Zap,
  Gauge,
  Activity,
  RotateCcw,
  Minus,
  Wifi,
  HardDrive,
  Film,
  Clapperboard,
  Flame,
  Eye,
  EyeOff,
  Moon,
  Clock,
  ShieldAlert,
  Unlock,
  AlertTriangle,
} from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  playlists: PlaylistSource[];
  channels: Channel[];
  onUpdateSettings: (newSettings: AppSettings) => void;
  onUpdatePlaylists: (newPlaylists: PlaylistSource[]) => void;
  onImportChannels: (newChannels: Channel[], sourceName: string) => void;
  onImportCatalog?: (
    result: { channels: Channel[]; movies: VodItem[]; series: VodItem[]; groups: string[] },
    sourceName: string
  ) => void;
  onClearDatabase?: () => void;
  sleepTimerRemainingSec?: number | null;
  onSetSleepTimer?: (minutes: number) => void;
  onCancelSleepTimer?: () => void;
}

const BUFFER_PRESETS = [
  { sec: 5, label: '5s', name: 'Ultra-Low', category: 'Live Sports', desc: 'Minimal latency behind broadcast edge (Fiber / Sports)' },
  { sec: 10, label: '10s', name: 'Low Latency', category: 'Fast Zapping', desc: 'Rapid channel surfing with light cushion' },
  { sec: 15, label: '15s', name: 'Responsive', category: 'Broadband', desc: 'Optimal responsiveness on stable home broadband' },
  { sec: 20, label: '20s', name: 'Standard', category: 'Everyday', desc: 'Smooth everyday playback with stall protection' },
  { sec: 25, label: '25s', name: 'Resilient', category: 'Wi-Fi Guard', desc: 'Cushions home Wi-Fi traffic and packet jitter' },
  { sec: 30, label: '30s', name: 'Balanced', category: 'Recommended', desc: 'Default balance between latency & stability' },
];

function getBufferProfile(sec: number) {
  if (sec <= 5) {
    return {
      tag: 'Ultra-Low Latency',
      icon: '⚡',
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      description: 'Ultra-responsive playback with minimal delay behind broadcast edge. Best for high-speed fiber & live sports.',
      latency: '±1–3s live delay',
      profile: 'Instant Sports Mode',
    };
  }
  if (sec <= 10) {
    return {
      tag: 'Fast Zapping',
      icon: '⚡',
      badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      description: 'Quick channel zapping with a light network cushion. Recommended for good broadband.',
      latency: '±3–7s live delay',
      profile: 'Fast Channel Surfing',
    };
  }
  if (sec <= 15) {
    return {
      tag: 'Responsive Broadband',
      icon: '⚡',
      badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      description: 'Quick channel browsing on stable home internet with good cushion.',
      latency: '±7–12s live delay',
      profile: 'Responsive Broadband',
    };
  }
  if (sec <= 20) {
    return {
      tag: 'Standard Everyday',
      icon: '✓',
      badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      description: 'Smooth everyday playback with good resilience against household Wi-Fi drops.',
      latency: '±12–18s live delay',
      profile: 'Everyday Stable',
    };
  }
  return {
    tag: 'Balanced Standard (Recommended)',
    icon: '✓',
    badgeClass: 'bg-[var(--tv-accent-subtle)] text-[var(--tv-accent)] border-[var(--tv-accent-border)]',
    description: 'Optimal balance of swift channel changes and robust buffer protection against stream stalls.',
    latency: '±15–25s live delay',
    profile: 'Standard IPTV Default',
  };
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  playlists,
  channels,
  onUpdateSettings,
  onUpdatePlaylists,
  onImportChannels,
  onImportCatalog,
  onClearDatabase,
  sleepTimerRemainingSec,
  onSetSleepTimer,
  onCancelSleepTimer,
}) => {
  const [activeSection, setActiveSection] = useState<
    'sources' | 'playback' | 'theme' | 'lan' | 'parental' | 'database' | 'about'
  >('sources');

  // Parental controls states
  const [showPin, setShowPin] = useState(false);
  const [pinInput, setPinInput] = useState(settings.parentalPin || '0000');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [customVodGenreInput, setCustomVodGenreInput] = useState('');
  const [parentalNotice, setParentalNotice] = useState<string | null>(null);

  // Sleep timer custom slider state (minutes)
  const [customSleepMinutes, setCustomSleepMinutes] = useState(settings.sleepTimerMinutes || 30);

  // New Playlist form states
  const [m3uUrl, setM3uUrl] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [parseProgress, setParseProgress] = useState<StreamingParseProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [dbStats, setDbStats] = useState<{
    channelsCount: number;
    moviesCount: number;
    seriesCount: number;
  } | null>(null);

  useEffect(() => {
    IndexedDbService.getStats().then(setDbStats);
  }, [channels.length]);

  // Xtream Form states
  const [xtreamHost, setXtreamHost] = useState('');
  const [xtreamUser, setXtreamUser] = useState('');
  const [xtreamPass, setXtreamPass] = useState('');
  const [xtreamLoading, setXtreamLoading] = useState(false);

  // QR Code state
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [pendingMobileCreds, setPendingMobileCreds] = useState<any | null>(null);
  const companionUrl = `http://${LanCompanionService.getEstimatedLanIp()}:${settings.lanPort || 8080}`;

  useEffect(() => {
    LanCompanionService.generateQrCode(companionUrl).then(setQrDataUrl);
  }, [companionUrl, settings.lanPort]);

  // Poll companion service for credentials sent from mobile device
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      const creds = await LanCompanionService.fetchPendingCredentials(settings.lanPort || 8080);
      if (creds) {
        setPendingMobileCreds(creds);
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [settings.lanPort]);

  const handleApplyPendingCredentials = async () => {
    if (!pendingMobileCreds) return;
    try {
      if (pendingMobileCreds.type === 'xtream' && pendingMobileCreds.xtreamConfig) {
        const { host, user, pass } = pendingMobileCreds.xtreamConfig;
        const service = new XtreamService({ host, user, pass });
        await service.authenticate();
        const liveStreams = await service.getLiveStreams();
        const newSource: PlaylistSource = {
          id: `xtream-${Date.now()}`,
          name: pendingMobileCreds.name || `Xtream: ${user}`,
          type: 'xtream',
          xtreamConfig: { host, user, pass },
          enabled: true,
          channelCount: liveStreams.length,
          lastUpdated: Date.now(),
        };
        onUpdatePlaylists([...playlists, newSource]);
        onImportChannels(liveStreams, newSource.name);
      } else if (pendingMobileCreds.type === 'm3u_url' && pendingMobileCreds.url) {
        const res = await fetch(pendingMobileCreds.url);
        const text = await res.text();
        const { channels: parsed } = PlaylistParser.parseM3U(text);
        const newSource: PlaylistSource = {
          id: `m3u-${Date.now()}`,
          name: pendingMobileCreds.name || 'Mobile Pushed Playlist',
          type: 'm3u_url',
          url: pendingMobileCreds.url,
          enabled: true,
          channelCount: parsed.length,
          lastUpdated: Date.now(),
        };
        onUpdatePlaylists([...playlists, newSource]);
        onImportChannels(parsed, newSource.name);
      } else if (pendingMobileCreds.type === 'm3u_file' && pendingMobileCreds.content) {
        const { channels: parsed } = PlaylistParser.parseM3U(pendingMobileCreds.content);
        const newSource: PlaylistSource = {
          id: `file-${Date.now()}`,
          name: pendingMobileCreds.name || 'Mobile Pushed File',
          type: 'm3u_file',
          enabled: true,
          channelCount: parsed.length,
          lastUpdated: Date.now(),
        };
        onUpdatePlaylists([...playlists, newSource]);
        onImportChannels(parsed, newSource.name);
      }

      await LanCompanionService.clearPendingCredentials(settings.lanPort || 8080);
      setPendingMobileCreds(null);
    } catch (err: any) {
      alert('Error importing credentials from mobile: ' + (err.message || 'Unknown error'));
    }
  };

  // Import M3U from URL (supports massive playlists up to 900MB+)
  const handleImportM3uUrl = async () => {
    if (!m3uUrl.trim()) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsImporting(true);
    setImportStatus('Connecting and streaming playlist from URL...');

    try {
      const result = await StreamingPlaylistParser.parseUrlStream(
        m3uUrl.trim(),
        (progress) => setParseProgress(progress),
        controller.signal
      );

      if (result.channels.length === 0 && result.movies.length === 0 && result.series.length === 0) {
        throw new Error('No valid streams found in playlist.');
      }

      setImportStatus('Saving catalog to high-capacity IndexedDB...');
      await Promise.all([
        IndexedDbService.saveChannels(result.channels),
        IndexedDbService.saveVodMovies(result.movies),
        IndexedDbService.saveVodSeries(result.series),
      ]);

      const newSource: PlaylistSource = {
        id: `m3u-${Date.now()}`,
        name: playlistName.trim() || 'M3U Web Stream',
        type: 'm3u_url',
        url: m3uUrl.trim(),
        enabled: true,
        channelCount: result.channels.length,
        lastUpdated: Date.now(),
      };

      onUpdatePlaylists([...playlists, newSource]);
      if (onImportCatalog) {
        onImportCatalog(result, newSource.name);
      } else {
        onImportChannels(result.channels, newSource.name);
      }

      setImportStatus(
        `Successfully indexed ${result.channels.length.toLocaleString()} channels, ${result.movies.length.toLocaleString()} movies, and ${result.series.length.toLocaleString()} TV series!`
      );
      setM3uUrl('');
      setPlaylistName('');
      const updatedStats = await IndexedDbService.getStats();
      setDbStats(updatedStats);
    } catch (err: any) {
      setImportStatus(err.message === 'Parsing cancelled by user' ? 'Import cancelled.' : `Failed: ${err.message || 'Network error'}`);
    } finally {
      setIsImporting(false);
      setParseProgress(null);
      abortControllerRef.current = null;
    }
  };

  // Upload M3U File from local disk (chunked stream processing for 900MB+ files)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsImporting(true);
    const mbSize = (file.size / (1024 * 1024)).toFixed(1);
    setImportStatus(`Initializing streaming parser for ${file.name} (${mbSize} MB)...`);

    try {
      const result = await StreamingPlaylistParser.parseFileStream(
        file,
        (progress) => setParseProgress(progress),
        controller.signal
      );

      setImportStatus('Saving to high-capacity IndexedDB...');
      await Promise.all([
        IndexedDbService.saveChannels(result.channels),
        IndexedDbService.saveVodMovies(result.movies),
        IndexedDbService.saveVodSeries(result.series),
      ]);

      const newSource: PlaylistSource = {
        id: `file-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        type: 'm3u_file',
        enabled: true,
        channelCount: result.channels.length,
        lastUpdated: Date.now(),
      };

      onUpdatePlaylists([...playlists, newSource]);
      if (onImportCatalog) {
        onImportCatalog(result, newSource.name);
      } else {
        onImportChannels(result.channels, newSource.name);
      }

      setImportStatus(
        `Loaded ${result.channels.length.toLocaleString()} channels, ${result.movies.length.toLocaleString()} movies, and ${result.series.length.toLocaleString()} series!`
      );
      const updatedStats = await IndexedDbService.getStats();
      setDbStats(updatedStats);
    } catch (err: any) {
      setImportStatus(err.message === 'Parsing cancelled by user' ? 'Import cancelled.' : `Error: ${err.message}`);
    } finally {
      setIsImporting(false);
      setParseProgress(null);
      abortControllerRef.current = null;
    }
  };

  // Connect Xtream Codes
  const handleConnectXtream = async () => {
    if (!xtreamHost.trim() || !xtreamUser.trim() || !xtreamPass.trim()) return;
    setXtreamLoading(true);
    setImportStatus('Authenticating with Xtream server...');

    try {
      const service = new XtreamService({
        host: xtreamHost.trim(),
        user: xtreamUser.trim(),
        pass: xtreamPass.trim(),
      });

      await service.authenticate();
      setImportStatus('Connected! Fetching live streams...');
      const liveStreams = await service.getLiveStreams();

      const newSource: PlaylistSource = {
        id: `xtream-${Date.now()}`,
        name: `Xtream: ${xtreamUser}`,
        type: 'xtream',
        xtreamConfig: {
          host: xtreamHost.trim(),
          user: xtreamUser.trim(),
          pass: xtreamPass.trim(),
        },
        enabled: true,
        channelCount: liveStreams.length,
        lastUpdated: Date.now(),
      };

      onUpdatePlaylists([...playlists, newSource]);
      onImportChannels(liveStreams, newSource.name);
      setImportStatus(`Connected! Imported ${liveStreams.length} live channels.`);
      setXtreamHost('');
      setXtreamUser('');
      setXtreamPass('');
    } catch (err: any) {
      setImportStatus(`Xtream error: ${err.message || 'Check host, user and password'}`);
    } finally {
      setXtreamLoading(false);
    }
  };

  const themes: { id: AppSettings['theme']; label: string; bg: string; accent: string }[] = [
    { id: 'dark', label: 'Dark Obsidian', bg: '#0a0a0e', accent: '#00d2ff' },
    { id: 'oled', label: 'OLED Pure Black', bg: '#000000', accent: '#00d2ff' },
    { id: 'soft_dark', label: 'Soft Charcoal', bg: '#12141a', accent: '#3b82f6' },
    { id: 'light', label: 'High Contrast Daytime', bg: '#e5e7eb', accent: '#00d2ff' },
  ];

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0a0a0c]">
      {/* Settings Left Navigation */}
      <div className="w-72 border-r border-white/10 bg-[#0f0f14]/80 p-6 flex flex-col shrink-0">
        <h2 className="text-xl font-black text-white mb-6 flex items-center space-x-2">
          <Sliders className="w-5 h-5 text-[var(--tv-accent)]" />
          <span>Settings</span>
        </h2>

        <div className="space-y-1.5 flex-1">
          <button
            onClick={() => setActiveSection('sources')}
            className={`tv-focusable w-full p-3.5 rounded-2xl text-left text-xs font-bold flex items-center space-x-3 transition-colors ${
              activeSection === 'sources'
                ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                : 'text-zinc-300 hover:bg-white/10'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Playlist Sources ({playlists.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('playback')}
            className={`tv-focusable w-full p-3.5 rounded-2xl text-left text-xs font-bold flex items-center space-x-3 transition-colors ${
              activeSection === 'playback'
                ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                : 'text-zinc-300 hover:bg-white/10'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Player Engine & DVR</span>
          </button>

          <button
            onClick={() => setActiveSection('theme')}
            className={`tv-focusable w-full p-3.5 rounded-2xl text-left text-xs font-bold flex items-center space-x-3 transition-colors ${
              activeSection === 'theme'
                ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                : 'text-zinc-300 hover:bg-white/10'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Display, Themes & Scale</span>
          </button>

          <button
            onClick={() => setActiveSection('lan')}
            className={`tv-focusable w-full p-3.5 rounded-2xl text-left text-xs font-bold flex items-center space-x-3 transition-colors ${
              activeSection === 'lan'
                ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                : 'text-zinc-300 hover:bg-white/10'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>LAN Mobile Companion</span>
          </button>

          <button
            onClick={() => setActiveSection('parental')}
            className={`tv-focusable w-full p-3.5 rounded-2xl text-left text-xs font-bold flex items-center space-x-3 transition-colors ${
              activeSection === 'parental'
                ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                : 'text-zinc-300 hover:bg-white/10'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Parental PIN Lock</span>
          </button>

          <button
            onClick={() => setActiveSection('database')}
            className={`tv-focusable w-full p-3.5 rounded-2xl text-left text-xs font-bold flex items-center space-x-3 transition-colors ${
              activeSection === 'database'
                ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                : 'text-zinc-300 hover:bg-white/10'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Database & Large Lists</span>
          </button>

          <button
            onClick={() => setActiveSection('about')}
            className={`tv-focusable w-full p-3.5 rounded-2xl text-left text-xs font-bold flex items-center space-x-3 transition-colors ${
              activeSection === 'about'
                ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                : 'text-zinc-300 hover:bg-white/10'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>System Diagnostics</span>
          </button>
        </div>

        <div className="pt-4 border-t border-white/10 text-[11px] text-zinc-500">
          Total Channels: {channels.length}
        </div>
      </div>

      {/* Settings Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Section 1: Playlist Sources */}
        {activeSection === 'sources' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Playlist & Xtream Sources</h3>
              <p className="text-xs text-zinc-400">
                Manage your M3U playlists, Xtream Codes credentials, or upload files directly.
              </p>
            </div>

            {/* Active Sources Cards */}
            <div className="space-y-3">
              {playlists.map((pl) => (
                <div
                  key={pl.id}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-bold text-white flex items-center space-x-2">
                      <span>{pl.name}</span>
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] uppercase font-bold">
                        {pl.type}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      {pl.channelCount || 0} channels loaded
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        const updated = playlists.filter(p => p.id !== pl.id);
                        onUpdatePlaylists(updated);
                      }}
                      className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400"
                      title="Delete playlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add M3U URL Form */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Add M3U / M3U8 Playlist URL</span>
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Playlist Name (e.g. My Provider Live)"
                  value={playlistName}
                  onChange={e => setPlaylistName(e.target.value)}
                  className="bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                />
                <input
                  type="url"
                  placeholder="https://example.com/playlist.m3u8"
                  value={m3uUrl}
                  onChange={e => setM3uUrl(e.target.value)}
                  className="bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="tv-focusable cursor-pointer px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center space-x-2">
                  <Upload className="w-4 h-4" />
                  <span>Upload .m3u File</span>
                  <input
                    type="file"
                    accept=".m3u,.m3u8,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleImportM3uUrl}
                  disabled={isImporting || !m3uUrl.trim()}
                  className="tv-focusable px-6 py-2.5 rounded-xl bg-[var(--tv-accent)] hover:brightness-110 disabled:opacity-50 text-black font-extrabold text-xs flex items-center space-x-2 shadow-lg shadow-[var(--tv-accent-glow)]"
                >
                  {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Import Playlist</span>
                </button>
              </div>

              {importStatus && (
                <div className="text-xs font-semibold text-[var(--tv-accent)] pt-2">{importStatus}</div>
              )}
            </div>

            {/* Xtream Codes Section */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <Tv className="w-4 h-4 text-[var(--tv-accent)]" />
                <span>Connect Xtream Codes API Account</span>
              </h4>

              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Server URL (http://domain:port)"
                  value={xtreamHost}
                  onChange={e => setXtreamHost(e.target.value)}
                  className="bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--tv-accent)]"
                />
                <input
                  type="text"
                  placeholder="Username"
                  value={xtreamUser}
                  onChange={e => setXtreamUser(e.target.value)}
                  className="bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--tv-accent)]"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={xtreamPass}
                  onChange={e => setXtreamPass(e.target.value)}
                  className="bg-black/40 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--tv-accent)]"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleConnectXtream}
                  disabled={xtreamLoading}
                  className="tv-focusable px-6 py-2.5 rounded-xl bg-[var(--tv-accent)] hover:brightness-110 disabled:opacity-50 text-black font-extrabold text-xs flex items-center space-x-2 shadow-md shadow-[var(--tv-accent-glow)]"
                >
                  {xtreamLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Connect Xtream</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Playback Engine & DVR */}
        {activeSection === 'playback' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Playback Pipeline & Engine Selection</h3>
              <p className="text-xs text-zinc-400">
                Choose your media playback engine. Default is the native hardware decoding pipeline.
              </p>
            </div>

            {/* 5 User-Selectable Engines */}
            <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">Selected Player Engine</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--tv-accent-subtle)] text-[var(--tv-accent)] border border-[var(--tv-accent-border)] text-[11px] font-bold uppercase">
                  Active: {settings.playerEngine.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    id: 'native' as const,
                    title: 'Native HTML5 Pipeline (Default & Recommended)',
                    desc: 'Direct video.src assignment. Maximum hardware decoding efficiency, zero dropped frames, native HDR10 / HLG / Dolby Vision, and Dolby Atmos passthrough. Lowest CPU usage.',
                    badge: 'Default • Best Quality & Passthrough',
                    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                  },
                  {
                    id: 'auto' as const,
                    title: 'Auto Intelligent Selection',
                    desc: 'Smart protocol detection. Prefers Native for HLS and progressive streams, switches to mpegts.js for raw HTTP TS streams, and loads Shaka for MPEG-DASH manifests.',
                    badge: 'Smart Switching',
                    badgeColor: 'bg-[var(--tv-accent-subtle)] text-[var(--tv-accent)] border-[var(--tv-accent-border)]',
                  },
                  {
                    id: 'hls' as const,
                    title: 'hls.js (MSE Engine)',
                    desc: 'Advanced JavaScript demuxer for complex HLS manifests, alternate audio renditions, WebVTT subtitle tracks, and Low-Latency HLS.',
                    badge: 'Multi-Audio & Low-Latency',
                    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                  },
                  {
                    id: 'mpegts' as const,
                    title: 'mpegts.js (Raw Transport Stream)',
                    desc: 'Specialist demuxer for raw MPEG-TS over HTTP streams. Converts transport stream packets to ISO BMFF FMP4 segments on the fly.',
                    badge: 'Direct .ts Feeds',
                    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                  },
                  {
                    id: 'shaka' as const,
                    title: 'Shaka Player (MPEG-DASH & DRM)',
                    desc: 'Google Shaka Player engine loaded on-demand for MPEG-DASH (.mpd) manifests, ClearKey, and Widevine EME content protection.',
                    badge: 'DASH & DRM Capable',
                    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                  },
                ].map((engine) => {
                  const isSelected = settings.playerEngine === engine.id;
                  return (
                    <div
                      key={engine.id}
                      onClick={() => {
                        const updated: AppSettings = { ...settings, playerEngine: engine.id };
                        onUpdateSettings(updated);
                        StorageService.saveSettings(updated);
                      }}
                      className={`tv-focusable p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[var(--tv-accent-subtle)] border-[var(--tv-accent)] shadow-lg shadow-[var(--tv-accent-glow)]'
                          : 'bg-black/30 border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-[var(--tv-accent)] bg-[var(--tv-accent)]' : 'border-zinc-500'
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black"></div>}
                          </div>
                          <span className={`text-sm font-bold ${isSelected ? 'text-[var(--tv-accent)]' : 'text-white'}`}>
                            {engine.title}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${engine.badgeColor}`}>
                          {engine.badge}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 pl-6 leading-relaxed">
                        {engine.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Buffer Size with Slider and Numeric Input (5s to 30s) */}
            {(() => {
              const currentSec = Math.max(5, Math.min(30, settings.bufferSizeSec || 15));
              const bufferProfile = getBufferProfile(currentSec);
              const sliderPercent = Math.max(0, Math.min(100, ((currentSec - 5) / (30 - 5)) * 100));

              return (
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
                  {/* Header and Live Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[var(--tv-accent-subtle)] border border-[var(--tv-accent-border)] flex items-center justify-center text-[var(--tv-accent)]">
                          <Gauge className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-base font-bold text-white flex items-center space-x-2">
                            <span>Dynamic Playback Buffer Size</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${bufferProfile.badgeClass}`}>
                              {bufferProfile.icon} {bufferProfile.tag}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-400">
                            {bufferProfile.description}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Numeric Input & Current Value Display */}
                    <div className="flex items-center space-x-3 shrink-0">
                      <div className="px-3.5 py-2 rounded-xl bg-black/60 border border-white/15 flex items-center space-x-2.5">
                        <div className="text-right">
                          <div className="text-[9px] uppercase tracking-wider font-bold text-zinc-400">Buffer Size</div>
                          <div className="flex items-center space-x-1 justify-end">
                            <input
                              type="number"
                              min="5"
                              max="30"
                              step="1"
                              value={currentSec}
                              onChange={(e) => {
                                const parsed = parseInt(e.target.value, 10);
                                if (!isNaN(parsed)) {
                                  const clamped = Math.max(5, Math.min(30, parsed));
                                  const updated = { ...settings, bufferSizeSec: clamped };
                                  onUpdateSettings(updated);
                                  StorageService.saveSettings(updated);
                                }
                              }}
                              className="w-16 bg-white/10 border border-white/20 rounded-lg px-2 py-0.5 text-center font-mono text-xl font-black text-[var(--tv-accent)] focus:outline-none focus:border-[var(--tv-accent)] focus:bg-black/80"
                              title="Enter numeric buffer size in seconds (5 to 30)"
                            />
                            <span className="text-xs font-bold text-zinc-300 font-mono">sec</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Real-time Dynamic Metrics Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-black/40 border border-white/5 text-xs">
                    <div className="flex items-center space-x-2 text-zinc-300">
                      <Zap className="w-3.5 h-3.5 text-[var(--tv-accent)] shrink-0" />
                      <div>
                        <div className="text-[10px] text-zinc-400">Live Delay</div>
                        <div className="font-semibold text-white">{bufferProfile.latency}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-zinc-300">
                      <HardDrive className="w-3.5 h-3.5 text-[var(--tv-accent)] shrink-0" />
                      <div>
                        <div className="text-[10px] text-zinc-400">Estimated Cache</div>
                        <div className="font-semibold text-white">~{Math.round(currentSec * 1.8)} MB RAM</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-zinc-300">
                      <Activity className="w-3.5 h-3.5 text-[var(--tv-accent)] shrink-0" />
                      <div>
                        <div className="text-[10px] text-zinc-400">Profile Mode</div>
                        <div className="font-semibold text-white truncate">{bufferProfile.profile}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-zinc-300">
                      <Cpu className="w-3.5 h-3.5 text-[var(--tv-accent)] shrink-0" />
                      <div>
                        <div className="text-[10px] text-zinc-400">Active Engine</div>
                        <div className="font-semibold text-white capitalize">{settings.playerEngine}</div>
                      </div>
                    </div>
                  </div>

                  {/* Synchronized Slider and Steppers (5s to 30s) */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="flex items-center space-x-1.5 font-medium text-white">
                        <span>Buffer Slider & Steppers</span>
                        <span className="text-[11px] font-mono text-[var(--tv-accent)] font-bold">5s – 30s</span>
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        Direct two-way binding with numeric input
                      </span>
                    </div>

                    <div className="flex items-center space-x-2.5">
                      {/* Stepper Down -5s */}
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.max(5, currentSec - 5);
                          const updated = { ...settings, bufferSizeSec: next };
                          onUpdateSettings(updated);
                          StorageService.saveSettings(updated);
                        }}
                        className="tv-focusable px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors flex items-center space-x-1 shrink-0"
                        title="Decrease buffer by 5 seconds"
                      >
                        <Minus className="w-3 h-3" />
                        <span>5s</span>
                      </button>

                      {/* Stepper Down -1s */}
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.max(5, currentSec - 1);
                          const updated = { ...settings, bufferSizeSec: next };
                          onUpdateSettings(updated);
                          StorageService.saveSettings(updated);
                        }}
                        className="tv-focusable px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors flex items-center space-x-1 shrink-0"
                        title="Decrease buffer by 1 second"
                      >
                        <Minus className="w-3 h-3" />
                        <span>1s</span>
                      </button>

                      {/* Range Slider (5s to 30s) */}
                      <div className="flex-1 relative flex items-center px-1">
                        <input
                          type="range"
                          min="5"
                          max="30"
                          step="1"
                          value={currentSec}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            const updated = { ...settings, bufferSizeSec: val };
                            onUpdateSettings(updated);
                            StorageService.saveSettings(updated);
                          }}
                          className="w-full h-3 rounded-lg appearance-none cursor-pointer accent-[var(--tv-accent)] tv-focusable"
                          style={{
                            background: `linear-gradient(to right, var(--tv-accent) 0%, var(--tv-accent) ${sliderPercent}%, rgba(255,255,255,0.15) ${sliderPercent}%, rgba(255,255,255,0.15) 100%)`
                          }}
                        />
                      </div>

                      {/* Stepper Up +1s */}
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.min(30, currentSec + 1);
                          const updated = { ...settings, bufferSizeSec: next };
                          onUpdateSettings(updated);
                          StorageService.saveSettings(updated);
                        }}
                        className="tv-focusable px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors flex items-center space-x-1 shrink-0"
                        title="Increase buffer by 1 second"
                      >
                        <Plus className="w-3 h-3" />
                        <span>1s</span>
                      </button>

                      {/* Stepper Up +5s */}
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.min(30, currentSec + 5);
                          const updated = { ...settings, bufferSizeSec: next };
                          onUpdateSettings(updated);
                          StorageService.saveSettings(updated);
                        }}
                        className="tv-focusable px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors flex items-center space-x-1 shrink-0"
                        title="Increase buffer by 5 seconds"
                      >
                        <Plus className="w-3 h-3" />
                        <span>5s</span>
                      </button>

                      {/* Reset to 15s Default */}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...settings, bufferSizeSec: 15 };
                          onUpdateSettings(updated);
                          StorageService.saveSettings(updated);
                        }}
                        className="tv-focusable px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white text-xs font-bold transition-colors flex items-center space-x-1 shrink-0"
                        title="Reset to 15s default"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset 15s</span>
                      </button>
                    </div>

                    {/* Scale markers: 5s, 10s, 15s, 20s, 25s, 30s */}
                    <div className="flex justify-between text-[10px] font-mono text-zinc-500 px-2 pt-0.5">
                      <span className={currentSec === 5 ? 'text-[var(--tv-accent)] font-bold' : ''}>5s (Sports)</span>
                      <span className={currentSec === 10 ? 'text-[var(--tv-accent)] font-bold' : ''}>10s</span>
                      <span className={currentSec === 15 ? 'text-[var(--tv-accent)] font-bold' : ''}>15s (Responsive)</span>
                      <span className={currentSec === 20 ? 'text-[var(--tv-accent)] font-bold' : ''}>20s</span>
                      <span className={currentSec === 25 ? 'text-[var(--tv-accent)] font-bold' : ''}>25s</span>
                      <span className={currentSec === 30 ? 'text-[var(--tv-accent)] font-bold' : ''}>30s (Balanced)</span>
                    </div>
                  </div>

                  {/* Buffer Presets Buttons */}
                  <div className="space-y-2 pt-1">
                    <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Quick Buffer Presets (5s – 30s)</span>
                      <span className="text-[11px] text-zinc-400 font-normal">Click any profile to instantly configure</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {BUFFER_PRESETS.map((preset) => {
                        const isSelected = currentSec === preset.sec;
                        return (
                          <button
                            key={preset.sec}
                            type="button"
                            onClick={() => {
                              const updated = { ...settings, bufferSizeSec: preset.sec };
                              onUpdateSettings(updated);
                              StorageService.saveSettings(updated);
                            }}
                            className={`tv-focusable p-2.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                              isSelected
                                ? 'bg-[var(--tv-accent)] text-black border-[var(--tv-accent)] shadow-lg shadow-[var(--tv-accent-glow)] font-bold scale-[1.02]'
                                : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <span className={`text-sm font-black ${isSelected ? 'text-black' : 'text-white'}`}>
                                {preset.label}
                              </span>
                              {isSelected && (
                                <div className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center shrink-0">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              )}
                            </div>
                            <div className={`text-[11px] font-semibold truncate ${isSelected ? 'text-black/90' : 'text-zinc-200'}`}>
                              {preset.name}
                            </div>
                            <div className={`text-[9px] truncate ${isSelected ? 'text-black/75' : 'text-zinc-400'}`}>
                              {preset.category}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Aggressive Buffer Management Toggle Card */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      settings.aggressiveBufferManagement
                        ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                        : 'bg-white/10 border border-white/15 text-zinc-400'
                    }`}>
                      <Flame className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-white flex items-center space-x-2">
                        <span>Aggressive Buffer Management</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          settings.aggressiveBufferManagement
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-white/10 text-zinc-400 border-white/10'
                        }`}>
                          {settings.aggressiveBufferManagement ? '✓ ACTIVE' : 'DISABLED'}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400">
                        Dynamically evicts backward cache, caps MSE memory to 32MB, and actively chases the live broadcast edge.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Accessible TV Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!settings.aggressiveBufferManagement}
                  onClick={() => {
                    const updated = {
                      ...settings,
                      aggressiveBufferManagement: !settings.aggressiveBufferManagement,
                    };
                    onUpdateSettings(updated);
                    StorageService.saveSettings(updated);
                  }}
                  className={`tv-focusable relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.aggressiveBufferManagement
                      ? 'bg-[var(--tv-accent)] shadow-lg shadow-[var(--tv-accent-glow)]'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                  title="Toggle Aggressive Buffer Management"
                >
                  <span
                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      settings.aggressiveBufferManagement ? 'translate-x-8 bg-black' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Technical Specifications Matrix of Aggressive Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs">
                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center space-x-1">
                    <HardDrive className="w-3 h-3 text-[var(--tv-accent)]" />
                    <span>Memory Footprint Cap</span>
                  </div>
                  <div className="font-semibold text-white mt-1">
                    {settings.aggressiveBufferManagement ? (
                      <span className="text-emerald-400 font-mono">32 MB (Hard Eviction)</span>
                    ) : (
                      <span className="text-zinc-300 font-mono">128 MB (Relaxed MSE)</span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Prevents webOS out-of-memory crashes on continuous 4K 60fps feeds.
                  </p>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center space-x-1">
                    <RotateCcw className="w-3 h-3 text-[var(--tv-accent)]" />
                    <span>Backward Buffer Eviction</span>
                  </div>
                  <div className="font-semibold text-white mt-1">
                    {settings.aggressiveBufferManagement ? (
                      <span className="text-emerald-400 font-mono">&lt; 10s (Auto-Purge)</span>
                    ) : (
                      <span className="text-zinc-300 font-mono">30s (Default Buffer)</span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Clears past frames aggressively to keep decoding memory pristine.
                  </p>
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center space-x-1">
                    <Zap className="w-3 h-3 text-[var(--tv-accent)]" />
                    <span>Live-Edge Chasing</span>
                  </div>
                  <div className="font-semibold text-white mt-1">
                    {settings.aggressiveBufferManagement ? (
                      <span className="text-emerald-400 font-mono">Active (1.15x Catch-Up)</span>
                    ) : (
                      <span className="text-zinc-300 font-mono">Relaxed Growth</span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Locks stream to real-time live broadcast edge without latency creep.
                  </p>
                </div>
              </div>

              {/* Multi-Engine Dynamic Sync Notice */}
              <div className="text-[11px] text-zinc-400 bg-white/5 p-3 rounded-xl border border-white/5 flex items-start space-x-2">
                <Info className="w-4 h-4 text-[var(--tv-accent)] shrink-0 mt-0.5" />
                <span>
                  <strong>Dynamic Pipeline Sync:</strong> Changes to buffer size and aggressive mode are dynamically applied to the running <span className="font-bold uppercase text-white">{settings.playerEngine}</span> pipeline in real-time through <code className="text-[var(--tv-accent)] font-mono text-[10px]">PlaybackEngine</code> without restarting your stream.
                </span>
              </div>
            </div>

            <div className="space-y-3">

              {/* Live Preview Toggle */}
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">Live Channel Preview in Browser</div>
                  <div className="text-xs text-zinc-400">Plays selected channel in sidebar preview pane</div>
                </div>
                <button
                  onClick={() => {
                    const updated = { ...settings, showLivePreview: !settings.showLivePreview };
                    onUpdateSettings(updated);
                    StorageService.saveSettings(updated);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                    settings.showLivePreview
                      ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                      : 'bg-white/10 text-zinc-400'
                  }`}
                >
                  {settings.showLivePreview ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Auto Recovery Retries */}
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">Stall Watchdog Max Retries</div>
                  <div className="text-xs text-zinc-400">
                    Attempts to revive frozen streams (Soft Nudge → Engine Swap → Hard Reload)
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {[1, 3, 5].map(cnt => (
                    <button
                      key={cnt}
                      onClick={() => {
                        const updated = { ...settings, autoRecoveryRetries: cnt };
                        onUpdateSettings(updated);
                        StorageService.saveSettings(updated);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        settings.autoRecoveryRetries === cnt
                          ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                          : 'bg-white/10 text-zinc-300 hover:bg-white/15'
                      }`}
                    >
                      {cnt} Retries
                    </button>
                  ))}
                </div>
              </div>

              {/* Sleep Timer Setting & Live Countdown Control */}
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                      <Moon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center space-x-2">
                        <span>Sleep Timer & Auto Player Shutoff</span>
                        {sleepTimerRemainingSec && sleepTimerRemainingSec > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold animate-pulse flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>
                              {Math.floor(sleepTimerRemainingSec / 60)}m {sleepTimerRemainingSec % 60}s REMAINING
                            </span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-zinc-400 text-[10px] font-bold">
                            OFF
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400">
                        Automatically pauses playback and exits player to standby after a set duration.
                      </div>
                    </div>
                  </div>

                  {sleepTimerRemainingSec && sleepTimerRemainingSec > 0 && onCancelSleepTimer && (
                    <button
                      onClick={onCancelSleepTimer}
                      className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-bold transition-colors"
                    >
                      Cancel Active Timer
                    </button>
                  )}
                </div>

                {/* Duration Presets */}
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-2">
                    Quick Preset Durations
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {[
                      { min: 0, label: 'Off' },
                      { min: 30, label: '30 Min' },
                      { min: 60, label: '60 Min (1h)' },
                      { min: 90, label: '90 Min (1.5h)' },
                      { min: 120, label: '120 Min (2h)' },
                      { min: 180, label: '180 Min (3h)' },
                    ].map((p) => {
                      const isActivePreset = (settings.sleepTimerMinutes || 0) === p.min;
                      return (
                        <button
                          key={p.min}
                          onClick={() => {
                            setCustomSleepMinutes(p.min);
                            const updated = { ...settings, sleepTimerMinutes: p.min };
                            onUpdateSettings(updated);
                            StorageService.saveSettings(updated);
                            if (p.min > 0 && onSetSleepTimer) {
                              onSetSleepTimer(p.min);
                            } else if (p.min === 0 && onCancelSleepTimer) {
                              onCancelSleepTimer();
                            }
                          }}
                          className={`p-2.5 rounded-xl text-center text-xs font-bold border transition-all ${
                            isActivePreset
                              ? 'bg-[var(--tv-accent)] text-black border-[var(--tv-accent)] shadow-md shadow-[var(--tv-accent-glow)]'
                              : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Minutes Slider and Numeric Stepper */}
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300 font-semibold">Custom Duration</span>
                      <span className="font-mono font-bold text-[var(--tv-accent)]">
                        {customSleepMinutes > 0 ? `${customSleepMinutes} minutes` : 'Disabled'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={240}
                      step={15}
                      value={customSleepMinutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setCustomSleepMinutes(val);
                      }}
                      className="w-full accent-[var(--tv-accent)] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                      <span>Off</span>
                      <span>60m</span>
                      <span>120m</span>
                      <span>180m</span>
                      <span>240m (4h)</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => {
                        const val = Math.max(0, customSleepMinutes - 15);
                        setCustomSleepMinutes(val);
                      }}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
                      title="Decrease by 15 mins"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={240}
                      value={customSleepMinutes}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(240, parseInt(e.target.value, 10) || 0));
                        setCustomSleepMinutes(val);
                      }}
                      className="w-16 bg-black/60 border border-white/20 rounded-xl px-2 py-1.5 text-center font-mono font-bold text-xs text-white focus:outline-none focus:border-[var(--tv-accent)]"
                    />
                    <span className="text-xs text-zinc-400">min</span>
                    <button
                      onClick={() => {
                        const val = Math.min(240, customSleepMinutes + 15);
                        setCustomSleepMinutes(val);
                      }}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
                      title="Increase by 15 mins"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        const updated = { ...settings, sleepTimerMinutes: customSleepMinutes };
                        onUpdateSettings(updated);
                        StorageService.saveSettings(updated);
                        if (customSleepMinutes > 0 && onSetSleepTimer) {
                          onSetSleepTimer(customSleepMinutes);
                        } else if (customSleepMinutes === 0 && onCancelSleepTimer) {
                          onCancelSleepTimer();
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-[var(--tv-accent)] hover:brightness-110 text-black font-extrabold text-xs ml-2 shadow-md"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Themes & Display */}
        {activeSection === 'theme' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Visual Themes, Accents & Layout</h3>
              <p className="text-xs text-zinc-400">
                10-foot UI styling optimized for LG OLED panels, high contrast, and viewing distance.
              </p>
            </div>

            {/* Base Themes Grid */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                Base Theme (OLED Safe)
              </span>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'dark' as const, label: 'Dark Obsidian (Default)', desc: 'Balanced dark palette for living rooms', bg: '#0a0a0e', border: '#222' },
                  { id: 'oled' as const, label: 'Midnight Black (OLED Pure)', desc: 'Zero pixel illumination (#000) for OLED panels', bg: '#000000', border: '#1a1a1a' },
                  { id: 'soft_dark' as const, label: 'Soft Charcoal Dark', desc: 'Warm slate-gray tone gentle on the eyes', bg: '#12141a', border: '#2a303c' },
                  { id: 'light' as const, label: 'High Contrast Daytime', desc: 'Crisp light mode for bright sunlit rooms', bg: '#e5e7eb', border: '#cbd5e1' },
                ].map((th) => {
                  const isSelected = settings.theme === th.id;
                  return (
                    <div
                      key={th.id}
                      onClick={() => {
                        const updated: AppSettings = { ...settings, theme: th.id };
                        onUpdateSettings(updated);
                        StorageService.saveSettings(updated);
                        document.documentElement.setAttribute('data-theme', th.id);
                      }}
                      className={`tv-focusable p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[var(--tv-accent)] bg-white/10 shadow-lg'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-white">{th.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-[var(--tv-accent)]" />}
                      </div>
                      <p className="text-xs text-zinc-400 mb-3">{th.desc}</p>
                      <div
                        className="h-8 rounded-lg flex items-center px-3 space-x-2 border"
                        style={{ backgroundColor: th.bg, borderColor: th.border }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: settings.accentColorHex }}></span>
                        <span className="text-[10px] text-zinc-400 font-mono">10-Foot UI</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Accent Color Palette & System-Wide Customization */}
            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-white uppercase tracking-wider block flex items-center space-x-2">
                    <Palette className="w-4 h-4 text-[var(--tv-accent)]" />
                    <span>System-Wide Accent Color</span>
                  </span>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Select your preferred accent glow. Changes apply immediately system-wide across all menus, focus rings, guide, and player OSD.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full shadow-md transition-all duration-300"
                    style={{
                      backgroundColor: settings.accentColorHex || '#00d2ff',
                      boxShadow: `0 0 12px ${settings.accentColorHex || '#00d2ff'}`,
                    }}
                  ></span>
                  <span className="text-xs font-bold text-white capitalize">
                    {ACCENT_OPTIONS.find(a => a.id === settings.accentColor)?.label || 'Teal Pro'}
                  </span>
                </div>
              </div>

              {/* 8 Color Selection Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                {ACCENT_OPTIONS.map((acc) => {
                  const isSelected = (settings.accentColor || 'teal') === acc.id;
                  return (
                    <button
                      key={acc.id}
                      onClick={() => {
                        const updated: AppSettings = {
                          ...settings,
                          accentColor: acc.id,
                          accentColorHex: acc.hex,
                          accentColorRgb: acc.rgb,
                        };
                        onUpdateSettings(updated);
                        StorageService.saveSettings(updated);
                        document.documentElement.setAttribute('data-accent', acc.id);
                        document.documentElement.style.setProperty('--tv-accent', acc.hex);
                        document.documentElement.style.setProperty('--tv-accent-rgb', acc.rgb);
                        document.documentElement.style.setProperty('--tv-accent-glow', `rgba(${acc.rgb}, 0.45)`);
                        document.documentElement.style.setProperty('--tv-accent-subtle', `rgba(${acc.rgb}, 0.15)`);
                        document.documentElement.style.setProperty('--tv-accent-border', `rgba(${acc.rgb}, 0.38)`);
                      }}
                      className={`tv-focusable p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? 'border-[var(--tv-accent)] bg-white/10 shadow-lg'
                          : 'border-white/10 bg-black/40 hover:bg-white/5'
                      }`}
                      style={{
                        borderColor: isSelected ? acc.hex : undefined,
                        boxShadow: isSelected ? `0 0 20px rgba(${acc.rgb}, 0.3)` : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2.5">
                          <span
                            className="w-5 h-5 rounded-full shrink-0 shadow-sm border border-white/20 transition-transform"
                            style={{
                              backgroundColor: acc.hex,
                              boxShadow: isSelected ? `0 0 10px ${acc.hex}` : 'none',
                            }}
                          ></span>
                          <span className="text-xs font-black text-white">{acc.label}</span>
                        </div>
                        {isSelected && (
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-black"
                            style={{ backgroundColor: acc.hex }}
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                        {acc.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Live Real-Time Preview Strip */}
              <div className="mt-3 p-4 rounded-2xl bg-black/50 border border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-white">
                  <Sparkles className="w-4 h-4 text-[var(--tv-accent)] animate-pulse" />
                  <span>Real-Time Theme Preview:</span>
                </div>

                <div className="flex items-center space-x-2.5">
                  {/* Sample Active Nav Pill */}
                  <span
                    className="px-3 py-1 rounded-xl text-xs font-black text-black shadow-sm transition-all"
                    style={{
                      backgroundColor: settings.accentColorHex || '#00d2ff',
                      boxShadow: `0 2px 10px rgba(${settings.accentColorRgb || '0, 210, 255'}, 0.4)`,
                    }}
                  >
                    Active Tab
                  </span>

                  {/* Sample High-Contrast Badge */}
                  <span
                    className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition-all"
                    style={{
                      backgroundColor: `rgba(${settings.accentColorRgb || '0, 210, 255'}, 0.15)`,
                      color: settings.accentColorHex || '#00d2ff',
                      borderColor: `rgba(${settings.accentColorRgb || '0, 210, 255'}, 0.38)`,
                    }}
                  >
                    4K HDR Live
                  </span>

                  {/* Sample Remote Focus Indicator */}
                  <span
                    className="px-3 py-1 rounded-xl text-xs font-bold border text-white transition-all"
                    style={{
                      borderColor: settings.accentColorHex || '#00d2ff',
                      boxShadow: `0 0 12px rgba(${settings.accentColorRgb || '0, 210, 255'}, 0.35)`,
                    }}
                  >
                    D-Pad Focus Ring
                  </span>
                </div>
              </div>
            </div>

            {/* UI Density: Comfortable vs Compact */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">Layout Spacing & Density</div>
                <div className="text-xs text-zinc-400">Comfortable (larger spacing) vs Compact (more channels per view)</div>
              </div>
              <div className="flex items-center space-x-2">
                {[
                  { id: 'comfortable' as const, label: 'Comfortable' },
                  { id: 'compact' as const, label: 'Compact' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      const updated: AppSettings = { ...settings, uiDensity: mode.id };
                      onUpdateSettings(updated);
                      StorageService.saveSettings(updated);
                      document.documentElement.setAttribute('data-density', mode.id);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      settings.uiDensity === mode.id
                        ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                        : 'bg-white/10 text-zinc-300 hover:bg-white/15'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Scaling: 85% to 150% */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">Typography Scale (85% – 150%)</div>
                <div className="text-xs text-zinc-400">Scales text size for optimal viewing distance without breaking UI layout</div>
              </div>
              <div className="flex items-center space-x-1.5">
                {[0.85, 1.0, 1.15, 1.3, 1.5].map(scale => (
                  <button
                    key={scale}
                    onClick={() => {
                      const updated = { ...settings, fontScale: scale };
                      onUpdateSettings(updated);
                      StorageService.saveSettings(updated);
                      document.documentElement.style.setProperty('--tv-font-scale', scale.toString());
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      Math.abs(settings.fontScale - scale) < 0.05
                        ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                        : 'bg-white/10 text-zinc-300 hover:bg-white/15'
                    }`}
                  >
                    {Math.round(scale * 100)}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Section 4: LAN Mobile Companion */}
        {activeSection === 'lan' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">LAN Companion & Mobile Push</h3>
              <p className="text-xs text-zinc-400">
                Scan with your phone camera on the same Wi-Fi to push playlists, upload .m3u files, or type easily without a remote.
              </p>
            </div>

            {/* Notification when mobile pushes credentials */}
            {pendingMobileCreds && (
              <div className="p-5 rounded-2xl bg-emerald-950/80 border-2 border-emerald-500 shadow-2xl flex items-center justify-between animate-pulse">
                <div>
                  <div className="text-sm font-bold text-emerald-300">
                    Incoming Credentials from Mobile!
                  </div>
                  <div className="text-xs text-zinc-300 mt-0.5">
                    Type: <span className="font-mono text-white font-bold">{pendingMobileCreds.type}</span>
                    {pendingMobileCreds.name && ` (${pendingMobileCreds.name})`}
                  </div>
                </div>
                <button
                  onClick={handleApplyPendingCredentials}
                  className="tv-focusable px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/30"
                >
                  Import to TV Now
                </button>
              </div>
            )}

            <div className="p-8 rounded-3xl bg-white/5 border border-white/10 flex flex-col md:flex-row items-center gap-8">
              {qrDataUrl && (
                <div className="p-3 bg-white rounded-2xl shadow-2xl shrink-0">
                  <img src={qrDataUrl} alt="LAN Companion QR Code" className="w-48 h-48" />
                </div>
              )}

              <div className="space-y-4">
                <div className="text-sm font-bold text-white">Scan to Connect Smartphone</div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Your TV runs a lightweight bundled background service. Point any mobile browser to:
                </p>
                <div className="p-3 rounded-xl bg-black/60 border border-white/15 font-mono text-[var(--tv-accent)] text-xs select-all flex items-center justify-between">
                  <span>{companionUrl}</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Companion Server Active on Port {settings.lanPort || 8080}</span>
                </div>

                <div className="pt-2">
                  <a
                    href={companionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white"
                  >
                    <span>Open Mobile Landing Page in Browser</span>
                    <span>↗</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Parental PIN Lock & Content Protection */}
        {activeSection === 'parental' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Parental Controls & Content Lock</h3>
              <p className="text-xs text-zinc-400">
                Protect your household by hiding or requiring a 4-digit PIN for sensitive channel categories and VOD items.
              </p>
            </div>

            {parentalNotice && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-300 flex items-center justify-between animate-fadeIn">
                <div className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{parentalNotice}</span>
                </div>
                <button onClick={() => setParentalNotice(null)} className="text-zinc-400 hover:text-white">
                  &times;
                </button>
              </div>
            )}

            {/* Master Parental Control Toggle & PIN Settings */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center space-x-3.5">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                      settings.parentalControlActive
                        ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                        : 'bg-white/10 border border-white/15 text-zinc-400'
                    }`}
                  >
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-white flex items-center space-x-2">
                      <span>Master Parental Lock</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          settings.parentalControlActive
                            ? 'bg-red-500/20 text-red-300 border-red-500/30'
                            : 'bg-white/10 text-zinc-400 border-white/10'
                        }`}
                      >
                        {settings.parentalControlActive ? 'PROTECTED' : 'DISABLED'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400">
                      Enforces 4-digit PIN access for all configured channel categories and VOD items.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={!!settings.parentalControlActive}
                  onClick={() => {
                    const nextActive = !settings.parentalControlActive;
                    const updated = { ...settings, parentalControlActive: nextActive };
                    onUpdateSettings(updated);
                    StorageService.saveSettings(updated);
                    setParentalNotice(nextActive ? 'Parental Controls activated.' : 'Parental Controls disabled.');
                  }}
                  className={`tv-focusable relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.parentalControlActive
                      ? 'bg-red-500 shadow-lg shadow-red-500/30'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                  title="Toggle Master Parental Controls"
                >
                  <span
                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      settings.parentalControlActive ? 'translate-x-8 bg-white' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 4-Digit Security PIN Customization */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div>
                  <div className="text-sm font-bold text-white">4-Digit Security PIN</div>
                  <div className="text-xs text-zinc-400">Used to unlock protected channels and restricted VOD catalogs</div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      maxLength={4}
                      value={pinInput}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9]/g, '');
                        setPinInput(clean);
                      }}
                      className="bg-black/60 border border-white/20 rounded-xl pl-3 pr-9 py-2 text-center font-mono tracking-widest text-base text-[var(--tv-accent)] focus:outline-none focus:border-[var(--tv-accent)] w-28"
                      placeholder="0000"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                      title={showPin ? 'Hide PIN' : 'Show PIN'}
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (pinInput.length === 4) {
                        const updated = { ...settings, parentalPin: pinInput };
                        onUpdateSettings(updated);
                        StorageService.saveSettings(updated);
                        setParentalNotice(`Security PIN saved as ${pinInput}`);
                      } else {
                        alert('Security PIN must be exactly 4 digits.');
                      }
                    }}
                    disabled={pinInput.length !== 4}
                    className="px-4 py-2 rounded-xl bg-[var(--tv-accent)] disabled:opacity-50 text-black font-extrabold text-xs shadow-md"
                  >
                    Save PIN
                  </button>
                </div>
              </div>

              {/* Hide vs Lock Display Mode */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center space-x-2">
                    <span>Hide Locked Content Completely from Browsing</span>
                    {settings.hideLockedContent && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        Stealth Active
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    When enabled, locked channel groups and VOD items are omitted entirely from lists rather than showing lock icons.
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={!!settings.hideLockedContent}
                  onClick={() => {
                    const updated = { ...settings, hideLockedContent: !settings.hideLockedContent };
                    onUpdateSettings(updated);
                    StorageService.saveSettings(updated);
                    setParentalNotice(
                      updated.hideLockedContent
                        ? 'Locked channels & VODs will be hidden from browsing views.'
                        : 'Locked channels & VODs will be visible with lock icons.'
                    );
                  }}
                  className={`tv-focusable relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.hideLockedContent ? 'bg-[var(--tv-accent)]' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      settings.hideLockedContent ? 'translate-x-6 bg-black' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Channel Category Lock Manager */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-white flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span>Locked Channel Categories</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 text-xs font-mono font-bold">
                      {(settings.lockedCategories || []).length} Locked
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    Channels in these groups require PIN entry or are hidden from the Live TV channel list.
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const adultDefaults = ['Adult', 'XXX', '18+', 'For Adults'];
                      const current = settings.lockedCategories || [];
                      const merged = Array.from(new Set([...current, ...adultDefaults]));
                      const updated = { ...settings, lockedCategories: merged };
                      onUpdateSettings(updated);
                      StorageService.saveSettings(updated);
                      setParentalNotice('All adult & 18+ channel categories locked.');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors"
                  >
                    Lock Adult (18+)
                  </button>
                  <button
                    onClick={() => {
                      const updated = { ...settings, lockedCategories: [] };
                      onUpdateSettings(updated);
                      StorageService.saveSettings(updated);
                      setParentalNotice('All channel category locks cleared.');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 text-xs font-bold transition-colors"
                  >
                    Unlock All
                  </button>
                </div>
              </div>

              {/* Add Custom Category Form */}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Enter category name to lock (e.g. News, Late Night, Adult...)"
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customCategoryInput.trim()) {
                      const val = customCategoryInput.trim();
                      const current = settings.lockedCategories || [];
                      if (!current.includes(val)) {
                        const updated = { ...settings, lockedCategories: [...current, val] };
                        onUpdateSettings(updated);
                        StorageService.saveSettings(updated);
                        setParentalNotice(`Category "${val}" added to locked list.`);
                      }
                      setCustomCategoryInput('');
                    }
                  }}
                  className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--tv-accent)]"
                />
                <button
                  onClick={() => {
                    if (!customCategoryInput.trim()) return;
                    const val = customCategoryInput.trim();
                    const current = settings.lockedCategories || [];
                    if (!current.includes(val)) {
                      const updated = { ...settings, lockedCategories: [...current, val] };
                      onUpdateSettings(updated);
                      StorageService.saveSettings(updated);
                      setParentalNotice(`Category "${val}" added to locked list.`);
                    }
                    setCustomCategoryInput('');
                  }}
                  disabled={!customCategoryInput.trim()}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-bold text-xs flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Lock Category</span>
                </button>
              </div>

              {/* Grid of Categories */}
              <div className="flex flex-wrap gap-2 pt-1 max-h-56 overflow-y-auto pr-1">
                {Array.from(
                  new Set([
                    'Adult',
                    'XXX',
                    '18+',
                    'For Adults',
                    ...channels.map((c) => c.group || 'General'),
                    ...(settings.lockedCategories || []),
                  ])
                )
                  .filter((g) => g && g !== 'ALL' && g !== 'FAVORITES' && g !== 'RECENTS')
                  .sort()
                  .map((category) => {
                    const isLocked = (settings.lockedCategories || []).some(
                      (l) => l.toLowerCase() === category.toLowerCase()
                    );
                    const channelCount = channels.filter((c) => c.group === category).length;

                    return (
                      <button
                        key={category}
                        onClick={() => {
                          const current = settings.lockedCategories || [];
                          let updatedList: string[];
                          if (isLocked) {
                            updatedList = current.filter((l) => l.toLowerCase() !== category.toLowerCase());
                          } else {
                            updatedList = [...current, category];
                          }
                          const updated = { ...settings, lockedCategories: updatedList };
                          onUpdateSettings(updated);
                          StorageService.saveSettings(updated);
                        }}
                        className={`tv-focusable px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-2 border transition-all ${
                          isLocked
                            ? 'bg-red-500/20 text-red-300 border-red-500/40 shadow-sm'
                            : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {isLocked ? (
                          <Lock className="w-3.5 h-3.5 text-red-400" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                        <span>{category}</span>
                        {channelCount > 0 && (
                          <span className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1.5 py-0.2 rounded">
                            {channelCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* VOD Items & Genres Lock Manager */}
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-white flex items-center space-x-2">
                    <Film className="w-4 h-4 text-cyan-400" />
                    <span>Locked VOD Genres & Mature Items</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 text-xs font-mono font-bold">
                      {(settings.lockedVodGenres || []).length} Restricted
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    On-demand movies and series matching these genres require PIN authorization to view or play.
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const adultDefaults = ['Adult', '18+', 'Erotic'];
                      const current = settings.lockedVodGenres || [];
                      const merged = Array.from(new Set([...current, ...adultDefaults]));
                      const updated = { ...settings, lockedVodGenres: merged };
                      onUpdateSettings(updated);
                      StorageService.saveSettings(updated);
                      setParentalNotice('Mature VOD genres restricted.');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-colors"
                  >
                    Lock Adult VOD
                  </button>
                  <button
                    onClick={() => {
                      const updated = { ...settings, lockedVodGenres: [] };
                      onUpdateSettings(updated);
                      StorageService.saveSettings(updated);
                      setParentalNotice('All VOD genre restrictions cleared.');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 text-xs font-bold transition-colors"
                  >
                    Unlock All
                  </button>
                </div>
              </div>

              {/* Add Custom VOD Genre */}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Enter VOD genre to restrict (e.g. Horror, Adult, Thriller...)"
                  value={customVodGenreInput}
                  onChange={(e) => setCustomVodGenreInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customVodGenreInput.trim()) {
                      const val = customVodGenreInput.trim();
                      const current = settings.lockedVodGenres || [];
                      if (!current.includes(val)) {
                        const updated = { ...settings, lockedVodGenres: [...current, val] };
                        onUpdateSettings(updated);
                        StorageService.saveSettings(updated);
                        setParentalNotice(`VOD Genre "${val}" restricted.`);
                      }
                      setCustomVodGenreInput('');
                    }
                  }}
                  className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={() => {
                    if (!customVodGenreInput.trim()) return;
                    const val = customVodGenreInput.trim();
                    const current = settings.lockedVodGenres || [];
                    if (!current.includes(val)) {
                      const updated = { ...settings, lockedVodGenres: [...current, val] };
                      onUpdateSettings(updated);
                      StorageService.saveSettings(updated);
                      setParentalNotice(`VOD Genre "${val}" restricted.`);
                    }
                    setCustomVodGenreInput('');
                  }}
                  disabled={!customVodGenreInput.trim()}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white font-bold text-xs flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Lock Genre</span>
                </button>
              </div>

              {/* VOD Genres List */}
              <div className="flex flex-wrap gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
                {Array.from(
                  new Set([
                    'Adult',
                    '18+',
                    'Erotic',
                    'Horror',
                    'Thriller',
                    'Crime',
                    'Action',
                    'Drama',
                    'Sci-Fi',
                    ...(settings.lockedVodGenres || []),
                  ])
                )
                  .sort()
                  .map((genre) => {
                    const isLocked = (settings.lockedVodGenres || []).some(
                      (l) => l.toLowerCase() === genre.toLowerCase()
                    );

                    return (
                      <button
                        key={genre}
                        onClick={() => {
                          const current = settings.lockedVodGenres || [];
                          let updatedList: string[];
                          if (isLocked) {
                            updatedList = current.filter((l) => l.toLowerCase() !== genre.toLowerCase());
                          } else {
                            updatedList = [...current, genre];
                          }
                          const updated = { ...settings, lockedVodGenres: updatedList };
                          onUpdateSettings(updated);
                          StorageService.saveSettings(updated);
                        }}
                        className={`tv-focusable px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-2 border transition-all ${
                          isLocked
                            ? 'bg-red-500/20 text-red-300 border-red-500/40'
                            : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {isLocked ? (
                          <Lock className="w-3.5 h-3.5 text-red-400" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                        <span>{genre}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Section: IndexedDB Database & Large Lists Storage */}
        {activeSection === 'database' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">IndexedDB High-Capacity Storage</h3>
              <p className="text-xs text-zinc-400">
                Engineered for massive 900MB+ playlists, 10,000+ live channels, movies, and TV series with zero UI freeze.
              </p>
            </div>

            {/* Storage Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-xs font-semibold">Live Channels</span>
                  <Tv className="w-4 h-4 text-[var(--tv-accent)]" />
                </div>
                <div className="text-2xl font-black text-white font-mono">
                  {dbStats ? dbStats.channelsCount.toLocaleString() : channels.length.toLocaleString()}
                </div>
                <span className="text-[10px] text-zinc-500 mt-1">Indexed in local database</span>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-xs font-semibold">On-Demand Movies</span>
                  <Film className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono">
                  {dbStats ? dbStats.moviesCount.toLocaleString() : '8'}
                </div>
                <span className="text-[10px] text-zinc-500 mt-1">Ready for 4K streaming</span>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-400 mb-2">
                  <span className="text-xs font-semibold">TV Series & Serials</span>
                  <Clapperboard className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono">
                  {dbStats ? dbStats.seriesCount.toLocaleString() : '3'}
                </div>
                <span className="text-[10px] text-zinc-500 mt-1">Grouped by Season & Episodes</span>
              </div>
            </div>

            {/* Large Playlist Pipeline Details */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-[var(--tv-accent)]" />
                <span>Non-Blocking Stream Architecture</span>
              </h4>
              <p className="text-xs text-zinc-300 leading-relaxed">
                When importing playlists up to 900MB with 10,000+ streams, the app uses chunked streaming (4MB buffers) and writes directly to IndexedDB in batches. The main UI thread never locks, and RAM consumption remains safely below 20MB.
              </p>
              <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                  ✓ Chunked Slice Reader
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                  ✓ 60 FPS Virtualized Grid
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                  ✓ Automatic Series & Episode Merging
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                  ✓ Zero LocalStorage Quota Crashes
                </span>
              </div>
            </div>

            {/* Database Management Actions */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <h4 className="text-sm font-bold text-white">Database Management Tools</h4>
              <div className="flex items-center space-x-3">
                <button
                  onClick={async () => {
                    if (confirm('Clear all indexed channels and media from IndexedDB?')) {
                      await IndexedDbService.clearAll();
                      if (onClearDatabase) onClearDatabase();
                      const stats = await IndexedDbService.getStats();
                      setDbStats(stats);
                    }
                  }}
                  className="tv-focusable px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold border border-red-500/30 flex items-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear All Cached Data</span>
                </button>

                <button
                  onClick={async () => {
                    const stats = await IndexedDbService.getStats();
                    setDbStats(stats);
                  }}
                  className="tv-focusable px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh Storage Stats</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 6: System Diagnostics & About */}
        {activeSection === 'about' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">LG webOS System Diagnostics</h3>
              <p className="text-xs text-zinc-400">Device architecture and media pipeline capabilities</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-zinc-500 block mb-1">Target Platform</span>
                <span className="font-bold text-white text-sm">LG webOS TV (4.0 → webOS 26)</span>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-zinc-500 block mb-1">Chromium Baseline</span>
                <span className="font-bold text-white text-sm">Chrome 53 Target Polyfilled</span>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-zinc-500 block mb-1">Video Decoder Pipeline</span>
                <span className="font-bold text-white text-sm">Hardware HEVC / AVC / VP9</span>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-zinc-500 block mb-1">HDR Passthrough</span>
                <span className="font-bold text-white text-sm">HDR10 / HLG / Dolby Vision</span>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-zinc-500 block mb-1">Audio Engine</span>
                <span className="font-bold text-white text-sm">eARC Dolby Atmos / DD+ Passthrough</span>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-zinc-500 block mb-1">Telemetry & Privacy</span>
                <span className="font-bold text-emerald-400 text-sm">Zero Telemetry (100% On-Device)</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--tv-accent-subtle)] border border-[var(--tv-accent-border)] text-xs text-[var(--tv-accent)]">
              Package ID: <span className="font-mono text-white font-bold">com.webos.iptv.pro</span> — Ready for Developer Mode / Homebrew Channel installation.
            </div>
          </div>
        )}
      </div>

      {/* Real-Time Non-Blocking Streaming Parse Progress Modal */}
      {parseProgress && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-[#12141c] border border-[var(--tv-accent)] rounded-3xl max-w-lg w-full p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-[var(--tv-accent-subtle)] border border-[var(--tv-accent)] flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-[var(--tv-accent)] animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Streaming & Indexing Playlist</h3>
                  <p className="text-xs text-zinc-400">Non-blocking chunked parser (900MB+ safe)</p>
                </div>
              </div>

              <span className="font-mono text-xl font-black text-[var(--tv-accent)]">
                {parseProgress.percent}%
              </span>
            </div>

            {/* Animated Progress Bar */}
            <div className="h-3 w-full bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${parseProgress.percent}%`,
                  background: 'var(--tv-accent-gradient, var(--tv-accent))',
                  boxShadow: '0 0 12px var(--tv-accent-glow)',
                }}
              />
            </div>

            {/* Live Statistics Counters */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[11px] text-zinc-400 block mb-0.5">Live Channels</span>
                <span className="font-mono text-base font-bold text-white">
                  {parseProgress.channelsCount.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[11px] text-zinc-400 block mb-0.5">Movies</span>
                <span className="font-mono text-base font-bold text-cyan-400">
                  {parseProgress.moviesCount.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[11px] text-zinc-400 block mb-0.5">TV Series</span>
                <span className="font-mono text-base font-bold text-purple-400">
                  {parseProgress.seriesCount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-white/10">
              <span>
                Processed <strong className="text-white font-mono">{parseProgress.totalItems.toLocaleString()}</strong> items
                ({parseProgress.speedLinesPerSec.toLocaleString()} lines/sec)
              </span>

              <button
                onClick={() => {
                  if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                  }
                }}
                className="tv-focusable px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-xs transition-colors"
              >
                Cancel Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
