import { describe, it, expect, beforeEach } from 'vitest';
import {
  PhoneLocationBuffer,
  InMemorySQLiteDatabase,
  PhoneLocationCollector,
  LocationCollectorHttpHandler,
} from '../src/driver/index.js';
import {
  DriverLocationSampleDto,
  DriverLocationsBatchDto,
  DriverLocationsResponseDto,
} from '@collegebus/contracts';

describe('PhoneLocationBuffer (RS-20 SQLite Storage & FIFO Eviction)', () => {
  let buffer: PhoneLocationBuffer;
  let mockDb: InMemorySQLiteDatabase;

  beforeEach(async () => {
    mockDb = new InMemorySQLiteDatabase();
    buffer = new PhoneLocationBuffer({ db: mockDb, maxCapacity: 100 });
    await buffer.initialize();
  });

  it('initializes database with WAL mode and RS-20 schema', async () => {
    expect(mockDb.journalMode).toBe('WAL');
    const initialCount = await buffer.getCount();
    expect(initialCount).toBe(0);
  });

  it('enqueues and retrieves samples in strict chronological seq order', async () => {
    const shiftId = 'shift_test_01';
    const sample1: DriverLocationSampleDto = {
      seq: 1,
      recorded_at: '2026-10-21T08:00:00.000Z',
      lat: 12.9716,
      lng: 77.5946,
      accuracy_m: 12.5,
      speed_mps: 5.2,
      heading_deg: 90,
      provider: 'GPS',
      is_mock: false,
    };
    const sample2: DriverLocationSampleDto = {
      seq: 2,
      recorded_at: '2026-10-21T08:00:10.000Z',
      lat: 12.972,
      lng: 77.595,
      accuracy_m: 8.0,
      speed_mps: 6.1,
      heading_deg: 95,
      provider: 'GPS',
      is_mock: false,
    };

    await buffer.enqueueSample(shiftId, sample1);
    await buffer.enqueueSample(shiftId, sample2);

    const count = await buffer.getCount(shiftId);
    expect(count).toBe(2);

    const pending = await buffer.getPendingBatch(shiftId, 50);
    expect(pending.length).toBe(2);
    expect(pending[0]!.seq).toBe(1);
    expect(pending[1]!.seq).toBe(2);
    expect(pending[0]!.lat).toBeCloseTo(12.9716);
    expect(pending[1]!.accuracy_m).toBe(8.0);
  });

  it('acknowledges and deletes samples up to ack_seq', async () => {
    const shiftId = 'shift_test_02';
    const samples: DriverLocationSampleDto[] = [1, 2, 3, 4, 5].map((seq) => ({
      seq,
      recorded_at: new Date(Date.UTC(2026, 9, 21, 8, seq, 0)).toISOString(),
      lat: 12.97 + seq * 0.001,
      lng: 77.59,
      accuracy_m: 10,
      provider: 'GPS',
      is_mock: false,
    }));

    await buffer.enqueueBatch(shiftId, samples);
    expect(await buffer.getCount(shiftId)).toBe(5);

    // Acknowledge up to seq 3
    const deletedCount = await buffer.acknowledge(shiftId, 3);
    expect(deletedCount).toBe(3);

    const remaining = await buffer.getCount(shiftId);
    expect(remaining).toBe(2);

    const remainingBatch = await buffer.getPendingBatch(shiftId, 10);
    expect(remainingBatch.map((s) => s.seq)).toEqual([4, 5]);
  });

  it('enforces FIFO eviction when capacity limit is reached', async () => {
    const smallBuffer = new PhoneLocationBuffer({ db: mockDb, maxCapacity: 5 });
    await smallBuffer.initialize();

    const shiftId = 'shift_fifo';
    for (let i = 1; i <= 5; i++) {
      await smallBuffer.enqueueSample(shiftId, {
        seq: i,
        recorded_at: new Date().toISOString(),
        lat: 12.9,
        lng: 77.5,
        accuracy_m: 15,
        provider: 'GPS',
        is_mock: false,
      });
    }

    expect(await smallBuffer.getCount()).toBe(5);

    // Adding 6th and 7th sample should evict seq 1 and seq 2
    for (let i = 6; i <= 7; i++) {
      await smallBuffer.enqueueSample(shiftId, {
        seq: i,
        recorded_at: new Date().toISOString(),
        lat: 12.9,
        lng: 77.5,
        accuracy_m: 15,
        provider: 'GPS',
        is_mock: false,
      });
    }

    expect(await smallBuffer.getCount()).toBe(5);
    expect(smallBuffer.getEvictedCount()).toBe(2);

    const pending = await smallBuffer.getPendingBatch(shiftId, 10);
    expect(pending.map((s) => s.seq)).toEqual([3, 4, 5, 6, 7]);
  });

  it('isolates samples between different shifts', async () => {
    const shiftA = 'shift_A';
    const shiftB = 'shift_B';

    await buffer.enqueueSample(shiftA, {
      seq: 1,
      recorded_at: new Date().toISOString(),
      lat: 12.1,
      lng: 77.1,
      accuracy_m: 10,
      provider: 'GPS',
      is_mock: false,
    });
    await buffer.enqueueSample(shiftB, {
      seq: 1,
      recorded_at: new Date().toISOString(),
      lat: 12.2,
      lng: 77.2,
      accuracy_m: 10,
      provider: 'GPS',
      is_mock: false,
    });

    expect(await buffer.getCount(shiftA)).toBe(1);
    expect(await buffer.getCount(shiftB)).toBe(1);

    await buffer.acknowledge(shiftA, 1);
    expect(await buffer.getCount(shiftA)).toBe(0);
    expect(await buffer.getCount(shiftB)).toBe(1);
  });
});

describe('PhoneLocationCollector (Adaptive Cadence, Notification & Batch Replay)', () => {
  let collector: PhoneLocationCollector;
  let buffer: PhoneLocationBuffer;
  let dispatchedRequests: Array<{ url: string; body: DriverLocationsBatchDto }> = [];

  const createMockHttp = (
    handler?: (url: string, body: DriverLocationsBatchDto) => Response,
  ): LocationCollectorHttpHandler => ({
    fetch: async (url, init) => {
      const parsedBody = (init?.body ? JSON.parse(init.body as string) : {}) as DriverLocationsBatchDto;
      dispatchedRequests.push({ url, body: parsedBody });

      if (handler) {
        return handler(url, parsedBody);
      }

      const responseDto: DriverLocationsResponseDto = {
        ack_seq: parsedBody.samples?.[parsedBody.samples.length - 1]?.seq ?? 0,
        rejected: [],
        phone_interval_s: 30,
        active_source: 'HW',
        server_time: new Date().toISOString(),
      };

      return new Response(JSON.stringify(responseDto), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  beforeEach(() => {
    dispatchedRequests = [];
    buffer = new PhoneLocationBuffer({ maxCapacity: 1000 });
    collector = new PhoneLocationCollector({
      apiBaseUrl: 'https://api.collegebus.test',
      accessToken: 'test_token_123',
      driverId: 'drv_01',
      appVersion: '1.2.0',
      deviceModel: 'Pixel 8',
      batchSize: 50,
      batchPacingMs: 0,
      buffer,
      http: createMockHttp(),
    });
  });

  it('starts tracking with persistent foreground notification', async () => {
    await collector.start('shift_active_01', 'Bus 42');

    expect(collector.isTracking()).toBe(true);
    expect(collector.getCurrentShiftId()).toBe('shift_active_01');

    const notification = collector.getForegroundNotification();
    expect(notification).not.toBeNull();
    expect(notification?.channelId).toBe('TRACKING');
    expect(notification?.title).toBe('Bus 42 · Tracking Active');
    expect(notification?.ongoing).toBe(true);
    expect(notification?.priority).toBe('HIGH');
  });

  it('adjusts adaptive cadence based on speed threshold (3 km/h = 0.833 m/s)', async () => {
    await collector.start('shift_cadence_01', 'Bus 10');

    // Stopped: 0 m/s -> cadence 30s
    await collector.recordLocation({
      lat: 12.9716,
      lng: 77.5946,
      accuracy_m: 10,
      speed_mps: 0,
    });
    expect(collector.getCurrentCadenceS()).toBe(30);

    // Below 3 km/h (~0.833 m/s): 0.5 m/s (~1.8 km/h) -> cadence 30s
    await collector.recordLocation({
      lat: 12.9718,
      lng: 77.5948,
      accuracy_m: 10,
      speed_mps: 0.5,
    });
    expect(collector.getCurrentCadenceS()).toBe(30);

    // Above 3 km/h: 5.0 m/s (~18 km/h) -> adaptive cadence switches to 10s
    await collector.recordLocation({
      lat: 12.973,
      lng: 77.596,
      accuracy_m: 12,
      speed_mps: 5.0,
    });
    expect(collector.getCurrentCadenceS()).toBe(10);
  });

  it('buffers locations offline and shows banner: "Sending saved location, N points" upon reconnect', async () => {
    await collector.start('shift_offline_01', 'Bus 15');

    // Go offline
    collector.setOnline(false);
    expect(collector.isOnline()).toBe(false);

    // Record 12 points while offline
    for (let i = 1; i <= 12; i++) {
      await collector.recordLocation({
        lat: 12.97 + i * 0.001,
        lng: 77.59,
        accuracy_m: 10,
        speed_mps: 4.5,
      });
    }

    // Points should be buffered locally
    const bufferCount = await buffer.getCount('shift_offline_01');
    expect(bufferCount).toBe(12);
    expect(dispatchedRequests.length).toBe(0);

    // Banner indicates buffered points
    const banner = collector.getStatusBanner();
    expect(banner.visible).toBe(true);
    expect(banner.pointCount).toBe(12);
    expect(banner.message).toBe('Sending saved location, 12 points');

    // Reconnect network
    collector.setOnline(true);
    const flushResult = await collector.flushPending();

    expect(flushResult.sentCount).toBe(12);
    expect(flushResult.remainingCount).toBe(0);
    expect(dispatchedRequests.length).toBe(1);

    const requestBody = dispatchedRequests[0]!.body;
    expect(requestBody.shift_id).toBe('shift_offline_01');
    expect(requestBody.samples.length).toBe(12);
    expect(requestBody.samples[0]!.seq).toBe(1);
    expect(requestBody.samples[11]!.seq).toBe(12);

    // After flush complete, banner is cleared
    const bannerAfter = collector.getStatusBanner();
    expect(bannerAfter.visible).toBe(false);
    expect(bannerAfter.pointCount).toBe(0);
  });

  it('replays multi-batch buffer sequentially in chunks of 50 samples', async () => {
    await collector.start('shift_multibatch', 'Bus 99');
    collector.setOnline(false);

    // Record 115 points while offline
    for (let i = 1; i <= 115; i++) {
      await collector.recordLocation({
        lat: 12.95 + i * 0.0001,
        lng: 77.58,
        accuracy_m: 8,
        speed_mps: 6.0,
      });
    }

    expect(await buffer.getCount('shift_multibatch')).toBe(115);

    collector.setOnline(true);
    const flushResult = await collector.flushPending();

    expect(flushResult.sentCount).toBe(115);
    expect(flushResult.remainingCount).toBe(0);

    // 115 samples with batchSize 50 must produce 3 batches: 50, 50, 15
    expect(dispatchedRequests.length).toBe(3);
    expect(dispatchedRequests[0]!.body.samples.length).toBe(50);
    expect(dispatchedRequests[1]!.body.samples.length).toBe(50);
    expect(dispatchedRequests[2]!.body.samples.length).toBe(15);

    // Verify sequence integrity
    expect(dispatchedRequests[0]!.body.samples[0]!.seq).toBe(1);
    expect(dispatchedRequests[0]!.body.samples[49]!.seq).toBe(50);
    expect(dispatchedRequests[1]!.body.samples[0]!.seq).toBe(51);
    expect(dispatchedRequests[1]!.body.samples[49]!.seq).toBe(100);
    expect(dispatchedRequests[2]!.body.samples[0]!.seq).toBe(101);
    expect(dispatchedRequests[2]!.body.samples[14]!.seq).toBe(115);

    expect(await buffer.getCount('shift_multibatch')).toBe(0);
  });

  it('preserves buffered samples safely if transmission fails with 500 error', async () => {
    const failingHttp: LocationCollectorHttpHandler = {
      fetch: async () => new Response('Internal Server Error', { status: 500 }),
    };

    const resilientCollector = new PhoneLocationCollector({
      apiBaseUrl: 'https://api.collegebus.test',
      accessToken: 'test_token_123',
      driverId: 'drv_01',
      buffer,
      http: failingHttp,
    });

    await resilientCollector.start('shift_fail_01', 'Bus 20');
    resilientCollector.setOnline(false);

    for (let i = 1; i <= 5; i++) {
      await resilientCollector.recordLocation({
        lat: 12.97,
        lng: 77.59,
        accuracy_m: 10,
        speed_mps: 5,
      });
    }

    resilientCollector.setOnline(true);
    const flushResult = await resilientCollector.flushPending();

    // Transmission failed -> 0 acknowledged, all 5 preserved
    expect(flushResult.sentCount).toBe(0);
    expect(flushResult.remainingCount).toBe(5);
    expect(await buffer.getCount('shift_fail_01')).toBe(5);

    const banner = resilientCollector.getStatusBanner();
    expect(banner.visible).toBe(true);
    expect(banner.pointCount).toBe(5);
  });

  it('clears notification and banner on stop', async () => {
    await collector.start('shift_stop_01', 'Bus 10');
    expect(collector.isTracking()).toBe(true);

    await collector.stop();
    expect(collector.isTracking()).toBe(false);
    expect(collector.getForegroundNotification()).toBeNull();
    expect(collector.getStatusBanner().visible).toBe(false);
  });
});
