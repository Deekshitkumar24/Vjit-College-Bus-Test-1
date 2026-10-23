import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProfilePrivacyManager,
  UserProfile,
  ActiveSession,
} from '../src/privacy/profile-privacy-manager.js';

describe('P2-T13: Profile and Privacy Management', () => {
  let manager: ProfilePrivacyManager;

  const mockProfile: UserProfile = {
    userId: 'usr_stu_100',
    fullName: 'Ananya Sharma',
    collegeEmail: 'ananya.s@college.edu',
    phoneNumber: '+919876543210',
    role: 'STU',
    emergencyContact: '+919876543211',
  };

  beforeEach(() => {
    manager = new ProfilePrivacyManager(mockProfile);
  });

  it('retrieves user profile and queues profile correction request', () => {
    expect(manager.getProfile().fullName).toBe('Ananya Sharma');

    const correction = manager.requestProfileCorrection({
      field: 'phoneNumber',
      proposedValue: '+919876543299',
      reason: 'Updated SIM card',
    });

    expect(correction.id).toBeDefined();
    expect(correction.status).toBe('PENDING_REVIEW');
    expect(correction.proposedValue).toBe('+919876543299');
  });

  it('manages GDPR/DPDP privacy requests (data export, deletion, consent withdrawal)', () => {
    const exportReq = manager.requestDataExport();
    expect(exportReq.status).toBe('REQUESTED');
    expect(exportReq.linkLifetimeHours).toBe(24); // C-06: 24 hours export validity

    const deletionReq = manager.requestAccountDeletion('Graduated from college');
    expect(deletionReq.status).toBe('QUEUED_FOR_PURGE');

    const consentRevoke = manager.withdrawConsent('MARKETING_COMMUNICATIONS');
    expect(consentRevoke.active).toBe(false);
    expect(manager.getConsentHistory().length).toBeGreaterThan(0);
  });

  it('tracks session list and allows signing out of other devices', () => {
    const sessions: ActiveSession[] = [
      { id: 'sess_current', deviceName: 'iPhone 15', current: true, lastActive: '2026-10-22T10:00:00Z' },
      { id: 'sess_old_ipad', deviceName: 'iPad Air', current: false, lastActive: '2026-10-20T14:30:00Z' },
      { id: 'sess_old_android', deviceName: 'Galaxy S22', current: false, lastActive: '2026-10-18T09:15:00Z' },
    ];

    manager.setSessions(sessions);
    expect(manager.getSessions()).toHaveLength(3);

    const revokedIds = manager.signOutOtherDevices();
    expect(revokedIds).toEqual(['sess_old_ipad', 'sess_old_android']);
    expect(manager.getSessions()).toHaveLength(1);
    expect(manager.getSessions()[0]!.current).toBe(true);
  });
});
