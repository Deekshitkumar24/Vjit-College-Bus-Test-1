export interface HoldProgressState {
  isHolding: boolean;
  elapsedMs: number;
  durationMs: number;
  progressFraction: number; // 0.0 to 1.0
  isTriggered: boolean;
  label: string;
}

export class GuardedHoldTrigger {
  private readonly durationMs: number;
  private holdStartTimestamp: number | null = null;
  private isHolding: boolean = false;
  private isTriggered: boolean = false;

  constructor(durationMs: number = 3000) {
    this.durationMs = durationMs;
  }

  /**
   * User pressed and started holding the SOS button.
   */
  public pressDown(nowMs: number = Date.now()): HoldProgressState {
    if (this.isTriggered) {
      return this.getState(nowMs);
    }

    this.isHolding = true;
    this.holdStartTimestamp = nowMs;
    return this.getState(nowMs);
  }

  /**
   * Evaluates current hold progress at a given timestamp.
   */
  public updateProgress(nowMs: number = Date.now()): HoldProgressState {
    if (!this.isHolding || this.holdStartTimestamp === null) {
      return this.getState(nowMs);
    }

    const elapsed = nowMs - this.holdStartTimestamp;
    if (elapsed >= this.durationMs) {
      this.isTriggered = true;
      this.isHolding = false;
    }

    return this.getState(nowMs);
  }

  /**
   * User released the SOS button.
   * If released before durationMs, the trigger is safely cancelled.
   */
  public release(nowMs: number = Date.now()): { wasTriggered: boolean; state: HoldProgressState } {
    const finalState = this.updateProgress(nowMs);
    const wasTriggered = finalState.isTriggered;

    this.isHolding = false;
    this.holdStartTimestamp = null;

    return {
      wasTriggered,
      state: this.getState(nowMs),
    };
  }

  /**
   * Resets trigger state (e.g. after emergency is acknowledged or cancelled).
   */
  public reset(): void {
    this.isHolding = false;
    this.isTriggered = false;
    this.holdStartTimestamp = null;
  }

  public getState(nowMs: number = Date.now()): HoldProgressState {
    if (this.isTriggered) {
      return {
        isHolding: false,
        elapsedMs: this.durationMs,
        durationMs: this.durationMs,
        progressFraction: 1.0,
        isTriggered: true,
        label: 'SOS Triggered! Dispatching...',
      };
    }

    if (!this.isHolding || this.holdStartTimestamp === null) {
      return {
        isHolding: false,
        elapsedMs: 0,
        durationMs: this.durationMs,
        progressFraction: 0.0,
        isTriggered: false,
        label: 'Hold for 3 seconds to send SOS',
      };
    }

    const elapsed = Math.max(0, Math.min(this.durationMs, nowMs - this.holdStartTimestamp));
    const progress = elapsed / this.durationMs;
    const remainingSec = Math.ceil((this.durationMs - elapsed) / 1000);

    return {
      isHolding: true,
      elapsedMs: elapsed,
      durationMs: this.durationMs,
      progressFraction: Math.round(progress * 100) / 100,
      isTriggered: false,
      label: `Keep holding... ${remainingSec}s`,
    };
  }
}
