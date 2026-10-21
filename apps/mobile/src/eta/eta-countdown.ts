export interface CountdownState {
  initialSeconds: number;
  remainingSeconds: number;
  displayText: string;
  isArrived: boolean;
  isImminent: boolean; // <= 60s
}

/**
 * Formats a live remaining seconds count into a friendly user-facing label.
 */
export function formatCountdownLabel(remainingSeconds: number): string {
  if (remainingSeconds <= 0) {
    return 'Arrived';
  }
  if (remainingSeconds <= 60) {
    return 'Arriving now';
  }
  const minutes = Math.ceil(remainingSeconds / 60);
  return `${minutes} min`;
}

/**
 * Computes remaining seconds and countdown state based on an initial baseline timestamp.
 */
export function computeCountdownState(
  initialEtaSeconds: number,
  elapsedSeconds: number,
): CountdownState {
  const remaining = Math.max(0, initialEtaSeconds - elapsedSeconds);
  const displayText = formatCountdownLabel(remaining);

  return {
    initialSeconds: initialEtaSeconds,
    remainingSeconds: remaining,
    displayText,
    isArrived: remaining === 0,
    isImminent: remaining > 0 && remaining <= 60,
  };
}
