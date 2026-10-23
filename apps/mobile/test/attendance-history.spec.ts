import { describe, it, expect } from 'vitest';
import {
  AttendanceHistoryManager,
  DailyAttendanceRow,
} from '../src/attendance/attendance-history.js';

describe('P2-T12: Attendance History Screen (GET /attendance/me)', () => {
  it('parses attendance history rows into daily records with morning and afternoon status', () => {
    const records: DailyAttendanceRow[] = [
      {
        date: '2026-10-22',
        morning: {
          status: 'PRESENT',
          boardedAt: '2026-10-22T08:15:00.000Z',
          busNumber: 'BUS-01',
          stopName: 'Main Gate',
        },
        afternoon: {
          status: 'PRESENT',
          boardedAt: '2026-10-22T16:35:00.000Z',
          busNumber: 'BUS-01',
          stopName: 'Campus Terminal',
        },
      },
      {
        date: '2026-10-21',
        morning: {
          status: 'PRESENT',
          boardedAt: '2026-10-21T08:12:00.000Z',
          busNumber: 'BUS-01',
          stopName: 'Main Gate',
        },
        afternoon: {
          status: 'ABSENT',
          boardedAt: null,
          busNumber: null,
          stopName: null,
        },
      },
      {
        date: '2026-10-20',
        morning: {
          status: 'ON_LEAVE',
          boardedAt: null,
          busNumber: null,
          stopName: null,
        },
        afternoon: {
          status: 'ON_LEAVE',
          boardedAt: null,
          busNumber: null,
          stopName: null,
        },
      },
    ];

    const manager = new AttendanceHistoryManager(records);
    const history = manager.getHistory();

    expect(history).toHaveLength(3);
    expect(history[0]!.morning.status).toBe('PRESENT');
    expect(history[0]!.afternoon.status).toBe('PRESENT');
  });

  it('detects D-12 morning-present afternoon-absent discrepancy rule', () => {
    const manager = new AttendanceHistoryManager([
      {
        date: '2026-10-21',
        morning: { status: 'PRESENT', boardedAt: '2026-10-21T08:12:00.000Z', busNumber: 'BUS-01', stopName: 'Gate 1' },
        afternoon: { status: 'ABSENT', boardedAt: null, busNumber: null, stopName: null },
      },
      {
        date: '2026-10-22',
        morning: { status: 'PRESENT', boardedAt: '2026-10-22T08:15:00.000Z', busNumber: 'BUS-01', stopName: 'Gate 1' },
        afternoon: { status: 'PRESENT', boardedAt: '2026-10-22T16:30:00.000Z', busNumber: 'BUS-01', stopName: 'Gate 1' },
      },
    ]);

    const discrepancies = manager.getMorningPresentAfternoonAbsentDiscrepancies();
    expect(discrepancies).toHaveLength(1);
    expect(discrepancies[0]!.date).toBe('2026-10-21');
  });

  it('computes summary statistics accurately', () => {
    const manager = new AttendanceHistoryManager([
      {
        date: '2026-10-22',
        morning: { status: 'PRESENT', boardedAt: null, busNumber: null, stopName: null },
        afternoon: { status: 'PRESENT', boardedAt: null, busNumber: null, stopName: null },
      },
      {
        date: '2026-10-21',
        morning: { status: 'ON_LEAVE', boardedAt: null, busNumber: null, stopName: null },
        afternoon: { status: 'ON_LEAVE', boardedAt: null, busNumber: null, stopName: null },
      },
      {
        date: '2026-10-20',
        morning: { status: 'ABSENT', boardedAt: null, busNumber: null, stopName: null },
        afternoon: { status: 'ABSENT', boardedAt: null, busNumber: null, stopName: null },
      },
    ]);

    const stats = manager.getStats();
    expect(stats.totalDays).toBe(3);
    expect(stats.presentTrips).toBe(2);
    expect(stats.leaveTrips).toBe(2);
    expect(stats.absentTrips).toBe(2);
  });
});
