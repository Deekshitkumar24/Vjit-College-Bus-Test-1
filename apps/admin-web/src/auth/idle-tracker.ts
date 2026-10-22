export interface IdleTrackerConfig {
  /**
   * Timeout in seconds before session is expired (default: 900 = 15m)
   */
  timeoutSeconds: number;
  /**
   * Warning threshold in seconds before expiration (default: 120 = 2m)
   */
  warningSeconds?: number;
  /**
   * Callback fired when session enters warning window
   */
  onWarning?: (remainingSeconds: number) => void;
  /**
   * Callback fired when idle timeout expires
   */
  onExpired: () => void;
  /**
   * Callback fired when user becomes active after being in warning state
   */
  onActivityResumed?: () => void;
}

export class SessionIdleTracker {
  private lastActivityAt: number;
  private readonly timeoutMs: number;
  private readonly warningMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private inWarningState = false;
  private isExpired = false;

  constructor(private readonly config: IdleTrackerConfig) {
    this.timeoutMs = config.timeoutSeconds * 1000;
    this.warningMs = (config.warningSeconds ?? 120) * 1000;
    this.lastActivityAt = Date.now();
  }

  public start(): void {
    if (this.timer) {
      return;
    }
    this.lastActivityAt = Date.now();
    this.inWarningState = false;
    this.isExpired = false;

    // Tick every 1000ms
    this.timer = setInterval(() => {
      this.checkStatus();
    }, 1000);
  }

  public recordActivity(): void {
    if (this.isExpired) {
      return;
    }
    const wasInWarning = this.inWarningState;
    this.lastActivityAt = Date.now();
    this.inWarningState = false;

    if (wasInWarning && this.config.onActivityResumed) {
      this.config.onActivityResumed();
    }
  }

  public checkStatus(currentTime: number = Date.now()): {
    isExpired: boolean;
    inWarning: boolean;
    remainingSeconds: number;
  } {
    if (this.isExpired) {
      return { isExpired: true, inWarning: false, remainingSeconds: 0 };
    }

    const elapsedMs = currentTime - this.lastActivityAt;
    const remainingMs = Math.max(0, this.timeoutMs - elapsedMs);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    if (elapsedMs >= this.timeoutMs) {
      this.isExpired = true;
      this.inWarningState = false;
      this.stop();
      this.config.onExpired();
      return { isExpired: true, inWarning: false, remainingSeconds: 0 };
    }

    if (elapsedMs >= this.timeoutMs - this.warningMs) {
      this.inWarningState = true;
      if (this.config.onWarning) {
        this.config.onWarning(remainingSeconds);
      }
      return { isExpired: false, inWarning: true, remainingSeconds };
    }

    this.inWarningState = false;
    return { isExpired: false, inWarning: false, remainingSeconds };
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public reset(): void {
    this.lastActivityAt = Date.now();
    this.inWarningState = false;
    this.isExpired = false;
  }

  public getLastActivityAt(): number {
    return this.lastActivityAt;
  }
}
