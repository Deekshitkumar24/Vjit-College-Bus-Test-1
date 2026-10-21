/**
 * Source Selector & Anti-Flapping Engine (Part 9.3 to 9.7)
 */

export type TrackingMode = 'AUTO' | 'MANUAL_HW' | 'MANUAL_PHONE';
export type BusSource = 'NONE' | 'HW' | 'PHONE';
export type BusDisplayState = 'NOT_RUNNING' | 'LIVE' | 'STALE' | 'UNAVAILABLE';

export type SwitchReason =
  | 'INITIAL'
  | 'PHONE_FALLBACK'
  | 'HW_STALE'
  | 'HW_RECOVERED'
  | 'PHONE_LOST'
  | 'DRIVER_MODE'
  | 'ADMIN_OVERRIDE'
  | 'SHIFT_ENDED';

export interface SourceSelectorParams {
  hasActiveShift: boolean;
  mode: TrackingMode;
  currentActiveSource: BusSource;
  currentState: BusDisplayState;
  lastHwValidAt: Date | null;
  lastPhoneValidAt: Date | null;
  consecutiveHwValid: number;
  lastSwitchedAt: Date | null;
  recentSwitchTimestamps: Date[]; // switches within last 600s
  flapHoldUntil: Date | null;
  now?: Date;
  cooldownSeconds?: number; // default 30s
  freshnessSeconds?: number; // default 60s
  unavailableSeconds?: number; // default 120s
  flapLimit?: number; // default 6 switches
  flapWindowSeconds?: number; // default 600s
  flapHoldSeconds?: number; // default 300s
}

export interface SourceSelectorResult {
  nextActiveSource: BusSource;
  nextState: BusDisplayState;
  switched: boolean;
  switchReason: SwitchReason | null;
  nextConsecutiveHwValid: number;
  nextFlapHoldUntil: Date | null;
  alertRaised: 'BUS_UNAVAILABLE' | 'SOURCE_FLAPPING' | null;
  phoneIntervalS: 10 | 30;
}

export function evaluateSourceSelection(params: SourceSelectorParams): SourceSelectorResult {
  const {
    hasActiveShift,
    mode,
    currentActiveSource,
    lastHwValidAt,
    lastPhoneValidAt,
    consecutiveHwValid,
    lastSwitchedAt,
    recentSwitchTimestamps,
    flapHoldUntil,
    now = new Date(),
    cooldownSeconds = 30,
    freshnessSeconds = 60,
    unavailableSeconds = 120,
    flapLimit = 6,
    flapWindowSeconds = 600,
    flapHoldSeconds = 300,
  } = params;

  // 1. If B has no ACTIVE shift: state = NOT_RUNNING, active_source = NONE
  if (!hasActiveShift) {
    const switched = currentActiveSource !== 'NONE';
    return {
      nextActiveSource: 'NONE',
      nextState: 'NOT_RUNNING',
      switched,
      switchReason: switched ? 'SHIFT_ENDED' : null,
      nextConsecutiveHwValid: 0,
      nextFlapHoldUntil: null,
      alertRaised: null,
      phoneIntervalS: 30,
    };
  }

  const nowMs = now.getTime();
  const hwFresh =
    lastHwValidAt !== null && (nowMs - lastHwValidAt.getTime()) / 1000 <= freshnessSeconds;
  const phoneFresh =
    lastPhoneValidAt !== null && (nowMs - lastPhoneValidAt.getTime()) / 1000 <= freshnessSeconds;

  const cooldownOk =
    !lastSwitchedAt || (nowMs - lastSwitchedAt.getTime()) / 1000 >= cooldownSeconds;

  // Check anti-flapping hold
  let isFlapHoldActive = flapHoldUntil !== null && nowMs < flapHoldUntil.getTime();
  let nextFlapHoldUntil = isFlapHoldActive ? flapHoldUntil : null;
  let flapAlert: 'SOURCE_FLAPPING' | null = null;

  // Check if flapping threshold crossed (> 6 switches in 600s)
  const switchesInWindow = recentSwitchTimestamps.filter(
    (t) => (nowMs - t.getTime()) / 1000 <= flapWindowSeconds,
  ).length;

  if (switchesInWindow >= flapLimit && !isFlapHoldActive) {
    isFlapHoldActive = true;
    nextFlapHoldUntil = new Date(nowMs + flapHoldSeconds * 1000);
    flapAlert = 'SOURCE_FLAPPING';
  }

  let nextSource: BusSource = currentActiveSource;
  let switchReason: SwitchReason | null = null;

  let nextConsecutive = consecutiveHwValid;

  // 5. Apply the rule for the mode
  if (mode === 'MANUAL_HW') {
    nextSource = 'HW';
    if (currentActiveSource !== 'HW') {
      switchReason = 'DRIVER_MODE';
    }
  } else if (mode === 'MANUAL_PHONE') {
    nextSource = 'PHONE';
    if (currentActiveSource !== 'PHONE') {
      switchReason = 'DRIVER_MODE';
    }
  } else {
    // AUTO mode
    if (isFlapHoldActive) {
      // Hold current source during flapping lockout
      nextSource = currentActiveSource;
    } else {
      if (currentActiveSource === 'HW' && !hwFresh && phoneFresh && cooldownOk) {
        nextSource = 'PHONE';
        switchReason = 'HW_STALE';
        nextConsecutive = 0;
      } else if (currentActiveSource === 'PHONE' && consecutiveHwValid >= 3 && cooldownOk) {
        nextSource = 'HW';
        switchReason = 'HW_RECOVERED';
      } else if (currentActiveSource === 'PHONE' && !phoneFresh && hwFresh && cooldownOk) {
        nextSource = 'HW';
        switchReason = 'PHONE_LOST';
      } else if (currentActiveSource === 'NONE' && hwFresh) {
        nextSource = 'HW';
        switchReason = 'INITIAL';
      } else if (currentActiveSource === 'NONE' && phoneFresh) {
        nextSource = 'PHONE';
        switchReason = 'PHONE_FALLBACK';
        nextConsecutive = 0;
      }
    }
  }

  const switched = nextSource !== currentActiveSource;

  // 6. State evaluation (LIVE, STALE, UNAVAILABLE)
  let nextState: BusDisplayState = 'LIVE';
  let alertRaised: 'BUS_UNAVAILABLE' | 'SOURCE_FLAPPING' | null = flapAlert;

  const activeIsFresh = nextSource === 'HW' ? hwFresh : nextSource === 'PHONE' ? phoneFresh : false;

  if (!activeIsFresh) {
    // Check if neither source has been fresh for unavailableSeconds (120s)
    const hwDead = !lastHwValidAt || (nowMs - lastHwValidAt.getTime()) / 1000 >= unavailableSeconds;
    const phoneDead =
      !lastPhoneValidAt || (nowMs - lastPhoneValidAt.getTime()) / 1000 >= unavailableSeconds;

    if (hwDead && phoneDead) {
      nextState = 'UNAVAILABLE';
      if (!alertRaised) {
        alertRaised = 'BUS_UNAVAILABLE';
      }
    } else {
      nextState = 'STALE';
    }
  }

  // Adaptive phone cadence (Part 9.7): 30s on HW (Standby), 10s on PHONE (Fallback)
  const phoneIntervalS: 10 | 30 = nextSource === 'PHONE' ? 10 : 30;

  return {
    nextActiveSource: nextSource,
    nextState,
    switched,
    switchReason,
    nextConsecutiveHwValid: nextConsecutive,
    nextFlapHoldUntil,
    alertRaised,
    phoneIntervalS,
  };
}
