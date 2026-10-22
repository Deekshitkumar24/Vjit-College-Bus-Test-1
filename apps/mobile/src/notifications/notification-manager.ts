export interface NotificationPreference {
  pushEnabled: boolean;
  safetyAlertsEnabled: boolean;
  approachingAlertMinutes: number; // 2 to 15 minutes (P2-T6)
  delayAlertsEnabled: boolean;
  soundEnabled: boolean;
}

export interface NotificationItem {
  id: string;
  category: 'SAFETY' | 'APPROACHING' | 'DELAY' | 'GENERAL';
  title: string;
  body: string;
  receivedAt: string;
  read: boolean;
}

export interface PushTokenPayload {
  user_id: string;
  token: string;
  platform: 'ios' | 'android';
  active: boolean;
}

export interface AndroidNotificationChannel {
  channelId: string;
  name: string;
  importance: 'HIGH' | 'DEFAULT' | 'LOW';
  vibration: boolean;
  sound: string;
}

export class NotificationManager {
  private userId: string;
  private deviceToken: string;
  private platform: 'ios' | 'android';
  private preferences: NotificationPreference;
  private notifications: NotificationItem[] = [];

  constructor(options: {
    userId: string;
    deviceToken: string;
    platform: 'ios' | 'android';
    initialPreferences?: Partial<NotificationPreference>;
  }) {
    this.userId = options.userId;
    this.deviceToken = options.deviceToken;
    this.platform = options.platform;
    this.preferences = {
      pushEnabled: true,
      safetyAlertsEnabled: true,
      approachingAlertMinutes: 5, // Default 5 minutes
      delayAlertsEnabled: true,
      soundEnabled: true,
      ...options.initialPreferences,
    };
  }

  public getPreferences(): NotificationPreference {
    return { ...this.preferences };
  }

  public updatePreferences(updates: Partial<NotificationPreference>): void {
    if (updates.approachingAlertMinutes !== undefined) {
      // Clamped strictly between 2 and 15 minutes per P2-T6
      const clamped = Math.max(2, Math.min(15, updates.approachingAlertMinutes));
      updates.approachingAlertMinutes = clamped;
    }
    this.preferences = {
      ...this.preferences,
      ...updates,
    };
  }

  public getPushTokenRegistrationPayload(): PushTokenPayload {
    return {
      user_id: this.userId,
      token: this.deviceToken,
      platform: this.platform,
      active: true,
    };
  }

  public addNotification(item: NotificationItem): void {
    this.notifications.unshift(item);
  }

  public getNotifications(): NotificationItem[] {
    return [...this.notifications];
  }

  public markAsRead(id: string): void {
    const item = this.notifications.find((n) => n.id === id);
    if (item) {
      item.read = true;
    }
  }

  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }
}

/**
 * Android SAFETY channel setup (Part 10.3 / P2-T4)
 */
export function setupAndroidSafetyChannel(): AndroidNotificationChannel {
  return {
    channelId: 'safety_alerts',
    name: 'Safety & Emergency Alerts',
    importance: 'HIGH',
    vibration: true,
    sound: 'emergency_alert_tone',
  };
}
