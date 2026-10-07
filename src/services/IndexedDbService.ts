import { Channel, VodItem, PlaylistSource } from '../types/iptv';
import { DEFAULT_CHANNELS, SAMPLE_VOD } from './DefaultChannels';

const DB_NAME = 'webos_iptv_db_v2';
const DB_VERSION = 1;

export class IndexedDbService {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  static async getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported'));
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Channels store
        if (!db.objectStoreNames.contains('channels')) {
          const channelStore = db.createObjectStore('channels', { keyPath: 'id' });
          channelStore.createIndex('group', 'group', { unique: false });
          channelStore.createIndex('num', 'num', { unique: false });
        }

        // VOD Movies store
        if (!db.objectStoreNames.contains('vod_movies')) {
          const movieStore = db.createObjectStore('vod_movies', { keyPath: 'id' });
          movieStore.createIndex('genre', 'genre', { unique: false });
        }

        // VOD Series store
        if (!db.objectStoreNames.contains('vod_series')) {
          const seriesStore = db.createObjectStore('vod_series', { keyPath: 'id' });
          seriesStore.createIndex('genre', 'genre', { unique: false });
        }

        // Playlists store
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Save thousands of channels in non-blocking chunked transactions
   */
  static async saveChannels(channels: Channel[], clearExisting: boolean = true): Promise<void> {
    try {
      const db = await this.getDb();
      const chunkSize = 1500;

      if (clearExisting) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('channels', 'readwrite');
          const store = tx.objectStore('channels');
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }

      // Write in non-blocking chunks
      for (let i = 0; i < channels.length; i += chunkSize) {
        const chunk = channels.slice(i, i + chunkSize);
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('channels', 'readwrite');
          const store = tx.objectStore('channels');
          for (const item of chunk) {
            store.put(item);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

        // Yield to event loop periodically
        if (channels.length > 2000) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    } catch (e) {
      console.warn('[IndexedDbService] Error saving channels', e);
    }
  }

  static async getChannels(): Promise<Channel[]> {
    try {
      const db = await this.getDb();
      return new Promise<Channel[]>((resolve, reject) => {
        const tx = db.transaction('channels', 'readonly');
        const store = tx.objectStore('channels');
        const req = store.getAll();
        req.onsuccess = () => {
          const res = req.result;
          if (Array.isArray(res) && res.length > 0) {
            resolve(res);
          } else {
            resolve(DEFAULT_CHANNELS);
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return DEFAULT_CHANNELS;
    }
  }

  /**
   * Fast count of channels in IndexedDB
   */
  static async getChannelsCount(): Promise<number> {
    try {
      const db = await this.getDb();
      return new Promise<number>((resolve) => {
        const tx = db.transaction('channels', 'readonly');
        const store = tx.objectStore('channels');
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(DEFAULT_CHANNELS.length);
      });
    } catch {
      return DEFAULT_CHANNELS.length;
    }
  }

  /**
   * Save VOD movies to IndexedDB
   */
  static async saveVodMovies(movies: VodItem[], clearExisting: boolean = true): Promise<void> {
    try {
      const db = await this.getDb();
      const chunkSize = 1500;

      if (clearExisting) {
        await new Promise<void>((res, rej) => {
          const tx = db.transaction('vod_movies', 'readwrite');
          const store = tx.objectStore('vod_movies');
          const req = store.clear();
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        });
      }

      for (let i = 0; i < movies.length; i += chunkSize) {
        const chunk = movies.slice(i, i + chunkSize);
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('vod_movies', 'readwrite');
          const store = tx.objectStore('vod_movies');
          for (const m of chunk) {
            store.put(m);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

        if (movies.length > 2000) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    } catch (e) {
      console.warn('[IndexedDbService] Error saving VOD movies', e);
    }
  }

  static async getVodMovies(): Promise<VodItem[]> {
    try {
      const db = await this.getDb();
      return new Promise<VodItem[]>((resolve) => {
        const tx = db.transaction('vod_movies', 'readonly');
        const store = tx.objectStore('vod_movies');
        const req = store.getAll();
        req.onsuccess = () => {
          const res = req.result;
          if (Array.isArray(res) && res.length > 0) {
            resolve(res);
          } else {
            resolve(SAMPLE_VOD.filter((v) => v.type === 'movie'));
          }
        };
        req.onerror = () => resolve(SAMPLE_VOD.filter((v) => v.type === 'movie'));
      });
    } catch {
      return SAMPLE_VOD.filter((v) => v.type === 'movie');
    }
  }

  /**
   * Save VOD TV series to IndexedDB
   */
  static async saveVodSeries(series: VodItem[], clearExisting: boolean = true): Promise<void> {
    try {
      const db = await this.getDb();
      const chunkSize = 1500;

      if (clearExisting) {
        await new Promise<void>((res, rej) => {
          const tx = db.transaction('vod_series', 'readwrite');
          const store = tx.objectStore('vod_series');
          const req = store.clear();
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        });
      }

      for (let i = 0; i < series.length; i += chunkSize) {
        const chunk = series.slice(i, i + chunkSize);
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('vod_series', 'readwrite');
          const store = tx.objectStore('vod_series');
          for (const s of chunk) {
            store.put(s);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

        if (series.length > 2000) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    } catch (e) {
      console.warn('[IndexedDbService] Error saving VOD series', e);
    }
  }

  static async getVodSeries(): Promise<VodItem[]> {
    try {
      const db = await this.getDb();
      return new Promise<VodItem[]>((resolve) => {
        const tx = db.transaction('vod_series', 'readonly');
        const store = tx.objectStore('vod_series');
        const req = store.getAll();
        req.onsuccess = () => {
          const res = req.result;
          if (Array.isArray(res) && res.length > 0) {
            resolve(res);
          } else {
            resolve(SAMPLE_VOD.filter((v) => v.type === 'series'));
          }
        };
        req.onerror = () => resolve(SAMPLE_VOD.filter((v) => v.type === 'series'));
      });
    } catch {
      return SAMPLE_VOD.filter((v) => v.type === 'series');
    }
  }

  /**
   * Get database statistics across all stores
   */
  static async getStats(): Promise<{ channelsCount: number; moviesCount: number; seriesCount: number }> {
    try {
      const db = await this.getDb();
      const countStore = (storeName: string): Promise<number> =>
        new Promise((resolve) => {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const req = store.count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(0);
        });

      const [channelsCount, moviesCount, seriesCount] = await Promise.all([
        countStore('channels'),
        countStore('vod_movies'),
        countStore('vod_series'),
      ]);

      return {
        channelsCount: channelsCount || DEFAULT_CHANNELS.length,
        moviesCount: moviesCount || SAMPLE_VOD.filter((v) => v.type === 'movie').length,
        seriesCount: seriesCount || SAMPLE_VOD.filter((v) => v.type === 'series').length,
      };
    } catch {
      return {
        channelsCount: DEFAULT_CHANNELS.length,
        moviesCount: SAMPLE_VOD.filter((v) => v.type === 'movie').length,
        seriesCount: SAMPLE_VOD.filter((v) => v.type === 'series').length,
      };
    }
  }

  /**
   * Clear all stores in IndexedDB
   */
  static async clearAll(): Promise<void> {
    try {
      const db = await this.getDb();
      const stores = ['channels', 'vod_movies', 'vod_series'];
      for (const storeName of stores) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    } catch (e) {
      console.warn('[IndexedDbService] Error clearing database', e);
    }
  }
}
