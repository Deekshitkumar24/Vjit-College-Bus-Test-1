import { execSync } from 'child_process';

interface ActivationRule {
  input: string;
  envVars: string[];
  testCommand?: string;
  evidenceId: string;
}

const ACTIVATION_RULES: Record<string, ActivationRule> = {
  sso: {
    input: 'E3',
    envVars: [
      'OIDC_GOOGLE_ISSUER',
      'OIDC_GOOGLE_CLIENT_ID',
      'OIDC_GOOGLE_CLIENT_SECRET',
      'OIDC_MICROSOFT_ISSUER',
      'OIDC_MICROSOFT_CLIENT_ID',
      'OIDC_MICROSOFT_CLIENT_SECRET',
    ],
    testCommand: 'pnpm --filter @collegebus/api test test/auth.spec.ts',
    evidenceId: 'activate-sso',
  },
  ci: {
    input: 'E2',
    envVars: ['GITHUB_REPOSITORY', 'GITHUB_TOKEN'],
    evidenceId: 'activate-ci',
  },
  headers: {
    input: 'E1',
    envVars: ['AWS_PROFILE', 'AWS_REGION', 'API_PUBLIC_HOST'],
    evidenceId: 'activate-headers',
  },
  sentry: {
    input: 'E4',
    envVars: ['SENTRY_DSN'],
    evidenceId: 'activate-sentry',
  },
  turnstile: {
    input: 'E5',
    envVars: ['TURNSTILE_SECRET_KEY'],
    evidenceId: 'activate-turnstile',
  },
  'staging-load': {
    input: 'E1, E7',
    envVars: ['STAGING_API_URL'],
    evidenceId: 'activate-staging-load',
  },
  'device-p2': {
    input: 'E6, E3',
    envVars: ['DEVICE_ANDROID_ID', 'DEVICE_IOS_ID'],
    evidenceId: 'activate-device-p2',
  },
  'device-p3': {
    input: 'E6, E3',
    envVars: ['DEVICE_ANDROID_ID', 'DEVICE_IOS_ID'],
    evidenceId: 'activate-device-p3',
  },
  battery: {
    input: 'E6',
    envVars: ['DEVICE_ANDROID_ID'],
    evidenceId: 'activate-battery',
  },
  bench: {
    input: 'E11',
    envVars: ['BENCH_DEVICE_ID'],
    evidenceId: 'activate-bench',
  },
  push: {
    input: 'E12',
    envVars: ['FCM_SERVICE_ACCOUNT_JSON'],
    evidenceId: 'activate-push',
  },
  sms: {
    input: 'E13',
    envVars: ['SMS_PROVIDER_KEY', 'SMS_SENDER_ID', 'SMS_CALLBACK_SECRET'],
    evidenceId: 'activate-sms',
  },
  pilot: {
    input: 'E10, O7',
    envVars: ['PILOT_CONSENT_REF'],
    evidenceId: 'activate-pilot',
  },
  eas: {
    input: 'E14',
    envVars: ['EXPO_TOKEN'],
    evidenceId: 'activate-eas',
  },
  stores: {
    input: 'E9',
    envVars: ['APPLE_TEAM_ID', 'PLAY_SERVICE_ACCOUNT_JSON'],
    evidenceId: 'activate-stores',
  },
  pentest: {
    input: 'E8',
    envVars: ['PENTEST_REPORT_PATH'],
    evidenceId: 'activate-pentest',
  },
  'purge-staging': {
    input: 'E7, GO',
    envVars: ['STAGING_DATABASE_URL'],
    evidenceId: 'activate-purge-staging',
  },
};

const target = process.argv[2];
if (!target || !ACTIVATION_RULES[target]) {
  console.error(`Unknown activation target: "${target}". Valid targets: ${Object.keys(ACTIVATION_RULES).join(', ')}`);
  process.exit(1);
}

const rule = ACTIVATION_RULES[target];
const missing = rule.envVars.filter((v) => !process.env[v]);

if (missing.length > 0) {
  console.log(`[ACTIVATION REFUSED] Required environment variables missing for ${rule.input} (${target}):`);
  for (const v of missing) {
    console.log(`  - ${v}`);
  }
  process.exit(2);
}

console.log(`[ACTIVATION SUCCESS] All required variables present for ${rule.input} (${target}).`);
if (rule.testCommand) {
  execSync(`pnpm evidence -- ${rule.evidenceId} -- ${rule.testCommand}`, { stdio: 'inherit' });
} else {
  execSync(`pnpm evidence -- ${rule.evidenceId} -- echo "Activation verified"`, { stdio: 'inherit' });
}
