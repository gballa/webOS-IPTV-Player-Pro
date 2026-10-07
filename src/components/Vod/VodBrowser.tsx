import React, { useState, useMemo, useEffect, useRef } from 'react';
import { VodItem, AppSettings } from '../../types/iptv';
import { VirtualGrid } from '../Common/VirtualGrid';
import {
  Film,
  Clapperboard,
  Star,
  Play,
  X,
  Plus,
  Check,
  Clock,
  Bookmark,
  Sparkles,
  Search,
  Layers,
  ChevronRight,
  Tv,
  Info,
  Lock,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { globalRemote, RemoteEvent } from '../../services/RemoteController';
import { PinEntryModal } from '../Common/PinEntryModal';
import { ImdbService, ImdbMetadata } from '../../services/ImdbService';

interface VodBrowserProps {
  vodItems: VodItem[];
  movies?: VodItem[];
  series?: VodItem[];
  onPlayVod: (item: VodItem, streamUrl?: string) => void;
  defaultType?: 'movie' | 'series';
  settings?: AppSettings;
}

export const VodBrowser: React.FC<VodBrowserProps> = ({
  vodItems,
  movies,
  series,
  onPlayVod,
  defaultType = 'movie',
  settings,
}) => {
  const [activeType, setActiveType] = useState<'movie' | 'series'>(defaultType);
  const [selectedVod, setSelectedVod] = useState<VodItem | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [watchlistIds, setWatchlistIds] = useState<string[]>(['vod-sintel']);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('ALL');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(650);
  const [gridColumns, setGridColumns] = useState(5);

  // Parental controls unlocked VOD items session cache
  const [unlockedVodIds, setUnlockedVodIds] = useState<Set<string>>(new Set());
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingVodItem, setPendingVodItem] = useState<VodItem | null>(null);

  // IMDb metadata cache & fetching status
  const [imdbDataMap, setImdbDataMap] = useState<Record<string, ImdbMetadata>>({});
  const [loadingImdb, setLoadingImdb] = useState(false);
  const [isBulkFetchingImdb, setIsBulkFetchingImdb] = useState(false);

  // Auto-fetch rich IMDb metadata when item inspector is opened
  useEffect(() => {
    if (!selectedVod) return;
    if (imdbDataMap[selectedVod.id]) return;

    setLoadingImdb(true);
    ImdbService.fetchMetadata(selectedVod.title, selectedVod.type)
      .then((meta) => {
        if (meta) {
          setImdbDataMap((prev) => ({ ...prev, [selectedVod.id]: meta }));
        }
      })
      .finally(() => setLoadingImdb(false));
  }, [selectedVod, imdbDataMap]);

  // Bulk enrich visible catalog items with IMDb data (posters, ratings, plots)
  const handleBulkFetchImdb = async () => {
    if (isBulkFetchingImdb) return;
    setIsBulkFetchingImdb(true);
    try {
      const candidates = filteredItems.slice(0, 24).filter((it) => !imdbDataMap[it.id]);
      for (const it of candidates) {
        const meta = await ImdbService.fetchMetadata(it.title, it.type);
        if (meta) {
          setImdbDataMap((prev) => ({ ...prev, [it.id]: meta }));
        }
      }
    } finally {
      setIsBulkFetchingImdb(false);
    }
  };

  // Check if VOD item is restricted by Parental Controls
  const isVodLocked = (item: VodItem) => {
    if (!settings?.parentalControlActive) return false;
    if (unlockedVodIds.has(item.id)) return false;
    const genre = item.genre?.toLowerCase() || '';
    const title = item.title?.toLowerCase() || '';
    const lockedGenres = settings?.lockedVodGenres || ['Adult', '18+'];
    const lockedCats = settings?.lockedCategories || [];
    const isGenreMatch = lockedGenres.some((g) => genre.includes(g.toLowerCase()) || title.includes(g.toLowerCase()));
    const isCatMatch = lockedCats.some((c) => genre.includes(c.toLowerCase()) || title.includes(c.toLowerCase()));
    return isGenreMatch || isCatMatch;
  };

  // Debounce search input to maintain 60 FPS on 10,000+ catalogs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setFocusedIndex(0);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Dynamic viewport sizing
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 1600) setGridColumns(6);
      else if (width >= 1200) setGridColumns(5);
      else if (width >= 900) setGridColumns(4);
      else if (width >= 640) setGridColumns(3);
      else setGridColumns(2);

      setViewportHeight(Math.max(450, window.innerHeight - 170));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Separate pools for movies and TV series
  const currentPool: VodItem[] = useMemo(() => {
    if (activeType === 'movie') {
      if (movies && movies.length > 0) return movies;
      return vodItems.filter((i) => i.type === 'movie');
    } else {
      if (series && series.length > 0) return series;
      return vodItems.filter((i) => i.type === 'series');
    }
  }, [activeType, movies, series, vodItems]);

  // Pre-calculate genre counts in O(N) single pass
  const { genres, genreCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set('ALL', currentPool.length);

    currentPool.forEach((item) => {
      const g = item.genre?.trim() || 'General';
      counts.set(g, (counts.get(g) || 0) + 1);
    });

    const sortedGenres = Array.from(counts.keys())
      .filter((k) => k !== 'ALL')
      .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));

    return {
      genres: ['ALL', ...sortedGenres],
      genreCounts: counts,
    };
  }, [currentPool]);

  // Filtered catalog
  const filteredItems = useMemo(() => {
    return currentPool.filter((item) => {
      if (settings?.parentalControlActive && settings?.hideLockedContent) {
        if (isVodLocked(item)) return false;
      }
      if (selectedGenre !== 'ALL') {
        const itemGenre = item.genre?.trim() || 'General';
        if (itemGenre !== selectedGenre) return false;
      }
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesGenre = item.genre ? item.genre.toLowerCase().includes(q) : false;
        return matchesTitle || matchesGenre;
      }
      return true;
    });
  }, [currentPool, selectedGenre, debouncedSearch, settings?.parentalControlActive, settings?.hideLockedContent, unlockedVodIds, settings?.lockedVodGenres]);

  // Sample Continue Watching items
  const continueWatchingItems = useMemo(() => {
    return currentPool.slice(0, 3).map((item, idx) => ({
      ...item,
      progressPercent: idx === 0 ? 65 : idx === 1 ? 32 : 88,
    }));
  }, [currentPool]);

  // Watchlist items
  const watchlistItems = useMemo(() => {
    return currentPool.filter((v) => watchlistIds.includes(v.id));
  }, [currentPool, watchlistIds]);

  const toggleWatchlist = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWatchlistIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Remote key handling for TV remote
  useEffect(() => {
    const unsubscribe = globalRemote.subscribe((event: RemoteEvent) => {
      if (selectedVod) {
        if (event.action === 'BACK') {
          setSelectedVod(null);
        }
        return;
      }

      switch (event.action) {
        case 'LEFT':
          setFocusedIndex((prev) => Math.max(0, prev - 1));
          break;
        case 'RIGHT':
          setFocusedIndex((prev) => Math.min(filteredItems.length - 1, prev + 1));
          break;
        case 'UP':
          setFocusedIndex((prev) => Math.max(0, prev - gridColumns));
          break;
        case 'DOWN':
          setFocusedIndex((prev) => Math.min(filteredItems.length - 1, prev + gridColumns));
          break;
        case 'ENTER':
          if (filteredItems[focusedIndex]) {
            setSelectedVod(filteredItems[focusedIndex]);
          }
          break;
        case 'GREEN':
          if (filteredItems[focusedIndex]) {
            toggleWatchlist(filteredItems[focusedIndex].id);
          }
          break;
        case 'PLAY':
          if (filteredItems[focusedIndex]) {
            onPlayVod(filteredItems[focusedIndex]);
          }
          break;
      }
    });

    return () => unsubscribe();
  }, [selectedVod, filteredItems, focusedIndex, gridColumns, onPlayVod]);

  return (
    <div className="flex-1 flex overflow-hidden bg-[var(--tv-bg-primary)] select-none">
      {/* 1. Left Sidebar: Categories & Genres */}
      <div className="w-64 border-r border-[var(--tv-border)] bg-[var(--tv-bg-surface)] p-3.5 flex flex-col shrink-0">
        {/* Toggle Movies vs TV Series */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/5 border border-white/10 rounded-xl mb-3">
          <button
            onClick={() => {
              setActiveType('movie');
              setSelectedGenre('ALL');
              setFocusedIndex(0);
            }}
            className={`tv-focusable flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeType === 'movie'
                ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Movies</span>
          </button>

          <button
            onClick={() => {
              setActiveType('series');
              setSelectedGenre('ALL');
              setFocusedIndex(0);
            }}
            className={`tv-focusable flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeType === 'series'
                ? 'bg-[var(--tv-accent)] text-black shadow-md shadow-[var(--tv-accent-glow)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Clapperboard className="w-3.5 h-3.5" />
            <span>Series</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search ${activeType === 'movie' ? 'movies' : 'series'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--tv-bg-elevated)] border border-[var(--tv-border)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[var(--tv-text-primary)] placeholder-zinc-500 focus:outline-none focus:border-[var(--tv-accent)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* Genre / Category List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 py-1 flex items-center space-x-1.5">
            <Layers className="w-3 h-3 text-[var(--tv-accent)]" />
            <span>Genres & Collections ({genres.length})</span>
          </div>

          {genres.map((genre) => {
            const isSelected = selectedGenre === genre;
            const count = genreCounts.get(genre) || 0;

            return (
              <button
                key={genre}
                onClick={() => {
                  setSelectedGenre(genre);
                  setFocusedIndex(0);
                }}
                className={`tv-focusable w-full px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between border transition-all ${
                  isSelected
                    ? 'bg-[var(--tv-accent)] text-black font-extrabold shadow-md shadow-[var(--tv-accent-glow)] border-[var(--tv-accent)]'
                    : 'border-transparent text-[var(--tv-text-secondary)] hover:bg-white/10 hover:text-[var(--tv-text-primary)]'
                }`}
              >
                <span className="truncate">{genre === 'ALL' ? 'All Titles' : genre}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isSelected ? 'bg-black/20 text-black font-bold' : 'text-zinc-400'
                  }`}
                >
                  {count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Remote guide */}
        <div className="pt-2.5 border-t border-[var(--tv-border)] text-[10px] text-zinc-400 space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tv-accent)]" />
            <span>Enter: View Details / Seasons</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Green: Add to Watchlist</span>
          </div>
        </div>
      </div>

      {/* 2. Centre: Virtualized Catalog Grid */}
      <div className="flex-1 p-5 flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-black text-[var(--tv-text-primary)] tracking-tight">
              {activeType === 'movie' ? 'On-Demand Movies' : 'TV Series & Serials'}
            </h2>
            <div className="flex items-center space-x-2 text-xs text-zinc-400">
              <span className="font-mono font-bold text-[var(--tv-accent)]">
                {filteredItems.length.toLocaleString()}
              </span>
              <span>titles available</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <button
              onClick={handleBulkFetchImdb}
              disabled={isBulkFetchingImdb}
              className={`px-3 py-1 rounded-xl font-bold flex items-center space-x-1.5 border transition-all ${
                isBulkFetchingImdb
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/10'
              }`}
              title="Fetch IMDb posters, ratings, and synopsis for titles in this view"
            >
              {isBulkFetchingImdb ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Fetching IMDb...</span>
                </>
              ) : (
                <>
                  <span className="px-1 py-0.2 rounded bg-[#f5c518] text-black font-black text-[9px] leading-none">
                    IMDb
                  </span>
                  <span>Fetch Info</span>
                </>
              )}
            </button>
            <span className="px-2 py-1 rounded-xl bg-white/5 border border-white/10 text-[var(--tv-accent)] font-bold hidden sm:inline">
              60 FPS Virtualized Grid
            </span>
          </div>
        </div>

        {/* Virtualized Grid */}
        <div className="flex-1 overflow-hidden">
          {filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500">
              <Film className="w-12 h-12 mb-3 stroke-[1.5]" />
              <p className="text-sm font-semibold">No titles found matching current criteria</p>
            </div>
          ) : (
            <VirtualGrid
              items={filteredItems}
              columns={gridColumns}
              rowHeight={310}
              viewportHeight={viewportHeight}
              focusedIndex={focusedIndex}
              getItemKey={(item) => item.id}
              renderItem={(item, idx, isFocused) => {
                const inWatchlist = watchlistIds.includes(item.id);
                const seasonCount = item.seasons?.length || 1;
                const locked = isVodLocked(item);
                const imdb = imdbDataMap[item.id];
                const posterUrl = imdb?.poster || item.poster;
                const ratingVal = imdb?.rating || item.rating;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setFocusedIndex(idx);
                      if (locked) {
                        setPendingVodItem(item);
                        setIsPinModalOpen(true);
                      } else {
                        setSelectedVod(item);
                      }
                    }}
                    className={`tv-card-focus group relative rounded-2xl overflow-hidden cursor-pointer flex flex-col border transition-all duration-150 h-full ${
                      isFocused
                        ? 'bg-[var(--tv-accent-subtle)] border-[var(--tv-accent)] shadow-xl shadow-[var(--tv-accent-glow)] ring-1 ring-[var(--tv-accent)]'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Poster Image */}
                    <div className="aspect-[2/3] w-full bg-zinc-900 relative overflow-hidden shrink-0">
                      {posterUrl ? (
                        <img
                          src={posterUrl}
                          alt={item.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-zinc-600 p-2 text-center">
                          {item.type === 'movie' ? (
                            <Film className="w-10 h-10 mb-1" />
                          ) : (
                            <Clapperboard className="w-10 h-10 mb-1" />
                          )}
                          <span className="text-[10px] font-bold text-zinc-500 line-clamp-2">
                            {item.title}
                          </span>
                        </div>
                      )}

                      {/* Locked Badge Overlay */}
                      {locked && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg bg-red-600 text-white font-bold text-[9px] flex items-center space-x-1 shadow-md z-10">
                          <Lock className="w-3 h-3" />
                          <span>LOCKED</span>
                        </div>
                      )}

                      {/* Rating Badge (Enriched with IMDb logo) */}
                      {ratingVal && !locked && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg bg-black/85 backdrop-blur-md flex items-center space-x-1 text-[10px] font-bold border border-white/10 shadow-md">
                          <span className="px-1 py-0.2 rounded bg-[#f5c518] text-black font-black text-[8px] leading-none">
                            IMDb
                          </span>
                          <span className="text-amber-400 font-mono font-extrabold">{ratingVal.toFixed(1)}</span>
                        </div>
                      )}

                      {/* Type Badge: Series vs 4K Movie */}
                      <div className="absolute bottom-2 left-2 flex items-center space-x-1">
                        {item.type === 'series' ? (
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/80 text-[9px] font-bold text-white backdrop-blur-md">
                            {seasonCount} {seasonCount === 1 ? 'Season' : 'Seasons'}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-[var(--tv-accent)] text-black text-[9px] font-black">
                            4K UHD
                          </span>
                        )}
                      </div>

                      {/* Watchlist Toggle */}
                      <button
                        onClick={(e) => toggleWatchlist(item.id, e)}
                        className={`absolute top-2 left-2 p-1.5 rounded-lg backdrop-blur-md border transition-all ${
                          inWatchlist
                            ? 'bg-amber-500 border-amber-400 text-black'
                            : 'bg-black/60 border-white/20 text-white hover:bg-black/90'
                        }`}
                        title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                      >
                        {inWatchlist ? (
                          <Check className="w-3 h-3 stroke-[3]" />
                        ) : (
                          <Plus className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {/* Metadata Card Footer */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-[var(--tv-accent)] transition-colors truncate">
                          {item.title}
                        </h4>
                        <div className="flex items-center space-x-1.5 text-[10px] text-zinc-400 mt-0.5">
                          <span>{item.year || '2024'}</span>
                          <span>•</span>
                          <span className="truncate">{item.genre || 'Entertainment'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>
      </div>

      {/* 3. Detailed Inspector Modal for Movies & TV Series */}
      {selectedVod && (() => {
        const currentImdb = imdbDataMap[selectedVod.id];
        const backdropUrl = currentImdb?.backdrop || currentImdb?.poster || selectedVod.backdrop || selectedVod.poster;
        const displayRating = currentImdb?.rating || selectedVod.rating;
        const displayPlot = currentImdb?.plot || selectedVod.plot;

        return (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
            <div className="bg-[#121218] border border-white/15 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
              {/* Header with Backdrop */}
              <div className="relative h-64 sm:h-72 bg-zinc-900 shrink-0">
                {backdropUrl && (
                  <img
                    src={backdropUrl}
                    alt={selectedVod.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-35"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#121218] via-[#121218]/50 to-transparent" />

                {/* Close Button */}
                <button
                  onClick={() => setSelectedVod(null)}
                  className="absolute top-4 right-4 p-2.5 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/15 transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Banner Details */}
                <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="space-y-1.5 min-w-0 flex-1 pr-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--tv-accent)]">
                      <span>{selectedVod.type === 'series' ? 'TV SERIES & SERIALS' : 'FEATURE FILM'}</span>
                      <span>•</span>
                      <span>{currentImdb?.year || selectedVod.year || '2024'}</span>
                      <span>•</span>
                      <span>{currentImdb?.genres?.slice(0, 2).join(' / ') || selectedVod.genre || 'General'}</span>

                      {/* IMDb Gold Rating Badge */}
                      {displayRating && (
                        <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-[#f5c518] text-black font-black text-[11px] shadow-md">
                          <span>IMDb</span>
                          <span className="font-mono">{displayRating.toFixed(1)}/10</span>
                        </div>
                      )}

                      {/* IMDb Fetching indicator */}
                      {loadingImdb && (
                        <span className="flex items-center space-x-1 text-amber-300 text-[11px] font-medium bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Fetching IMDb...</span>
                        </span>
                      )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
                      {selectedVod.title}
                    </h1>
                  </div>

                  {/* Primary Play Action Button & Re-sync */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => {
                        setLoadingImdb(true);
                        ImdbService.fetchMetadata(selectedVod.title, selectedVod.type)
                          .then((meta) => {
                            if (meta) {
                              setImdbDataMap((prev) => ({ ...prev, [selectedVod.id]: meta }));
                            }
                          })
                          .finally(() => setLoadingImdb(false));
                      }}
                      className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-zinc-300 hover:text-white transition-all"
                      title="Re-query IMDb & TMDB catalog for this title"
                    >
                      <Sparkles className="w-5 h-5 text-amber-400" />
                    </button>

                    {selectedVod.type === 'movie' && (
                      <button
                        onClick={() => {
                          onPlayVod(selectedVod);
                          setSelectedVod(null);
                        }}
                        className="tv-focusable flex items-center space-x-2 px-6 py-3 rounded-2xl bg-[var(--tv-accent)] text-black font-extrabold text-sm shadow-xl shadow-[var(--tv-accent-glow)] hover:scale-105 transition-all"
                      >
                        <Play className="w-5 h-5 fill-black" />
                        <span>Watch Movie</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Content Body: Movie Synopsis OR Series Season/Episode Browser */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* IMDb Technical & Production Metadata Grid */}
                {currentImdb && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs">
                    {currentImdb.director && (
                      <div>
                        <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Director</div>
                        <div className="font-semibold text-white mt-0.5 truncate">{currentImdb.director}</div>
                      </div>
                    )}
                    {currentImdb.cast && currentImdb.cast.length > 0 && (
                      <div className="sm:col-span-2">
                        <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Cast</div>
                        <div className="font-semibold text-white mt-0.5 truncate">{currentImdb.cast.join(', ')}</div>
                      </div>
                    )}
                    {currentImdb.runtime && (
                      <div>
                        <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Runtime</div>
                        <div className="font-semibold text-white mt-0.5">{currentImdb.runtime}</div>
                      </div>
                    )}
                    {currentImdb.imdbId && (
                      <div>
                        <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">IMDb ID</div>
                        <div className="font-mono font-bold text-amber-400 mt-0.5">{currentImdb.imdbId}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Synopsis */}
                <div>
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center space-x-2">
                    <span>Synopsis & Information</span>
                    {currentImdb?.imdbId && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#f5c518] text-black font-black">
                        Verified IMDb
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {displayPlot ||
                      `${selectedVod.title} is now streaming in ultra-high definition with full surround audio fidelity and HDR dynamic range enhancement.`}
                  </p>
                </div>

                {/* Series Season and Episode Selector */}
                {selectedVod.type === 'series' && selectedVod.seasons && selectedVod.seasons.length > 0 && (
                  <div className="space-y-4">
                    {/* Season Tabs */}
                    <div className="flex items-center space-x-2 border-b border-white/10 pb-3 overflow-x-auto">
                      <span className="text-xs font-bold text-zinc-400 mr-2 shrink-0">Season:</span>
                      {selectedVod.seasons.map((season) => (
                        <button
                          key={season.seasonNumber}
                          onClick={() => setSelectedSeason(season.seasonNumber)}
                          className={`tv-focusable px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                            selectedSeason === season.seasonNumber
                              ? 'bg-[var(--tv-accent)] text-black font-extrabold shadow-md'
                              : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                          }`}
                        >
                          Season {season.seasonNumber}
                        </button>
                      ))}
                    </div>

                    {/* Episode List */}
                    <div>
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                        Episodes (
                        {
                          selectedVod.seasons.find((s) => s.seasonNumber === selectedSeason)
                            ?.episodes.length || 0
                        }{' '}
                        available)
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {selectedVod.seasons
                          .find((s) => s.seasonNumber === selectedSeason)
                          ?.episodes.map((ep) => (
                            <div
                              key={ep.id}
                              onClick={() => {
                                onPlayVod(selectedVod, ep.streamUrl);
                                setSelectedVod(null);
                              }}
                              className="tv-focusable p-3 rounded-xl bg-white/5 border border-white/10 hover:border-[var(--tv-accent)] flex items-center justify-between cursor-pointer group transition-all"
                            >
                              <div className="flex items-center space-x-3 min-w-0 pr-2">
                                <span className="font-mono text-xs font-bold text-[var(--tv-accent)] shrink-0">
                                  E{ep.episodeNumber.toString().padStart(2, '0')}
                                </span>
                                <span className="text-xs font-semibold text-white group-hover:text-[var(--tv-accent)] truncate">
                                  {ep.title}
                                </span>
                              </div>

                              <button className="p-1.5 rounded-lg bg-[var(--tv-accent)] text-black shrink-0">
                                <Play className="w-3.5 h-3.5 fill-black" />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Parental PIN Entry Security Modal */}
      <PinEntryModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingVodItem(null);
        }}
        onSuccess={() => {
          if (pendingVodItem) {
            setUnlockedVodIds((prev) => new Set([...prev, pendingVodItem.id]));
            setSelectedVod(pendingVodItem);
          }
          setIsPinModalOpen(false);
          setPendingVodItem(null);
        }}
        correctPin={settings?.parentalPin || '0000'}
        targetName={pendingVodItem ? `${pendingVodItem.title} (${pendingVodItem.genre || 'VOD'})` : 'Restricted Title'}
        description="Enter your 4-digit security PIN to unlock this protected on-demand movie or TV series."
      />
    </div>
  );
};
