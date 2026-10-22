import { describe, it, expect } from 'vitest';
import {
  MaintenanceTicketManager,
  FirmwareRolloutManager,
} from '../src/firmware/tickets-firmware-manager';

describe('P4-T7: Maintenance Tickets & Staged Firmware Rollout (Part 20.6, C-05)', () => {
  describe('Maintenance Ticket Lifecycle & 48h Escalation', () => {
    it('creates ticket, auto-escalates after 48h for HIGH/CRITICAL, and resolves with notes', () => {
      const ticketManager = new MaintenanceTicketManager();

      const ticket = ticketManager.createTicket({
        title: 'GNSS Antenna intermittent signal loss',
        description: 'Device reported 4 GNSS degraded events in last 2 hours',
        priority: 'HIGH',
        category: 'GNSS_DEGRADED',
        device_id: 'dev-001',
        bus_id: 'bus-1',
      });

      expect(ticket.id).toBeDefined();
      expect(ticket.status).toBe('OPEN');
      expect(ticket.is_escalated).toBe(false);

      // Check after 24h: should not escalate
      const check24h = new Date(new Date(ticket.created_at).getTime() + 24 * 3600 * 1000);
      ticketManager.evaluateAutoEscalations(check24h);
      expect(ticketManager.getTicket(ticket.id)?.is_escalated).toBe(false);

      // Check after 49h: must escalate
      const check49h = new Date(new Date(ticket.created_at).getTime() + 49 * 3600 * 1000);
      const escalatedCount = ticketManager.evaluateAutoEscalations(check49h);
      expect(escalatedCount).toBe(1);

      const escalatedTicket = ticketManager.getTicket(ticket.id);
      expect(escalatedTicket?.is_escalated).toBe(true);
      expect(escalatedTicket?.escalated_at).toBeDefined();

      // Resolve ticket with notes
      const resolved = ticketManager.resolveTicket(ticket.id, {
        resolution_notes: 'Replaced external GNSS antenna cable; signal verified at 18dB.',
      });
      expect(resolved.status).toBe('RESOLVED');
      expect(resolved.resolution_notes).toContain('Replaced external GNSS antenna');
    });

    it('rejects resolving a ticket without notes', () => {
      const ticketManager = new MaintenanceTicketManager();
      const ticket = ticketManager.createTicket({
        title: 'Tamper switch tripped',
        description: 'Enclosure opened during inspection',
        priority: 'LOW',
        category: 'TAMPER',
      });

      expect(() => {
        ticketManager.resolveTicket(ticket.id, { resolution_notes: 'done' });
      }).toThrow(/Resolution notes are required/);
    });
  });

  describe('Firmware Release Registration & Staged Canary Rollout', () => {
    it('registers a firmware release with SHA-256 and presigned URL (C-05)', () => {
      const rolloutManager = new FirmwareRolloutManager();

      const release = rolloutManager.registerRelease({
        firmware_version: 'v1.4.0',
        firmware_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        firmware_size_bytes: 524288,
        firmware_signature: 'sig_ed25519_test_payload_valid_signature_string',
        firmware_url: 'https://s3.ap-south-1.amazonaws.com/collegebus-firmware/v1.4.0.bin?X-Amz-Expires=900',
        min_hardware_version: 'EC200U-V1',
      });

      expect(release.id).toBeDefined();
      expect(release.firmware_version).toBe('v1.4.0');
      expect(release.status).toBe('DRAFT');
    });

    it('automatically pauses staged rollout if error rate exceeds 5% or 3 crash events occur', () => {
      const rolloutManager = new FirmwareRolloutManager();

      const release = rolloutManager.registerRelease({
        firmware_version: 'v1.4.1',
        firmware_sha256: 'a'.repeat(64),
        firmware_size_bytes: 262144,
        firmware_signature: 'sig_test',
        firmware_url: 'https://firmware.collegebus.internal/v1.4.1.bin',
        min_hardware_version: 'EC200U-V1',
      });

      // Start rollout at 5% canary
      rolloutManager.startRollout({
        release_id: release.id,
        target_stage_percent: 5,
        canary_failure_threshold_percent: 5,
        max_crash_count_24h: 3,
      });

      expect(rolloutManager.getRelease(release.id)?.status).toBe('ACTIVE');

      // Record 2 crashes (within limit)
      rolloutManager.recordDeviceEvent(release.id, 'FIRMWARE_CRASH');
      rolloutManager.recordDeviceEvent(release.id, 'FIRMWARE_CRASH');
      expect(rolloutManager.getRelease(release.id)?.status).toBe('ACTIVE');

      // Record 3rd crash: safety gate triggers auto-pause!
      rolloutManager.recordDeviceEvent(release.id, 'FIRMWARE_CRASH');
      expect(rolloutManager.getRelease(release.id)?.status).toBe('PAUSED');
      expect(rolloutManager.getAutoPauseReason(release.id)).toContain('Crash count reached limit');
    });
  });
});
