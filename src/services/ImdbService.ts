/**
 * ImdbService
 * Fetches rich IMDb & TMDB movie and series metadata (posters, ratings, synopsis,
 * genres, cast, director) using free, CORS-open media catalog APIs.
 */

export interface ImdbMetadata {
  imdbId?: string;
  title: string;
  year?: string;
  rating?: number;
  votes?: string;
  poster?: string;
  backdrop?: string;
  genres?: string[];
  plot?: string;
  director?: string;
  cast?: string[];
  runtime?: string;
  type: 'movie' | 'series';
}

export class ImdbService {
  private static cache = new Map<string, ImdbMetadata | null>();

  /**
   * Cleans movie and TV series filenames/titles commonly found in IPTV M3U & Xtream catalogs:
   * e.g. "Oppenheimer.2023.1080p.WEBRip.x264" -> "Oppenheimer", year: "2023"
   */
  static cleanTitle(rawTitle: string): { title: string; year?: string } {
    if (!rawTitle) return { title: '' };

    // Extract year if present
    const yearMatch = rawTitle.match(/\b(19\d{2}|20\d{2})\b/);
    const year = yearMatch ? yearMatch[1] : undefined;

    let clean = rawTitle
      // Remove year and everything after it if desired or year brackets
      .replace(/\s*\(\s*(19\d{2}|20\d{2})\s*\)/g, '')
      .replace(/\s*\[\s*(19\d{2}|20\d{2})\s*\]/g, '')
      // Remove season and episode markers like S01E02
      .replace(/s\d{1,2}\s?e\d{1,2}.*$/i, '')
      .replace(/season\s?\d+.*$/i, '')
      .replace(/temporada\s?\d+.*$/i, '')
      // Remove common release tags
      .replace(/\b(1080p|720p|2160p|4k|uhd|bluray|blu-ray|web-dl|webrip|hdrip|dvdrip|x264|x265|hevc|aac|ac3|atmos|dts|remux)\b/gi, '')
      // Replace dots and underscores with spaces
      .replace(/[._]/g, ' ')
      // Remove extra brackets
      .replace(/[\(\[\{].*?[\)\]\}]/g, '')
      // Remove trailing hyphens
      .replace(/[-–—]\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    return { title: clean || rawTitle.trim(), year };
  }

  /**
   * Fetches metadata for a movie or TV series by title
   */
  static async fetchMetadata(
    rawTitle: string,
    type: 'movie' | 'series' = 'movie',
    signal?: AbortSignal
  ): Promise<ImdbMetadata | null> {
    const { title, year } = this.cleanTitle(rawTitle);
    if (!title || title.length < 2) return null;

    const cacheKey = `${type}:${title.toLowerCase()}:${year || ''}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // 1. Try Cinemeta API (Direct IMDb-backed Stremio catalog)
      const cinemetaType = type === 'series' ? 'series' : 'movie';
      const searchUrl = `https://v3-cinemeta.strem.io/catalog/${cinemetaType}/top/search=${encodeURIComponent(title)}.json`;
      
      const res = await fetch(searchUrl, { signal });
      if (res.ok) {
        const data = await res.json();
        if (data.metas && data.metas.length > 0) {
          // If we have a year, prefer the item matching the year
          let match = data.metas[0];
          if (year) {
            const yearMatch = data.metas.find((m: any) => m.year?.toString() === year);
            if (yearMatch) match = yearMatch;
          }

          if (match) {
            const result: ImdbMetadata = {
              imdbId: match.id,
              title: match.name || title,
              year: match.year?.toString() || year,
              rating: match.imdbRating ? parseFloat(match.imdbRating) : undefined,
              poster: match.poster || undefined,
              backdrop: match.background || undefined,
              genres: Array.isArray(match.genres) ? match.genres : undefined,
              plot: match.description || undefined,
              type,
            };

            // Optionally get full details if ID is available
            if (match.id && match.id.startsWith('tt')) {
              try {
                const detailRes = await fetch(`https://v3-cinemeta.strem.io/meta/${cinemetaType}/${match.id}.json`, { signal });
                if (detailRes.ok) {
                  const detailData = await detailRes.json();
                  if (detailData.meta) {
                    const dm = detailData.meta;
                    result.plot = dm.description || result.plot;
                    result.director = Array.isArray(dm.director) ? dm.director.join(', ') : dm.director;
                    result.cast = Array.isArray(dm.cast) ? dm.cast.slice(0, 5) : undefined;
                    result.runtime = dm.runtime;
                    result.backdrop = dm.background || result.backdrop;
                    result.poster = dm.poster || result.poster;
                  }
                }
              } catch {
                // Ignore detail fetch errors, basic meta is sufficient
              }
            }

            this.cache.set(cacheKey, result);
            return result;
          }
        }
      }

      // 2. Fallback for TV Series: TVMaze API
      if (type === 'series') {
        const tvmazeRes = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}`, { signal });
        if (tvmazeRes.ok) {
          const show = await tvmazeRes.json();
          if (show && show.name) {
            const cleanSummary = show.summary ? show.summary.replace(/<[^>]*>/g, '') : undefined;
            const result: ImdbMetadata = {
              imdbId: show.externals?.imdb,
              title: show.name,
              year: show.premiered ? show.premiered.substring(0, 4) : year,
              rating: show.rating?.average ? parseFloat(show.rating.average) : undefined,
              poster: show.image?.original || show.image?.medium,
              backdrop: show.image?.original,
              genres: show.genres,
              plot: cleanSummary,
              type: 'series',
            };
            this.cache.set(cacheKey, result);
            return result;
          }
        }
      }

      // 3. Fallback for Movies: iTunes Search API
      const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(title)}&media=movie&limit=1`, { signal });
      if (itunesRes.ok) {
        const itunesData = await itunesRes.json();
        if (itunesData.results && itunesData.results.length > 0) {
          const item = itunesData.results[0];
          // Upgrade artwork to high-res
          const poster = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x900bb') : undefined;
          const result: ImdbMetadata = {
            title: item.trackName || title,
            year: item.releaseDate ? item.releaseDate.substring(0, 4) : year,
            poster,
            backdrop: poster,
            genres: item.primaryGenreName ? [item.primaryGenreName] : undefined,
            plot: item.longDescription || item.shortDescription,
            type: 'movie',
          };
          this.cache.set(cacheKey, result);
          return result;
        }
      }

      this.cache.set(cacheKey, null);
      return null;
    } catch (e) {
      this.cache.set(cacheKey, null);
      return null;
    }
  }
}
