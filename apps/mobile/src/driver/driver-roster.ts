import {
  DriverRosterResponseDto,
  DriverRosterBusDto,
  DriverDeviceRegisterDto,
  DriverDeviceRegisterResponseDto,
} from '@collegebus/contracts';

export interface DriverSessionState {
  driverId: string;
  email: string;
  accessToken: string;
  deviceLabel?: string | undefined;
  selectedBusId?: string | undefined;
  activeShiftId?: string | undefined;
}

export interface DriverHttpHandler {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export class DriverRosterClient {
  private session: DriverSessionState | null = null;
  private cachedRoster: DriverRosterBusDto[] = [];

  constructor(
    private readonly apiBaseUrl: string,
    private readonly http: DriverHttpHandler = { fetch: globalThis.fetch },
  ) {}

  setSession(session: DriverSessionState) {
    this.session = session;
  }

  getSession(): DriverSessionState | null {
    return this.session;
  }

  clearSession() {
    this.session = null;
    this.cachedRoster = [];
  }

  /**
   * Registers this phone as the driver's phone with device label (SW-MVP-1.0 §16.3 #1).
   */
  async registerDevice(
    dto: DriverDeviceRegisterDto,
  ): Promise<DriverDeviceRegisterResponseDto> {
    if (!this.session) {
      throw new Error('Driver is not authenticated');
    }

    const response = await this.http.fetch(`${this.apiBaseUrl}/api/v1/driver/device-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.session.accessToken}`,
        'x-driver-id': this.session.driverId,
      },
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || 'Failed to register device');
    }

    const data = (await response.json()) as DriverDeviceRegisterResponseDto;
    this.session.deviceLabel = data.device_label;
    return data;
  }

  /**
   * Retrieves the buses this driver is rostered to run (SW-MVP-1.0 §16.3 #1, AC-DRV-01).
   * Unrostered buses are strictly excluded.
   */
  async getRoster(): Promise<DriverRosterBusDto[]> {
    if (!this.session) {
      throw new Error('Driver is not authenticated');
    }

    const response = await this.http.fetch(`${this.apiBaseUrl}/api/v1/driver/roster`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.session.accessToken}`,
        'x-driver-id': this.session.driverId,
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || 'Failed to fetch driver roster');
    }

    const data = (await response.json()) as DriverRosterResponseDto;
    this.cachedRoster = data.buses;
    return data.buses;
  }

  /**
   * Verifies access to a specific bus.
   * Returns bus detail if rostered; throws 403 Forbidden error if unrostered (AC-DRV-01).
   */
  async selectBus(busId: string): Promise<DriverRosterBusDto> {
    if (!this.session) {
      throw new Error('Driver is not authenticated');
    }

    const response = await this.http.fetch(
      `${this.apiBaseUrl}/api/v1/driver/bus/${encodeURIComponent(busId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.session.accessToken}`,
          'x-driver-id': this.session.driverId,
        },
      },
    );

    if (response.status === 403) {
      throw new Error(`DRIVER_NOT_ON_ROSTER: Access denied for bus ${busId}`);
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || `Failed to access bus ${busId}`);
    }

    const bus = (await response.json()) as DriverRosterBusDto;
    this.session.selectedBusId = bus.bus_id;
    return bus;
  }

  getCachedRoster(): DriverRosterBusDto[] {
    return this.cachedRoster;
  }

  getSelectedBusId(): string | undefined {
    return this.session?.selectedBusId;
  }
}
