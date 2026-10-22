import { DriverTripSummaryDto } from '@collegebus/contracts';

export interface TripSummaryHttpHandler {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export interface TripSummarySession {
  driverId: string;
  accessToken: string;
}

export class TripSummaryManager {
  private cachedSummary: DriverTripSummaryDto | null = null;

  constructor(
    private readonly apiBaseUrl: string,
    private readonly http: TripSummaryHttpHandler = { fetch: globalThis.fetch },
  ) {}

  getCachedSummary(): DriverTripSummaryDto | null {
    return this.cachedSummary;
  }

  clear() {
    this.cachedSummary = null;
  }

  /**
   * Fetches the completed trip summary for a shift (Part 20.9 fields, SW-MVP §15.7).
   */
  async fetchTripSummary(
    session: TripSummarySession,
    shiftId: string,
  ): Promise<DriverTripSummaryDto> {
    const response = await this.http.fetch(
      `${this.apiBaseUrl}/api/v1/driver/trip-summary/${shiftId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'x-driver-id': session.driverId,
        },
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || 'Failed to fetch trip summary');
    }

    const data = (await response.json()) as DriverTripSummaryDto;
    this.cachedSummary = data;
    return data;
  }
}
