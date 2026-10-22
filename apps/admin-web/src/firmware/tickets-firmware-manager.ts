import {
  CreateTicketDto,
  CreateTicketSchema,
  MaintenanceTicketDto,
  MaintenanceTicketSchema,
  ResolveTicketDto,
  ResolveTicketSchema,
  RegisterFirmwareReleaseDto,
  RegisterFirmwareReleaseSchema,
  FirmwareReleaseDto,
  FirmwareReleaseSchema,
  StagedRolloutConfigDto,
  StagedRolloutConfigSchema,
} from '@collegebus/contracts';

export class MaintenanceTicketManager {
  private tickets: Map<string, MaintenanceTicketDto> = new Map();
  private nextId = 1;

  createTicket(input: CreateTicketDto): MaintenanceTicketDto {
    const validated = CreateTicketSchema.parse(input);
    const now = new Date().toISOString();
    const id = `tkt-${this.nextId++}`;

    const ticket: MaintenanceTicketDto = {
      id,
      device_id: validated.device_id ?? null,
      bus_id: validated.bus_id ?? null,
      title: validated.title,
      description: validated.description,
      priority: validated.priority,
      category: validated.category,
      status: 'OPEN',
      created_at: now,
      updated_at: now,
      is_escalated: false,
      escalated_at: null,
      resolution_notes: null,
      resolved_at: null,
    };

    const parsed = MaintenanceTicketSchema.parse(ticket);
    this.tickets.set(id, parsed);
    return parsed;
  }

  evaluateAutoEscalations(now: Date = new Date()): number {
    let escalatedCount = 0;
    const nowMs = now.getTime();
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;

    for (const ticket of this.tickets.values()) {
      if (
        ticket.status === 'OPEN' &&
        !ticket.is_escalated &&
        (ticket.priority === 'HIGH' || ticket.priority === 'CRITICAL')
      ) {
        const createdMs = new Date(ticket.created_at).getTime();
        if (nowMs - createdMs >= fortyEightHoursMs) {
          ticket.is_escalated = true;
          ticket.escalated_at = now.toISOString();
          ticket.updated_at = now.toISOString();
          escalatedCount++;
        }
      }
    }

    return escalatedCount;
  }

  resolveTicket(id: string, input: ResolveTicketDto): MaintenanceTicketDto {
    const ticket = this.tickets.get(id);
    if (!ticket) {
      throw new Error(`Ticket ${id} not found`);
    }

    const validated = ResolveTicketSchema.parse(input);
    const now = new Date().toISOString();

    ticket.status = 'RESOLVED';
    ticket.resolution_notes = validated.resolution_notes;
    ticket.resolved_at = now;
    ticket.updated_at = now;

    return ticket;
  }

  getTicket(id: string): MaintenanceTicketDto | undefined {
    return this.tickets.get(id);
  }
}

export class FirmwareRolloutManager {
  private releases: Map<string, FirmwareReleaseDto> = new Map();
  private rolloutConfigs: Map<string, StagedRolloutConfigDto> = new Map();
  private crashEvents: Map<string, number> = new Map();
  private autoPauseReasons: Map<string, string> = new Map();
  private nextId = 1;

  registerRelease(input: RegisterFirmwareReleaseDto): FirmwareReleaseDto {
    const validated = RegisterFirmwareReleaseSchema.parse(input);
    const id = `fw-${this.nextId++}`;
    const now = new Date().toISOString();

    const release: FirmwareReleaseDto = {
      id,
      firmware_version: validated.firmware_version,
      firmware_sha256: validated.firmware_sha256,
      firmware_size_bytes: validated.firmware_size_bytes,
      firmware_signature: validated.firmware_signature,
      firmware_url: validated.firmware_url,
      min_hardware_version: validated.min_hardware_version,
      status: 'DRAFT',
      created_at: now,
    };

    const parsed = FirmwareReleaseSchema.parse(release);
    this.releases.set(id, parsed);
    return parsed;
  }

  startRollout(config: StagedRolloutConfigDto): void {
    const validated = StagedRolloutConfigSchema.parse(config);
    const release = this.releases.get(validated.release_id);
    if (!release) {
      throw new Error(`Release ${validated.release_id} not found`);
    }

    release.status = 'ACTIVE';
    this.rolloutConfigs.set(validated.release_id, validated);
    this.crashEvents.set(validated.release_id, 0);
  }

  recordDeviceEvent(releaseId: string, eventType: string): void {
    const release = this.releases.get(releaseId);
    if (!release || release.status !== 'ACTIVE') return;

    const config = this.rolloutConfigs.get(releaseId);
    if (!config) return;

    if (eventType === 'FIRMWARE_CRASH' || eventType === 'BOOT_FAILURE') {
      const currentCrashes = (this.crashEvents.get(releaseId) ?? 0) + 1;
      this.crashEvents.set(releaseId, currentCrashes);

      if (currentCrashes >= config.max_crash_count_24h) {
        release.status = 'PAUSED';
        this.autoPauseReasons.set(
          releaseId,
          `Crash count reached limit (${currentCrashes} >= ${config.max_crash_count_24h}) within 24h`,
        );
      }
    }
  }

  getRelease(id: string): FirmwareReleaseDto | undefined {
    return this.releases.get(id);
  }

  getAutoPauseReason(id: string): string | undefined {
    return this.autoPauseReasons.get(id);
  }
}
