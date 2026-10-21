import {
  evaluatePreTripDiagnostics,
  PreTripDiagnosticsInput,
  PreTripDiagnosticsSummary,
  DiagnosticCheckResult,
} from '@collegebus/domain';

export interface DeviceDiagnosticSensor {
  getLocationPermission: () => Promise<'ALWAYS' | 'WHILE_IN_USE' | 'DENIED'>;
  getNotificationPermission: () => Promise<'GRANTED' | 'DENIED'>;
  isBatteryOptimisationExempt: () => Promise<boolean | null>;
  getCurrentGpsAccuracy: () => Promise<number | null>;
  isNetworkReachable: () => Promise<boolean>;
  getOperatingSystem: () => 'ANDROID' | 'IOS';
}

export interface ServerHardwareStateFetcher {
  getHardwareStatus: (
    busId: string,
  ) => Promise<{ heartbeatAgeSeconds: number | null; gpsValid: boolean }>;
}

export class PreTripDiagnosticsManager {
  private latestSummary: PreTripDiagnosticsSummary | null = null;

  constructor(
    private readonly sensor: DeviceDiagnosticSensor,
    private readonly server: ServerHardwareStateFetcher,
  ) {}

  /**
   * Executes the full pre-trip diagnostic suite for a bus and selected trip type.
   */
  async runDiagnostics(params: {
    busId: string;
    isDriverRostered: boolean;
    tripType: 'MORNING' | 'AFTERNOON' | null;
  }): Promise<PreTripDiagnosticsSummary> {
    const [
      locationPerm,
      notifPerm,
      batteryExempt,
      gpsAccuracy,
      networkOk,
      hardwareState,
    ] = await Promise.all([
      this.sensor.getLocationPermission(),
      this.sensor.getNotificationPermission(),
      this.sensor.isBatteryOptimisationExempt(),
      this.sensor.getCurrentGpsAccuracy(),
      this.sensor.isNetworkReachable(),
      this.server.getHardwareStatus(params.busId).catch(() => ({
        heartbeatAgeSeconds: null,
        gpsValid: false,
      })),
    ]);

    const input: PreTripDiagnosticsInput = {
      isDriverRostered: params.isDriverRostered,
      tripTypeSelected: params.tripType,
      hardwareHeartbeatAgeSeconds: hardwareState.heartbeatAgeSeconds,
      hardwareGpsValid: hardwareState.gpsValid,
      phoneLocationPermission: locationPerm,
      phoneNotificationPermission: notifPerm,
      batteryOptimisationExempt: batteryExempt,
      phoneGpsAccuracyM: gpsAccuracy,
      networkReachable: networkOk,
      os: this.sensor.getOperatingSystem(),
    };

    const summary = evaluatePreTripDiagnostics(input);
    this.latestSummary = summary;
    return summary;
  }

  getLatestSummary(): PreTripDiagnosticsSummary | null {
    return this.latestSummary;
  }

  canStartShift(): boolean {
    return this.latestSummary?.allowedToStart ?? false;
  }

  getFixInstructions(checkNumber: number): string | undefined {
    const check = this.latestSummary?.checks.find((c) => c.checkNumber === checkNumber);
    return check?.fixInstructions;
  }

  getBlockingFailures(): DiagnosticCheckResult[] {
    return this.latestSummary?.blockingFailures ?? [];
  }
}
