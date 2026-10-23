# RB-13: Use of the Emergency Access Account

## 1. Trigger

Break-glass root/superuser access required due to total lockout, infrastructure failure, or security disaster.

## 2. First Five Minutes

1. Two-person authorization: obtain dual sign-off from Engineering Lead and Campus Security Officer.
2. Retrieve emergency credential from encrypted hardware vault.
3. Initiate screen recording and session logging on dedicated bastion host.
4. Notify executive stakeholders before accessing production.

## 3. Diagnosis

- Establish specific technical blocker preventing normal role-based access.
- Document every command executed in the emergency session log.

## 4. Mitigation

- Perform only minimal actions necessary to restore standard administrative access.
- Revoke emergency session immediately upon resolution.
- Rotate break-glass credentials and generate new recovery codes.

## 5. Communication Template

> AUDIT ADVISORY: Emergency break-glass access activated under dual authorization. Incident logging enabled.

## 6. Post-Incident Review

A blameless post-incident review must be conducted within five working days. The review must document root causes, action items, and prevention mechanisms.
