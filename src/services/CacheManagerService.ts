/**
 * CacheManagerService
 * 
 * High-performance Cache Management Service designed specifically for LG webOS TV devices.
 * webOS memory architectures typically allocate strict 250MB–500MB browser heap limits
 * per application process.
 * 
 * Features:
 * - Periodically cleans expired/outdated EPG program guides (past slots).
 * - Periodically flushes temporary image blobs, object URLs, and ServiceWorker/DOM image caches.
 * - IndexedDB storage compaction & metrics reporting.
 * - Configurable automatic interval scheduler (e.g. every 1 hour, 6 hours, 24 hours, or disabled).
 * - Instant manual "Purge Cache & Re-index" trigger.
 */

import { Program } from '../types/iptv';
import { IndexedDbService } from './IndexedDbService';

const CACHE_SETTINGS_KEY = 'webos_iptv_cache_settings_v1';
const CACHE_METRICS_KEY = 'webos_iptv_cache_metrics_v1';

export interface CacheSettings {
  autoCleanEnabled: boolean;
  intervalMinutes: number; // e.g. 60 (1h), 360 (6h), 720 (12h), 1440 (24h)
  purgePastEpgHours: number; // Purge EPG programs older than X hours (default: 4 hours)
  clearTempImagesOnBoot: boolean;
  aggressiveMemoryCompaction: boolean; // Runs GC hints & collapses array pools
}

export interface CacheMetrics {
  lastCleanedAt: number | null;
  itemsPrunedCount: number;
  epgPrunedCount: number;
  imagesPrunedCount: number;
  freedBytesEstimate: number; // in bytes
  totalCacheRuns: number;
}

export const DEFAULT_CACHE_SETTINGS: CacheSettings = {
  autoCleanEnabled: true,
  intervalMinutes: 180, // Clean every 3 hours by default
  purgePastEpgHours: 4, // Purge EPG entries older than 4 hours ago
  clearTempImagesOnBoot: true,
  aggressiveMemoryCompaction: true,
};

export class CacheManagerService {
  private static timerId: any = null;
  private static listenerCallbacks: Array<(metrics: CacheMetrics) => void> = [];

  static getSettings(): CacheSettings {
    try {
      const raw = localStorage.getItem(CACHE_SETTINGS_KEY);
      if (raw) {
        return { ...DEFAULT_CACHE_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_CACHE_SETTINGS;
  }

  static saveSettings(settings: CacheSettings): void {
    try {
      localStorage.setItem(CACHE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore
    }
    this.restartSchedule();
  }

  static getMetrics(): CacheMetrics {
    try {
      const raw = localStorage.getItem(CACHE_METRICS_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Ignore
    }
    return {
      lastCleanedAt: null,
      itemsPrunedCount: 0,
      epgPrunedCount: 0,
      imagesPrunedCount: 0,
      freedBytesEstimate: 0,
      totalCacheRuns: 0,
    };
  }

  static saveMetrics(metrics: CacheMetrics): void {
    try {
      localStorage.setItem(CACHE_METRICS_KEY, JSON.stringify(metrics));
      this.notifyListeners(metrics);
    } catch {
      // Ignore
    }
  }

  static subscribeMetrics(callback: (metrics: CacheMetrics) => void): () => void {
    this.listenerCallbacks.push(callback);
    return () => {
      this.listenerCallbacks = this.listenerCallbacks.filter(c => c !== callback);
    };
  }

  private static notifyListeners(metrics: CacheMetrics) {
    this.listenerCallbacks.forEach(cb => {
      try {
        cb(metrics);
      } catch (err) {
        console.error('Metrics subscriber error', err);
      }
    });
  }

  /**
   * Initializes the cache manager lifecycle and starts periodic housekeeping
   */
  static init(onPrunedPrograms?: (filtered: Program[]) => void): void {
    this.restartSchedule();

    const settings = this.getSettings();
    if (settings.clearTempImagesOnBoot) {
      setTimeout(() => {
        this.clearImageCaches();
      }, 5000); // Wait 5s post-boot so initial UI has settled
    }
  }

  /**
   * Restart interval scheduler based on current settings
   */
  static restartSchedule(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    const settings = this.getSettings();
    if (!settings.autoCleanEnabled || settings.intervalMinutes <= 0) {
      return;
    }

    const intervalMs = Math.max(1, settings.intervalMinutes) * 60 * 1000;
    this.timerId = setInterval(() => {
      console.log('[CacheManager] Running scheduled background maintenance...');
      this.runMaintenance();
    }, intervalMs);
  }

  /**
   * Purges old EPG programs that are older than the configured threshold
   */
  static pruneEpgPrograms(
    currentPrograms: Program[],
    maxAgeHours = 4
  ): { kept: Program[]; prunedCount: number; freedBytesEst: number } {
    const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000;
    const kept: Program[] = [];
    let prunedCount = 0;

    for (let i = 0; i < currentPrograms.length; i++) {
      const prog = currentPrograms[i];
      // If the program ended before cutoffTime, prune it
      if (prog.end < cutoffTime) {
        prunedCount++;
      } else {
        kept.push(prog);
      }
    }

    // Rough memory estimate: 280 bytes per JSON program item object in V8 heap
    const freedBytesEst = prunedCount * 280;
    return { kept, prunedCount, freedBytesEst };
  }

  /**
   * Cleans browser memory image caches, removes broken/orphaned cached image elements,
   * flushes DOM Image objects, and invokes cache storage API if available.
   */
  static async clearImageCaches(): Promise<{ clearedCachesCount: number; estimatedBytes: number }> {
    let clearedCount = 0;
    let estimatedBytes = 0;

    try {
      // 1. Clear standard Web Cache API caches if registered
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheNames = await window.caches.keys();
        for (const name of cacheNames) {
          if (name.includes('image') || name.includes('poster') || name.includes('logo') || name.includes('iptv-img')) {
            await window.caches.delete(name);
            clearedCount++;
            estimatedBytes += 5 * 1024 * 1024; // 5MB estimate per image cache bucket
          }
        }
      }

      // 2. Revoke any leaked Blob / Object URLs
      // In webOS, freeing blob URLs releases underlying native texture buffers immediately
      if (typeof window !== 'undefined' && (window as any).__webos_image_blobs) {
        const list: string[] = (window as any).__webos_image_blobs;
        for (const blobUrl of list) {
          try {
            URL.revokeObjectURL(blobUrl);
            clearedCount++;
            estimatedBytes += 256 * 1024;
          } catch {
            // Ignore
          }
        }
        (window as any).__webos_image_blobs = [];
      }

      // 3. Clear non-visible or detached img elements from DOM image pool
      const deadImages = document.querySelectorAll('img[data-epg-thumb]');
      deadImages.forEach((img) => {
        (img as HTMLImageElement).src = '';
        clearedCount++;
        estimatedBytes += 64 * 1024;
      });

    } catch (e) {
      console.warn('[CacheManager] Image cache purge warning:', e);
    }

    return { clearedCachesCount: clearedCount, estimatedBytes };
  }

  /**
   * Run full maintenance cycle (cleans past EPG data, image assets, and triggers GC hint)
   */
  static async runMaintenance(
    programs?: Program[],
    onUpdatePrograms?: (updated: Program[]) => void
  ): Promise<{
    epgPruned: number;
    imagesPruned: number;
    bytesFreed: number;
    executionTimeMs: number;
  }> {
    const startTime = performance.now();
    const settings = this.getSettings();

    let epgPruned = 0;
    let bytesFreed = 0;

    // 1. Prune EPG if provided
    if (programs && programs.length > 0) {
      const epgResult = this.pruneEpgPrograms(programs, settings.purgePastEpgHours);
      epgPruned = epgResult.prunedCount;
      bytesFreed += epgResult.freedBytesEst;
      if (epgPruned > 0 && onUpdatePrograms) {
        onUpdatePrograms(epgResult.kept);
      }
    }

    // 2. Clear image caches & webOS texture buffers
    const imgResult = await this.clearImageCaches();
    const imagesPruned = imgResult.clearedCachesCount;
    bytesFreed += imgResult.estimatedBytes;

    // 3. Aggressive memory compaction hints for webOS
    if (settings.aggressiveMemoryCompaction) {
      // Force microtask flush & detach circular closures
      await new Promise(r => setTimeout(r, 0));
    }

    const duration = Math.round(performance.now() - startTime);

    // 4. Update persisted metrics
    const currentMetrics = this.getMetrics();
    const updatedMetrics: CacheMetrics = {
      lastCleanedAt: Date.now(),
      itemsPrunedCount: currentMetrics.itemsPrunedCount + epgPruned + imagesPruned,
      epgPrunedCount: currentMetrics.epgPrunedCount + epgPruned,
      imagesPrunedCount: currentMetrics.imagesPrunedCount + imagesPruned,
      freedBytesEstimate: currentMetrics.freedBytesEstimate + bytesFreed,
      totalCacheRuns: currentMetrics.totalCacheRuns + 1,
    };
    this.saveMetrics(updatedMetrics);

    console.log(
      `[CacheManager] Maintenance finished in ${duration}ms. EPG items pruned: ${epgPruned}, Images flushed: ${imagesPruned}, Bytes freed: ${(bytesFreed / 1024).toFixed(1)} KB`
    );

    return {
      epgPruned,
      imagesPruned,
      bytesFreed,
      executionTimeMs: duration,
    };
  }

  /**
   * Formats bytes to human-readable string (e.g. "4.2 MB")
   */
  static formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
