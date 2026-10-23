import { describe, it, expect } from 'vitest';
import {
  AdminSettingsManager,
  FeatureFlagManager,
  AdminAuditViewer,
  evaluateAdminEndpointAccess,
} from '../src/settings/settings-audit-manager';

describe('P4-T8: Settings, Feature Flags, Audit Viewer & T-SEC-05 Verification', () => {
  describe('Super Admin Settings Management with Mandatory Reason', () => {
    it('updates setting when valid reason is provided by SAD and logs audit entry', () => {
      const settingsMgr = new AdminSettingsManager();

      const result = settingsMgr.updateSetting({
        key: 'tracking.gps_jump_threshold_kmh',
        value: 160,
        change_reason: 'Updated highway bus speed tolerance per state transport guideline',
        updated_by_user_id: 'usr-sad-1',
      }, 'SUPER_ADMIN');

      expect(result.success).toBe(true);
      expect(settingsMgr.getSetting('tracking.gps_jump_threshold_kmh')).toBe(160);

      // Verify audit log entry
      const auditEntries = settingsMgr.getAuditLogs();
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0]!.entity_type).toBe('SYSTEM_SETTING');
      expect(auditEntries[0]!.change_reason).toContain('Updated highway bus speed tolerance');
      expect(auditEntries[0]!.user_id).toBe('usr-sad-1');
    });

    it('rejects setting update if role is not SUPER_ADMIN', () => {
      const settingsMgr = new AdminSettingsManager();

      expect(() => {
        settingsMgr.updateSetting({
          key: 'tracking.gps_jump_threshold_kmh',
          value: 160,
          change_reason: 'Attempted unauthorized change by coordinator',
          updated_by_user_id: 'usr-cor-1',
        }, 'COORDINATOR');
      }).toThrow(/Only SUPER_ADMIN may update system settings/);
    });

    it('rejects setting update if reason is under 10 characters', () => {
      const settingsMgr = new AdminSettingsManager();

      expect(() => {
        settingsMgr.updateSetting({
          key: 'tracking.gps_jump_threshold_kmh',
          value: 160,
          change_reason: 'too short',
          updated_by_user_id: 'usr-sad-1',
        }, 'SUPER_ADMIN');
      }).toThrow(/Change reason must be at least 10 characters/);
    });
  });

  describe('Feature Flags Management', () => {
    it('updates feature flag percentage and logs reason', () => {
      const flagMgr = new FeatureFlagManager();

      flagMgr.setFlag({
        key: 'enable_student_qr_scanner',
        enabled: true,
        rollout_percentage: 50,
        change_reason: 'Staging 50% rollout of QR scanner for North campus cohort',
        updated_by_user_id: 'usr-sad-1',
      });

      const flag = flagMgr.getFlag('enable_student_qr_scanner');
      expect(flag?.enabled).toBe(true);
      expect(flag?.rollout_percentage).toBe(50);
    });
  });

  describe('Admin Audit Viewer', () => {
    it('provides append-only filtered audit query', () => {
      const auditViewer = new AdminAuditViewer();

      auditViewer.recordEntry({
        id: 'aud-1',
        action: 'UPDATE_SETTING',
        entity_type: 'SYSTEM_SETTING',
        entity_id: 'export.max_rows',
        user_id: 'usr-sad-1',
        change_reason: 'Aligning export limit to 100,000 per contract',
        recorded_at: '2026-10-22T08:00:00.000Z',
      });

      auditViewer.recordEntry({
        id: 'aud-2',
        action: 'REVOKE_DEVICE',
        entity_type: 'DEVICE',
        entity_id: 'dev-001',
        user_id: 'usr-cor-1',
        change_reason: 'Stolen or damaged hardware reported',
        recorded_at: '2026-10-22T09:00:00.000Z',
      });

      const deviceAudits = auditViewer.query({ entity_type: 'DEVICE' });
      expect(deviceAudits).toHaveLength(1);
      expect(deviceAudits[0]!.entity_id).toBe('dev-001');

      const allAudits = auditViewer.query({});
      expect(allAudits).toHaveLength(2);
    });
  });

  describe('T-SEC-05: Admin Endpoint Route Security & 404 Hiding', () => {
    const adminEndpoints = [
      '/admin/buses',
      '/admin/devices',
      '/admin/routes',
      '/admin/settings',
      '/admin/tickets',
      '/admin/users',
    ];

    it('returns 404 and leaks no data for non-admin roles and unauthenticated requests (T-SEC-05)', () => {
      const unauthorizedRoles = ['STUDENT', 'DRIVER', 'FACULTY', 'PARENT', 'GUEST', null];

      for (const endpoint of adminEndpoints) {
        for (const role of unauthorizedRoles) {
          const response = evaluateAdminEndpointAccess(endpoint, role);
          expect(response.status).toBe(404);
          expect(response.body).toEqual({ error: 'Not Found' });
          expect(response.data).toBeUndefined();
        }
      }
    });

    it('allows access only to authorized admin roles (COORDINATOR, TECHNICIAN, SUPER_ADMIN, MANAGEMENT)', () => {
      expect(evaluateAdminEndpointAccess('/admin/buses', 'COORDINATOR').status).toBe(200);
      expect(evaluateAdminEndpointAccess('/admin/devices', 'TECHNICIAN').status).toBe(200);
      expect(evaluateAdminEndpointAccess('/admin/settings', 'SUPER_ADMIN').status).toBe(200);
      expect(evaluateAdminEndpointAccess('/admin/routes', 'MANAGEMENT').status).toBe(200);
    });
  });
});
