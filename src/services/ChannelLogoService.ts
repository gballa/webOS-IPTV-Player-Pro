/**
 * ChannelLogoService
 * Provides intelligent channel logo resolution, SSL proxying, and fallback matching
 * for IPTV M3U & Xtream channels.
 */

// Curated high-res official SVG/PNG logos for major international channels
const KNOWN_CHANNEL_LOGOS: Record<string, string> = {
  // Global & News
  'nasa tv': 'https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg',
  'nasa': 'https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg',
  'nasa hd': 'https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg',
  'red bull tv': 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Red_Bull_TV_logo.svg/512px-Red_Bull_TV_logo.svg.png',
  'bloomberg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Bloomberg_Television_logo_2015.svg/512px-Bloomberg_Television_logo_2015.svg.png',
  'bloomberg tv': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Bloomberg_Television_logo_2015.svg/512px-Bloomberg_Television_logo_2015.svg.png',
  'euronews': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Euronews_2016_logo.svg/512px-Euronews_2016_logo.svg.png',
  'dw english': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/512px-Deutsche_Welle_symbol_2012.svg.png',
  'dw': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/512px-Deutsche_Welle_symbol_2012.svg.png',
  'france 24': 'https://upload.wikimedia.org/wikipedia/en/thumb/6/65/France_24_logo.svg/512px-France_24_logo.svg.png',
  'al jazeera': 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Al_Jazeera_English_logo.svg/512px-Al_Jazeera_English_logo.svg.png',
  'al jazeera english': 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Al_Jazeera_English_logo.svg/512px-Al_Jazeera_English_logo.svg.png',
  'cnn': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/CNN.svg/512px-CNN.svg.png',
  'cnn international': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/CNN.svg/512px-CNN.svg.png',
  'bbc news': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/BBC_News_2022.svg/512px-BBC_News_2022.svg.png',
  'bbc one': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/BBC_One_2021.svg/512px-BBC_One_2021.svg.png',
  'bbc two': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/BBC_Two_2021.svg/512px-BBC_Two_2021.svg.png',
  'bbc world news': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/BBC_News_2022.svg/512px-BBC_News_2022.svg.png',
  'sky news': 'https://upload.wikimedia.org/wikipedia/en/thumb/2/23/Sky_News_logo_2020.svg/512px-Sky_News_logo_2020.svg.png',
  'fox news': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Fox_News_Channel_logo.svg/512px-Fox_News_Channel_logo.svg.png',
  'msnbc': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/MSNBC_2021_logo.svg/512px-MSNBC_2021_logo.svg.png',
  'cnbc': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/CNBC_logo.svg/512px-CNBC_logo.svg.png',

  // Sports
  'espn': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/512px-ESPN_wordmark.svg.png',
  'espn 2': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/ESPN2_logo.svg/512px-ESPN2_logo.svg.png',
  'sky sports': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9f/Sky_Sports_logo_2020.svg/512px-Sky_Sports_logo_2020.svg.png',
  'sky sports premier league': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9f/Sky_Sports_logo_2020.svg/512px-Sky_Sports_logo_2020.svg.png',
  'fox sports': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Fox_Sports_logo.svg/512px-Fox_Sports_logo.svg.png',
  'eurosport': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Eurosport_1_logo_2015.svg/512px-Eurosport_1_logo_2015.svg.png',
  'eurosport 1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Eurosport_1_logo_2015.svg/512px-Eurosport_1_logo_2015.svg.png',
  'eurosport 2': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Eurosport_2_logo_2015.svg/512px-Eurosport_2_logo_2015.svg.png',
  'bein sports': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/BeIN_Sports_logo.svg/512px-BeIN_Sports_logo.svg.png',

  // Entertainment / Movies / Docs
  'hbo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/HBO_logo.svg/512px-HBO_logo.svg.png',
  'hbo max': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/HBO_Max_Logo.svg/512px-HBO_Max_Logo.svg.png',
  'cinemax': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Cinemax_2011_logo.svg/512px-Cinemax_2011_logo.svg.png',
  'showtime': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Showtime.svg/512px-Showtime.svg.png',
  'paramount': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Paramount_Network_2018.svg/512px-Paramount_Network_2018.svg.png',
  'discovery': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Discovery_Channel_2019_logo.svg/512px-Discovery_Channel_2019_logo.svg.png',
  'discovery channel': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Discovery_Channel_2019_logo.svg/512px-Discovery_Channel_2019_logo.svg.png',
  'national geographic': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/National_Geographic_Logo.svg/512px-National_Geographic_Logo.svg.png',
  'nat geo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/National_Geographic_Logo.svg/512px-National_Geographic_Logo.svg.png',
  'history': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/History_Logo.svg/512px-History_Logo.svg.png',
  'history channel': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/History_Logo.svg/512px-History_Logo.svg.png',
  'cartoon network': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Cartoon_Network_2010_logo.svg/512px-Cartoon_Network_2010_logo.svg.png',
  'disney channel': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/2019_Disney_Channel_logo.svg/512px-2019_Disney_Channel_logo.svg.png',
  'nickelodeon': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Nickelodeon_2023_logo.svg/512px-Nickelodeon_2023_logo.svg.png',
  'mtv': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/MTV_2021_logo.svg/512px-MTV_2021_logo.svg.png',
};

export class ChannelLogoService {
  /**
   * Cleans raw channel names commonly found in IPTV lists:
   * "US | NASA TV (4K UHD) [HEVC]" -> "nasa tv"
   */
  static cleanChannelName(rawName: string): string {
    if (!rawName) return '';
    return rawName
      // Remove country prefixes like "US |", "UK:", "[DE]", "ES - ", etc.
      .replace(/^[A-Z]{2,3}\s*[:|\-\/\]]\s*/i, '')
      .replace(/^\[[A-Z]{2,3}\]\s*/i, '')
      .replace(/^\([A-Z]{2,3}\)\s*/i, '')
      // Remove technical tags
      .replace(/\b(4k|uhd|fhd|hd|sd|hevc|h265|h264|1080p|720p|50fps|60fps|raw|vip|backup)\b/gi, '')
      // Remove brackets and parentheticals
      .replace(/[\(\[\{].*?[\)\]\}]/g, '')
      // Remove trailing pipes, dashes, colons
      .replace(/[\:\-\|\/]+$/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Resolves a safe image URL for web environments.
   * If on HTTPS and the logo is HTTP, routes through a secure image proxy
   * to avoid mixed-content blocking.
   */
  static getSafeLogoUrl(url?: string): string | null {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;

    // Check if running on HTTPS and URL is plain HTTP
    const isHttpsEnv = typeof window !== 'undefined' && window.location.protocol === 'https:';
    if (isHttpsEnv && trimmed.startsWith('http://')) {
      // Use free secure image cache/proxy to serve over HTTPS
      return `https://images.weserv.nl/?url=${encodeURIComponent(trimmed.replace(/^http:\/\//, ''))}&w=160&fit=contain&we`;
    }

    return trimmed;
  }

  /**
   * Matches a channel name to a known high-res logo
   */
  static matchKnownLogo(channelName: string): string | null {
    const clean = this.cleanChannelName(channelName);
    if (!clean) return null;

    // Direct match
    if (KNOWN_CHANNEL_LOGOS[clean]) {
      return KNOWN_CHANNEL_LOGOS[clean];
    }

    // Partial match (e.g. "bbc news hd" -> "bbc news")
    for (const [key, logoUrl] of Object.entries(KNOWN_CHANNEL_LOGOS)) {
      if (clean === key || clean.startsWith(key + ' ') || clean.includes(key)) {
        return logoUrl;
      }
    }

    // iptv-org fallback via epg channel ID pattern if available
    const slug = clean.replace(/[^a-z0-9]/g, '');
    if (slug.length >= 3) {
      // Return null if not directly known, let monogram handle
    }

    return null;
  }

  /**
   * Generates a deterministic color and monogram for stylish channel badge fallback
   */
  static getMonogram(channelName: string): { initials: string; gradient: string } {
    const clean = this.cleanChannelName(channelName) || channelName.trim() || 'TV';
    const words = clean.split(/\s+/).filter(Boolean);
    let initials = '';
    if (words.length >= 2) {
      initials = (words[0][0] + words[1][0]).toUpperCase();
    } else if (words.length === 1) {
      initials = words[0].substring(0, Math.min(3, words[0].length)).toUpperCase();
    } else {
      initials = 'TV';
    }

    // Deterministic gradient selection
    const gradients = [
      'from-cyan-600 to-blue-700',
      'from-violet-600 to-purple-800',
      'from-emerald-600 to-teal-800',
      'from-amber-600 to-orange-700',
      'from-rose-600 to-pink-800',
      'from-indigo-600 to-blue-800',
      'from-fuchsia-600 to-rose-700',
      'from-sky-600 to-cyan-800',
    ];

    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = (hash << 5) - hash + clean.charCodeAt(i);
      hash |= 0;
    }
    const gradient = gradients[Math.abs(hash) % gradients.length];

    return { initials, gradient };
  }
}
