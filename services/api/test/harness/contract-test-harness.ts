import { TelemetryService } from '../../src/modules/telemetry/telemetry.service.js';
import { HeartbeatService } from '../../src/modules/heartbeat/heartbeat.service.js';
import { generateDeviceToken, hashDeviceToken, DeviceRecord, KeyRing } from '@collegebus/domain';
import { HeartbeatRequestSchema, TelemetryBatchSchema } from '@collegebus/contracts';

export interface RecordedHardwareMessage {
  type: 'telemetry' | 'heartbeat' | 'event';
  endpoint: string;
  auth_override?: string;
  payload: any;
  expected_status?: number;
  expected_response?: any;
  expected_accepted?: number;
  expected_rejected?: number;
  expected_rejection_reason?: string;
  expected_event_count?: number;
}

export interface RecordedHardwareStream {
  description: string;
  metadata: {
    device_id: string;
    serial_number: string;
    imei: string;
    iccid: string;
    vehicle_class: 'V12' | 'V24';
    is_synthetic: boolean;
  };
  messages: RecordedHardwareMessage[];
}

export interface ReplayMessageResult {
  index: number;
  type: string;
  status: number;
  body: any;
  passed: boolean;
  error?: string;
}

export interface StreamReplaySummary {
  streamDescription: string;
  deviceId: string;
  totalMessages: number;
  successfulMessages: number;
  results: ReplayMessageResult[];
  allPassed: boolean;
}

export class ContractTestHarness {
  private readonly secretKey = '0123456789abcdef0123456789abcdef';
  private readonly keyring: KeyRing = { 1: this.secretKey };

  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly heartbeatService: HeartbeatService,
  ) {}

  /**
   * Initializes device registration with synthetic test credentials.
   */
  public provisionDevice(
    deviceId: string,
    initialStatus: 'PROVISIONED' | 'ACTIVE' | 'REVOKED' = 'PROVISIONED',
    vehicleClass: 'V12' | 'V24' = 'V12',
  ): { rawToken: string; deviceRecord: DeviceRecord } {
    const rawToken = generateDeviceToken();
    const tokenHash = hashDeviceToken(rawToken, this.secretKey);

    const deviceRecord: DeviceRecord = {
      id: `dev_${deviceId.toLowerCase()}`,
      device_id: deviceId,
      status: initialStatus,
      token_hash: tokenHash,
      key_version: 1,
      first_used_at: initialStatus === 'ACTIVE' ? new Date('2026-10-21T00:00:00Z') : null,
      vehicle_class: vehicleClass,
    };

    this.telemetryService.registerDevice(deviceRecord);
    this.heartbeatService.registerDevice(deviceRecord);

    return { rawToken, deviceRecord };
  }

  /**
   * Replays an entire recorded hardware message stream and validates contract compliance.
   */
  public async replayStream(
    stream: RecordedHardwareStream,
    initialStatus: 'PROVISIONED' | 'ACTIVE' | 'REVOKED' = 'PROVISIONED',
  ): Promise<StreamReplaySummary> {
    const { rawToken } = this.provisionDevice(
      stream.metadata.device_id,
      initialStatus,
      stream.metadata.vehicle_class,
    );

    const results: ReplayMessageResult[] = [];
    let successfulCount = 0;

    for (let i = 0; i < stream.messages.length; i++) {
      const msg = stream.messages[i]!;
      const token = msg.auth_override
        ? msg.auth_override.startsWith('Bearer ')
          ? msg.auth_override.slice(7)
          : msg.auth_override
        : rawToken;

      try {
        if (msg.type === 'telemetry') {
          // Validate schema with Zod
          const parseResult = TelemetryBatchSchema.safeParse(msg.payload);
          if (!parseResult.success) {
            results.push({
              index: i,
              type: msg.type,
              status: 400,
              body: parseResult.error.flatten(),
              passed: msg.expected_status === 400,
            });
            continue;
          }

          const response = await this.telemetryService.ingestBatch(
            stream.metadata.device_id,
            token,
            parseResult.data,
            this.keyring,
          );

          let passed = true;
          if (
            msg.expected_accepted !== undefined &&
            response.accepted_count !== msg.expected_accepted
          ) {
            passed = false;
          }
          if (
            msg.expected_rejected !== undefined &&
            response.rejected_count !== msg.expected_rejected
          ) {
            passed = false;
          }
          if (
            msg.expected_rejection_reason &&
            !response.rejections.some((r) => r.reason === msg.expected_rejection_reason)
          ) {
            passed = false;
          }

          if (passed) successfulCount++;
          results.push({
            index: i,
            type: msg.type,
            status: 200,
            body: response,
            passed,
          });
        } else if (msg.type === 'heartbeat') {
          const parseResult = HeartbeatRequestSchema.safeParse(msg.payload);
          if (!parseResult.success) {
            results.push({
              index: i,
              type: msg.type,
              status: 400,
              body: parseResult.error.flatten(),
              passed: msg.expected_status === 400,
            });
            continue;
          }

          const response = await this.heartbeatService.processHeartbeat(
            stream.metadata.device_id,
            token,
            parseResult.data,
            this.keyring,
          );

          let passed = true;
          if (
            msg.expected_response?.pending_action &&
            response.pending_action !== msg.expected_response.pending_action
          ) {
            passed = false;
          }

          if (passed) successfulCount++;
          results.push({
            index: i,
            type: msg.type,
            status: 200,
            body: response,
            passed,
          });
        } else if (msg.type === 'event') {
          const eventResults = await this.heartbeatService.processEvents(
            stream.metadata.device_id,
            token,
            msg.payload.boot_id,
            msg.payload.events,
            this.keyring,
          );

          let passed = true;
          if (
            msg.expected_event_count !== undefined &&
            eventResults.length !== msg.expected_event_count
          ) {
            passed = false;
          }

          if (passed) successfulCount++;
          results.push({
            index: i,
            type: msg.type,
            status: 200,
            body: { event_results: eventResults },
            passed,
          });
        }
      } catch (err: any) {
        const status = err.status || 500;
        const expected = msg.expected_status || 200;
        const passed = status === expected;
        if (passed) successfulCount++;

        results.push({
          index: i,
          type: msg.type,
          status,
          body: err.response || err.message,
          passed,
          error: err.message,
        });
      }
    }

    return {
      streamDescription: stream.description,
      deviceId: stream.metadata.device_id,
      totalMessages: stream.messages.length,
      successfulMessages: successfulCount,
      results,
      allPassed: successfulCount === stream.messages.length,
    };
  }
}
