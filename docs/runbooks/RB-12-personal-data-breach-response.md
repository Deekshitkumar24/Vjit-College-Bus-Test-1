# RB-12: Personal Data Breach Response

## 1. Trigger
Unauthorized exfiltration, credential leak, or inadvertent disclosure of personally identifiable information (PII).

## 2. First Five Minutes
1. Immediately revoke compromised session tokens, API keys, and IAM credentials.
2. Isolate affected network endpoints and enable strict CloudFront WAF block.
3. Preserve all access logs, audit logs, and database transaction logs for forensic review.
4. Notify Data Protection Officer (DPO), College Counsel, and Incident Response Team.

## 3. Diagnosis
- Analyze `audit_logs` table (append-only protected) for unauthorized SELECT/EXPORT activity.
- Identify exact student/faculty records accessed or exported.
- Determine breach vector (IDOR, credential compromise, misconfigured S3 bucket).

## 4. Mitigation
- Patch exploited vulnerability and rotate all production database credentials.
- Invalidate all active user sessions across mobile and web consoles.
- Prepare formal regulatory breach notification in compliance with DPDP / GDPR requirements within 72 hours.

## 5. Communication Template
> SECURITY ADVISORY: Security incident contained. No evidence of ongoing exposure. Affected users will receive direct advisory.

## 6. Post-Incident Review
A blameless post-incident review must be conducted within five working days. The review must document root causes, action items, and prevention mechanisms.
