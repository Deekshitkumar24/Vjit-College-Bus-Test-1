import { describe, it, expect } from 'vitest';
import {
  t,
  setLocale,
  getLocale,
  getAccessibilityProps,
  SUPPORTED_LOCALES,
} from '../src/accessibility/i18n.js';

describe('P2-T8: Accessibility and String Externalisation', () => {
  it('provides externalised strings with parameter interpolation', () => {
    expect(t('bus.detail.eta_minutes', { minutes: 5 })).toBe('Arriving in 5 minutes');
    expect(t('common.cancel')).toBe('Cancel');
    expect(t('auth.sign_in')).toBe('Sign In');
  });

  it('supports locale switching and falls back gracefully', () => {
    expect(SUPPORTED_LOCALES).toContain('en');
    setLocale('en');
    expect(getLocale()).toBe('en');

    // Missing key returns key path instead of throwing
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('builds accessible element props with labels, roles, and hints', () => {
    const buttonProps = getAccessibilityProps({
      label: 'Scan QR Code',
      role: 'button',
      hint: 'Double tap to open camera scanner',
    });

    expect(buttonProps.accessible).toBe(true);
    expect(buttonProps.accessibilityLabel).toBe('Scan QR Code');
    expect(buttonProps.accessibilityRole).toBe('button');
    expect(buttonProps.accessibilityHint).toBe('Double tap to open camera scanner');
  });

  it('formats ETA countdown and status text for screen readers without ambiguous abbreviations', () => {
    const liveTrackerLabel = t('bus.status.live_tracker');
    const driverPhoneLabel = t('bus.status.driver_phone');

    expect(liveTrackerLabel).toBe('Live · bus tracker');
    expect(driverPhoneLabel).toBe("Live · driver's phone");
  });
});
