import { SnapshotResponseDto } from '@collegebus/contracts';
import { MobileCacheStore } from '../store/cache-store.js';

export interface SnapshotFetchResult {
  snapshot: SnapshotResponseDto | null;
  etag?: string | undefined;
  fromCache: boolean;
  isStale: boolean;
  status: number;
  error?: string | undefined;
}

export type SnapshotSubscriber = (result: SnapshotFetchResult) => void;

export interface SnapshotClientOptions {
  baseUrl: string;
  tokenProvider: () => Promise<string | null>;
  pollIntervalMs?: number;
}

export class SnapshotPollingClient {
  private currentEtag?: string | undefined;
  private isPolling = false;
  private pollTimer?: NodeJS.Timeout | undefined;
  private subscribers = new Set<SnapshotSubscriber>();

  constructor(
    private readonly cacheStore: MobileCacheStore,
    private readonly fetchFn: (
      url: string,
      headers: Record<string, string>,
    ) => Promise<{ status: number; headers: Record<string, string>; body?: unknown }>,
    private readonly options: SnapshotClientOptions,
  ) {}

  public subscribe(subscriber: SnapshotSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  private notify(result: SnapshotFetchResult): void {
    for (const sub of this.subscribers) {
      sub(result);
    }
  }

  /**
   * Fetches a snapshot for a given route using conditional GET with ETag.
   */
  public async fetchSnapshot(routeId: string): Promise<SnapshotFetchResult> {
    const token = await this.options.tokenProvider();
    const cached = this.cacheStore.getRouteSnapshot(routeId);

    // If offline, return cached immediately
    if (!this.cacheStore.isOnline()) {
      const result: SnapshotFetchResult = {
        snapshot: cached.snapshot,
        etag: cached.etag,
        fromCache: true,
        isStale: true,
        status: 200,
        error: cached.snapshot ? undefined : 'No offline snapshot available',
      };
      this.notify(result);
      return result;
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const etagToSend = this.currentEtag || cached.etag;
    if (etagToSend) {
      headers['If-None-Match'] = etagToSend;
    }

    try {
      const res = await this.fetchFn(
        `${this.options.baseUrl}/api/v1/snapshot?route_id=${encodeURIComponent(routeId)}`,
        headers,
      );

      if (res.status === 304) {
        // HTTP 304 Not Modified: return cached snapshot
        const result: SnapshotFetchResult = {
          snapshot: cached.snapshot,
          etag: etagToSend,
          fromCache: true,
          isStale: false,
          status: 304,
        };
        this.notify(result);
        return result;
      }

      if (res.status === 200 && res.body) {
        const newEtag = res.headers['etag'] || res.headers['ETag'];
        const snapshot = res.body as SnapshotResponseDto;
        this.currentEtag = newEtag;

        // Update cache
        this.cacheStore.setRouteSnapshot(routeId, snapshot, newEtag, 30000);

        const result: SnapshotFetchResult = {
          snapshot,
          etag: newEtag,
          fromCache: false,
          isStale: false,
          status: 200,
        };
        this.notify(result);
        return result;
      }

      if (res.status === 404) {
        const result: SnapshotFetchResult = {
          snapshot: null,
          fromCache: false,
          isStale: false,
          status: 404,
          error: 'Route not found or not in caller assigned scope',
        };
        this.notify(result);
        return result;
      }

      throw new Error(`Unexpected server response: ${res.status}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Fall back to stale cache on network/server error
      const result: SnapshotFetchResult = {
        snapshot: cached.snapshot,
        etag: cached.etag,
        fromCache: true,
        isStale: true,
        status: 0,
        error: msg,
      };
      this.notify(result);
      return result;
    }
  }

  /**
   * Starts periodic polling for a route.
   */
  public startPolling(routeId: string): void {
    if (this.isPolling) return;
    this.isPolling = true;

    const interval = this.options.pollIntervalMs || 3000;
    const poll = async () => {
      if (!this.isPolling) return;
      await this.fetchSnapshot(routeId);
      if (this.isPolling) {
        this.pollTimer = setTimeout(poll, interval);
      }
    };

    poll().catch(() => {});
  }

  public stopPolling(): void {
    this.isPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }
}
