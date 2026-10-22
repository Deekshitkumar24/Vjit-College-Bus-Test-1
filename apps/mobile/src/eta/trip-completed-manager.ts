export interface CompletedTripSummary {
  tripId: string;
  busNumber: string;
  routeName: string;
  completedAt: string; // ISO 8601
  durationMinutes: number;
  totalStopsServed: number;
  boardedCount: number;
}

export interface TripCompletedViewState {
  isVisible: boolean;
  summary: CompletedTripSummary | null;
  remainingDisplaySeconds: number;
  fallbackState: 'NOT_RUNNING' | null;
}

export class TripCompletedViewManager {
  private summary: CompletedTripSummary;
  private readonly TTL_MS = 30 * 60 * 1000; // 30 minutes TTL per Part 6.10

  constructor(summary: CompletedTripSummary) {
    this.summary = { ...summary };
  }

  /**
   * Evaluates visibility of trip summary. Visible for up to 30 minutes post-completion.
   */
  public getViewState(currentTimestampMs = Date.now()): TripCompletedViewState {
    const completedAtMs = new Date(this.summary.completedAt).getTime();
    const elapsedMs = currentTimestampMs - completedAtMs;

    if (elapsedMs >= 0 && elapsedMs <= this.TTL_MS) {
      const remainingDisplaySeconds = Math.max(0, Math.floor((this.TTL_MS - elapsedMs) / 1000));
      return {
        isVisible: true,
        summary: { ...this.summary },
        remainingDisplaySeconds,
        fallbackState: null,
      };
    }

    return {
      isVisible: false,
      summary: null,
      remainingDisplaySeconds: 0,
      fallbackState: 'NOT_RUNNING',
    };
  }
}
