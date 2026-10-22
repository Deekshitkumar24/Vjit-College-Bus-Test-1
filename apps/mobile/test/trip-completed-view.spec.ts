import { describe, it, expect } from 'vitest';
import {
  TripCompletedViewManager,
  CompletedTripSummary,
} from '../src/eta/trip-completed-manager.js';

describe('P2-T14: Trip Completed View with 30-minute TTL (Part 6.10)', () => {
  const tripCompletionTime = new Date('2026-10-22T09:30:00.000Z').getTime();

  const mockSummary: CompletedTripSummary = {
    tripId: 'trip_morning_01',
    busNumber: 'BUS-04',
    routeName: 'Route 4 - North Campus',
    completedAt: '2026-10-22T09:30:00.000Z',
    durationMinutes: 42,
    totalStopsServed: 12,
    boardedCount: 38,
  };

  it('renders trip summary while within 30 minutes of completion', () => {
    const manager = new TripCompletedViewManager(mockSummary);

    // 10 minutes after completion
    const tenMinutesAfter = tripCompletionTime + 10 * 60 * 1000;
    const viewState10 = manager.getViewState(tenMinutesAfter);

    expect(viewState10.isVisible).toBe(true);
    expect(viewState10.summary?.busNumber).toBe('BUS-04');
    expect(viewState10.remainingDisplaySeconds).toBe(20 * 60);

    // 29 minutes after completion
    const twentyNineMinutesAfter = tripCompletionTime + 29 * 60 * 1000;
    const viewState29 = manager.getViewState(twentyNineMinutesAfter);
    expect(viewState29.isVisible).toBe(true);
    expect(viewState29.remainingDisplaySeconds).toBe(60);
  });

  it('expires and hides trip summary after 30 minutes, transitioning to idle/not running view', () => {
    const manager = new TripCompletedViewManager(mockSummary);

    // Exactly 30 minutes + 1 second after completion
    const thirtyMinutesOneSecondAfter = tripCompletionTime + 30 * 60 * 1000 + 1000;
    const viewStateExpired = manager.getViewState(thirtyMinutesOneSecondAfter);

    expect(viewStateExpired.isVisible).toBe(false);
    expect(viewStateExpired.summary).toBeNull();
    expect(viewStateExpired.fallbackState).toBe('NOT_RUNNING');
  });
});
