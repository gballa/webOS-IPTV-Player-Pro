import { Channel } from '../types/iptv';

export interface ParseResult {
  channels: Channel[];
  groups: string[];
}

export class PlaylistParser {
  /**
   * Fast M3U/M3U8 parser optimized for low-memory webOS environments.
   * Can handle both standard #EXTINF lines and inline tags.
   */
  static parseM3U(content: string, startChannelNumber = 1): ParseResult {
    const lines = content.split(/\r?\n/);
    const channels: Channel[] = [];
    const groupsSet = new Set<string>();

    let currentExtinf: string | null = null;
    let chNo = startChannelNumber;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        currentExtinf = line;
      } else if (!line.startsWith('#') && currentExtinf) {
        // Stream URL found for the previous EXTINF
        const channel = this.parseChannelLine(currentExtinf, line, chNo);
        if (channel) {
          channels.push(channel);
          groupsSet.add(channel.group);
          chNo++;
        }
        currentExtinf = null;
      }
    }

    return {
      channels,
      groups: Array.from(groupsSet).sort(),
    };
  }

  private static parseChannelLine(extinf: string, streamUrl: string, fallbackNum: number): Channel | null {
    try {
      // Extract tvg-name or trailing channel title
      const commaIdx = extinf.indexOf(',');
      let rawTitle = commaIdx !== -1 ? extinf.substring(commaIdx + 1).trim() : 'Channel ' + fallbackNum;

      // Extract attributes
      const tvgId = this.extractAttribute(extinf, 'tvg-id');
      const tvgName = this.extractAttribute(extinf, 'tvg-name') || rawTitle;
      const tvgLogo =
        this.extractAttribute(extinf, 'tvg-logo') ||
        this.extractAttribute(extinf, 'logo') ||
        this.extractAttribute(extinf, 'stream_icon') ||
        this.extractAttribute(extinf, 'logo-url');
      const groupTitle = this.extractAttribute(extinf, 'group-title') || 'General';
      const tvgChno = this.extractAttribute(extinf, 'tvg-chno');
      const catchup = this.extractAttribute(extinf, 'catchup');
      const catchupDays = this.extractAttribute(extinf, 'catchup-days');
      const catchupSource = this.extractAttribute(extinf, 'catchup-source');

      const num = tvgChno ? parseInt(tvgChno, 10) : fallbackNum;

      // Detect resolution / HDR from name
      let resolution: Channel['resolution'] = '1080p';
      let hdr: Channel['hdr'] = 'SDR';

      const lower = (tvgName + ' ' + groupTitle).toLowerCase();
      if (lower.includes('4k') || lower.includes('uhd') || lower.includes('2160p')) {
        resolution = '4K';
      } else if (lower.includes('720p') || lower.includes('sd')) {
        resolution = '720p';
      }

      if (lower.includes('hdr') || lower.includes('hdr10')) {
        hdr = 'HDR10';
      } else if (lower.includes('hlg')) {
        hdr = 'HLG';
      } else if (lower.includes('dolby vision') || lower.includes('dv')) {
        hdr = 'DolbyVision';
      }

      const id = `ch-${tvgId || ''}-${num}-${Math.random().toString(36).substring(2, 7)}`;

      return {
        id,
        num: isNaN(num) ? fallbackNum : num,
        name: tvgName.replace(/\s+/g, ' ').trim(),
        logo: tvgLogo || undefined,
        group: groupTitle.trim(),
        streamUrl: streamUrl.trim(),
        epgId: tvgId || undefined,
        catchupDays: catchupDays ? parseInt(catchupDays, 10) : undefined,
        catchupSource: catchupSource || undefined,
        resolution,
        hdr,
        isFavorite: false,
      };
    } catch {
      return null;
    }
  }

  private static extractAttribute(text: string, attrName: string): string | null {
    const regex = new RegExp(`${attrName}=["']([^"']*)["']`, 'i');
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
    // Also try unquoted attribute: attr=val
    const unquotedRegex = new RegExp(`${attrName}=([^\\s,]+)`, 'i');
    const unquotedMatch = text.match(unquotedRegex);
    return unquotedMatch && unquotedMatch[1] ? unquotedMatch[1].trim() : null;
  }
}
