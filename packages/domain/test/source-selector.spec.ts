import { describe, it, expect } from 'vitest';
import { evaluateSourceSelection, SourceSelectorParams } from '../src/source-selector.js';

describe('Source Selector & Anti-Flapping Engine (Part 9.3 to 9.7)', () => {
  const baseTime = new Date('2026-10-21T08:00:00Z');

  it('sets NOT_RUNNING and active_source NONE when bus has no active shift', () => {
    const params: SourceSelectorParams = {
      hasActiveShift: false,
      mode: 'AUTO',
      currentActiveSource: 'HW',
      currentState: 'LIVE',
      lastHwValidAt: baseTime,
      lastPhoneValidAt: baseTime,
      consecutiveHwValid: 5,
      lastSwitchedAt: baseTime,
      recentSwitchTimestamps: [],
      flapHoldUntil: null,
      now: baseTime,
    };

    const res = evaluateSourceSelection(params);
    expect(res.nextActiveSource).toBe('NONE');
    expect(res.nextState).toBe('NOT_RUNNING');
    expect(res.switched).toBe(true);
    expect(res.switchReason).toBe('SHIFT_ENDED');
  });

  describe('Initial Source Selection', () => {
    it('picks HW with reason INITIAL when HW is fresh on shift start', () => {
      const params: SourceSelectorParams = {
        hasActiveShift: true,
        mode: 'AUTO',
        currentActiveSource: 'NONE',
        currentState: 'NOT_RUNNING',
        lastHwValidAt: new Date(baseTime.getTime() - 10 * 1000), // 10s ago (fresh)
        lastPhoneValidAt: null,
        consecutiveHwValid: 1,
        lastSwitchedAt: null,
        recentSwitchTimestamps: [],
        flapHoldUntil: null,
        now: baseTime,
      };

      const res = evaluateSourceSelection(params);
      expect(res.nextActiveSource).toBe('HW');
      expect(res.nextState).toBe('LIVE');
      expect(res.switched).toBe(true);
      expect(res.switchReason).toBe('INITIAL');
      expect(res.phoneIntervalS).toBe(30); // Standby cadence
    });

    it('picks PHONE with reason PHONE_FALLBACK when HW not fresh on shift start', () => {
      const params: SourceSelectorParams = {
        hasActiveShift: true,
        mode: 'AUTO',
        currentActiveSource: 'NONE',
        currentState: 'NOT_RUNNING',
        lastHwValidAt: null,
        lastPhoneValidAt: new Date(baseTime.getTime() - 10 * 1000), // 10s ago (fresh)
        consecutiveHwValid: 0,
        lastSwitchedAt: null,
        recentSwitchTimestamps: [],
        flapHoldUntil: null,
        now: baseTime,
      };

      const res = evaluateSourceSelection(params);
      expect(res.nextActiveSource).toBe('PHONE');
      expect(res.nextState).toBe('LIVE');
      expect(res.switched).toBe(true);
      expect(res.switchReason).toBe('PHONE_FALLBACK');
      expect(res.phoneIntervalS).toBe(10); // Fallback cadence
    });
  });

  describe('Automatic Failover and Recovery (AUTO Mode)', () => {
    it('switches from HW to PHONE with reason HW_STALE when HW is older than 60s and cooldown ok', () => {
      const params: SourceSelectorParams = {
        hasActiveShift: true,
        mode: 'AUTO',
        currentActiveSource: 'HW',
        currentState: 'LIVE',
        lastHwValidAt: new Date(baseTime.getTime() - 75 * 1000), // 75s ago (> 60s stale)
        lastPhoneValidAt: new Date(baseTime.getTime() - 5 * 1000), // fresh
        consecutiveHwValid: 0,
        lastSwitchedAt: new Date(baseTime.getTime() - 40 * 1000), // 40s ago (> 30s cooldown)
        recentSwitchTimestamps: [],
        flapHoldUntil: null,
        now: baseTime,
      };

      const res = evaluateSourceSelection(params);
      expect(res.nextActiveSource).toBe('PHONE');
      expect(res.nextState).toBe('LIVE');
      expect(res.switched).toBe(true);
      expect(res.switchReason).toBe('HW_STALE');
      expect(res.phoneIntervalS).toBe(10); // Instructs phone to switch to 10s cadence
    });

    it('enforces 30s cooldown before allowing automatic switch to PHONE', () => {
      const params: SourceSelectorParams = {
        hasActiveShift: true,
        mode: 'AUTO',
        currentActiveSource: 'HW',
        currentState: 'LIVE',
        lastHwValidAt: new Date(baseTime.getTime() - 75 * 1000), // stale
        lastPhoneValidAt: new Date(baseTime.getTime() - 5 * 1000), // fresh
        consecutiveHwValid: 0,
        lastSwitchedAt: new Date(baseTime.getTime() - 15 * 1000), // only 15s ago (< 30s cooldown)
        recentSwitchTimestamps: [],
        flapHoldUntil: null,
        now: baseTime,
      };

      const res = evaluateSourceSelection(params);
      expect(res.nextActiveSource).toBe('HW'); // Cooldown holds HW
      expect(res.switched).toBe(false);
      expect(res.nextState).toBe('STALE'); // HW is stale so state is STALE
    });

    it('switches back to HW with reason HW_RECOVERED when consecutive_hw_valid >= 3 and cooldown ok', () => {
      const params: SourceSelectorParams = {
        hasActiveShift: true,
        mode: 'AUTO',
        currentActiveSource: 'PHONE',
        currentState: 'LIVE',
        lastHwValidAt: new Date(baseTime.getTime() - 5 * 1000), // fresh
        lastPhoneValidAt: new Date(baseTime.getTime() - 5 * 1000), // fresh
        consecutiveHwValid: 3, // 3 consecutive valid fixes
        lastSwitchedAt: new Date(baseTime.getTime() - 35 * 1000), // > 30s cooldown
        recentSwitchTimestamps: [],
        flapHoldUntil: null,
        now: baseTime,
      };

      const res = evaluateSourceSelection(params);
      expect(res.nextActiveSource).toBe('HW');
      expect(res.nextState).toBe('LIVE');
      expect(res.switched).toBe(true);
      expect(res.switchReason).toBe('HW_RECOVERED');
      expect(res.phoneIntervalS).toBe(30); // Standby cadence
    });

    it('does not switch back to HW if consecutive_hw_valid < 3', () => {
      const params: SourceSelectorParams = {
        hasActiveShift: true,
        mode: 'AUTO',
        currentActiveSource: 'PHONE',
        currentState: 'LIVE',
        lastHwValidAt: new Date(baseTime.getTime() - 5 * 1000),
        lastPhoneValidAt: new Date(baseTime.getTime() - 5 * 1000),
        consecutiveHwValid: 2, // only 2 fixes
        lastSwitchedAt: new Date(baseTime.getTime() - 35 * 1000),
        recentSwitchTimestamps: [],
        flapHoldUntil: null,
        now: baseTime,
      };

      const res = evaluateSourceSelection(params);
      expect(res.nextActiveSource).toBe('PHONE');
      expect(res.switched).toBe(false);
    });

    it('switches to HW with reason PHONE_LOST when phone goes stale and HW is fresh', () => {
      const params: SourceSelectorParams = {
        hasActiveShift: true,
        mode: 'AUTO',
        currentActiveSource: 'PHONE',
        currentState: 'LIVE',
        lastHwValidAt: new Date(baseTime.getTime() - 10 * 1000), // fresh
        lastPhoneValidAt: new Date(baseTime.getTime() - 70 * 1000), // stale
        consecutiveHwValid: 1,
        lastSwitchedAt: new Date(baseTime.getTime() - 40 * 1000),
        recentSwitchTimestamps: [],
        flapHoldUntil: null,
        now: baseTime,
      };

      const res = evaluateSourceSelection(params);
      expect(res.nextActiveSource).toBe('HW');
      expect(res.switched).toBe(true);
      expect(res.switchReason).toBe('PHONE_LOST');
    });
  });

  describe('Anti-Flapping Protection (Part 9.5)', () => {
    it('locks source in flap hold and raises alert when more than 6 switches occur in 600 seconds', () => {
      // 6 previous switches in the last 10 minutes
      const recentSwitches = [
        new Date(baseTime.getTime() - 500 * 1000),
        new Date(baseTime.getTime() - 420 * 1000),
        new Date(baseTime.getTime() - 340 * 1000),
        new Date(baseTime.getTime() - 260 * 1000),
        new Date(baseTime.getTime() - 180 * 1000),
        new Date(baseTime.getTime() - 100 * 1000),
      ];

      const params: SourceSelectorParams = {
        hasActiveShift: true,
        mode: 'AUTO',
        currentActiveSource: 'HW',
        currentState: 'LIVE',
        lastHwValidAt: new Date(baseTime.getTime() - 75 * 1000), // stale
        lastPhoneValidAt: new Date(baseTime.getTime() - 5 * 1000), // fresh
        consecutiveHwValid: 0,
        lastSwitchedAt: new Date(baseTime.getTime() - 100 * 1000),
        recentSwitchTimestamps: recentSwitches,
        flapHoldUntil: null,
        now: baseTime,
      };

      const res = evaluateSourceSelection(params);
      expect(res.alertRaised).toBe('SOURCE_FLAPPING');
      expect(res.nextFlapHoldUntil).toBeDefined();
      expect(res.nextActiveSource).toBe('HW'); // Held on HW during flap hold
      expect(res.switched).toBe(false);
    });
  });

  describe('Stale & Unavailable States (Part 9.3 step 6 & Part 9.12)', () => {
    it('sets state = STALE when neither source is fresh but less than 120s old', () => {
      const params: SourceSelectorParams = {
        hasActiveShift: true,
        mode: 'AUTO',
        currentActiveSource: 'HW',
        currentState: 'LIVE',
        lastHwValidAt: new Date(baseTime.getTime() - 80 * 1000), // 80s ago (> 60s, < 120s)
        lastPhoneValidAt: new Date(baseTime.getTime() - 90 * 1000), // 90s ago
        consecutiveHwValid: 0,
        lastSwitchedAt: null,
        recentSwitchTimestamps: [],
        flapHoldUntil: null,
        now: baseTime,
      };

      const res = evaluateSourceSelection(params);
      expect(res.nextState).toBe('STALE');
      expect(res.alertRaised).toBeNull();
    });

    it('sets state = UNAVAILABLE and raises alert when neither source fresh for >= 120 seconds', () => {
      const params: SourceSelectorParams = {
        hasActiveShift: true,
        mode: 'AUTO',
        currentActiveSource: 'HW',
        currentState: 'STALE',
        lastHwValidAt: new Date(baseTime.getTime() - 150 * 1000), // 150s ago (>= 120s)
        lastPhoneValidAt: new Date(baseTime.getTime() - 180 * 1000), // 180s ago (>= 120s)
        consecutiveHwValid: 0,
        lastSwitchedAt: null,
        recentSwitchTimestamps: [],
        flapHoldUntil: null,
        now: baseTime,
      };

      const res = evaluateSourceSelection(params);
      expect(res.nextState).toBe('UNAVAILABLE');
      expect(res.alertRaised).toBe('BUS_UNAVAILABLE');
    });
  });

  describe('Manual Mode Overrides (Part 9.4 & 9.6)', () => {
    it('locks active source to HW in MANUAL_HW mode regardless of freshness', () => {
      const params: SourceSelectorParams = {
        hasActiveShift: true,
        mode: 'MANUAL_HW',
        currentActiveSource: 'PHONE',
        currentState: 'LIVE',
        lastHwValidAt: new Date(baseTime.getTime() - 100 * 1000), // stale
        lastPhoneValidAt: new Date(baseTime.getTime() - 5 * 1000), // fresh
        consecutiveHwValid: 0,
        lastSwitchedAt: baseTime,
        recentSwitchTimestamps: [],
        flapHoldUntil: null,
        now: baseTime,
      };

      const res = evaluateSourceSelection(params);
      expect(res.nextActiveSource).toBe('HW');
      expect(res.switched).toBe(true);
      expect(res.switchReason).toBe('DRIVER_MODE');
      expect(res.nextState).toBe('STALE'); // HW is stale so bus state is STALE
    });

    it('locks active source to PHONE in MANUAL_PHONE mode', () => {
      const params: SourceSelectorParams = {
        hasActiveShift: true,
        mode: 'MANUAL_PHONE',
        currentActiveSource: 'HW',
        currentState: 'LIVE',
        lastHwValidAt: new Date(baseTime.getTime() - 10 * 1000), // fresh
        lastPhoneValidAt: new Date(baseTime.getTime() - 5 * 1000), // fresh
        consecutiveHwValid: 1,
        lastSwitchedAt: baseTime,
        recentSwitchTimestamps: [],
        flapHoldUntil: null,
        now: baseTime,
      };

      const res = evaluateSourceSelection(params);
      expect(res.nextActiveSource).toBe('PHONE');
      expect(res.switched).toBe(true);
      expect(res.switchReason).toBe('DRIVER_MODE');
      expect(res.nextState).toBe('LIVE');
    });
  });
});
