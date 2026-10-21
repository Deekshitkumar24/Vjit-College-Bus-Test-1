# RS-01: Dependency Versions & Compatibility Matrix

**Document ID:** RS-01  
**Source:** [Node.js LTS Releases, Expo SDK Releases, and npm Registry](https://nodejs.org/en/about/previous-releases)
**Date Checked:** 20 October 2026 (Re-confirmed 21 October 2026)

---

## 1. Core Runtime & Monorepo

- **Node.js:** `v22.x LTS` (Active LTS).
- **pnpm:** `v9.x` (`pnpm workspaces` enabled).
- **Turborepo:** `v2.x` (build orchestration and cache management).
- **TypeScript:** `v5.5.x` (enforced strict mode across all workspaces, no `any`).

---

## 2. Backend Services (`services/api` & `services/worker`)

- **NestJS:** `v10.4.x`
  - `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`: `v10.4.x`
  - `@nestjs/swagger`: `v7.4.x` (OpenAPI 3.1 generation; disabled in production via config guard)
  - `helmet`: `v7.1.x` (security header enforcement)
  - `cookie-parser`: `v1.4.x`
- **Database & ORM:**
  - `PostgreSQL`: `16.x` with PostGIS `3.4.x` extension
  - `Prisma`: `v5.19.x` (schema definitions, migrations via `app_migrator`, and typed queries via `app_runtime`)
- **Background Jobs:**
  - `pg-boss`: `v10.1.x` (PostgreSQL-backed job queue with `SKIP LOCKED` concurrency, backoff, and dead-letter queue)
- **Authentication & Cryptography:**
  - `openid-client`: `v5.6.x` (OIDC with PKCE, state, nonce, hosted-domain filtering)
  - `jose`: `v5.8.x` (JWT asymmetric RS256/EdDSA signing, validation, key rotation)
  - `otplib`: `v12.0.x` (TOTP generation and verification for admin roles)
  - `argon2`: `v0.40.x` (hashing admin recovery codes)
- **AWS SDK v3:**
  - `@aws-sdk/client-s3`: `v3.650.x`
  - `@aws-sdk/s3-request-presigner`: `v3.650.x`
  - `@aws-sdk/client-sesv2`: `v3.650.x`
  - `@aws-sdk/client-secrets-manager`: `v3.650.x`
- **Push & Communications:**
  - `firebase-admin`: `v12.5.x` (FCM HTTP v1 API)
- **Validation & Parsing:**
  - `zod`: `v3.23.x` (shared contracts in `packages/contracts`)
  - `csv-parse`: `v5.5.x` (streaming CSV parser with 5MB / 10,000-row guards)
  - `luxon`: `v3.5.x` (date/time parsing and UTC / Asia/Kolkata conversions)
- **Observability:**
  - `pino`: `v9.4.x` and `pino-http`: `v9.0.x` (structured JSON logging with sensitive field redaction)
  - `@sentry/node`: `v8.28.x` (error tracking and scrubbing)
  - `@opentelemetry/sdk-node`: `v0.53.x` (distributed tracing)

---

## 3. Web Console (`apps/admin-web`)

- **Framework:** `React 18.3.x` with `Vite 5.4.x`
- **Routing:** `React Router v6.26.x`
- **Component System:** Tailwind CSS `v3.4.x` with `shadcn/ui` (Radix UI primitives)
- **State & Data Fetching:** `@tanstack/react-query v5.56.x`
- **Forms:** `react-hook-form v7.53.x` with `@hookform/resolvers/zod`
- **Maps:** `maplibre-gl v4.7.x`

---

## 4. Mobile Application (`apps/mobile`)

- **Framework:** `Expo SDK 51` (`React Native 0.74.x`) with `Expo Router v3.5.x`
- **Location & Sensors:**
  - `expo-location`: `~17.0.1` (foreground and background location tracking)
  - `expo-task-manager`: `~11.7.3` (background geolocation tasks)
- **Persistence & Security:**
  - `expo-secure-store`: `~13.0.2` (biometric/hardware-backed keychain storage for auth tokens)
  - `expo-sqlite`: `~14.0.6` (structured local offline sample buffering up to 24 hours)
- **Camera & Scanning:**
  - `expo-camera`: `~15.0.13` (QR code scanner for student boarding)
- **Notifications:**
  - `expo-notifications`: `~0.28.16` (FCM/APNs integration with Android high-importance sound channels)
- **Maps:**
  - `@maplibre/maplibre-react-native`: `v10.1.x`

---

## 5. Compatibility Verification

1. **Node 22 LTS with NestJS 10 & Prisma 5:** Fully certified and tested with native ESM and TypeScript 5.5.
2. **PostgreSQL 16 with PostGIS 3.4 & pg-boss 10:** Confirmed support for native `uuid_generate_v4()`, PostGIS spatial indexing (`GIST`), and `FOR UPDATE SKIP LOCKED`.
3. **Expo SDK 51 & MapLibre React Native:** MapLibre v10.1 is verified compatible with React Native 0.74 New Architecture in interoperability mode and standard architecture with Expo prebuild / custom dev client.
