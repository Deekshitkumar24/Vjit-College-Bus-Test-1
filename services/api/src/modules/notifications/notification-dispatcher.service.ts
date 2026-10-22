import { Injectable } from '@nestjs/common';

export interface DispatchNotificationParams {
  recipientId: string;
  category: 'SAFETY' | 'ATTENDANCE' | 'TRIP' | 'ADMIN' | 'SYSTEM';
  title: string;
  body: string;
  channel: 'PUSH' | 'EMAIL' | 'SMS' | 'IN_APP';
  sendTime?: Date;
  recipientQuietHours?: { startHour: number; endHour: number }; // e.g. 22 (10pm) to 6 (6am)
  templateId?: string;
  templateParams?: Record<string, string>;
}

export interface DispatchResult {
  success: boolean;
  deliveryId?: string;
  suppressed?: boolean;
  suppressReason?: string;
  error?: string;
}

// Approved DLT templates registry per D-07 / RS-06
const APPROVED_DLT_TEMPLATES: Record<string, string> = {
  DLT_SOS_ALERT: 'Emergency Alert: SOS reported on Bus {#var#}. Immediate action required.',
  DLT_ABSENCE_ALERT: 'Attendance Notice: Student {#var#} was absent on afternoon trip {#var#}.',
  DLT_OTP_LOGIN: 'Your College Bus login verification code is {#var#}. Valid for 5 minutes.',
};

@Injectable()
export class NotificationDispatcherService {
  // In-memory sliding window rate tracker per recipient (5 msgs / 60 seconds)
  private readonly recipientTimestamps = new Map<string, number[]>();

  /**
   * Dispatches a notification across the specified channel while enforcing:
   * 1. Quiet hours (T-NTF-01): Non-SAFETY messages between 22:00 and 06:00 are suppressed.
   * 2. Recipient rate limiting (T-NTF-02): Max 5 notifications per 60s per user.
   * 3. SMS DLT Template verification (T-NTF-03): Mismatched or unapproved templates are blocked.
   */
  public async dispatch(params: DispatchNotificationParams): Promise<DispatchResult> {
    const now = params.sendTime ?? new Date();

    // 1. T-NTF-01: Quiet hours check
    // SAFETY notifications ALWAYS bypass quiet hours!
    if (params.category !== 'SAFETY') {
      const quiet = params.recipientQuietHours ?? { startHour: 22, endHour: 6 };
      const currentHour = now.getHours();

      const inQuietHours =
        quiet.startHour > quiet.endHour
          ? currentHour >= quiet.startHour || currentHour < quiet.endHour
          : currentHour >= quiet.startHour && currentHour < quiet.endHour;

      if (inQuietHours) {
        return {
          success: false,
          suppressed: true,
          suppressReason: 'QUIET_HOURS_SUPPRESSED',
        };
      }
    }

    // 2. T-NTF-02: Rate limit check (5 notifications / 60 seconds)
    const timestamps = this.recipientTimestamps.get(params.recipientId) ?? [];
    const windowStart = now.getTime() - 60 * 1000;
    const activeTimestamps = timestamps.filter((t) => t >= windowStart);

    if (activeTimestamps.length >= 5) {
      return {
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        suppressReason: 'RATE_LIMIT_EXCEEDED',
      };
    }

    // 3. T-NTF-03: SMS DLT template validation
    if (params.channel === 'SMS') {
      if (!params.templateId || !APPROVED_DLT_TEMPLATES[params.templateId]) {
        return {
          success: false,
          error: 'DLT_TEMPLATE_MISMATCH',
        };
      }
    }

    // Record timestamp for rate limiting
    activeTimestamps.push(now.getTime());
    this.recipientTimestamps.set(params.recipientId, activeTimestamps);

    return {
      success: true,
      deliveryId: `del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
  }

  public resetRateLimits(): void {
    this.recipientTimestamps.clear();
  }
}
