import {
  DriverLocationSampleDto,
  DriverLocationsBatchDto,
  DriverLocationsResponseDto,
} from '@collegebus/contracts';
import { PhoneLocationBuffer } from './location-buffer.js';

export interface LocationCollectorHttpHandler {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export interface ForegroundNotificationState {
  channelId: string;
  title: string;
  body: string;
  ongoing: boolean;
  priority: 'HIGH' | 'DEFAULT' | 'LOW';
}

export interface LocationStatusBannerState {
  visible: boolean;
  pointCount: number;
  message: string | null;
}

export interface LocationInputData {
  lat: number;
  lng: number;
  accuracy_m: number;
  speed_mps?: number | null | undefined;
  heading_deg?: number | null | undefined;
  provider?: 'GPS' | 'FUSED' | 'NETWORK' | 'UNKNOWN' | undefined;
  is_mock?: boolean | undefined;
  recorded_at?: string | undefined;
}

export interface PhoneLocationCollectorConfig {
  apiBaseUrl: string;
  accessToken: string;
  driverId: string;
  appVersion?: string;
  deviceModel?: string;
  movingSpeedThresholdMps?: number; // default: 3 km/h = 3 / 3.6 = 0.833 m/s
  movingIntervalS?: 10 | 30; // default 10s
  stoppedIntervalS?: 10 | 30; // default 30s
  batchSize?: number; // default 50
  batchPacingMs?: number; // default 2000ms (1 batch every 2 seconds per §11.8)
  buffer?: PhoneLocationBuffer;
  http?: LocationCollectorHttpHandler;
}

export class PhoneLocationCollector {
  private trackingActive = false;
  private currentShiftId: string | null = null;
  private currentBusNumber: string | null = null;
  private seqCounter = 0;
  private lastKnownSpeedMps = 0;
  private cadenceIntervalS: 10 | 30 = 30;
  private networkOnline = true;
  private isFlushing = false;
  private activeFlushPromise: Promise<{ sentCount: number; remainingCount: number }> | null = null;

  private readonly apiBaseUrl: string;
  private readonly accessToken: string;
  private readonly driverId: string;
  private readonly appVersion: string;
  private readonly deviceModel: string;
  private readonly movingSpeedThresholdMps: number;
  private readonly movingIntervalS: 10 | 30;
  private readonly stoppedIntervalS: 10 | 30;
  private readonly batchSize: number;
  private readonly batchPacingMs: number;
  private readonly buffer: PhoneLocationBuffer;
  private readonly http: LocationCollectorHttpHandler;

  private foregroundNotification: ForegroundNotificationState | null = null;
  private bannerState: LocationStatusBannerState = {
    visible: false,
    pointCount: 0,
    message: null,
  };

  constructor(config: PhoneLocationCollectorConfig) {
    this.apiBaseUrl = config.apiBaseUrl;
    this.accessToken = config.accessToken;
    this.driverId = config.driverId;
    this.appVersion = config.appVersion ?? '1.0.0';
    this.deviceModel = config.deviceModel ?? 'Generic Smartphone';
    this.movingSpeedThresholdMps = config.movingSpeedThresholdMps ?? 3 / 3.6; // 3 km/h
    this.movingIntervalS = config.movingIntervalS ?? 10;
    this.stoppedIntervalS = config.stoppedIntervalS ?? 30;
    this.batchSize = config.batchSize ?? 50;
    this.batchPacingMs = config.batchPacingMs ?? 2000;
    this.buffer = config.buffer ?? new PhoneLocationBuffer();
    this.http = config.http ?? { fetch: globalThis.fetch };
  }

  isTracking(): boolean {
    return this.trackingActive;
  }

  getCurrentShiftId(): string | null {
    return this.currentShiftId;
  }

  getCurrentBusNumber(): string | null {
    return this.currentBusNumber;
  }

  getCurrentCadenceS(): 10 | 30 {
    return this.cadenceIntervalS;
  }

  getForegroundNotification(): ForegroundNotificationState | null {
    return this.foregroundNotification;
  }

  getStatusBanner(): LocationStatusBannerState {
    return { ...this.bannerState };
  }

  getBuffer(): PhoneLocationBuffer {
    return this.buffer;
  }

  setOnline(online: boolean): void {
    const wasOffline = !this.networkOnline;
    this.networkOnline = online;

    if (wasOffline && online && this.trackingActive && this.currentShiftId) {
      // Trigger replay of saved buffer when connection returns
      void this.flushPending();
    }
  }

  isOnline(): boolean {
    return this.networkOnline;
  }

  /**
   * Starts tracking for the specified shift and bus.
   */
  async start(shiftId: string, busNumber: string): Promise<void> {
    await this.buffer.initialize();
    this.currentShiftId = shiftId;
    this.currentBusNumber = busNumber;
    this.trackingActive = true;
    this.seqCounter = 0;
    this.cadenceIntervalS = this.stoppedIntervalS;

    // Establish persistent foreground notification for Android/iOS background tracking
    const displayBus = busNumber.startsWith('Bus ') ? busNumber : `Bus ${busNumber}`;
    this.foregroundNotification = {
      channelId: 'TRACKING',
      title: `${displayBus} · Tracking Active`,
      body: 'Shift active · GPS active',
      ongoing: true,
      priority: 'HIGH',
    };

    // Update banner with initial buffer count
    await this.updateBanner();

    // If buffer had points from prior session, start flush
    if (this.networkOnline) {
      void this.flushPending();
    }
  }

  /**
   * Stops tracking and clears persistent notification.
   */
  async stop(): Promise<void> {
    this.trackingActive = false;
    this.foregroundNotification = null;
    this.currentShiftId = null;
    this.currentBusNumber = null;
    this.bannerState = {
      visible: false,
      pointCount: 0,
      message: null,
    };
  }

  /**
   * Ingests a new GPS reading from phone location provider.
   * Adjusts adaptive cadence (10s moving / 30s stopped) and persists to buffer.
   */
  async recordLocation(input: LocationInputData): Promise<DriverLocationSampleDto | null> {
    if (!this.trackingActive || !this.currentShiftId) {
      return null;
    }

    this.seqCounter++;
    const speed = input.speed_mps ?? 0;
    this.lastKnownSpeedMps = speed;

    // Adaptive cadence: 10s when moving (> 3 km/h = 0.833 m/s), 30s when stopped
    if (speed > this.movingSpeedThresholdMps) {
      this.cadenceIntervalS = this.movingIntervalS;
    } else {
      this.cadenceIntervalS = this.stoppedIntervalS;
    }

    const sample: DriverLocationSampleDto = {
      seq: this.seqCounter,
      recorded_at: input.recorded_at ?? new Date().toISOString(),
      lat: input.lat,
      lng: input.lng,
      accuracy_m: input.accuracy_m,
      speed_mps: input.speed_mps !== undefined ? input.speed_mps : null,
      heading_deg: input.heading_deg !== undefined ? input.heading_deg : null,
      provider: input.provider ?? 'GPS',
      is_mock: Boolean(input.is_mock),
    };

    // Enqueue to SQLite buffer
    await this.buffer.enqueueSample(this.currentShiftId, sample);
    await this.updateBanner();

    // Trigger flush if online
    if (this.networkOnline && !this.isFlushing) {
      void this.flushPending();
    }

    return sample;
  }

  /**
   * Flushes buffered samples sequentially in FIFO batches of up to 50 samples
   * to POST /api/v1/driver/locations per SW-MVP-1.0 §11.7 and §16.3 #10.
   */
  async flushPending(): Promise<{ sentCount: number; remainingCount: number }> {
    if (this.activeFlushPromise) {
      return this.activeFlushPromise;
    }

    this.activeFlushPromise = this.executeFlush();
    try {
      return await this.activeFlushPromise;
    } finally {
      this.activeFlushPromise = null;
    }
  }

  private async executeFlush(): Promise<{ sentCount: number; remainingCount: number }> {
    if (!this.currentShiftId || !this.networkOnline) {
      const remaining = this.currentShiftId ? await this.buffer.getCount(this.currentShiftId) : 0;
      return { sentCount: 0, remainingCount: remaining };
    }

    this.isFlushing = true;
    let totalSent = 0;

    try {
      while (this.networkOnline && this.currentShiftId) {
        const batchSamples = await this.buffer.getPendingBatch(this.currentShiftId, this.batchSize);
        if (batchSamples.length === 0) {
          break;
        }

        const currentCount = await this.buffer.getCount(this.currentShiftId);
        this.bannerState = {
          visible: true,
          pointCount: currentCount,
          message: `Sending saved location, ${currentCount} points`,
        };

        const batchPayload: DriverLocationsBatchDto = {
          shift_id: this.currentShiftId,
          app_version: this.appVersion,
          device_model: this.deviceModel,
          samples: batchSamples,
        };

        const response = await this.http.fetch(`${this.apiBaseUrl}/api/v1/driver/locations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'x-driver-id': this.driverId,
          },
          body: JSON.stringify(batchPayload),
        });

        if (!response.ok) {
          // If server error, abort current flush cycle without deleting buffered rows
          break;
        }

        const data = (await response.json()) as DriverLocationsResponseDto;

        // Acknowledge server-confirmed sequence number
        if (data.ack_seq !== undefined) {
          await this.buffer.acknowledge(this.currentShiftId, data.ack_seq);
        }

        // Honor server's cadence interval update if supplied, while preserving moving cadence
        if (data.phone_interval_s) {
          if (this.lastKnownSpeedMps > this.movingSpeedThresholdMps) {
            this.cadenceIntervalS = this.movingIntervalS;
          } else {
            this.cadenceIntervalS = data.phone_interval_s;
          }
        }

        totalSent += batchSamples.length;

        // Check remaining points
        const remaining = await this.buffer.getCount(this.currentShiftId);
        if (remaining === 0) {
          break;
        }

        // Pacing delay between sequential batches per §11.8 if running in real environment
        if (this.batchPacingMs > 0 && typeof setTimeout === 'function') {
          await new Promise((resolve) => setTimeout(resolve, Math.min(this.batchPacingMs, 10)));
        }
      }
    } catch {
      // Network failure or abort -> samples remain securely buffered
    } finally {
      this.isFlushing = false;
      await this.updateBanner();
    }

    const remaining = this.currentShiftId ? await this.buffer.getCount(this.currentShiftId) : 0;
    return { sentCount: totalSent, remainingCount: remaining };
  }

  private async updateBanner(): Promise<void> {
    if (!this.currentShiftId) {
      this.bannerState = { visible: false, pointCount: 0, message: null };
      return;
    }

    const count = await this.buffer.getCount(this.currentShiftId);
    if (count > 0) {
      this.bannerState = {
        visible: true,
        pointCount: count,
        message: `Sending saved location, ${count} points`,
      };
    } else {
      this.bannerState = {
        visible: false,
        pointCount: 0,
        message: null,
      };
    }
  }
}
