import { assertNonProduction } from './synthetic.guard.js';

export interface TestUserOptions {
  id?: string;
  collegeId?: string;
  email?: string;
  fullName?: string;
  phone?: string;
  status?: string;
}

export function createTestUser(options: TestUserOptions = {}) {
  assertNonProduction();

  const id = options.id || '99999999-0000-0000-0000-000000000001';
  const collegeId = options.collegeId || '99999999-0000-0000-0000-000000000000';
  const email = options.email || `test.user.${Date.now()}@test.invalid`;
  const fullName = options.fullName || 'Test User';
  const phone = options.phone || '+919999000001';
  const status = options.status || 'ACTIVE';

  return {
    id,
    college_id: collegeId,
    email,
    full_name: fullName,
    phone_e164: phone,
    status,
    is_synthetic: true, // Mandatory rule R-M3, Part 15.5
  };
}

export interface TestBusOptions {
  id?: string;
  busNumber?: string;
  registrationNumber?: string;
  capacity?: number;
}

export function createTestBus(options: TestBusOptions = {}) {
  assertNonProduction();

  const id = options.id || '99999999-0000-0000-0000-000000000010';
  const busNumber = options.busNumber || 'Bus 901'; // 9nn range per Part 15.5
  const registrationNumber = options.registrationNumber || 'KA-99-TEST-9001';
  const capacity = options.capacity || 50;

  return {
    id,
    bus_number: busNumber,
    registration_number: registrationNumber,
    capacity,
    status: 'ACTIVE',
    default_mode: 'AUTO',
    insurance_expiry: new Date('2030-01-01'),
    fitness_expiry: new Date('2030-01-01'),
    pollution_expiry: new Date('2030-01-01'),
    permit_expiry: new Date('2030-01-01'),
    is_synthetic: true,
  };
}

export interface TestDeviceOptions {
  id?: string;
  deviceId?: string;
  serialNumber?: string;
  imei?: string;
  iccid?: string;
}

export function createTestDevice(options: TestDeviceOptions = {}) {
  assertNonProduction();

  const id = options.id || '99999999-0000-0000-0000-000000000020';
  const deviceId = options.deviceId || 'HW_901'; // HW_9nn range per Part 15.5
  const serialNumber = options.serialNumber || 'SN-TEST-9001';
  const imei = options.imei || '999999999999001';
  const iccid = options.iccid || '9999999999999999001';

  return {
    id,
    device_id: deviceId,
    serial_number: serialNumber,
    imei,
    iccid,
    status: 'ACTIVE',
    fw_version: '1.0.0',
    vehicle_class: 'V12',
    is_synthetic: true,
  };
}
