# RB-07: Data Subject Request (DSR) Erasure & Export

## 1. Purpose
Fulfilling DPDP Act and GDPR Article 17 requests for data export, correction, or permanent erasure (T-PRV-02, Part 14.1).

## 2. Erasure Procedure
1. Verify identity of requesting data principal or guardian.
2. In Admin Console -> Privacy & DSR -> Select Request -> Approve Deletion.
3. Automated pipeline invokes `PrivacyService.executeDataDeletion(userId)`:
   - Erases attendance records and student route mappings.
   - Deletes active sessions.
   - Anonymizes SOS event history by replacing user ID with zero UUID (`00000000-0000-0000-0000-000000000000`).
   - Overwrites user full name and phone number with anonymized tokens.
4. Export job summary and audit log are stored in `audit_logs`.
