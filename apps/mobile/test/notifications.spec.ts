import { describe, it, expect, beforeEach } from 'vitest';
import {
  NotificationManager,
  NotificationPreference,
  NotificationItem,
  setupAndroidSafetyChannel,
} from '../src/notifications/notification-manager.js';

describe('P2-T4: Notification Centre and Preferences', () => {
  let manager: NotificationManager;

  beforeEach(() => {
    manager = new NotificationManager({
      userId: 'usr_student_01',
      deviceToken: 'fcm_mock_token_abc123',
      platform: 'android',
    });
  });

  it('initializes default notification preferences correctly', () => {
    const prefs = manager.getPreferences();
    expect(prefs.pushEnabled).toBe(true);
    expect(prefs.safetyAlertsEnabled).toBe(true);
    expect(prefs.approachingAlertMinutes).toBe(5); // Default 5 mins
    expect(prefs.delayAlertsEnabled).toBe(true);
  });

  it('updates notification preferences and clamps approaching alert between 2 and 15 mins (P2-T6)', () => {
    manager.updatePreferences({ approachingAlertMinutes: 1 });
    expect(manager.getPreferences().approachingAlertMinutes).toBe(2); // Clamped min 2

    manager.updatePreferences({ approachingAlertMinutes: 20 });
    expect(manager.getPreferences().approachingAlertMinutes).toBe(15); // Clamped max 15

    manager.updatePreferences({ approachingAlertMinutes: 10, pushEnabled: false });
    expect(manager.getPreferences().approachingAlertMinutes).toBe(10);
    expect(manager.getPreferences().pushEnabled).toBe(false);
  });

  it('registers push token payload conforming to push_tokens table schema', () => {
    const payload = manager.getPushTokenRegistrationPayload();
    expect(payload.user_id).toBe('usr_student_01');
    expect(payload.token).toBe('fcm_mock_token_abc123');
    expect(payload.platform).toBe('android');
    expect(payload.active).toBe(true);
  });

  it('stores and retrieves notifications in the notification center', () => {
    const alert1: NotificationItem = {
      id: 'notif_1',
      category: 'SAFETY',
      title: 'Emergency SOS Triggered',
      body: 'Bus 12 has triggered an alert.',
      receivedAt: '2026-10-22T08:30:00.000Z',
      read: false,
    };
    const alert2: NotificationItem = {
      id: 'notif_2',
      category: 'APPROACHING',
      title: 'Bus Arriving Soon',
      body: 'Bus 12 is 5 minutes from your stop.',
      receivedAt: '2026-10-22T08:35:00.000Z',
      read: false,
    };

    manager.addNotification(alert1);
    manager.addNotification(alert2);

    expect(manager.getUnreadCount()).toBe(2);
    expect(manager.getNotifications()).toHaveLength(2);

    manager.markAsRead('notif_1');
    expect(manager.getUnreadCount()).toBe(1);
    expect(manager.getNotifications().find((n) => n.id === 'notif_1')?.read).toBe(true);
  });

  it('configures Android SAFETY notification channel with high priority and sound', () => {
    const channel = setupAndroidSafetyChannel();
    expect(channel.channelId).toBe('safety_alerts');
    expect(channel.name).toBe('Safety & Emergency Alerts');
    expect(channel.importance).toBe('HIGH');
    expect(channel.vibration).toBe(true);
  });
});
