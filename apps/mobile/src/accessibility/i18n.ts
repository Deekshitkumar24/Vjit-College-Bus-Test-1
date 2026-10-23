export type SupportedLocale = 'en' | 'hi' | 'te';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'hi', 'te'];

let currentLocale: SupportedLocale = 'en';

export interface AccessibilityProps {
  accessible: boolean;
  accessibilityLabel: string;
  accessibilityRole?: 'button' | 'header' | 'link' | 'image' | 'text' | 'alert' | 'none';
  accessibilityHint?: string;
  accessibilityState?: {
    disabled?: boolean;
    selected?: boolean;
    busy?: boolean;
  };
}

const STRINGS: Record<SupportedLocale, Record<string, string>> = {
  en: {
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save',
    'common.back': 'Back',
    'common.loading': 'Loading, please wait...',
    'auth.sign_in': 'Sign In',
    'auth.sign_out': 'Sign Out',
    'bus.detail.eta_minutes': 'Arriving in {minutes} minutes',
    'bus.status.live_tracker': 'Live · bus tracker',
    'bus.status.driver_phone': "Live · driver's phone",
    'bus.status.scheduled': 'Scheduled · not yet started',
    'bus.status.completed': 'Trip completed',
    'bus.status.not_running': 'Not running today',
    'qr.scan.title': 'Scan Boarding QR',
    'qr.scan.hint': 'Point your camera at the driver QR code to check in',
    'attendance.marked': 'Attendance marked successfully',
    'sos.button.title': 'Emergency SOS',
    'sos.button.hint': 'Press and hold for 3 seconds to send emergency signal',
  },
  hi: {
    'common.cancel': 'रद्द करें',
    'common.confirm': 'पुष्टि करें',
    'auth.sign_in': 'साइन इन करें',
    'bus.detail.eta_minutes': '{minutes} मिनट में आगमन',
    'bus.status.live_tracker': 'लाइव · बस ट्रैकर',
    'bus.status.driver_phone': 'लाइव · चालक का फोन',
  },
  te: {
    'common.cancel': 'రద్దు చేయి',
    'common.confirm': 'ధృవీకరించు',
    'auth.sign_in': 'సైన్ ఇన్ చేయండి',
    'bus.detail.eta_minutes': '{minutes} నిమిషాల్లో చేరుకుంటుంది',
    'bus.status.live_tracker': 'లైవ్ · బస్సు ట్రాకర్',
    'bus.status.driver_phone': 'లైవ్ · డ్రైవర్ ఫోన్',
  },
};

export function setLocale(locale: SupportedLocale): void {
  if (SUPPORTED_LOCALES.includes(locale)) {
    currentLocale = locale;
  }
}

export function getLocale(): SupportedLocale {
  return currentLocale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const dictionary = STRINGS[currentLocale] || STRINGS.en;
  let text = dictionary[key] || STRINGS.en[key] || key;

  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
    }
  }

  return text;
}

export function getAccessibilityProps(options: {
  label: string;
  role?: 'button' | 'header' | 'link' | 'image' | 'text' | 'alert' | 'none';
  hint?: string;
  disabled?: boolean;
  selected?: boolean;
}): AccessibilityProps {
  return {
    accessible: true,
    accessibilityLabel: options.label,
    ...(options.role !== undefined ? { accessibilityRole: options.role } : {}),
    ...(options.hint !== undefined ? { accessibilityHint: options.hint } : {}),
    accessibilityState: {
      ...(options.disabled !== undefined ? { disabled: options.disabled } : {}),
      ...(options.selected !== undefined ? { selected: options.selected } : {}),
    },
  };
}
