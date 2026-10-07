import { Channel, VodItem } from '../types/iptv';

export interface ChunkedParseProgress {
  channelsCount: number;
  moviesCount: number;
  seriesCount: number;
  totalParsed: number;
  percent: number;
  phase: string;
}

export interface ChunkedParseResult {
  channels: Channel[];
  movies: VodItem[];
  series: VodItem[];
  groups: string[];
}

export class ChunkedPlaylistParser {
  /**
   * High-capacity, non-blocking streaming parser designed for 900MB+ M3U files
   * and 10,000+ items without locking the UI or crashing webOS V8 memory.
   */
  static async parseM3UAsync(
    content: string,
    onProgress?: (progress: ChunkedParseProgress) => void
  ): Promise<ChunkedParseResult> {
    const channels: Channel[] = [];
    const movies: VodItem[] = [];
    const series: VodItem[] = [];
    const groupsSet = new Set<string>();

    const totalLength = content.length;
    let currentPos = 0;
    let lineStart = 0;
    let currentExtinf: string | null = null;
    let chNo = 1;
    let processedLines = 0;

    const BATCH_SIZE = 600;

    while (currentPos < totalLength) {
      // Find end of current line
      let lineEnd = content.indexOf('\n', currentPos);
      if (lineEnd === -1) {
        lineEnd = totalLength;
      }

      // Extract single line without creating full array
      let line = content.substring(lineStart, lineEnd).trim();
      currentPos = lineEnd + 1;
      lineStart = currentPos;

      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        currentExtinf = line;
      } else if (!line.startsWith('#') && currentExtinf) {
        const streamUrl = line;
        processedLines++;

        // Classify stream: Live TV vs VOD Movie vs Series
        const classification = this.classifyItem(currentExtinf, streamUrl, chNo);

        if (classification.type === 'live') {
          channels.push(classification.item as Channel);
          groupsSet.add((classification.item as Channel).group);
          chNo++;
        } else if (classification.type === 'movie') {
          movies.push(classification.item as VodItem);
        } else if (classification.type === 'series') {
          series.push(classification.item as VodItem);
        }

        currentExtinf = null;

        // Yield to event loop periodically to prevent UI thread starvation
        if (processedLines % BATCH_SIZE === 0) {
          const percent = Math.min(99, Math.round((currentPos / totalLength) * 100));
          onProgress?.({
            channelsCount: channels.length,
            moviesCount: movies.length,
            seriesCount: series.length,
            totalParsed: processedLines,
            percent,
            phase: `Parsing items (${processedLines.toLocaleString()})...`,
          });

          // Allow DOM repaints and event loop dispatch
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    }

    onProgress?.({
      channelsCount: channels.length,
      moviesCount: movies.length,
      seriesCount: series.length,
      totalParsed: processedLines,
      percent: 100,
      phase: 'Finalizing catalog index...',
    });

    return {
      channels,
      movies,
      series,
      groups: Array.from(groupsSet).sort(),
    };
  }

  /**
   * Determine whether an EXTINF + URL belongs to Live TV, VOD Movie, or TV Series
   */
  private static classifyItem(
    extinf: string,
    streamUrl: string,
    fallbackNum: number
  ): { type: 'live' | 'movie' | 'series'; item: Channel | VodItem } {
    const commaIdx = extinf.indexOf(',');
    const rawTitle = commaIdx !== -1 ? extinf.substring(commaIdx + 1).trim() : 'Channel ' + fallbackNum;

    const tvgId = this.extractAttribute(extinf, 'tvg-id');
    const tvgName = this.extractAttribute(extinf, 'tvg-name') || rawTitle;
    const tvgLogo = this.extractAttribute(extinf, 'tvg-logo');
    const groupTitle = this.extractAttribute(extinf, 'group-title') || 'General';
    const tvgChno = this.extractAttribute(extinf, 'tvg-chno');
    const catchupDays = this.extractAttribute(extinf, 'catchup-days');

    const cleanTitle = tvgName.replace(/\s+/g, ' ').trim();
    const lowerTitle = cleanTitle.toLowerCase();
    const lowerGroup = groupTitle.toLowerCase();
    const lowerUrl = streamUrl.toLowerCase();

    // 1. Detect TV Series
    const isSeries =
      lowerGroup.includes('series') ||
      lowerGroup.includes('serials') ||
      lowerGroup.includes('tv shows') ||
      lowerGroup.includes('temporada') ||
      lowerUrl.includes('/series/') ||
      /s\d{1,2}\s?e\d{1,2}/i.test(lowerTitle) ||
      /\bseason\s?\d+/i.test(lowerTitle);

    if (isSeries) {
      const seasonMatch = cleanTitle.match(/s(\d{1,2})/i);
      const episodeMatch = cleanTitle.match(/e(\d{1,2})/i);
      const seasonNum = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
      const episodeNum = episodeMatch ? parseInt(episodeMatch[1], 10) : 1;

      const seriesItem: VodItem = {
        id: `series-${Math.random().toString(36).substring(2, 9)}`,
        title: cleanTitle,
        type: 'series',
        poster: tvgLogo || undefined,
        genre: groupTitle,
        streamUrl,
        seasons: [
          {
            seasonNumber: seasonNum,
            episodes: [
              {
                id: `ep-${seasonNum}-${episodeNum}`,
                episodeNumber: episodeNum,
                title: cleanTitle,
                streamUrl,
              },
            ],
          },
        ],
      };
      return { type: 'series', item: seriesItem };
    }

    // 2. Detect VOD Movies
    const isMovie =
      lowerGroup.includes('movie') ||
      lowerGroup.includes('vod') ||
      lowerGroup.includes('cinema') ||
      lowerGroup.includes('film') ||
      lowerGroup.includes('pelicula') ||
      lowerUrl.includes('/movie/') ||
      lowerUrl.endsWith('.mp4') ||
      lowerUrl.endsWith('.mkv') ||
      lowerUrl.endsWith('.avi');

    if (isMovie) {
      const movieItem: VodItem = {
        id: `vod-${Math.random().toString(36).substring(2, 9)}`,
        title: cleanTitle,
        type: 'movie',
        poster: tvgLogo || undefined,
        genre: groupTitle,
        streamUrl,
        duration: 7200, // 2h default
      };
      return { type: 'movie', item: movieItem };
    }

    // 3. Live TV Channel
    let resolution: Channel['resolution'] = '1080p';
    let hdr: Channel['hdr'] = 'SDR';
    let codec = 'H.264 / AVC';
    let bitrateKbps = 6400;
    let fps = 50;

    const lowerCombo = (lowerTitle + ' ' + lowerGroup).toLowerCase();
    if (lowerCombo.includes('4k') || lowerCombo.includes('uhd') || lowerCombo.includes('2160p')) {
      resolution = '4K';
      codec = 'HEVC / H.265';
      bitrateKbps = 18500;
      fps = 60;
    } else if (lowerCombo.includes('720p') || lowerCombo.includes('sd')) {
      resolution = '720p';
      bitrateKbps = 3600;
    }

    if (lowerCombo.includes('hdr') || lowerCombo.includes('hdr10')) {
      hdr = 'HDR10';
    } else if (lowerCombo.includes('dolby vision') || lowerCombo.includes('dv')) {
      hdr = 'DolbyVision';
    } else if (lowerCombo.includes('hlg')) {
      hdr = 'HLG';
    }

    const num = tvgChno ? parseInt(tvgChno, 10) : fallbackNum;

    const channelItem: Channel = {
      id: `ch-${tvgId || ''}-${num}-${Math.random().toString(36).substring(2, 7)}`,
      num: isNaN(num) ? fallbackNum : num,
      name: cleanTitle,
      logo: tvgLogo || undefined,
      group: groupTitle.trim(),
      streamUrl: streamUrl.trim(),
      epgId: tvgId || undefined,
      catchupDays: catchupDays ? parseInt(catchupDays, 10) : undefined,
      resolution,
      hdr,
      codec,
      audioCodec: resolution === '4K' ? 'E-AC3 Atmos' : 'AAC Stereo',
      bitrateKbps,
      fps,
      isFavorite: false,
    };

    return { type: 'live', item: channelItem };
  }

  private static extractAttribute(line: string, attr: string): string | null {
    const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
    const match = line.match(regex);
    if (match && match[1]) {
      return match[1];
    }
    const regexNoQuote = new RegExp(`${attr}=([^\\s,]+)`, 'i');
    const matchNoQuote = line.match(regexNoQuote);
    if (matchNoQuote && matchNoQuote[1]) {
      return matchNoQuote[1];
    }
    return null;
  }
}
