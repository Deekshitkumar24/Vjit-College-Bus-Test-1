export interface SecurityHeaderAuditResult {
  passed: boolean;
  missingHeaders: string[];
  invalidDirectives: string[];
}

export function auditSecurityHeaders(headers: Record<string, string>): SecurityHeaderAuditResult {
  const missingHeaders: string[] = [];
  const invalidDirectives: string[] = [];

  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    normalized[k.toLowerCase()] = v;
  }

  // 1. CSP
  const csp = normalized['content-security-policy'];
  if (!csp) {
    missingHeaders.push('Content-Security-Policy');
  } else {
    if (!csp.includes("frame-ancestors 'none'")) {
      invalidDirectives.push("CSP missing frame-ancestors 'none'");
    }
    if (!csp.includes("default-src 'self'")) {
      invalidDirectives.push("CSP missing default-src 'self'");
    }
  }

  // 2. X-Frame-Options
  const xfo = normalized['x-frame-options'];
  if (!xfo) {
    missingHeaders.push('X-Frame-Options');
  } else if (xfo.toUpperCase() !== 'DENY') {
    invalidDirectives.push('X-Frame-Options must be DENY');
  }

  // 3. X-Content-Type-Options
  const xcto = normalized['x-content-type-options'];
  if (!xcto) {
    missingHeaders.push('X-Content-Type-Options');
  } else if (xcto.toLowerCase() !== 'nosniff') {
    invalidDirectives.push('X-Content-Type-Options must be nosniff');
  }

  // 4. Referrer-Policy
  const refPol = normalized['referrer-policy'];
  if (!refPol) {
    missingHeaders.push('Referrer-Policy');
  } else if (refPol.toLowerCase() !== 'strict-origin-when-cross-origin') {
    invalidDirectives.push('Referrer-Policy must be strict-origin-when-cross-origin');
  }

  return {
    passed: missingHeaders.length === 0 && invalidDirectives.length === 0,
    missingHeaders,
    invalidDirectives,
  };
}
