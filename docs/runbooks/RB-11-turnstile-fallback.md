# RB-11: Turnstile Captcha Failure Fallback

## 1. Purpose
Remediating driver OTP sign-in and public submission failures when Cloudflare Turnstile bot protection experiences outages (Decision C-02, P3-T1).

## 2. Thresholds
- If Turnstile API error rate exceeds 5% over 5 minutes, trigger automated alert.

## 3. Fallback Procedure
1. Super Admin navigates to Settings -> Feature Flags -> `ENABLE_TURNSTILE_ENFORCEMENT`.
2. Toggle to `false` with change reason: "Temporary bypass due to upstream Cloudflare Turnstile outage".
3. API falls back to sliding-window IP rate limiting (10 requests/minute per IP on `/auth/otp/request`) to maintain abuse defense.
4. Re-enable Turnstile verification as soon as Cloudflare status returns to operational.
