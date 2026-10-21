import { SnapshotResponseDto } from '@collegebus/contracts';

export interface CacheEntry<T> {
  key: string;
  data: T;
  etag?: string | undefined;
  storedAt: number;
  ttlMs: number;
}

export interface OfflinePendingRequest {
  id: string;
  type: 'STOP_CHANGE_REQUEST' | 'LEAVE_APPLICATION' | 'ATTENDANCE_SCAN';
  payload: Record<string, unknown>;
  queuedAt: number;
  retryCount: number;
}

export class MobileCacheStore {
  private readonly storage = new Map<string, CacheEntry<unknown>>();
  private readonly offlineQueue: OfflinePendingRequest[] = [];
  private onlineStatus: boolean = true;

  public setOnline(status: boolean): void {
    this.onlineStatus = status;
  }

  public isOnline(): boolean {
    return this.onlineStatus;
  }

  /**
   * Generic cache set with TTL.
   */
  public set<T>(key: string, data: T, ttlMs: number = 30000, etag?: string): void {
    this.storage.set(key, {
      key,
      data,
      etag,
      storedAt: Date.now(),
      ttlMs,
    });
  }

  /**
   * Generic cache get with expiration metadata.
   */
  public get<T>(key: string): { data: T | null; etag?: string | undefined; isExpired: boolean } {
    const entry = this.storage.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return { data: null, isExpired: true };
    }

    const age = Date.now() - entry.storedAt;
    const isExpired = age > entry.ttlMs;

    return {
      data: entry.data,
      etag: entry.etag,
      isExpired,
    };
  }

  /**
   * Caches SnapshotResponseDto with its associated ETag.
   */
  public setRouteSnapshot(
    routeId: string,
    snapshot: SnapshotResponseDto,
    etag?: string | undefined,
    ttlMs: number = 30000,
  ): void {
    this.set(`snapshot:${routeId}`, snapshot, ttlMs, etag);
  }

  /**
   * Gets cached SnapshotResponseDto, allowing stale access if offline.
   */
  public getRouteSnapshot(routeId: string): {
    snapshot: SnapshotResponseDto | null;
    etag?: string | undefined;
    isStale: boolean;
  } {
    const res = this.get<SnapshotResponseDto>(`snapshot:${routeId}`);
    return {
      snapshot: res.data,
      etag: res.etag,
      isStale: res.isExpired,
    };
  }

  /**
   * Queues an offline request to be synced once connectivity resumes.
   */
  public queueOfflineAction(
    type: OfflinePendingRequest['type'],
    payload: Record<string, unknown>,
  ): string {
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.offlineQueue.push({
      id,
      type,
      payload,
      queuedAt: Date.now(),
      retryCount: 0,
    });
    return id;
  }

  public getPendingQueue(): OfflinePendingRequest[] {
    return [...this.offlineQueue];
  }

  public clearQueue(): void {
    this.offlineQueue.length = 0;
  }

  public removeQueueItem(id: string): void {
    const idx = this.offlineQueue.findIndex((item) => item.id === id);
    if (idx !== -1) {
      this.offlineQueue.splice(idx, 1);
    }
  }

  public clearAll(): void {
    this.storage.clear();
    this.offlineQueue.length = 0;
  }
}
