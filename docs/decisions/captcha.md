# RS-08: Cloudflare Turnstile Server-Side Verification

**Document ID:** RS-08  
**Source:** Cloudflare Turnstile Documentation  
**Date Checked:** 20 October 2026  

---

## 1. Purpose & Application
Under `AG-MASTER-1.0` §13.11 and Conflict C-02, Cloudflare Turnstile is implemented on public authentication routes:
- Enforced on driver OTP sign-in requests after the first request in an hour from an IP or account (`AG-MASTER-1.0` §13.4, §13.11).
- Protects public forms without sign-in (e.g., student help inquiry if exposed).

---

## 2. Server-Side Verification Protocol

- **Endpoint:** `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`
- **Request Body (`application/x-www-form-urlencoded` or `application/json`):**
  - `secret`: `TURNSTILE_SECRET_KEY` (stored in AWS Secrets Manager).
  - `response`: Client-submitted token string from the front-end widget.
  - `remoteip`: Source IP of the incoming client request.
  - `idempotency_key`: Optional UUID v4 preventing double-spending during network retries.

- **Response Body Verification:**
  ```json
  {
    "success": true,
    "challenge_ts": "2026-10-20T12:00:00.000Z",
    "hostname": "bus.college.edu",
    "action": "driver_otp_request",
    "cdata": "session_meta"
  }
  ```

- **Server Validation Pipeline:**
  1. `success` must be strictly `true`.
  2. `hostname` must match the expected public web host domain (`API_PUBLIC_HOST` or college domain).
  3. `action` must match the intended API action (e.g., `driver_otp_request`).
  4. Timestamp `challenge_ts` must be within 5 minutes.
  5. Any verification failure returns HTTP 403 `CAPTCHA_REQUIRED` (`AG-MASTER-1.0` §8.2, §13.11).
