import { describe, it, expect, vi } from 'vitest';
import {
  canAccessAdminRoute,
  canAccessRouteById,
  AdminAuthState,
} from '../src/auth/auth-context.js';
import { SessionIdleTracker } from '../src/auth/idle-tracker.js';
import { MfaEnrolmentManager } from '../src/auth/mfa-enrolment.js';
import { getAuthorizedNavItems, isStudentDataAccessDenied } from '../src/routes/lazy-routes.js';
import { auditSecurityHeaders } from '../src/security/headers.js';

describe('Admin Web Shell & Route Security (P4-T1)', () => {
  describe('Role-Based Route Guards', () => {
    it('redirects unauthenticated caller to /login', () => {
      const state: AdminAuthState = {
        isAuthenticated: false,
        userRole: null,
        mfaVerified: false,
        userEmail: null,
      };
      const res = canAccessAdminRoute(['COR', 'SAD'], state);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('UNAUTHENTICATED');
      expect(res.redirectTo).toBe('/login');
    });

    it('redirects authenticated caller without MFA verification to /mfa-verify', () => {
      const state: AdminAuthState = {
        isAuthenticated: true,
        userRole: 'COR',
        mfaVerified: false,
        userEmail: 'coordinator@college.edu',
      };
      const res = canAccessAdminRoute(['COR'], state);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('MFA_REQUIRED');
      expect(res.redirectTo).toBe('/mfa-verify');
    });

    it('redirects to login with idle_timeout reason when session has expired', () => {
      const state: AdminAuthState = {
        isAuthenticated: true,
        userRole: 'SAD',
        mfaVerified: true,
        userEmail: 'admin@college.edu',
        isIdleTimedOut: true,
      };
      const res = canAccessAdminRoute(['SAD'], state);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('IDLE_TIMEOUT');
      expect(res.redirectTo).toBe('/login?reason=idle_timeout');
    });

    it('enforces technician role isolation from student data', () => {
      const tecState: AdminAuthState = {
        isAuthenticated: true,
        userRole: 'TEC',
        mfaVerified: true,
        userEmail: 'tech@college.edu',
      };

      // Technician CAN access devices, device-health, firmware, tickets
      expect(canAccessRouteById('devices', tecState).allowed).toBe(true);
      expect(canAccessRouteById('device-health', tecState).allowed).toBe(true);
      expect(canAccessRouteById('firmware', tecState).allowed).toBe(true);
      expect(canAccessRouteById('tickets', tecState).allowed).toBe(true);

      // Technician CANNOT access student routes, rosters, users, or settings
      expect(canAccessRouteById('student-routes', tecState).allowed).toBe(false);
      expect(canAccessRouteById('rosters', tecState).allowed).toBe(false);
      expect(canAccessRouteById('users', tecState).allowed).toBe(false);
      expect(canAccessRouteById('settings', tecState).allowed).toBe(false);

      expect(isStudentDataAccessDenied('TEC', 'student-routes')).toBe(true);
      expect(isStudentDataAccessDenied('TEC', 'faculty-assignments')).toBe(true);
      expect(isStudentDataAccessDenied('TEC', 'users')).toBe(true);
    });

    it('enforces coordinator access to fleet operations but denies firmware/system settings', () => {
      const corState: AdminAuthState = {
        isAuthenticated: true,
        userRole: 'COR',
        mfaVerified: true,
        userEmail: 'coordinator@college.edu',
      };

      // Coordinator has fleet operations
      expect(canAccessRouteById('fleet-map', corState).allowed).toBe(true);
      expect(canAccessRouteById('buses', corState).allowed).toBe(true);
      expect(canAccessRouteById('routes', corState).allowed).toBe(true);
      expect(canAccessRouteById('rosters', corState).allowed).toBe(true);
      expect(canAccessRouteById('student-routes', corState).allowed).toBe(true);

      // Coordinator does NOT have device provisioning, firmware rollout, or system settings
      expect(canAccessRouteById('devices', corState).allowed).toBe(false);
      expect(canAccessRouteById('firmware', corState).allowed).toBe(false);
      expect(canAccessRouteById('settings', corState).allowed).toBe(false);
    });

    it('permits super admin to access all route categories', () => {
      const sadState: AdminAuthState = {
        isAuthenticated: true,
        userRole: 'SAD',
        mfaVerified: true,
        userEmail: 'superadmin@college.edu',
      };

      expect(canAccessRouteById('settings', sadState).allowed).toBe(true);
      expect(canAccessRouteById('devices', sadState).allowed).toBe(true);
      expect(canAccessRouteById('buses', sadState).allowed).toBe(true);
      expect(canAccessRouteById('audit-logs', sadState).allowed).toBe(true);
    });

    it('grants security staff read-only live fleet map access per Locked Decision L-3', () => {
      const secState: AdminAuthState = {
        isAuthenticated: true,
        userRole: 'SEC',
        mfaVerified: true,
        userEmail: 'security@college.edu',
      };

      expect(canAccessRouteById('fleet-map', secState).allowed).toBe(true);
      expect(canAccessRouteById('settings', secState).allowed).toBe(false);
      expect(canAccessRouteById('devices', secState).allowed).toBe(false);
    });
  });

  describe('Session Idle Timeout Tracker', () => {
    it('fires warning callback and expiration callback accurately', () => {
      const onWarning = vi.fn();
      const onExpired = vi.fn();
      const onActivityResumed = vi.fn();

      const tracker = new SessionIdleTracker({
        timeoutSeconds: 900, // 15m
        warningSeconds: 120, // 2m
        onWarning,
        onExpired,
        onActivityResumed,
      });

      const startTime = tracker.getLastActivityAt();

      // At 700s elapsed (under 780s warning threshold) -> normal
      const normalStatus = tracker.checkStatus(startTime + 700_000);
      expect(normalStatus.inWarning).toBe(false);
      expect(normalStatus.isExpired).toBe(false);
      expect(onWarning).not.toHaveBeenCalled();

      // At 800s elapsed -> in warning window (100s remaining)
      const warningStatus = tracker.checkStatus(startTime + 800_000);
      expect(warningStatus.inWarning).toBe(true);
      expect(warningStatus.isExpired).toBe(false);
      expect(warningStatus.remainingSeconds).toBe(100);
      expect(onWarning).toHaveBeenCalledWith(100);

      // User moves mouse / interacts -> activity recorded
      tracker.recordActivity();
      expect(onActivityResumed).toHaveBeenCalled();

      // At timeout elapsed (900s) -> expired
      const expiredStatus = tracker.checkStatus(startTime + 950_000);
      expect(expiredStatus.isExpired).toBe(true);
      expect(onExpired).toHaveBeenCalled();

      tracker.stop();
    });
  });

  describe('MFA Enrolment Workflow', () => {
    it('manages full enrolment with recovery codes and TOTP verification', () => {
      const manager = new MfaEnrolmentManager();
      expect(manager.getState().step).toBe('INITIAL');

      // 1. Load enrolment payload from server
      manager.loadEnrolmentPayload({
        secret: 'JBSWY3DPEHPK3PXP',
        qr_code_uri: 'otpauth://totp/CollegeBus:admin@college.edu?secret=JBSWY3DPEHPK3PXP',
        recovery_codes: [
          'code-01',
          'code-02',
          'code-03',
          'code-04',
          'code-05',
          'code-06',
          'code-07',
          'code-08',
          'code-09',
          'code-10',
        ],
      });

      expect(manager.getState().step).toBe('DISPLAY_QR');
      expect(manager.getState().recoveryCodes).toHaveLength(10);

      // 2. Advance to recovery codes
      manager.proceedToRecoveryCodes();
      expect(manager.getState().step).toBe('SAVE_RECOVERY_CODES');

      // Attempting to complete before confirmation fails
      const premature = manager.completeEnrolment('123456');
      expect(premature.success).toBe(false);

      // 3. Confirm recovery codes saved
      manager.confirmRecoveryCodesSaved();
      expect(manager.getState().step).toBe('VERIFY_TOTP');
      expect(manager.getState().recoveryCodesConfirmed).toBe(true);

      // 4. Validate TOTP
      const badCode = manager.completeEnrolment('123');
      expect(badCode.success).toBe(false);
      expect(badCode.error).toBe('TOTP code must be exactly 6 digits');

      const success = manager.completeEnrolment('654321');
      expect(success.success).toBe(true);
      expect(manager.getState().step).toBe('COMPLETED');
    });
  });

  describe('Authorized Navigation Item Generator', () => {
    it('returns filtered items for each role', () => {
      const tecItems = getAuthorizedNavItems('TEC');
      const tecIds = tecItems.map((i) => i.id);

      expect(tecIds).toContain('devices');
      expect(tecIds).toContain('device-health');
      expect(tecIds).toContain('firmware');
      expect(tecIds).toContain('tickets');
      expect(tecIds).not.toContain('student-routes');
      expect(tecIds).not.toContain('users');
      expect(tecIds).not.toContain('settings');

      const corItems = getAuthorizedNavItems('COR');
      const corIds = corItems.map((i) => i.id);

      expect(corIds).toContain('buses');
      expect(corIds).toContain('routes');
      expect(corIds).toContain('rosters');
      expect(corIds).toContain('student-routes');
      expect(corIds).not.toContain('devices');
      expect(corIds).not.toContain('firmware');
    });
  });

  describe('Security Headers Audit', () => {
    it('passes compliant headers and fails missing headers', () => {
      const compliantHeaders = {
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self'; frame-ancestors 'none';",
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      };

      const result = auditSecurityHeaders(compliantHeaders);
      expect(result.passed).toBe(true);
      expect(result.missingHeaders).toHaveLength(0);
      expect(result.invalidDirectives).toHaveLength(0);

      const insecureHeaders = {
        'X-Frame-Options': 'SAMEORIGIN', // Not DENY
      };

      const failedResult = auditSecurityHeaders(insecureHeaders);
      expect(failedResult.passed).toBe(false);
      expect(failedResult.missingHeaders).toContain('Content-Security-Policy');
      expect(failedResult.missingHeaders).toContain('X-Content-Type-Options');
      expect(failedResult.invalidDirectives).toContain('X-Frame-Options must be DENY');
    });
  });
});
