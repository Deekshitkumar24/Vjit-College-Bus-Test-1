# RS-09: OpenID Connect Single Sign-On (Google Workspace & Entra ID)

**Document ID:** RS-09  
**Sources:**

- OpenID Connect Core 1.0 Specification: `https://openid.net/specs/openid-connect-core-1_0.html` (Final Specification)
- Google Identity - OpenID Connect: `https://developers.google.com/identity/openid-connect/openid-connect` (Pinned Version: Google Identity Services 2024)
- Microsoft Identity Platform - OpenID Connect on the Microsoft identity platform: `https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc` (Protocol Version: v2.0)
- node-openid-client: `https://github.com/panva/node-openid-client` (Pinned Version: `v5.6.5`)  
  **Date Checked:** 20 October 2026 (Re-confirmed 21 October 2026)  
  **Quoted Verification (OpenID Connect Core 1.0):**

> "The Authorization Code Flow returns an Authorization Code to the Client, which can then exchange it directly for an ID Token and an Access Token."  
> **Quoted Verification (Google Identity):**  
> "The hd parameter optimizes the sign-in flow for Google Workspace users. The ID token contains the hd claim indicating the hosted domain of the user."  
> **Quoted Verification (Microsoft Identity Platform):**  
> "Microsoft Entra ID supports the OpenID Connect standard. Use the tenant-specific endpoint to restrict sign-in to users from your specific organization."

---

## 1. Protocol Architecture & OpenID Connect Client

College students, faculty, and administrative staff authenticate via institutional OpenID Connect (`SW-MVP-1.0` §8, `AG-MASTER-1.0` §13.20):

- **Library:** `openid-client` (`v5.6.5`)
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
- **Email & Domain Verification:** Claim `preferred_username` or `email` must match an approved domain from `COLLEGE_EMAIL_DOMAINS`, and `tid` must equal `OIDC_MICROSOFT_TENANT_ID`.

---

## 3. Account Provisioning & Session Issuance

Upon validated OIDC callback (`GET /api/v1/auth/sso/callback`):

1. The server checks the `users` table for an existing record matching `email` with status `ACTIVE`.
2. If no record exists, returns error message: _"Your account is not registered. Please contact the transport office."_ (`SW-MVP-1.0` §8 F-AUTH-01).
3. If active, issues a new session family (`sessions` table) and returns:
   - Access Token: Asymmetric JWT (RS256/EdDSA via `jose v5.8.0`, valid 15 minutes).
   - Refresh Token: Opaque 32-byte cryptographic token (valid 30 days for students/staff, rotated on every refresh with reuse detection).
