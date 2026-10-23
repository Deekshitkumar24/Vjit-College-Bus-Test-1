export interface UserProfile {
  userId: string;
  fullName: string;
  collegeEmail: string;
  phoneNumber: string;
  role: 'STU' | 'FAC' | 'DRV';
  emergencyContact: string;
}

export interface ProfileCorrectionRequest {
  id: string;
  userId: string;
  field: string;
  proposedValue: string;
  reason: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface DataExportRequest {
  id: string;
  userId: string;
  status: 'REQUESTED' | 'PROCESSING' | 'READY';
  downloadUrl?: string;
  linkLifetimeHours: number; // 24 hours per C-06
  requestedAt: string;
}

export interface AccountDeletionRequest {
  id: string;
  userId: string;
  status: 'QUEUED_FOR_PURGE';
  reason?: string;
  requestedAt: string;
}

export interface UserConsentRecord {
  consentType: string;
  active: boolean;
  timestamp: string;
}

export interface ActiveSession {
  id: string;
  deviceName: string;
  current: boolean;
  lastActive: string;
}

export class ProfilePrivacyManager {
  private profile: UserProfile;
  private corrections: ProfileCorrectionRequest[] = [];
  private consentHistory: UserConsentRecord[] = [];
  private sessions: ActiveSession[] = [];

  constructor(profile: UserProfile) {
    this.profile = { ...profile };
  }

  public getProfile(): UserProfile {
    return { ...this.profile };
  }

  public requestProfileCorrection(params: {
    field: string;
    proposedValue: string;
    reason: string;
  }): ProfileCorrectionRequest {
    const correction: ProfileCorrectionRequest = {
      id: `corr_${Date.now()}`,
      userId: this.profile.userId,
      field: params.field,
      proposedValue: params.proposedValue,
      reason: params.reason,
      status: 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
    };
    this.corrections.push(correction);
    return correction;
  }

  public requestDataExport(): DataExportRequest {
    return {
      id: `exp_${Date.now()}`,
      userId: this.profile.userId,
      status: 'REQUESTED',
      linkLifetimeHours: 24, // C-06: 24 hours lifetime
      requestedAt: new Date().toISOString(),
    };
  }

  public requestAccountDeletion(reason?: string): AccountDeletionRequest {
    return {
      id: `del_${Date.now()}`,
      userId: this.profile.userId,
      status: 'QUEUED_FOR_PURGE',
      ...(reason !== undefined ? { reason } : {}),
      requestedAt: new Date().toISOString(),
    };
  }

  public withdrawConsent(consentType: string): UserConsentRecord {
    const record: UserConsentRecord = {
      consentType,
      active: false,
      timestamp: new Date().toISOString(),
    };
    this.consentHistory.push(record);
    return record;
  }

  public getConsentHistory(): UserConsentRecord[] {
    return [...this.consentHistory];
  }

  public setSessions(sessions: ActiveSession[]): void {
    this.sessions = [...sessions];
  }

  public getSessions(): ActiveSession[] {
    return [...this.sessions];
  }

  /**
   * Signs out all other sessions except the current active session.
   */
  public signOutOtherDevices(): string[] {
    const revoked = this.sessions.filter((s) => !s.current).map((s) => s.id);
    this.sessions = this.sessions.filter((s) => s.current);
    return revoked;
  }
}
