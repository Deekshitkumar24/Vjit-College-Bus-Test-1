import { describe, it, expect } from 'vitest';
import {
  initSentry,
  captureException,
  isSentryInitialized,
} from '../src/common/telemetry/sentry.js';
import { getTracer, withSpan } from '../src/common/telemetry/opentelemetry.js';

describe('Telemetry Baseline (P0-T15, Part 2 & Part 14.5)', () => {
  it('safely handles missing SENTRY_DSN without crashing', () => {
    const initialized = initSentry({ environment: 'development' });
    expect(initialized).toBe(false);
    expect(isSentryInitialized()).toBe(false);

    // captureException returns undefined when uninitialized
    const eventId = captureException(new Error('Test harmless error'));
    expect(eventId).toBeUndefined();
  });

  it('creates and completes OpenTelemetry spans cleanly', async () => {
    const tracer = getTracer();
    expect(tracer).toBeDefined();

    const output = await withSpan(
      'test-span',
      async (span) => {
        expect(span).toBeDefined();
        return 'span-complete';
      },
      { 'test.attribute': 'p0-t15' },
    );

    expect(output).toBe('span-complete');
  });

  it('records exceptions within OpenTelemetry spans', async () => {
    await expect(
      withSpan('error-span', async () => {
        throw new Error('Deliberate test failure for span error recording');
      }),
    ).rejects.toThrowError('Deliberate test failure for span error recording');
  });
});
