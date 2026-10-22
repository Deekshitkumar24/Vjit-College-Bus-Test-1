import {
  SystemSettingUpdateDto,
  SystemSettingUpdateSchema,
  FeatureFlagDto,
  FeatureFlagSchema,
  UpdateFeatureFlagDto,
  UpdateFeatureFlagSchema,
  AdminAuditLogEntryDto,
  AdminAuditLogEntrySchema,
} from '@collegebus/contracts';

export class AdminSettingsManager {
  private settings: Map<string, unknown> = new Map();
  private auditLogs: AdminAuditLogEntryDto[] = [];
  private nextAuditId = 1;

  updateSetting(
    input: SystemSettingUpdateDto,
    userRole: string,
  ): { success: boolean; auditId: string } {
    if (userRole !== 'SUPER_ADMIN') {
      throw new Error('Only SUPER_ADMIN may update system settings');
    }

    const validated = SystemSettingUpdateSchema.parse(input);
    const beforeState = this.settings.has(validated.key)
      ? { value: this.settings.get(validated.key) }
      : null;

    this.settings.set(validated.key, validated.value);

    const auditId = `aud-${this.nextAuditId++}`;
    const auditEntry: AdminAuditLogEntryDto = {
      id: auditId,
      action: 'UPDATE_SYSTEM_SETTING',
      entity_type: 'SYSTEM_SETTING',
      entity_id: validated.key,
      user_id: validated.updated_by_user_id,
      change_reason: validated.change_reason,
      before_state: beforeState,
      after_state: { value: validated.value },
      recorded_at: new Date().toISOString(),
    };

    this.auditLogs.push(AdminAuditLogEntrySchema.parse(auditEntry));
    return { success: true, auditId };
  }

  getSetting(key: string): unknown {
    return this.settings.get(key);
  }

  getAuditLogs(): AdminAuditLogEntryDto[] {
    return [...this.auditLogs];
  }
}

export class FeatureFlagManager {
  private flags: Map<string, FeatureFlagDto> = new Map();

  setFlag(input: UpdateFeatureFlagDto): FeatureFlagDto {
    const validated = UpdateFeatureFlagSchema.parse(input);
    const existing = this.flags.get(validated.key);

    const flag: FeatureFlagDto = {
      key: validated.key,
      enabled: validated.enabled,
      rollout_percentage:
        validated.rollout_percentage ?? existing?.rollout_percentage ?? 100,
      description: existing?.description,
      last_updated_at: new Date().toISOString(),
      last_updated_by: validated.updated_by_user_id,
    };

    const parsed = FeatureFlagSchema.parse(flag);
    this.flags.set(validated.key, parsed);
    return parsed;
  }

  getFlag(key: string): FeatureFlagDto | undefined {
    return this.flags.get(key);
  }
}

export class AdminAuditViewer {
  private entries: AdminAuditLogEntryDto[] = [];

  recordEntry(entry: AdminAuditLogEntryDto): void {
    this.entries.push(AdminAuditLogEntrySchema.parse(entry));
  }

  query(filters: {
    entity_type?: string;
    action?: string;
    user_id?: string;
  }): AdminAuditLogEntryDto[] {
    return this.entries.filter((e) => {
      if (filters.entity_type && e.entity_type !== filters.entity_type)
        return false;
      if (filters.action && e.action !== filters.action) return false;
      if (filters.user_id && e.user_id !== filters.user_id) return false;
      return true;
    });
  }
}

export interface EndpointAccessResult {
  status: 200 | 403 | 404;
  body: { error?: string; ok?: boolean };
  data?: unknown;
}

export function evaluateAdminEndpointAccess(
  endpoint: string,
  role: string | null,
): EndpointAccessResult {
  const allowedAdminRoles = new Set([
    'COORDINATOR',
    'TECHNICIAN',
    'SUPER_ADMIN',
    'MANAGEMENT',
  ]);

  // Non-admin or unauthenticated roles return 404 Not Found to prevent route enumeration (T-SEC-05)
  if (!role || !allowedAdminRoles.has(role)) {
    return {
      status: 404,
      body: { error: 'Not Found' },
    };
  }

  // Role-specific authorization within admin routes
  if (endpoint.startsWith('/admin/settings') && role !== 'SUPER_ADMIN') {
    return {
      status: 403,
      body: { error: 'Forbidden' },
    };
  }

  if (endpoint.startsWith('/admin/devices') && role === 'MANAGEMENT') {
    return {
      status: 403,
      body: { error: 'Forbidden' },
    };
  }

  return {
    status: 200,
    body: { ok: true },
  };
}
