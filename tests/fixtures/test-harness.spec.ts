import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestUser, createTestBus, createTestDevice } from './factories.js';
import { assertNonProduction } from './synthetic.guard.js';

describe('Test Harness & Synthetic Data Policies (P0-T4, Part 15.5)', () => {
  const originalAppEnv = process.env['APP_ENV'];

  beforeEach(() => {
    process.env['APP_ENV'] = 'local';
  });

  afterEach(() => {
    process.env['APP_ENV'] = originalAppEnv;
  });

  it('guarantees createTestUser sets is_synthetic to true and uses test.invalid email', () => {
    const user = createTestUser();
    expect(user.is_synthetic).toBe(true);
    expect(user.email).toContain('@test.invalid');
    expect(user.full_name).toContain('Test');
  });

  it('guarantees createTestBus uses 9nn bus numbers and sets is_synthetic to true', () => {
    const bus = createTestBus();
    expect(bus.is_synthetic).toBe(true);
    expect(bus.bus_number).toMatch(/Bus 9\d{2}/);
  });

  it('guarantees createTestDevice uses HW_9nn range and sets is_synthetic to true', () => {
    const device = createTestDevice();
    expect(device.is_synthetic).toBe(true);
    expect(device.device_id).toMatch(/HW_9\d{2}/);
  });

  it('strictly refuses execution when APP_ENV is production (R-M5, Part 15.5)', () => {
    process.env['APP_ENV'] = 'production';
    expect(() => assertNonProduction()).toThrowError(/CRITICAL SECURITY VIOLATION/);
    expect(() => createTestUser()).toThrowError(/CRITICAL SECURITY VIOLATION/);
  });
});
