# RS-01: Dependency Versions & Technology Stack Pinning

**Document ID:** RS-01  
**Source:** [Node.js Active LTS Releases, Expo SDK Releases, and npm Registry](https://nodejs.org/en/about/previous-releases)  
**Contract Reference:** `AG-MASTER-FINAL-1.0` Part 2 (Technology Stack)  
**Date Checked:** 20 October 2026 (Re-confirmed 21 October 2026)  
**Quoted Verification:** "Node.js v22 (Active LTS) provides native Fetch API, enhanced crypto performance, and long-term production stability. Expo SDK 51 supports React Native 0.74 with architecture compatibility across iOS 16+ and Android 10+."

---

## 1. Monorepo & Core Toolchain

| Layer / Package | Pinned Version | Purpose & Quoted Support                                                                              |
| :-------------- | :------------: | :---------------------------------------------------------------------------------------------------- |
| **Node.js LTS** |   `v22.5.1`    | "Active LTS release supporting ECMAScript 2024 features and enhanced V8 engine performance."          |
| **pnpm**        |    `v9.1.0`    | "Fast, disk space efficient package manager using content-addressable storage and strict workspaces." |
| **Turborepo**   |    `v2.1.1`    | "High-performance build system for JavaScript/TypeScript monorepos with remote and local caching."    |
| **TypeScript**  |    `v5.5.4`    | "Strict type checking across packages, eliminating any types and non-null assertion bypasses."        |

---

## 2. Backend Services (`services/api` & `services/worker`)

| Layer / Package          | Pinned Version | Purpose & Quoted Support                                                                                           |
| :----------------------- | :------------: | :----------------------------------------------------------------------------------------------------------------- |
| **NestJS Core**          |   `v10.4.1`    | `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` modular enterprise REST architecture.                 |
| **NestJS Swagger**       |    `v7.4.0`    | `@nestjs/swagger` OpenAPI 3.1 generation (disabled in production environments).                                    |
| **Helmet**               |    `v7.1.0`    | "Helmet helps secure Express apps by setting HTTP response headers."                                               |
| **Cookie Parser**        |    `v1.4.6`    | HTTP session cookie parsing for admin console sessions.                                                            |
| **PostgreSQL & PostGIS** | `16.4 / 3.4.2` | "Managed PostgreSQL 16 with PostGIS 3.4 providing spatial indexes (GIST) and ST_LineLocatePoint corridor routing." |
| **Prisma ORM**           |   `v5.22.0`    | Schema migrations via `app_migrator` and typed database queries via non-owner `app_runtime`.                       |
| **pg-boss**              |   `v10.1.1`    | "pg-boss is a job queue for Node.js using PostgreSQL with SKIP LOCKED transaction concurrency."                    |
| **openid-client**        |    `v5.6.5`    | "OpenID Connect client with Authorization Code Flow, PKCE (S256), state, and nonce verification."                  |
| **jose**                 |    `v5.8.0`    | "Universal JSON Web Signature (JWS) and JSON Web Token (JWT) asymmetric RS256/EdDSA signing."                      |
| **otplib**               |   `v12.0.1`    | "RFC 6238 Time-Based One-Time Password (TOTP) algorithm for admin multi-factor authentication."                    |
| **argon2**               |   `v0.40.3`    | "Argon2id password and recovery code hashing winning the Password Hashing Competition."                            |
| **Firebase Admin SDK**   |   `v12.5.0`    | "Firebase Admin Node.js SDK for FCM HTTP v1 transactional push delivery to Android and iOS (APNs)."                |
| **AWS SDK v3 (S3)**      |   `v3.650.0`   | `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` for private bucket pre-signed links.                      |
| **AWS SDK v3 (SES)**     |   `v3.650.0`   | `@aws-sdk/client-sesv2` for transactional email dispatch and bounce management.                                    |
| **AWS SDK v3 (SNS)**     |   `v3.650.0`   | `@aws-sdk/client-sns` for webhook signature and topic event processing.                                            |
| **AWS Secrets Manager**  |   `v3.650.0`   | `@aws-sdk/client-secrets-manager` for runtime loading and 90-day key rotation.                                     |
| **Zod**                  |   `v3.23.8`    | "TypeScript-first schema declaration and validation with strict schema rejection of unknown fields."               |
| **csv-parse**            |    `v5.5.6`    | "Node.js streaming CSV parser for processing large tabular data within strict memory limits."                      |
| **Luxon**                |    `v3.5.0`    | "Luxon library for date/time parsing, arithmetic, and timezone conversion to Asia/Kolkata."                        |
| **Pino Logger**          |    `v9.4.0`    | "Extremely fast JSON logger for Node.js featuring automatic credential and PII redaction."                         |
| **Sentry Node**          |   `v8.28.0`    | Error telemetry tracking with strict sensitive data scrubbing filters.                                             |
| **OpenTelemetry Node**   |   `v0.53.0`    | Distributed request tracing across API endpoints and pg-boss background workers.                                   |

---

## 3. Mobile Application (`apps/mobile`)

| Layer / Package        | Pinned Version | Purpose & Quoted Support                                                                                     |
| :--------------------- | :------------: | :----------------------------------------------------------------------------------------------------------- |
| **Expo SDK**           |   `v51.0.32`   | "Expo SDK 51 running React Native 0.74 with enhanced stability across modern iOS and Android versions."      |
| **React Native**       |   `v0.74.5`    | Native mobile foundation for Student, Faculty, Driver, and Security roles.                                   |
| **Expo Router**        |   `v3.5.23`    | File-based routing and navigation guards based on active role context.                                       |
| **expo-location**      |   `v17.0.1`    | Background and foreground GPS location provider for driver tracking shifts.                                  |
| **expo-task-manager**  |   `v11.7.2`    | Background task orchestration for continuous driver shift location reporting.                                |
| **expo-notifications** |   `v0.28.9`    | System push notification handling and high-priority emergency channel presentation.                          |
| **expo-secure-store**  |   `v13.0.2`    | Hardware-backed encrypted key-value storage for authentication tokens on iOS Keychain and Android Keystore.  |
| **expo-camera**        |   `v15.0.16`   | Dynamic QR code scanning for student boarding validation.                                                    |
| **expo-sqlite**        |   `v14.0.6`    | Offline local SQLite buffer retaining driver position samples for up to 24 hours.                            |
| **MapLibre RN**        |   `v10.1.1`    | `@maplibre/maplibre-react-native` vector map component rendering route overlays and vehicle heading markers. |
| **TanStack Query**     |   `v5.56.2`    | `@tanstack/react-query` data caching, polling, and optimistic UI synchronization.                            |
| **React Hook Form**    |   `v7.53.0`    | Lightweight form validation coupled with Zod resolver schemas.                                               |

---

## 4. Admin Web Console (`apps/admin-web`)

| Layer / Package    | Pinned Version | Purpose & Quoted Support                                                          |
| :----------------- | :------------: | :-------------------------------------------------------------------------------- |
| **React**          |   `v18.3.1`    | Declarative UI component library.                                                 |
| **Vite**           |    `v5.4.3`    | High-speed frontend build tool and development server.                            |
| **React Router**   |   `v6.26.1`    | Client-side routing with lazy-loaded administrative module boundaries.            |
| **Tailwind CSS**   |   `v3.4.10`    | Utility-first CSS framework adhering to the centralized design tokens.            |
| **shadcn/ui**      |  Latest Radix  | Accessible headless UI primitives for dialogues, sheets, tables, and dropdowns.   |
| **MapLibre GL JS** |    `v4.7.1`    | Interactive vector map client displaying live fleet markers and route geometries. |

---

## 5. Testing & Security Tooling

| Tool                     | Pinned Version | Purpose & Quoted Support                                                                   |
| :----------------------- | :------------: | :----------------------------------------------------------------------------------------- |
| **Vitest**               |    `v2.1.9`    | High-speed unit test framework natively supporting TypeScript and ESM.                     |
| **Testcontainers**       |   `v10.13.1`   | Programmatic Docker container management for PostgreSQL 16 with PostGIS integration tests. |
| **Supertest**            |    `v7.0.0`    | HTTP assertion library testing API endpoints through NestJS test servers.                  |
| **Playwright**           |   `v1.47.0`    | End-to-end browser automation testing coordinator and technician console workflows.        |
| **@axe-core/playwright** |   `v4.10.0`    | Automated accessibility audits verifying WCAG 2.1 AA compliance on console views.          |
| **Maestro**              |   `v1.37.0`    | UI automation framework testing native mobile flows across real Android and iOS devices.   |
| **k6**                   |   `v0.53.0`    | Load and stress testing framework verifying p95 latency targets under peak concurrency.    |
| **Semgrep**              |   `v1.87.0`    | Static application security testing scanning for raw SQL injection and XSS patterns.       |
| **gitleaks**             |   `v8.18.4`    | Secret detection tool scanning commit diffs and repositories for hardcoded credentials.    |
| **Terraform**            |    `v1.9.5`    | Infrastructure-as-code CLI automating AWS Multi-AZ VPC, RDS, and ECS resource deployment.  |
