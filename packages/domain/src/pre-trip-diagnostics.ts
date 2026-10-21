export type DiagnosticStatus = 'PASS' | 'WARN' | 'FAIL';

export interface PreTripDiagnosticsInput {
  isDriverRostered: boolean;
  tripTypeSelected: 'MORNING' | 'AFTERNOON' | null;
  hardwareHeartbeatAgeSeconds: number | null;
  hardwareGpsValid: boolean;
  phoneLocationPermission: 'ALWAYS' | 'WHILE_IN_USE' | 'DENIED';
  phoneNotificationPermission: 'GRANTED' | 'DENIED';
  batteryOptimisationExempt: boolean | null;
  phoneGpsAccuracyM: number | null;
  networkReachable: boolean;
  os: 'ANDROID' | 'IOS';
}

export interface DiagnosticCheckResult {
  checkNumber: number;
  title: string;
  status: DiagnosticStatus;
  blocksStart: boolean;
  message: string;
  fixInstructions?: string | undefined;
}

export interface PreTripDiagnosticsSummary {
  allowedToStart: boolean;
  hardwareColor: 'GREEN' | 'AMBER' | 'RED';
  primarySource: 'HW' | 'PHONE';
  checks: DiagnosticCheckResult[];
  blockingFailures: DiagnosticCheckResult[];
  warnings: DiagnosticCheckResult[];
}

/**
 * Runs the 8 pre-trip diagnostic checks per SW-MVP-1.0 §15.1 and Part 9.10.
 */
export function evaluatePreTripDiagnostics(
  input: PreTripDiagnosticsInput,
): PreTripDiagnosticsSummary {
  const checks: DiagnosticCheckResult[] = [];

  // 1. Driver signed in and rostered for the chosen bus
  if (input.isDriverRostered) {
    checks.push({
      checkNumber: 1,
      title: 'Driver Roster Assignment',
      status: 'PASS',
      blocksStart: false,
      message: 'Driver rostered for this bus',
    });
  } else {
    checks.push({
      checkNumber: 1,
      title: 'Driver Roster Assignment',
      status: 'FAIL',
      blocksStart: true,
      message: 'Driver is not on roster for this bus (AC-DRV-01)',
      fixInstructions: 'Contact the transport coordinator to assign your account to this bus',
    });
  }

  // 2. Trip type selected (MORNING or AFTERNOON)
  if (input.tripTypeSelected) {
    checks.push({
      checkNumber: 2,
      title: 'Trip Type Selection',
      status: 'PASS',
      blocksStart: false,
      message: `Trip type confirmed: ${input.tripTypeSelected}`,
    });
  } else {
    checks.push({
      checkNumber: 2,
      title: 'Trip Type Selection',
      status: 'FAIL',
      blocksStart: true,
      message: 'Trip type not selected',
      fixInstructions: 'Select either MORNING or AFTERNOON trip before starting',
    });
  }

  // 3. Hardware status (GREEN / AMBER / RED)
  let hardwareColor: 'GREEN' | 'AMBER' | 'RED' = 'RED';
  let primarySource: 'HW' | 'PHONE' = 'HW';

  if (input.hardwareHeartbeatAgeSeconds !== null && input.hardwareHeartbeatAgeSeconds <= 120) {
    if (input.hardwareGpsValid) {
      hardwareColor = 'GREEN';
      primarySource = 'HW';
      checks.push({
        checkNumber: 3,
        title: 'Hardware Tracker Status',
        status: 'PASS',
        blocksStart: false,
        message: 'Hardware tracker active with valid GPS fix (GREEN)',
      });
    } else {
      hardwareColor = 'AMBER';
      primarySource = 'HW';
      checks.push({
        checkNumber: 3,
        title: 'Hardware Tracker Status',
        status: 'WARN',
        blocksStart: false,
        message: 'Hardware tracker active but waiting for GPS fix (AMBER)',
        fixInstructions: 'Ensure bus antenna has clear view of the sky',
      });
    }
  } else {
    // RED: heartbeat older than 2 minutes or null
    // Start is allowed with a warning; phone becomes primary (AC-DRV-02)
    hardwareColor = 'RED';
    primarySource = 'PHONE';
    checks.push({
      checkNumber: 3,
      title: 'Hardware Tracker Status',
      status: 'WARN',
      blocksStart: false,
      message:
        'Hardware tracker offline (RED) - phone will become primary tracking source (AC-DRV-02)',
      fixInstructions: 'Shift can proceed; keep driver phone powered on with clear sky visibility',
    });
  }

  // 4. Phone location permission set to Always (AC-DRV-03)
  if (input.phoneLocationPermission === 'ALWAYS') {
    checks.push({
      checkNumber: 4,
      title: 'Background Location Permission',
      status: 'PASS',
      blocksStart: false,
      message: 'Always location permission granted',
    });
  } else {
    const isAndroid = input.os === 'ANDROID';
    checks.push({
      checkNumber: 4,
      title: 'Background Location Permission',
      status: 'FAIL',
      blocksStart: true,
      message: 'Always location permission required for continuous transit tracking (AC-DRV-03)',
      fixInstructions: isAndroid
        ? 'Open Settings > Apps > College Bus > Permissions > Location > Select "Allow all the time"'
        : 'Open Settings > Privacy & Security > Location Services > College Bus > Select "Always"',
    });
  }

  // 5. Notification permission granted
  if (input.phoneNotificationPermission === 'GRANTED') {
    checks.push({
      checkNumber: 5,
      title: 'Notification Permission',
      status: 'PASS',
      blocksStart: false,
      message: 'Notification permission granted',
    });
  } else {
    checks.push({
      checkNumber: 5,
      title: 'Notification Permission',
      status: 'FAIL',
      blocksStart: true,
      message: 'Notification permission required for safety alerts and SOS dispatch',
      fixInstructions: 'Enable notifications in device system settings',
    });
  }

  // 6. Battery optimisation exempt (Android only)
  if (input.os === 'ANDROID') {
    if (input.batteryOptimisationExempt === true) {
      checks.push({
        checkNumber: 6,
        title: 'Battery Optimisation Exemption',
        status: 'PASS',
        blocksStart: false,
        message: 'Battery optimisation exemption confirmed',
      });
    } else {
      checks.push({
        checkNumber: 6,
        title: 'Battery Optimisation Exemption',
        status: 'WARN',
        blocksStart: false,
        message: 'Battery saver or optimisation is active; background tracking may be killed by OS',
        fixInstructions:
          "Open Settings > Battery > Battery Optimisation > Select College Bus > Don't optimise",
      });
    }
  } else {
    checks.push({
      checkNumber: 6,
      title: 'Battery Optimisation Exemption',
      status: 'PASS',
      blocksStart: false,
      message: 'Not applicable on iOS',
    });
  }

  // 7. Phone GPS fix accuracy <= 50m (SW-MVP-1.0 §15.1 Check 7)
  // If hardware is GREEN, phone GPS accuracy > 50m is warning only.
  // If hardware is AMBER or RED, phone GPS accuracy <= 50m is blocking.
  if (input.phoneGpsAccuracyM !== null && input.phoneGpsAccuracyM <= 50) {
    checks.push({
      checkNumber: 7,
      title: 'Phone GPS Accuracy',
      status: 'PASS',
      blocksStart: false,
      message: `Phone GPS accuracy is ${input.phoneGpsAccuracyM.toFixed(1)}m (target <= 50m)`,
    });
  } else {
    const currentAcc =
      input.phoneGpsAccuracyM !== null ? `${input.phoneGpsAccuracyM.toFixed(1)}m` : 'No GPS fix';
    if (hardwareColor === 'GREEN') {
      checks.push({
        checkNumber: 7,
        title: 'Phone GPS Accuracy',
        status: 'WARN',
        blocksStart: false,
        message: `Phone GPS accuracy is ${currentAcc} (hardware tracker is GREEN, so start is allowed)`,
        fixInstructions: 'Mount phone on dashboard with clear windshield visibility',
      });
    } else {
      checks.push({
        checkNumber: 7,
        title: 'Phone GPS Accuracy',
        status: 'FAIL',
        blocksStart: true,
        message: `Phone GPS accuracy is ${currentAcc}. Accuracy <= 50m required because tracker is ${hardwareColor}`,
        fixInstructions: 'Place phone near vehicle windshield and wait for accurate GPS signal',
      });
    }
  }

  // 8. Network reachable
  if (input.networkReachable) {
    checks.push({
      checkNumber: 8,
      title: 'Network Connectivity',
      status: 'PASS',
      blocksStart: false,
      message: 'Network reachable and server verified',
    });
  } else {
    checks.push({
      checkNumber: 8,
      title: 'Network Connectivity',
      status: 'FAIL',
      blocksStart: true,
      message: 'Network connection unavailable',
      fixInstructions: 'Check cellular data connection or SIM status',
    });
  }

  const blockingFailures = checks.filter((c) => c.blocksStart);
  const warnings = checks.filter((c) => c.status === 'WARN');

  return {
    allowedToStart: blockingFailures.length === 0,
    hardwareColor,
    primarySource,
    checks,
    blockingFailures,
    warnings,
  };
}
