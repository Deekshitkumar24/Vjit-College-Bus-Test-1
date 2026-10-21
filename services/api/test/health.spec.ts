import { describe, it, expect } from 'vitest';
import { HealthController } from '../src/modules/health/health.controller.js';

describe('Health & Observability Baseline (P0-T10, Part 2 & Part 14.5)', () => {
  const controller = new HealthController();

  it('responds with 200 OK on liveness probe /health', () => {
    let statusCode: number | null = null;
    let jsonBody: any = null;

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            jsonBody = data;
          },
        };
      },
    };

    controller.liveness(mockRes);
    expect(statusCode).toBe(200);
    expect(jsonBody.status).toBe('ok');
    expect(jsonBody.service).toBe('college-bus-tracker-api');
    expect(jsonBody.timestamp).toBeDefined();
  });

  it('responds with 200 OK on readiness probe /health/ready', async () => {
    let statusCode: number | null = null;
    let jsonBody: any = null;

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            jsonBody = data;
          },
        };
      },
    };

    await controller.readiness(mockRes);
    expect(statusCode).toBe(200);
    expect(jsonBody.status).toBe('ready');
    expect(jsonBody.database).toBe('connected');
    expect(jsonBody.timestamp).toBeDefined();
  });
});
