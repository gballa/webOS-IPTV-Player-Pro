import { Channel, VodItem } from '../types/iptv';

export interface XtreamConfig {
  host: string; // e.g. "http://example.com:8080"
  user: string;
  pass: string;
}

export interface XtreamAuthResponse {
  user_info: {
    username: string;
    status: string;
    exp_date: string;
    is_trial: string;
    active_cons: string;
    max_connections: string;
  };
  server_info: {
    url: string;
    port: string;
    https_port: string;
    server_protocol: string;
    rtmp_port: string;
    timezone: string;
    timestamp_now: number;
    time_now: string;
  };
}

export class XtreamService {
  private config: XtreamConfig;
  private cleanHost: string;

  constructor(config: XtreamConfig) {
    this.config = config;
    let h = config.host.trim();
    if (!h.startsWith('http://') && !h.startsWith('https://')) {
      h = 'http://' + h;
    }
    this.cleanHost = h.replace(/\/+$/, '');
  }

  private getBaseUrl(): string {
    return `${this.cleanHost}/player_api.php?username=${encodeURIComponent(this.config.user)}&password=${encodeURIComponent(this.config.pass)}`;
  }

  async authenticate(): Promise<XtreamAuthResponse> {
    const res = await fetch(this.getBaseUrl());
    if (!res.ok) {
      throw new Error(`Xtream server returned status ${res.status}`);
    }
    const data = await res.json();
    if (!data.user_info || data.user_info.status !== 'Active') {
      throw new Error('Authentication failed or account inactive.');
    }
    return data;
  }

  async getLiveCategories(): Promise<{ category_id: string; category_name: string }[]> {
    const res = await fetch(`${this.getBaseUrl()}&action=get_live_categories`);
    return await res.json();
  }

  async getLiveStreams(categoryId?: string): Promise<Channel[]> {
    const url = categoryId
      ? `${this.getBaseUrl()}&action=get_live_streams&category_id=${categoryId}`
      : `${this.getBaseUrl()}&action=get_live_streams`;
    const res = await fetch(url);
    const data: any[] = await res.json();

    return data.map((item, index) => {
      const streamId = item.stream_id;
      // Live stream URL: m3u8 preferred on modern webOS, fallback to ts
      const streamUrl = `${this.cleanHost}/live/${this.config.user}/${this.config.pass}/${streamId}.m3u8`;

      const num = item.num ? parseInt(item.num, 10) : index + 1;
      const name = item.name || `Live ${streamId}`;

      return {
        id: `xtream-live-${streamId}`,
        num: isNaN(num) ? index + 1 : num,
        name,
        group: item.category_name || 'Xtream Live',
        logo: item.stream_icon || undefined,
        streamUrl,
        epgId: item.epg_channel_id || undefined,
        resolution: (name.toLowerCase().includes('4k') || name.toLowerCase().includes('uhd')) ? '4K' : '1080p',
        hdr: name.toLowerCase().includes('hdr') ? 'HDR10' : 'SDR',
        isFavorite: false,
      };
    });
  }

  async getVodStreams(): Promise<VodItem[]> {
    const res = await fetch(`${this.getBaseUrl()}&action=get_vod_streams`);
    const data: any[] = await res.json();

    return data.map((item) => {
      const ext = item.container_extension || 'mp4';
      const streamUrl = `${this.cleanHost}/movie/${this.config.user}/${this.config.pass}/${item.stream_id}.${ext}`;

      return {
        id: `xtream-vod-${item.stream_id}`,
        title: item.name || 'Movie',
        type: 'movie',
        poster: item.stream_icon || undefined,
        rating: item.rating ? parseFloat(item.rating) : undefined,
        year: item.year || undefined,
        genre: item.genre || undefined,
        plot: item.plot || item.description || undefined,
        streamUrl,
      };
    });
  }
}
