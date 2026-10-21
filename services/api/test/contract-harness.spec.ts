import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TelemetryService } from '../src/modules/telemetry/telemetry.service.js';
import { HeartbeatService } from '../src/modules/heartbeat/heartbeat.service.js';
import { ContractTestHarness, RecordedHardwareStream } from './harness/contract-test-harness.js';

describe('Hardware Contract Test Harness (P1-T10, Exit Criterion 2)', () => {
  let telemetryService: TelemetryService;
  let heartbeatService: HeartbeatService;
  let harness: ContractTestHarness;

  const fixturesDir = join(process.cwd(), '../../tests/fixtures/hardware-streams');

  function loadStreamFixture(fileName: string): RecordedHardwareStream {
    // Check local or workspace root relative path
    let fullPath = join(process.cwd(), '../../tests/fixtures/hardware-streams', fileName);
    try {
      const data = readFileSync(fullPath, 'utf8');
      return JSON.parse(data);
    } catch {
      fullPath = join(process.cwd(), 'tests/fixtures/hardware-streams', fileName);
      const data = readFileSync(fullPath, 'utf8');
      return JSON.parse(data);
    }
  }

  beforeEach(() => {
    telemetryService = new TelemetryService();
    heartbeatService = new HeartbeatService();
    harness = new ContractTestHarness(telemetryService, heartbeatService);
  });

  it('replays stream-01: normal driving route with provisioning, telemetry batch, and heartbeat', async () => {
    const stream = loadStreamFixture('stream-01-normal-route.json');
    const summary = await harness.replayStream(stream, 'PROVISIONED');

    expect(summary.totalMessages).toBe(3);
    expect(summary.successfulMessages).toBe(3);
    expect(summary.allPassed).toBe(true);

    // Verify device transitioned from PROVISIONED to ACTIVE per C-01
    const device = telemetryService.getDevice('HW_901');
    expect(device?.status).toBe('ACTIVE');
    expect(device?.first_used_at).toBeDefined();
  });

  it('replays stream-02: reconnect burst after signal loss', async () => {
    const stream = loadStreamFixture('stream-02-reconnect-burst.json');
    const summary = await harness.replayStream(stream, 'ACTIVE');

    expect(summary.totalMessages).toBe(2);
    expect(summary.successfulMessages).toBe(2);
    expect(summary.allPassed).toBe(true);

    const telemetryResult = summary.results.find((r) => r.type === 'telemetry');
    expect(telemetryResult?.body.accepted_count).toBe(5);
    expect(telemetryResult?.body.rejected_count).toBe(0);
  });

  it('replays stream-03: duplicate samples produce HTTP 200 with per-sample CONFLICT (C-09 / OV-1)', async () => {
    const stream = loadStreamFixture('stream-03-duplicate-conflict.json');
    const summary = await harness.replayStream(stream, 'ACTIVE');

    expect(summary.totalMessages).toBe(2);
    expect(summary.successfulMessages).toBe(2);
    expect(summary.allPassed).toBe(true);

    const secondBatchResult = summary.results[1];
    expect(secondBatchResult?.status).toBe(200);
    expect(secondBatchResult?.body.accepted_count).toBe(2);
    expect(secondBatchResult?.body.rejected_count).toBe(1);
    expect(secondBatchResult?.body.rejections[0]?.reason).toBe('CONFLICT');
  });

  it('replays stream-04: power and tamper event sequence', async () => {
    const stream = loadStreamFixture('stream-04-power-tamper-events.json');
    const summary = await harness.replayStream(stream, 'ACTIVE');

    expect(summary.totalMessages).toBe(2);
    expect(summary.successfulMessages).toBe(2);
    expect(summary.allPassed).toBe(true);

    const eventResult = summary.results.find((r) => r.type === 'event');
    expect(eventResult?.body.event_results).toHaveLength(2);
    expect(eventResult?.body.event_results[0].status).toBe('PROCESSED');
    expect(eventResult?.body.event_results[1].status).toBe('PROCESSED');
  });

  it('replays stream-05: unauthorized bearer token rejected with HTTP 401', async () => {
    const stream = loadStreamFixture('stream-05-unauthorized-revoked.json');
    const summary = await harness.replayStream(stream, 'ACTIVE');

    expect(summary.totalMessages).toBe(1);
    expect(summary.successfulMessages).toBe(1);
    expect(summary.allPassed).toBe(true);
    expect(summary.results[0]?.status).toBe(401);
  });

  it('replays stream-06: kinematic jump and invalid GPS fix parsing', async () => {
    const stream = loadStreamFixture('stream-06-kinematic-jump-invalid-gps.json');
    const summary = await harness.replayStream(stream, 'ACTIVE');

    expect(summary.totalMessages).toBe(1);
    expect(summary.successfulMessages).toBe(1);
    expect(summary.allPassed).toBe(true);
    expect(summary.results[0]?.body.accepted_count).toBe(0);
    expect(summary.results[0]?.body.rejected_count).toBe(2);
  });
});
