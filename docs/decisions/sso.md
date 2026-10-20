# RS-09: OpenID Connect Single Sign-On (Google Workspace & Entra ID)

**Document ID:** RS-09  
**Source:** OpenID Connect Core 1.0 Specification, openid-client (v5) Documentation  
**Date Checked:** 20 October 2026

---

## 1. Protocol Architecture

College students, faculty, and administrative staff authenticate via institutional OpenID Connect (`SW-MVP-1.0` §8, `AG-MASTER-1.0` §13.20):

- **Library:** `openid-client` (v5.6.x)
- **Flow:** Authorization Code Flow with **PKCE (Proof Key for Code Exchange)** using `S256` code challenge.
- **CSRF & Replay Protection:** Cryptographically random `state` and `nonce` parameters stored in signed httpOnly cookies during the flow and validated in the callback.

---

## 2. Institutional Domain & Tenant Restrictions

### 2.1 Google Workspace Configuration

- **Discovery Endpoint:** `https://accounts.google.com/.well-known/openid-configuration`
- **Hosted Domain (`hd`) Enforcement:**
  - Authorization request includes `hd: <college_domain>` (e.g. `college.edu`).
  - **Server-Side Token Verification:** After exchanging the authorization code, the ID token's `hd` claim is strictly compared against the allowlist in `COLLEGE_EMAIL_DOMAINS`. If the claim is missing or does not match, the session is rejected with HTTP 403 `FORBIDDEN`.

### 2.2 Microsoft Entra ID Configuration

- **Discovery Endpoint:** `https://login.microsoftonline.com/{tenant_id}/v2.0/.well-known/openid-configuration`
- **Tenant ID Restriction:** The authority URL is pinned strictly to the college's dedicated Entra tenant ID (preventing personal `@outlook.com` or external Azure Active Directory accounts from logging in).
- **Email Verification:** Claim `preferred_username` or `email` must match an approved domain from `COLLEGE_EMAIL_DOMAINS`.

---

## 3. Account Provisioning & Session Issuance

- Upon validated OIDC callback (`GET /api/v1/auth/sso/callback`):
  1. The server checks the `users` table for an existing record matching `email` with status `ACTIVE`.
  2. If no record exists, returns error message: _"Your account is not registered. Please contact the transport office."_ (`SW-MVP-1.0` §8 F-AUTH-01).
  3. If active, issues a new session family (`sessions` table) and returns:
     - Access Token: Asymmetric JWT (RS256/EdDSA, valid 15 minutes).
     - Refresh Token: Opaque 32-byte cryptographic token (valid 30 days for students/staff, rotated on every refresh with reuse detection).
