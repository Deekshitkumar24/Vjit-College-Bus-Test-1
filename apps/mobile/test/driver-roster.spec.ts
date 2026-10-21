import { describe, it, expect, beforeEach } from 'vitest';
import { DriverRosterClient } from '../src/driver/driver-roster.js';
import {
  DriverRosterResponseDto,
  DriverRosterBusDto,
  DriverDeviceRegisterResponseDto,
} from '@collegebus/contracts';

describe('P3-T1: Driver OTP Sign-in, Roster List & Device Registration', () => {
  const API_BASE = 'https://api.collegebus.internal';
  const DRIVER_ID = 'drv_a4f1e82d';
  const ROSTERED_BUS_1: DriverRosterBusDto = {
    bus_id: 'bus_01',
    bus_number: 'Bus 01',
    registration_number: 'KA-01-EA-1001',
    route_id: 'route_north_campus',
    route_name: 'North Campus Express',
    is_active: true,
  };
  const ROSTERED_BUS_2: DriverRosterBusDto = {
    bus_id: 'bus_03',
    bus_number: 'Bus 03',
    registration_number: 'KA-01-EA-1003',
    route_id: 'route_east_campus',
    route_name: 'East Campus Shuttle',
    is_active: true,
  };

  let mockRosterBuses: DriverRosterBusDto[];
  let client: DriverRosterClient;

  beforeEach(() => {
    mockRosterBuses = [ROSTERED_BUS_1, ROSTERED_BUS_2];

    const mockFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const headers = new Headers(init?.headers);
      const auth = headers.get('Authorization');
      const driverIdHeader = headers.get('x-driver-id');

      if (!auth || !driverIdHeader) {
        return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
      }

      // POST /api/v1/driver/device-register
      if (pathname === '/api/v1/driver/device-register' && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        const res: DriverDeviceRegisterResponseDto = {
          registered: true,
          registered_at: new Date('2026-10-22T08:00:00Z').toISOString(),
          device_label: body.device_label,
        };
        return new Response(JSON.stringify(res), { status: 200 });
      }

      // GET /api/v1/driver/roster
      if (pathname === '/api/v1/driver/roster' && (!init?.method || init.method === 'GET')) {
        const res: DriverRosterResponseDto = {
          driver_id: driverIdHeader,
          buses: mockRosterBuses,
        };
        return new Response(JSON.stringify(res), { status: 200 });
      }

      // GET /api/v1/driver/bus/:busId
      if (pathname.startsWith('/api/v1/driver/bus/') && (!init?.method || init.method === 'GET')) {
        const busId = pathname.replace('/api/v1/driver/bus/', '');
        const bus = mockRosterBuses.find((b) => b.bus_id === busId);
        if (!bus) {
          // AC-DRV-01: Direct request for unrostered bus returns 403 Forbidden
          return new Response(
            JSON.stringify({
              code: 'DRIVER_NOT_ON_ROSTER',
              message: `Driver is not rostered on bus ${busId}`,
            }),
            { status: 403 },
          );
        }
        return new Response(JSON.stringify(bus), { status: 200 });
      }

      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    };

    client = new DriverRosterClient(API_BASE, { fetch: mockFetch });
  });

  it('rejects calls when driver is unauthenticated', async () => {
    await expect(client.getRoster()).rejects.toThrow('Driver is not authenticated');
    await expect(client.selectBus('bus_01')).rejects.toThrow('Driver is not authenticated');
    await expect(
      client.registerDevice({
        device_label: 'Pixel 8 - Driver Phone',
        device_model: 'Google Pixel 8',
        os: 'ANDROID',
        os_version: '14.0',
        app_version: '1.0.0',
      }),
    ).rejects.toThrow('Driver is not authenticated');
  });

  it('registers the phone device label and binds it to driver session', async () => {
    client.setSession({
      driverId: DRIVER_ID,
      email: 'driver.ramesh@college.edu',
      accessToken: 'jwt_mock_driver_token_e8a2b3',
    });

    const reg = await client.registerDevice({
      device_label: 'Pixel 8 - Driver Phone Ramesh',
      device_model: 'Pixel 8',
      os: 'ANDROID',
      os_version: '14.0',
      app_version: '1.0.0',
    });

    expect(reg.registered).toBe(true);
    expect(reg.device_label).toBe('Pixel 8 - Driver Phone Ramesh');
    expect(client.getSession()?.deviceLabel).toBe('Pixel 8 - Driver Phone Ramesh');
  });

  it('retrieves roster strictly containing only assigned buses (AC-DRV-01)', async () => {
    client.setSession({
      driverId: DRIVER_ID,
      email: 'driver.ramesh@college.edu',
      accessToken: 'jwt_mock_driver_token_e8a2b3',
    });

    const roster = await client.getRoster();
    expect(roster.length).toBe(2);
    expect(roster.map((b) => b.bus_id)).toEqual(['bus_01', 'bus_03']);

    // Bus 07 is not on driver roster -> not listed
    expect(roster.some((b) => b.bus_id === 'bus_07')).toBe(false);
  });

  it('AC-DRV-01: direct request for unrostered bus (Bus 07) returns 403 Forbidden', async () => {
    client.setSession({
      driverId: DRIVER_ID,
      email: 'driver.ramesh@college.edu',
      accessToken: 'jwt_mock_driver_token_e8a2b3',
    });

    await expect(client.selectBus('bus_07')).rejects.toThrow(
      'DRIVER_NOT_ON_ROSTER: Access denied for bus bus_07',
    );
    expect(client.getSelectedBusId()).toBeUndefined();
  });

  it('allows selecting a rostered bus and records active selection', async () => {
    client.setSession({
      driverId: DRIVER_ID,
      email: 'driver.ramesh@college.edu',
      accessToken: 'jwt_mock_driver_token_e8a2b3',
    });

    const bus = await client.selectBus('bus_01');
    expect(bus.bus_id).toBe('bus_01');
    expect(bus.bus_number).toBe('Bus 01');
    expect(client.getSelectedBusId()).toBe('bus_01');
  });

  it('clears session and cached roster on sign out', async () => {
    client.setSession({
      driverId: DRIVER_ID,
      email: 'driver.ramesh@college.edu',
      accessToken: 'jwt_mock_driver_token_e8a2b3',
    });
    await client.getRoster();
    expect(client.getCachedRoster().length).toBe(2);

    client.clearSession();
    expect(client.getSession()).toBeNull();
    expect(client.getCachedRoster().length).toBe(0);
  });
});
