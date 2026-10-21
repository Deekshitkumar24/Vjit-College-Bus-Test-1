import * as Sentry from '@sentry/node';

export interface SentryConfig {
  dsn?: string;
  environment: string;
  release?: string;
}

let sentryInitialized = false;

export function initSentry(config: SentryConfig): boolean {
  if (!config.dsn) {
    return false;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release || 'college-bus-tracker-api@1.0.0',
    tracesSampleRate: config.environment === 'production' ? 0.1 : 1.0,
  });

  sentryInitialized = true;
  return true;
}

export function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>,
): string | undefined {
  if (!sentryInitialized) {
    return undefined;
  }
  return context
    ? Sentry.captureException(error, { extra: context })
    : Sentry.captureException(error);
}

export function isSentryInitialized(): boolean {
  return sentryInitialized;
}
