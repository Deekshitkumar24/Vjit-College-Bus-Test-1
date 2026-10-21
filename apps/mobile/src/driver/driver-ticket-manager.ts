import {
  DriverProblemCategory,
  DriverProblemReportRequestDto,
  DriverProblemReportResponseDto,
  DriverTicketPriority,
} from '@collegebus/contracts';

export interface TicketSubmissionParams {
  category: DriverProblemCategory;
  busId: string;
  shiftId?: string;
  note: string;
  location?: {
    lat: number;
    lng: number;
    accuracy_m?: number;
  };
}

export type TicketApiCaller = (
  req: DriverProblemReportRequestDto,
) => Promise<DriverProblemReportResponseDto>;

export interface LocalTicketRecord {
  ticket_id: string;
  category: DriverProblemCategory;
  priority: DriverTicketPriority;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  bus_id: string;
  note: string;
  reported_at: string;
  is_synced: boolean;
  message?: string;
}

/**
 * Driver Problem Reporter & Maintenance Ticketing Manager
 * Per SW-MVP-1.0 §16.3 #12 & §24:
 * - Submits maintenance problem reports: BUS_BREAKDOWN, TRACKER_PROBLEM, PHONE_PROBLEM, OTHER.
 * - Enforces mandatory 5 to 500 character descriptive notes.
 * - Enriches tickets with driver location and shift context.
 * - Derives appropriate priority (BUS_BREAKDOWN = HIGH, hardware/phone = MEDIUM, other = LOW).
 * - Implements offline buffering and sequential synchronization.
 */
export class DriverTicketManager {
  private tickets: LocalTicketRecord[] = [];
  private pendingQueue: DriverProblemReportRequestDto[] = [];

  constructor(private apiCaller?: TicketApiCaller) {}

  /**
   * Validates problem report note and category.
   */
  static validateReport(params: TicketSubmissionParams): { valid: boolean; error?: string } {
    if (!params.busId || params.busId.trim().length === 0) {
      return { valid: false, error: 'Bus ID is required' };
    }
    if (!params.category) {
      return { valid: false, error: 'Problem category is required' };
    }
    const note = params.note ? params.note.trim() : '';
    if (note.length < 5) {
      return { valid: false, error: 'Note must be at least 5 characters long' };
    }
    if (note.length > 500) {
      return { valid: false, error: 'Note cannot exceed 500 characters' };
    }
    return { valid: true };
  }

  /**
   * Submits a problem report, creating a maintenance ticket.
   */
  async submitReport(
    params: TicketSubmissionParams,
    options?: { isOnline?: boolean; now?: Date },
  ): Promise<LocalTicketRecord> {
    const validation = DriverTicketManager.validateReport(params);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const isOnline = options?.isOnline ?? true;
    const now = options?.now ?? new Date();

    const requestDto: DriverProblemReportRequestDto = {
      category: params.category,
      bus_id: params.busId,
      shift_id: params.shiftId,
      note: params.note.trim(),
      lat: params.location?.lat,
      lng: params.location?.lng,
      accuracy_m: params.location?.accuracy_m,
    };

    let priority: DriverTicketPriority = 'LOW';
    if (params.category === 'BUS_BREAKDOWN') {
      priority = 'HIGH';
    } else if (params.category === 'TRACKER_PROBLEM' || params.category === 'PHONE_PROBLEM') {
      priority = 'MEDIUM';
    }

    if (isOnline && this.apiCaller) {
      try {
        const response = await this.apiCaller(requestDto);
        const record: LocalTicketRecord = {
          ticket_id: response.ticket_id,
          category: response.category,
          priority: response.priority,
          status: response.status,
          bus_id: response.bus_id,
          note: params.note.trim(),
          reported_at: response.reported_at,
          is_synced: true,
          message: response.message,
        };
        this.tickets.unshift(record);
        return record;
      } catch (err) {
        // Fallback to queue on API failure
        return this.queueOfflineReport(
          requestDto,
          priority,
          now,
          err instanceof Error ? err.message : 'Network error',
        );
      }
    } else {
      return this.queueOfflineReport(requestDto, priority, now, 'Queued offline');
    }
  }

  private queueOfflineReport(
    requestDto: DriverProblemReportRequestDto,
    priority: DriverTicketPriority,
    now: Date,
    reason: string,
  ): LocalTicketRecord {
    this.pendingQueue.push(requestDto);
    const tempTicketId = `offline_tkt_${now.getTime()}_${Math.random().toString(36).substring(2, 6)}`;
    const record: LocalTicketRecord = {
      ticket_id: tempTicketId,
      category: requestDto.category,
      priority,
      status: 'OPEN',
      bus_id: requestDto.bus_id,
      note: requestDto.note,
      reported_at: now.toISOString(),
      is_synced: false,
      message: `Ticket saved offline: ${reason}. Will sync when reconnected.`,
    };
    this.tickets.unshift(record);
    return record;
  }

  /**
   * Returns all submitted and tracked tickets.
   */
  getTickets(): LocalTicketRecord[] {
    return [...this.tickets];
  }

  /**
   * Number of pending offline tickets awaiting sync.
   */
  getPendingCount(): number {
    return this.pendingQueue.length;
  }

  /**
   * Flushes all queued offline problem reports.
   */
  async flushPending(customCaller?: TicketApiCaller): Promise<{ synced: number; failed: number }> {
    const caller = customCaller || this.apiCaller;
    if (!caller) {
      throw new Error('API caller required to flush pending reports');
    }

    let synced = 0;
    let failed = 0;
    const remaining: DriverProblemReportRequestDto[] = [];

    for (const item of this.pendingQueue) {
      try {
        const response = await caller(item);
        synced++;
        // Update local ticket record if present
        const match = this.tickets.find(
          (t) => !t.is_synced && t.bus_id === item.bus_id && t.category === item.category,
        );
        if (match) {
          match.ticket_id = response.ticket_id;
          match.is_synced = true;
          match.status = response.status;
          match.message = response.message;
        }
      } catch {
        failed++;
        remaining.push(item);
      }
    }

    this.pendingQueue = remaining;
    return { synced, failed };
  }
}
