# RB-06: Session Breach Invalidation & Family Revocation

## 1. Purpose
Protocol for revoking compromised user sessions upon refresh token reuse detection (T-AUTH-03, Part 6.8).

## 2. Detection
- System detects an attempt to use an already-consumed refresh token hash.
- This indicates potential token theft and breach.

## 3. Automated & Manual Action
1. **Automated:** API immediately revokes the entire session family (`family_id`). All active JWT sessions for that device are rejected with HTTP 401.
2. **Manual Action:** If coordinated credential stuffing is suspected:
   - Super Admin executes `POST /api/v1/auth/sessions/purge-user` with `user_id`.
   - Force password reset via College SSO provider (Google Workspace or Entra ID).
