# RB-06: Certificate Renewal Failure

## 1. Trigger

ACM or CloudFront SSL/TLS certificate expires in <= 14 days without automatic renewal confirmation.

## 2. First Five Minutes

1. Inspect AWS Certificate Manager (ACM) console in us-east-1 and ap-south-1.
2. Check Route 53 DNS validation CNAME records for domain verification.
3. Verify domain WHOIS / registrar administrative contact.
4. Escalate to DevOps Lead for manual DNS validation.

## 3. Diagnosis

- Check if DNS authorization CNAME records were inadvertently modified or deleted.
- Verify CAA (Certificate Authority Authorization) records allow Amazon Trust Services.

## 4. Mitigation

- Re-create missing DNS CNAME verification records in Route 53.
- Request immediate certificate re-issuance through ACM.
- Associate renewed certificate with CloudFront distribution and ALB listener.

## 5. Communication Template

> INFRASTRUCTURE ADVISORY: SSL certificate renewal in progress. No user-facing interruption expected.

## 6. Post-Incident Review

A blameless post-incident review must be conducted within five working days. The review must document root causes, action items, and prevention mechanisms.
