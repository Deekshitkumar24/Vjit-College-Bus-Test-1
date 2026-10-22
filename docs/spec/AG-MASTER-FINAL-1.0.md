

<!-- PAGE 1 -->

Antigravity Master Build Prompt: College Bus
Tracker (Software MVP)
Prompt ID: AG-MASTER-1.0 | Companion: SW-MVP-1.0 (software specification, 103 pages)
| Date: 19 October 2026
How to use this prompt
1. Create the project folder. Save Part 1 as the project rules file (for example AGENTS.md
at the repository root). Antigravity reads it in every session.
2. Attach the SW-MVP-1.0 specification to the project as docs/spec/SW-MVP-1.0.pdf. It is
the detailed reference for every feature ID in Part 10. This prompt is the build contract:
it defines the pipeline, the device connection, visibility, GPS rules, security, data model,
API, testing, and the order of work.
3. Division of authority: the specification decides what a feature does. This prompt
decides how it is built, how the parts connect, how it is secured, and in what order. If
the two conflict, stop and log the conflict in docs/decisions/conflicts.md. Do not guess.
4. Send Part 4 (research) first. Wait for the research outputs.
5. Then send one phase at a time from Part 16. Do not send the next phase until the
current phase report passes review.
Part 1. Project rules (save as AGENTS.md)
1.1 Mission
Build the production software for a college bus tracker. It has four parts: a mobile app for
iOS and Android (students, faculty, drivers, security), a web console for transport staff
(coordinators, technicians, super admins, management), a backend API with a device and
driver-phone ingestion pipeline, and background workers on a PostgreSQL database with
PostGIS. The first release must be production-grade, not a prototype.
1.2 No mock, fake, or demo data (absolute rules)
R-M1: Production code, the production seed, and production images contain no mock,
fake, dummy, sample, demo, lorem, or placeholder records. This includes buses,
devices, routes, stops, people, phone numbers, email addresses, coordinates, tokens,
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 1 of 118


<!-- PAGE 2 -->

and notifications.
R-M2: Synthetic data exists only in tests/fixtures/ and tools/simulator/. Application
code must never import from these folders. A lint rule enforces this.
R-M3: Every synthetic row written to a shared environment (development or staging)
has is_synthetic set to true. Every business table has this column (Part 7).
R-M4: Tests create their own data inside a transaction or a disposable database, and
clean up afterwards. No test depends on data left by another test.
R-M5: The simulator refuses to run unless APP_ENV is local or staging, and only against
hostnames on its allowlist. It is excluded from the production build and the production
image.
R-M6: Before any release, the checks in Part 15.4 (verify:no-mock and verify:prod-
clean) must pass. A failing check blocks the release.
R-M7: The interface never shows sample buses, students, or times. Empty states say
what to do next (for example: No buses yet. Coordinators can add buses from the
Buses page).
R-M8: If you create temporary test data by hand during development, remove it with
the purge script before reporting the task as done. Record the purge in the phase
report.
R-M9: Never use real student, driver, or phone data in development. If a real record
seems necessary for debugging, stop and ask.
1.3 Security
Every item in Part 13 is mandatory. A feature is not done until its security checks pass.
1.4 Authority and conflicts
Log any conflict between this prompt and SW-MVP-1.0 in docs/decisions/conflicts.md,
and stop work on that task until it is resolved.
1.5 Scope
Build only the in-scope items in Part 18.3. Do not add features the specification does not
describe. Record ideas in docs/future.md.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 2 of 118


<!-- PAGE 3 -->

1.6 Configuration, not constants
Thresholds and timings come from configuration (Part 14.4). Store them in the settings
table, with code defaults that match Part 14.4 exactly. Never hardcode a threshold in a
feature file.
1.7 Coding standards
TypeScript in strict mode everywhere. No any. No non-null assertions unless a
comment explains why.
Validate every external input with Zod at the boundary: HTTP bodies, query strings,
headers, CSV rows, webhook payloads, environment variables, and device messages.
Reject unknown fields.
Business logic lives in services or in packages/domain (pure functions, no framework
imports). Controllers only parse input, authorise, call a service, and map the result.
No SQL built by string concatenation. Use the ORM or tagged template queries only.
Store all timestamps in UTC. Convert to Asia/Kolkata only in the presentation layer. Use
a date library for arithmetic (for example luxon).
Errors are typed domain errors. They are mapped to the error envelope in Part 8.2.
Never return stack traces.
Logs are structured (Part 14.2). No personal data in logs.
No TODO or FIXME on the main branch without a tracking ID.
Every service function has a unit test.
1.8 Definition of done (every task)
Merged through a pull request with one review.
Unit and integration tests pass, covering success and failure.
Authorisation tests exist for every new endpoint (the role matrix in Part 10.1).
Every new input is validated with Zod.
Migrations are expand-only (Part 16, P0-T5) and reversible in staging.
Every admin write writes an audit row.
The OpenAPI document is updated.
Logs and metrics are added.
verify:no-mock passes.
The phase report is updated.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 3 of 118


<!-- PAGE 4 -->

1.9 Work process per phase
1. Write docs/progress/PXX-plan.md before coding. List each task ID, the files it touches,
and its tests.
2. Build tasks in the order given. Commit after each task. The commit message starts
with the task ID.
3. Run all checks after each task. Fix failures before continuing.
4. Write docs/progress/PXX-report.md using the template in 1.10.
5. Stop at the end of the phase and wait for approval.
1.10 Phase report template
Phase ID. Tasks completed (IDs). Specification sections implemented. Tests added and
results. Security checks run and results. Migrations applied. Configuration keys added.
Known gaps, each linked to a decision ID. Mock-data check result. Purge result.
Commands to reproduce.
1.11 When to ask
Ask only when a decision in Part 18.2 has no default, or when a conflict is logged.
Otherwise use the default, and record it in docs/decisions/defaults-used.md.
Part 2. Technology stack
Use these choices. At project start, complete research task RS-01 to confirm current
stable versions and compatibility.
Layer
Choice
Notes
Monorepo
pnpm workspaces with Turborepo
One repository for all packages
Mobile app
Expo (React Native), TypeScript,
Expo Router, latest stable SDK
One app for student, faculty,
driver, and security roles
Mobile libraries
expo-location, expo-task-manager,
expo-notifications, expo-secure-
store, expo-camera (QR scanning),
@maplibre/maplibre-react-native,
TanStack Query, react-hook-form,
Zod
Confirm compatibility with the
chosen SDK (RS-01)
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 4 of 118


<!-- PAGE 5 -->

Layer
Choice
Notes
Admin web
React with Vite and TypeScript,
React Router, Tailwind CSS,
shadcn/ui, TanStack Query, react-
hook-form, Zod, MapLibre GL JS
Responsive down to tablet
width. Not designed for phones
API
Node.js LTS, NestJS, TypeScript,
Helmet, cookie-parser,
@nestjs/swagger (disabled in
production)
REST API and the device
ingestion routes
Database
PostgreSQL 16 or later with PostGIS,
managed, Multi-AZ
Prisma for migrations and typed
queries. Raw SQL through
tagged templates for PostGIS
and row-level security
Background jobs
pg-boss on PostgreSQL
No Redis in the MVP
Authentication
openid-client (college SSO over
OpenID Connect), jose (JWT), otplib
(TOTP), argon2 (recovery codes)
Email OTP for drivers, hashed
with HMAC
Push
notifications
Firebase Admin SDK, FCM HTTP v1
Android and iOS (through APNs
configured in Firebase)
SMS
Adapter for a DLT-registered
transactional SMS provider (chosen
in RS-06)
Only registered templates
Email
AWS SES v2 through AWS SDK v3.
Bounce and complaint notifications
through SNS
File storage
AWS S3 through AWS SDK v3.
Private buckets. Presigned links
Bot protection
Cloudflare Turnstile, verified on the
server
CSV parsing
csv-parse, streaming mode
Logging and
errors
pino (logs), Sentry (errors),
OpenTelemetry (traces and metrics)
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 5 of 118


<!-- PAGE 6 -->

Part 3. Repository, environments, and scripts
3.1 Repository layout
bus-tracker/
  apps/mobile/              Expo app (student, faculty, driver, security)
  apps/admin-web/           React console (coordinator, technician, super 
admin, management, security)
  services/api/            NestJS API: REST routes, device ingestion, auth
  services/worker/         Job runner (same codebase, separate entry point)
  packages/contracts/      Zod schemas shared by API, mobile, and web
  packages/domain/         Pure logic: source selector, ETA, QR tokens, 
validation rules, state machines
  packages/db/             Prisma schema, migrations, SQL helpers, row-level 
security policies
  packages/config/         Typed configuration loader and the defaults table
  tools/simulator/         Device and phone simulator (local and staging 
only)
  tests/fixtures/          Synthetic fixtures for tests only
Layer
Choice
Notes
Testing
Vitest, Testcontainers (PostgreSQL
with PostGIS), Supertest,
Playwright, @axe-core/playwright,
Maestro, k6
Security tooling
Semgrep, CodeQL, gitleaks, OWASP
ZAP baseline, pnpm audit, Renovate
Infrastructure
Terraform. AWS: ECS on Fargate,
Application Load Balancer, RDS
PostgreSQL Multi-AZ, S3, SES, SNS,
Secrets Manager, KMS, CloudWatch,
WAF, ACM, Route 53, CloudFront
(admin web)
Separate AWS accounts for dev,
staging, production
CI/CD
GitHub Actions. EAS Build and EAS
Submit for mobile
Time
Stored in UTC. Displayed in
Asia/Kolkata
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 6 of 118


<!-- PAGE 7 -->

  infra/terraform/         All AWS resources
  docs/spec/               SW-MVP-1.0 specification
  docs/decisions/          Research outputs, decisions, conflicts, defaults 
used
  docs/progress/           Phase plans and reports
  docs/runbooks/           RB-01 to RB-13
  docs/security/           Threat model and review records
  scripts/                 Verification and maintenance scripts
  .github/                 Workflows, pull request template, CODEOWNERS
  renovate.json
3.2 Environments
Each environment uses its own AWS account and its own database. Production never
receives simulator traffic.
3.3 Environment variables (names and purpose; values come from Secrets
Manager or Parameter Store)
APP_ENV
Purpose
Data
Simulator
local
Development on a developer
machine (Docker Compose:
PostgreSQL with PostGIS, MinIO,
Mailpit)
Synthetic only
Allowed
dev
Shared integration environment
Synthetic only, flagged
is_synthetic
Allowed
staging
Production-like. Connected to the
hardware test bench
Synthetic only, flagged
is_synthetic
Allowed
production
Live service
Real
Refused
Variable
Purpose
Secret
APP_ENV
local, dev, staging, or
production
No
NODE_ENV
production in deployed
environments
No
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 7 of 118


<!-- PAGE 8 -->

Variable
Purpose
Secret
DATABASE_URL
Runtime connection, role
app_runtime
Yes
DATABASE_URL_MIGRATIONS
Migration connection, role
app_migrator (owner)
Yes
DATABASE_URL_WORKER
Worker connection, role
app_worker
Yes
JWT_SIGNING_KEY
Asymmetric key for access
tokens
Yes
JWT_KEY_ID
Key identifier for rotation
No
DEVICE_TOKEN_HMAC_KEYS
Versioned keys for hashing
device tokens (format:
version:key)
Yes
QR_HMAC_KEYS
Versioned keys for boarding QR
tokens
Yes
OTP_HMAC_KEY
Key for hashing one-time codes
Yes
OIDC_ISSUER, OIDC_CLIENT_ID,
OIDC_CLIENT_SECRET
College SSO
Client
secret: yes
COLLEGE_EMAIL_DOMAINS
Comma-separated allowed
domains
No
SSO_ALLOWED_RETURN_URLS
Allowlist for post-login
redirects
No
FCM_SERVICE_ACCOUNT_JSON
Firebase service account
Yes
SMS_PROVIDER_KEY, SMS_SENDER_ID,
SMS_CALLBACK_SECRET
SMS adapter
Yes
SES_REGION, SES_FROM_ADDRESS,
SNS_EMAIL_TOPIC_ARNS
Email and bounce handling
No
S3_EXPORT_BUCKET,
S3_IMPORT_BUCKET
Private buckets
No
TURNSTILE_SECRET_KEY
CAPTCHA verification
Yes
CORS_ALLOWED_ORIGINS
Admin web origin only
No
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 8 of 118


<!-- PAGE 9 -->

At startup, validate all variables with a Zod schema. Refuse to start if a required variable is
missing, if NODE_ENV is production while APP_ENV is local, or if a secret matches a
known placeholder value.
3.4 Scripts (root package.json)
Variable
Purpose
Secret
API_PUBLIC_HOST,
INGEST_PUBLIC_HOST,
ADMIN_PUBLIC_HOST
Hostnames
No
SENTRY_DSN
Error tracking
No
LOG_LEVEL
info by default
No
SERVICE_TIMEZONE
Asia/Kolkata
No
SIMULATOR_ALLOWED_HOSTS
Allowlist for the simulator (local
and staging only)
No
Script
Purpose
dev
Start local services and the API, web, and worker in
watch mode
build
Build all packages
lint
ESLint, Prettier check, and the rules that ban
unsafe patterns (Part 13)
typecheck
TypeScript across all packages
test:unit
Vitest unit tests
test:int
Integration tests on Testcontainers PostgreSQL
with PostGIS
test:contract
Replays recorded device messages from every
firmware version
test:e2e:web
Playwright
test:e2e:mobile
Maestro
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 9 of 118


<!-- PAGE 10 -->

Part 4. Research tasks (do these before any code)
For each task, write the output to the file named. The research IDs in the table below are
RS-01 to RS-15. The table labels them R-01 to R-15, but they are research IDs only. R-01 to R-
20 elsewhere in this document are business rules (Part 20.2). Cite the official source you
used and the date you checked it. Stop and log a conflict if a result contradicts this
prompt.
Script
Purpose
test:security
Authorisation matrix, IDOR tests, route inventory,
header tests
test:a11y
Accessibility checks
load:test
k6 scenarios (Part 15.3)
db:migrate
Apply migrations as app_migrator
db:seed:config
Insert only configuration, roles, and notification
templates (no people, no buses)
db:purge-synthetic
Delete rows where is_synthetic is true, in
dependency order. Refuses in production
sim:start
Start the simulator. Refuses unless APP_ENV is
local or staging
verify:no-mock
Fails on mock-data patterns in production code
and seeds (Part 15.4)
verify:prod-clean
Fails if any production database row is synthetic or
has a non-college email
verify:routes-auth
Fails if any route lacks an explicit auth decision
(Part 13.2)
security:scan
Semgrep, CodeQL configuration check, gitleaks,
pnpm audit
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 10 of 118


<!-- PAGE 11 -->

ID
Question
Output file
R-01
Current stable versions of every package in
Part 2. Compatibility of Expo SDK with
React Native, NestJS with the chosen Node
LTS, Prisma with PostgreSQL 16, pg-boss,
MapLibre React Native with Expo
docs/decisions/versions.md
R-
02
Expo background location: config plugin
options for an Android foreground service
with a location type, the Android and iOS
permission strings, the entitlements and
background modes needed, and iOS
behaviour when the app is swiped away
docs/decisions/location-
permissions.md
R-
03
Google Play background location policy and
the location permission declaration form, as
currently published
docs/decisions/location-
permissions.md
R-
04
Apple App Review guidance for background
location and time-sensitive notifications.
Whether a Critical Alerts entitlement is
needed
docs/decisions/ios-notifications.md
R-
05
FCM HTTP v1 with Firebase Admin SDK:
Android priority fields and APNs headers
(apns-priority, interruption level) for high-
priority safety alerts
docs/decisions/push.md
R-
06
DLT requirements for transactional SMS in
India with the chosen provider: template
registration, sender ID, delivery report
format, and how to verify its signature
docs/decisions/sms.md
R-
07
SNS signature verification for SES bounce
and complaint messages: certificate URL
allowlist, signature algorithm, topic checks
docs/decisions/email-webhooks.md
R-
08
Cloudflare Turnstile server-side verification:
endpoint, fields, hostname and action
checks
docs/decisions/captcha.md
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 11 of 118


<!-- PAGE 12 -->

RS-16 to RS-20 are also required:
RS-16 Check the device contract against HW-SPEC-1.0 sections 8, 9, 10, 12, and 13. List
every mismatch as a conflict. Output: docs/decisions/hw-contract-check.md
RS-17 Google Play Data safety form: how location and account data are declared.
Output: docs/decisions/location-permissions.md (append)
RS-18 App Store privacy labels for location and account data. Output:
docs/decisions/ios-notifications.md (append)
RS-19 AWS India region: availability of every service in Parts 2 and 3 (ECS, ALB, RDS
PostgreSQL with PostGIS, S3, SES, SNS, KMS, WAF, ACM, Secrets Manager,
CloudFront). Output: docs/decisions/aws-region.md
ID
Question
Output file
R-
09
openid-client with Google Workspace and
Microsoft Entra ID: discovery, PKCE,
hosted-domain or tenant restriction
docs/decisions/sso.md
R-10
PostGIS: distance on geography,
ST_LineLocatePoint for distance along a
route, ST_Length, ST_DWithin, index types
docs/decisions/postgis.md
R-11
pg-boss: queues, retry and backoff, dead
letters, singleton keys, cron scheduling,
skip-locked fetching
docs/decisions/jobs.md
R-12
Prisma with PostgreSQL row-level security:
setting session variables per transaction,
connecting as a non-owner role without
BYPASSRLS
docs/decisions/rls.md
R-13
MapLibre GL JS and @maplibre/maplibre-
react-native: markers, clustering, line layers,
style configuration
docs/decisions/maps.md
R-14
Expo location object fields on Android and
iOS: speed units, accuracy, provider, and
whether a mocked flag is available
docs/decisions/gps-fields.md
R-15
Helmet and CORS in NestJS. Disabling
OpenAPI UI in production
docs/decisions/http-hardening.md
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 12 of 118


<!-- PAGE 13 -->

RS-20 expo-sqlite for the phone buffer: current support, background-safe writes, and
storage for 24 hours of samples (Part 10.5 step 10). Output: docs/decisions/phone-
buffer.md
Do not start phase P0 until every output file exists and any conflicts are logged.
Part 5. End-to-end pipeline
5.1 Overview
Read the diagram as one path for one bus. The tracker and the driver's phone both send
into the same ingest API. The source selector decides which source is active. The
snapshot API serves the result. The admin console reads the same state, and its writes
are audited.
5.2 Hardware sample pipeline
Stages run in this order. Each stage has one owner and a defined failure result.
one bus, one path: tracker and driver phone feed the ingest API, the selector picks one source, and the apps
read the result
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 13 of 118


<!-- PAGE 14 -->

Stage
What happens
Owner
On failure
S1 Edge
TLS ends at the load
balancer. WAF rate
rules apply to the
ingest host
Infrastructure
WAF blocks or returns 429
S2
Authenticate
Read the Bearer token.
Compute its HMAC
with each active key
version. Find the
device. Require status
ACTIVE, or
PROVISIONED on the
first request only (Part
6.3)
Ingest auth
401 DEVICE_REVOKED or
AUTH_REQUIRED. 403
DEVICE_INACTIVE
S3 Size
Body at most 8 KB
Ingest
413 PAYLOAD_TOO_LARGE
S4 Schema
Zod schema for the
envelope and for each
sample. Unknown
fields rejected
Contracts
400 VALIDATION_FAILED
with field errors. Nothing
stored
S5 Sample
range
Range checks per
sample (Part 9.1)
Domain
That sample rejected with a
reason
S6 Time
Future by more than
60 s rejected. Older
than 7 days rejected.
Older than 10 minutes
stored as BUFFERED
Domain
Rejected or flagged
S7 Duplicate
Same (device_id,
boot_id, seq) with
identical content:
accepted silently.
Different content:
CONFLICT. The unique
index is the final guard
Ingest,
database
CONFLICT
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 14 of 118


<!-- PAGE 15 -->

5.3 Driver phone pipeline
Authenticate the driver session. The token carries shift_id. The shift must be ACTIVE.
The driver must still be on the roster for the shift's bus (R-16).
Stage
What happens
Owner
On failure
S8 Null island
and area
Reject (0, 0). Flag
coordinates outside
the service area
Domain
Rejected or flagged
S9 Plausibility
Jump above 150 km/h
from the last accepted
valid sample of this
device
Domain
IMPLAUSIBLE_JUMP. Stored,
flagged
S10 Clock skew
sent_at differs from
server time by more
than 300 s
Domain
CLOCK_SKEW flag and
technician alert
S11 Attribution
Bus is the device link
valid at recorded_at, or
at received_at when
recorded_at is null
(Part 6.6)
Ingest
Stored with no bus. Not
shown
S12
Transaction
Insert accepted and
rejected samples and
events. Update device
health. Insert an
outbox row to evaluate
the bus
Ingest
Whole transaction rolls back
S13 Response
ack_seq, rejected list,
event results, config,
server_time
Ingest
Not applicable
S14 Selector
Evaluate the bus (Part
9.3)
Worker
Retried by pg-boss
S15 Bus state
Update the bus_state
row
Selector
Retried
S16 Apps
Poll the snapshot
Apps
Stale badge after 60 s
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 15 of 118


<!-- PAGE 16 -->

Body at most 16 KB, at most 50 samples per request.
Live use requires accuracy at most 50 m (configuration), a provider other than
NETWORK, and is_mock false. A sample with is_mock true is stored with its flag and
never updates live state.
Convert speed from m/s to km/h (multiply by 3.6).
Attribute samples to the shift's bus. The phone is not attributed through the device
link.
Use the same transaction and outbox rules as the hardware pipeline.
The response includes phone_interval_s (30 when hardware is active, 10 when the
phone is active) and active_source.
5.4 Heartbeat pipeline
Authenticate the device. Update device_health with the latest values. Insert a row into
device_heartbeats (partitioned by day). Compute health: ONLINE, DELAYED, or OFFLINE
(Part 11.6). Raise an alert when a threshold is crossed. Return pending_action: NONE,
UPDATE_CONFIG, REBOOT, or FIRMWARE_UPDATE with firmware_target.
5.5 Event pipeline
Authenticate the device. Validate the event type. Insert into device_events with
dedupe_key (device_id, boot_id, event seq). A duplicate key is stored once. Then run the
handler for the type:
SOS: create or join an incident (Part 11.1), built in P3-T16. Write outbox rows for tier 0
recipients. Return the incident_id.
GPS_LOST and GPS_RECOVERED: update the selector counters.
LOW_VEHICLE_BATTERY, LOW_DEVICE_BATTERY, MODULE_ERROR (three in 24
hours), BOOT with WATCHDOG or BROWNOUT (three in 24 hours),
BUFFER_OVERFLOW, FIRMWARE_FAILED, TAMPER: open a ticket and raise an alert.
IGNITION_OFF during an active shift: start the idle timer (Part 9.8).
Unknown type: store with status IGNORED.
The response includes event_results with a status for each event.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 16 of 118


<!-- PAGE 17 -->

5.6 Read pipeline (snapshot)
Authenticate. Resolve the caller's scope from the database (Part 6.9). Check the route is
visible to the caller, and return 404 if not. Read bus_state for buses on the route with a
trip today. Compute data age and ETA for the caller. Cache the result for 3 seconds per
route version. Return an ETag. Return 304 when unchanged.
5.7 SOS pipeline
A trigger arrives. Create or join the incident (Part 11.1). Write outbox rows for tier 0
recipients. The dispatcher sends a high-priority push, the in-app alert, and SMS where the
tier requires it. Acknowledgements are stored as sos_events. The sos-escalator job runs
every 15 seconds and moves the incident to the next tier when it has no
acknowledgement. Responding or resolving stops escalation. Resolution notifies all
recipients.
5.8 Attendance pipeline
A trip starts and EXPECTED rows are created. The driver app requests the current QR
payload every 30 seconds. A student scans, and the server validates in the order in Part
11.2. The record becomes BOARDED. At the boarding cutoff, the job sets ABSENT. The
absence evaluator creates an alert for the morning-present, afternoon-absent rule (Part
11.3). Faculty are notified.
5.9 Notification outbox pipeline
A business event writes the notification and its delivery rows in the same transaction. The
dispatcher fetches QUEUED deliveries with skip-locked. It applies quiet hours and rate
limits at dispatch time. SAFETY notifications bypass both. It sends through the channel
adapter and records the provider reference and status. Failed deliveries retry on the
schedule in Part 11.4. After six attempts a delivery is dead-lettered and an alert is raised.
5.10 Admin change pipeline
Request, authenticate, authorise, validate. Then one transaction: the change, an audit row
with old and new values, and a route version bump for each affected route. On commit,
clients see the change at their next poll. The snapshot cache is keyed by route version, so
no manual invalidation is needed.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 17 of 118


<!-- PAGE 18 -->

5.11 Job pipeline
Scheduled jobs (Part 14.3) run as idempotent handlers with unique keys. Failures retry
with backoff. Repeated failures are dead-lettered and raise an operational alert (Part 11.6).
5.12 What the software does with each hardware message
Hardware message
Software action
Visible result
Valid sample, fresh
Stored. Becomes the
hardware live state if newest
and valid
Bus shows Live · bus
tracker
Sample with gps_valid false
Stored. Not used for live
state
After 60 s without a valid
fix, the source may switch
to the phone
Buffered sample (older than
10 minutes)
Stored as BUFFERED. History
only
Trip history only
Sample at (0, 0)
Rejected: NULL_ISLAND
None
Jump above 150 km/h
Stored, flagged, rejected
Not shown live
Duplicate sample
Accepted silently
None
Same seq, different content
Rejected: CONFLICT
Technician sees the count
Batch of 50
One transaction. ack_seq
returned
Device deletes
acknowledged samples
Heartbeat, gps_status
NO_FIX
Health ONLINE. Hardware fix
marked invalid
Source may switch to the
phone
Heartbeats stop during
ignition ON
DELAYED, then OFFLINE
Ticket at OFFLINE
IGNITION_OFF during a shift
Idle timer starts
Driver prompted after 20
minutes without
movement
SOS
Incident created or joined.
Tier 0 starts. incident_id
returned
Recipients alerted within
5 s. Device LED confirms
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 18 of 118


<!-- PAGE 19 -->

Part 6. Device connection, provisioning, and visibility
This part answers three questions the build must get right: how a tracker connects to the
software, how a driver's phone is tied to a bus, and who may see what.
6.1 Concepts
Hardware message
Software action
Visible result
SOS with triggered_at older
than 60 s
Incident marked
DEVICE_DELAYED
Coordinator sees the
delay
LOW_VEHICLE_BATTERY
Ticket
Technician and
coordinator notified
MODULE_ERROR three times
in 24 h
Ticket
Technician
FIRMWARE_FAILED
Ticket. Rollout paused for
this device
Technician sees the pause
Request refused with 401 or
403
Authentication failure
recorded
Health shows OFFLINE
once heartbeats stop
Unknown event type
Stored as IGNORED
None
CONFIG_APPLIED
Logged
None
Term
Definition
Device
A tracker on a bus. Identified by device_id in the
form HW_ followed by 3 or 4 digits
Bus
A vehicle, identified by bus_number (for example
07). Holds the route, roster, faculty, and trips
Device link
A dated row that ties one device to one bus. At
most one open link per device and per bus
Roster entry
A dated row that allows one driver to run one bus
Faculty assignment
A dated row that makes a faculty member
responsible for a bus. One is primary
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 19 of 118


<!-- PAGE 20 -->

6.2 Provisioning flow
1. The technician creates device records as a batch: device_id, serial_number, imei, iccid.
Validation: device_id is unique. imei is 15 digits and unique. iccid is 19 or 20 digits. Status
is PROVISIONED.
2. The server generates the device token: 32 bytes from a cryptographically secure
random source, encoded as base64url. The server stores only the HMAC-SHA256
value, computed with the newest key version in DEVICE_TOKEN_HMAC_KEYS, and
records that key_version. The plaintext is shown once on the technician's screen. It
cannot be retrieved afterwards.
3. The technician loads the device_id and token into the device with a provisioning tool,
outside this software. The software provides the provisioning screen only.
4. The label contains the device_id and a QR code that encodes the device_id only. The
token never appears on a label.
5. The first authenticated request sets the device to ACTIVE and records first_used_at. A
device that is not used within 30 days stays PROVISIONED and appears in the
technician list as Not yet connected.
6.3 Device authentication
The request must carry exactly one Authorization header with the scheme Bearer. The
token must be 43 base64url characters. Anything else is rejected with 401
AUTH_REQUIRED.
Term
Definition
Student route
A dated row that places a student on a route for a
trip type, with a boarding stop
Shift
One driver's run on one bus, from start to end. Has
a shift_id
Trip
One scheduled run of a route on a service date, in
one direction (MORNING or AFTERNOON).
Created by a shift
Source
Where a position came from: HW (tracker) or
PHONE (driver's phone)
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 20 of 118


<!-- PAGE 21 -->

The server computes the HMAC with each active key version (at most two during
rotation) and looks up (key_version, token_hash) in the device_tokens table, using a
unique index.
A PROVISIONED device is accepted only on its first authenticated request, when
first_used_at is empty. That request sets status ACTIVE and first_used_at in the same
transaction. Every later request requires status ACTIVE. A REVOKED or RETIRED
device returns 403 DEVICE_INACTIVE. A revoked token returns 401
DEVICE_REVOKED.
Failed authentications are counted per source IP. More than 20 in 5 minutes returns
429 for that IP. More than 50 for one device in 5 minutes raises a security alert.
The token is never logged. Logs record the device_id only, and only when the device
exists.
6.4 Rotation and revocation
Rotation: a technician or coordinator requests rotation. The server creates a PENDING
token. The device calls POST /api/v1/devices/token/rotate with its current token and
receives the new token once. The device stores it and uses it. The first successful
request with the new token makes it ACTIVE and revokes the old one. A PENDING
token expires after 24 hours if unused, and the old token stays active.
Revocation: the coordinator types the bus number to confirm. The token becomes
REVOKED and the device becomes REVOKED. The next request returns 401
DEVICE_REVOKED. A maintenance ticket is opened. A revoked device cannot receive
a new token over the network. It needs physical reprovisioning.
6.5 Linking a device to a bus
1. The coordinator selects a device with status ACTIVE or PROVISIONED, and a bus with
no open device link.
2. valid_from defaults to now. A past date is allowed up to 7 days back. A future date is
allowed.
3. In one transaction, lock the bus row and the device row with SELECT FOR UPDATE.
Close any earlier open link for the device and for the bus at valid_from. Insert the new
link.
4. A partial unique index enforces one open link per device and one per bus.
5. Write an audit row with the old and new links.
6. From valid_from, samples recorded by the device are attributed to the bus (Part 6.6).
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 21 of 118


<!-- PAGE 22 -->

6.6 Attribution rule
For a sample, the bus is the device link whose interval [valid_from, valid_to) contains
recorded_at. If recorded_at is null, use received_at.
For an event, use occurred_at when present, otherwise received_at.
A sample with no matching link is stored with bus_id null. It is never shown in the apps.
The admin console lists such devices as unlinked.
A buffered sample recorded before a device was moved keeps its original bus. This is
correct, because the device was on that bus when it recorded the position.
6.7 Driver phone connection
1. The driver signs in with the email OTP (Part 13). The refresh token is stored in platform
secure storage.
2. The roster screen lists only the buses with an active roster entry for this driver.
3. Start shift. The server checks that the driver is rostered, that the bus has no ACTIVE
shift, and that the pre-trip checks passed (Part 9.10). It then creates the shift and the
trip, and issues a shift-scoped session claim containing shift_id and bus_id.
4. The driver app sends phone samples to POST /api/v1/driver/locations. The server
accepts them only when the claim matches an ACTIVE shift for that bus, and the roster
entry is still active.
5. When the shift ends, the claim stops allowing writes. The driver app stops sending.
6. The hardware is not bound to any driver. The selector combines both sources for the
same bus.
6.8 Visibility matrix
Read each cell as the access for that role. Yes means full access to the item. Own means
only the item tied to the user's own bus, shift, or record. Count means aggregate counts
only.
What
STU
FAC
DRV
SEC
COR
TEC
MGT
SAD
Live bus
position
Route
buses
with a
trip
today
Assigned
buses
Own bus
All
active
buses
All buses
No
(device
view
shows
last fix
only)
Count
All buses
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 22 of 118


<!-- PAGE 23 -->

6.9 Scope resolution
Scope is computed from database rows on each request. It is never taken from the client.
STU: active student route for today, then the buses that serve that route on today's
weekday and trip type.
FAC: active faculty assignments.
DRV: active roster entries. During a shift, only the shift's bus.
What
STU
FAC
DRV
SEC
COR
TEC
MGT
SAD
Source label
(bus tracker
or driver's
phone)
Yes
Yes
Own bus,
with detail
Yes
Yes
Yes
No
Yes
Device ID
(HW_nnn)
No
No
No
No
Yes
Yes
No
Yes
Device health
(battery,
signal, SIM,
firmware)
No
No
Summary
for own
bus (ok or
warning)
No
Summary
Full
No
Full
Phone source
and switch
history
No
No
Own bus
No
Yes
Yes
No
Yes
Driver name
and phone
number
No
Own
buses
Self
Yes (for
SOS)
Yes
No
No
Yes
Passenger list
and
boardings
Own
record
only
Own
buses
Own shift
No
Yes
No
Count
Yes
Location
history
No
No
No
No
Yes
(audited)
No
No
Yes
(audited)
SOS
Send
Receive
and
respond
(own
buses)
Send,
receive
own
Receive
and
respond
Receive,
respond,
cancel
No
Summary
All
Trip state
(Not running,
Live,
Unavailable)
Yes
Yes
Own bus
Yes
Yes
Yes
Count
Yes
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 23 of 118


<!-- PAGE 24 -->

SEC: all buses with status ACTIVE, read-only.
COR and SAD: all buses.
TEC: devices and device health. No passenger data.
MGT: aggregate endpoints only.
Any bus_id, route_id, or other identifier sent by the client is a filter. The server checks it
against scope. An identifier outside scope returns 404, not 403.
6.10 Time-based visibility
Students see a bus only when the route has a scheduled or active trip today. Before
the scheduled time, the card shows Not running with the next trip time. After the trip
ends, the trip summary is visible for 30 minutes with the label Trip completed.
Faculty see their buses for the whole service day.
Drivers see their own bus while the shift is active. They see their roster at all times.
A bus that is Not running has no marker on the map.
6.11 Naming in the interface
Students, faculty, drivers, and security see Bus 07 and a state label such as Live · bus
tracker or Live · driver's phone. They never see device IDs or internal names.
Coordinators and technicians see device IDs. IMEI and ICCID are shown masked (last
four digits) on device detail. Only the super admin sees them unmasked.
Part 7. Data model
Rules for every business table:
id: UUID v4, generated by the database, primary key.
created_at and updated_at: timestamptz in UTC.
is_synthetic: boolean, not null, default false. Used by the purge and verification scripts
(Part 15.4).
No hard deletes, except by the retention and personal-data deletion jobs (Part 14.2).
Enumerations are text with a CHECK constraint. Never use database enum types,
because they are hard to change later.
Every foreign key has an index.
Use citext for email addresses. Use geography(Point, 4326) and geography(LineString,
4326) for positions and routes.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 24 of 118


<!-- PAGE 25 -->

7.1 Identity and access
Table
Key columns
Constraints and indexes
colleges
name, email_domains (text array),
timezone (default Asia/Kolkata)
One row in the MVP
users
college_id, email (citext), full_name,
phone_e164, status (ACTIVE,
SUSPENDED, DEACTIVATED),
deactivated_at, last_seen_at
Unique (college_id, email).
Check on status
user_roles
user_id, role (STU, FAC, DRV, SEC, COR,
TEC, MGT, SAD), granted_by,
granted_at, revoked_at
Partial unique (user_id, role)
where revoked_at is null
sessions
user_id, family_id, refresh_token_hash,
device_label, created_at, last_used_at,
expires_at, revoked_at
Index (user_id, revoked_at).
Index (family_id)
otp_challenges
user_id, code_hmac, expires_at,
attempts, consumed_at
Index (user_id, created_at)
mfa_factors
user_id, type (TOTP),
secret_encrypted, enrolled_at
Unique (user_id, type)
recovery_codes
user_id, code_hash (argon2id), used_at
Index (user_id)
student_profiles
user_id, department, year_of_study,
date_of_birth_encrypted,
guardian_contact_encrypted,
approach_threshold_min (2 to 15,
default 5)
Unique (user_id)
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 25 of 118


<!-- PAGE 26 -->

7.2 Fleet and devices
Table
Key columns
Constraints and indexes
buses
bus_number,
registration_number, capacity (1
to 150), status (ACTIVE,
MAINTENANCE, RETIRED),
default_mode (AUTO,
MANUAL_HW,
MANUAL_PHONE; default
AUTO), insurance_expiry,
fitness_expiry, pollution_expiry,
permit_expiry
Unique bus_number and
registration_number
devices
device_id (pattern HW_
followed by 3 or 4 digits),
serial_number, imei (15 digits),
iccid (19 or 20 digits), status
(PROVISIONED, ACTIVE,
REVOKED, RETIRED, BENCH),
fw_version, module_fw_version,
schema_version, vehicle_class
(V12, V24), first_used_at
Unique device_id and imei
device_tokens
device_id, key_version,
token_hash, status (ACTIVE,
PENDING, REVOKED),
created_at, first_used_at,
revoked_at, expires_at
Unique (key_version,
token_hash). Partial unique
device_id where status is
ACTIVE
device_links
device_id, bus_id, valid_from,
valid_to, set_by
Partial unique device_id where
valid_to is null. Partial unique
bus_id where valid_to is null.
Check valid_to greater than
valid_from
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 26 of 118


<!-- PAGE 27 -->

Table
Key columns
Constraints and indexes
device_health
device_id (primary key),
last_heartbeat_at, last_fix_at,
state (ONLINE, DELAYED,
OFFLINE), fw_version,
vehicle_battery_mv,
device_battery_mv,
signal_rssi_dbm, sim_status,
network_status, gps_status,
buffer_bytes, ignition
One row per device
device_heartbeats
device_id, boot_id, received_at,
and the payload fields of
device_health
Partitioned daily on received_at.
Index (device_id, received_at)
device_events
device_id, bus_id (nullable),
type, boot_id, event_seq,
occurred_at, received_at,
payload (jsonb), status
(RECORDED, PROCESSED,
IGNORED), dedupe_key
Unique dedupe_key. Index
(bus_id, received_at)
firmware_releases
version (unique), sha256,
size_bytes, storage_key, channel
(STABLE, BETA), status (DRAFT,
ROLLING_OUT, COMPLETE,
WITHDRAWN), released_at
Unique version
firmware_rollouts
release_id, step (CANARY,
PERCENT_25, FULL), status,
started_at, paused_reason
Index (release_id)
maintenance_tickets
bus_id (nullable), device_id
(nullable), source
(DRIVER_REPORT,
SYSTEM_ALERT, MANUAL),
category, status (OPEN,
IN_PROGRESS, RESOLVED,
CLOSED), opened_by,
assigned_to, description (max
500), resolution_note,
opened_at, closed_at
Index (status, opened_at)
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 27 of 118


<!-- PAGE 28 -->

7.3 Routes and stops
7.4 People and assignments
Table
Key columns
Constraints and indexes
stops
name (max 60), location
(geography point), radius_m
(default 50), status
GIST index on location
routes
code (unique), name, status
Unique code
route_stops
route_id, stop_id, sequence,
valid_from, valid_to
Partial unique (route_id,
sequence) where valid_to is
null. Index stop_id
route_geometries
route_id, version, line
(geography line), valid_from,
valid_to
Unique (route_id, version).
GIST index on line
route_bus_assignments
route_id, bus_id, trip_type
(MORNING, AFTERNOON),
weekday_mask (7 bits),
valid_from, valid_to
Service checks for overlaps in
one transaction
timetables
route_id, trip_type,
departure_time (campus local
time), weekday_mask,
valid_from, valid_to
Index (route_id, trip_type)
holidays
holiday_date (unique), name
Used by the trip generator
Table
Key columns
Constraints and indexes
driver_roster
bus_id, driver_id, valid_from,
valid_to
Partial unique (bus_id,
driver_id) where valid_to is null
faculty_assignments
bus_id, faculty_id, is_primary,
valid_from, valid_to
At most one open primary per
bus (partial unique)
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 28 of 118


<!-- PAGE 29 -->

7.5 Operations
Table
Key columns
Constraints and indexes
student_routes
student_id, route_id, trip_type,
boarding_stop_id, valid_from,
valid_to
At most one open route per
student and trip type (partial
unique). Also checked in the
service
Table
Key columns
Constraints and indexes
shifts
bus_id, driver_id, trip_id,
mode_at_start, started_at,
ended_at, end_reason (MANUAL,
AUTO_IDLE, ADMIN, TIMEOUT),
status (ACTIVE, ENDED)
Partial unique bus_id where
status is ACTIVE. Partial unique
driver_id where status is
ACTIVE
trips
route_id, bus_id, shift_id, trip_type,
service_date, scheduled_departure,
actual_departure, ended_at, status
(SCHEDULED, ACTIVE,
COMPLETED, CANCELLED),
route_geometry_id
Unique (route_id, bus_id,
service_date, trip_type)
location_samples
source (HW or PHONE), bus_id,
device_id, driver_id, shift_id,
boot_id, seq, recorded_at,
received_at, lat, lng, geom,
speed_kmh, heading_deg,
accuracy_m, satellites, hdop,
gps_valid, ignition, provider,
is_mock, buffered, accepted,
reject_reason
Partitioned daily on
received_at. Unique
(device_id, boot_id, seq) where
device_id is not null. Unique
(driver_id, shift_id, seq) where
driver_id is not null. Index
(bus_id, recorded_at desc).
GIST on geom
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 29 of 118


<!-- PAGE 30 -->

Table
Key columns
Constraints and indexes
bus_state
bus_id (primary key), state
(NOT_RUNNING, LIVE, STALE,
UNAVAILABLE, NO_HARDWARE),
active_source (HW, PHONE,
NONE), mode (AUTO,
MANUAL_HW, MANUAL_PHONE),
last_hw_valid_at,
last_phone_valid_at, last_lat,
last_lng, last_speed_kmh,
last_heading_deg,
consecutive_hw_valid,
last_switch_at, route_version,
version
Version column used for
optimistic locking
source_switches
bus_id, from_source, to_source,
reason_code, actor_type (SYSTEM,
DRIVER, ADMIN), actor_id, note
(max 140 characters, optional), at
Index (bus_id, at)
stop_events
trip_id, stop_id, event (ARRIVED,
DEPARTED), at, method (AUTO,
MANUAL), source
Index (trip_id, at)
outbox
kind, payload (jsonb), status
(PENDING, DONE, FAILED),
attempts, available_at, locked_at
Index (status, available_at)
rate_counters
key (primary key), window_start,
count
Cleared by a job
idempotency_keys
user_id, key, request_hash,
response (jsonb), status_code,
expires_at
Unique (user_id, key)
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 30 of 118


<!-- PAGE 31 -->

7.6 Attendance
Table
Key columns
Constraints and indexes
attendance_records
trip_id, student_id, status
(EXPECTED, BOARDED,
LATE_BOARDED, ABSENT,
ON_LEAVE, MANUAL_CHECKIN,
FLAGGED_GUEST,
BOARDED_LATE), boarded_at,
method (QR, DRIVER), marked_by,
boarding_stop_id
Unique (trip_id, student_id)
leave_records
student_id, service_date,
trip_type, reason_category
(PERSONAL, ACADEMIC, OTHER),
created_by, cancelled_at
Partial unique (student_id,
service_date, trip_type) where
cancelled_at is null
absence_alerts
student_id, service_date,
morning_trip_id, afternoon_trip_id,
alerted_at, status (OPEN,
ACKNOWLEDGED,
BOARDED_LATE, CLOSED),
acknowledged_by, note
Unique (student_id,
service_date)
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 31 of 118


<!-- PAGE 32 -->

7.7 Emergencies
7.8 Stop requests
Table
Key columns
Constraints and indexes
sos_incidents
bus_id (nullable), trip_id (nullable),
category (EMERGENCY, MEDICAL,
BREAKDOWN, OTHER, UNKNOWN),
first_trigger_type (DRIVER_APP,
HW_BUTTON, STUDENT_APP,
FACULTY_APP, SECURITY_APP),
first_triggered_at,
device_triggered_at, received_at,
status (OPEN, RESPONDING,
RESOLVED, CANCELLED,
DRILL_CLOSED), current_tier (0 to 3),
is_drill, resolved_at, resolved_by,
resolution_note (max 500)
Index (status, received_at)
sos_events
incident_id, type (TRIGGERED,
JOINED, DELIVERED,
ACKNOWLEDGED, RESPONDING,
ESCALATED, CANCELLED,
RESOLVED, NOTE,
DEVICE_RECEIVED), actor_id, at,
detail (jsonb)
Append-only: no update or delete
grant. Index (incident_id, at)
Table
Key columns
Constraints and indexes
stop_requests
requested_by, proposed_name (max
60), location, route_id, status (PENDING,
APPROVED, REJECTED, MERGED),
merged_into_id, vote_count,
reviewed_by, review_note,
approved_stop_id, effective_from
Index (route_id, status)
stop_request_votes
request_id, student_id
Unique (request_id,
student_id)
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 32 of 118


<!-- PAGE 33 -->

7.9 Notifications, announcements, and settings
Table
Key columns
Constraints and indexes
notifications
recipient_id, category (SAFETY,
ATTENDANCE, TRIP, ADMIN,
SYSTEM), title, body, data (jsonb),
read_at
Index (recipient_id,
created_at)
notification_deliveries
notification_id, channel (PUSH,
SMS, EMAIL, IN_APP), status
(QUEUED, SENT, DELIVERED,
FAILED, SUPPRESSED, DEAD),
attempts, next_attempt_at,
provider_ref, last_error (no personal
data)
Index (status,
next_attempt_at)
notification_preferences
user_id, category, channel, enabled
Unique (user_id,
category, channel)
announcements
title (max 120), body (max 1,000,
plain text), scope_type (ALL,
ROUTE, BUS), scope_id, created_by,
published_at, expires_at
settings
key (primary key), value (jsonb),
updated_by, reason
Every change audited
feature_flags
key (primary key), enabled, scope,
updated_by
sms_templates
purpose, dlt_template_id,
body_with_placeholders,
approved_at
Unique purpose
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 33 of 118


<!-- PAGE 34 -->

7.10 Compliance and audit
7.11 Row-level security
Row-level security is enabled and forced on: users, sessions, mfa_factors,
recovery_codes, student_profiles, attendance_records, leave_records, student_routes,
absence_alerts, sos_incidents, sos_events, notifications, notification_deliveries,
notification_preferences, consents, data_requests, location_samples, and export_jobs.
Roles:
app_migrator owns the tables. It runs migrations only. Never used at runtime.
app_runtime is used by the API. It is not the owner, has no BYPASSRLS, and is not a
superuser.
app_worker is used by the worker process. It has only the grants the jobs need.
Table
Key columns
Constraints and indexes
audit_logs
actor_id, actor_role, action,
entity_type, entity_id, before (jsonb),
after (jsonb), ip, user_agent (max 255),
request_id, at
Append-only. The application
role has no update, delete, or
truncate grant. A trigger
rejects updates and deletes
data_requests
user_id, type (EXPORT, CORRECTION,
DELETION, WITHDRAW_CONSENT),
status (RECEIVED, IN_PROGRESS,
COMPLETED,
REJECTED_WITH_REASON),
received_at, due_at, completed_at,
handled_by
Index (status, due_at)
consents
user_id, purpose, notice_version_id,
granted_by_user_id (guardian,
nullable), granted_at, withdrawn_at
Index (user_id)
notice_versions
version, text_url, effective_from
export_jobs
requested_by, type, filters (jsonb),
status (QUEUED, RUNNING, READY,
FAILED, EXPIRED), storage_key,
row_count, expires_at
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 34 of 118


<!-- PAGE 35 -->

Per request, inside one transaction, the API sets session values with set_config(name,
value, true): app.user_id, app.roles, app.bus_ids, and app.route_ids. The policies read
these values. Cross-user writes are performed by the worker, or by narrow database
functions that the policies allow.
Row-level security is defence in depth. The service layer still enforces the authorisation
matrix (Part 6.8). Both must pass.
7.12 Partitions and retention
location_samples and device_heartbeats are partitioned daily. The partition manager
creates partitions seven days ahead. The retention job drops partitions older than the
retention period (Part 14.2).
Every partial unique index named above is created in a migration with a test.
Part 8. API specification
8.1 Conventions
Two public hosts. The API host (API_PUBLIC_HOST) serves the apps and the admin
console, under /api/v1. The ingest host (INGEST_PUBLIC_HOST) serves devices and
driver phones only, under /api/v1. The admin console host (ADMIN_PUBLIC_HOST)
serves the static console and calls the API host.
JSON only. Requests with another content type return 415
UNSUPPORTED_MEDIA_TYPE.
Timestamps are UTC ISO 8601 with a Z suffix. Service dates are YYYY-MM-DD in the
service time zone.
Identifiers are UUID v4, except device_id (HW_ followed by digits).
Pagination is cursor-based. The limit defaults to 50 and is capped at 200. Responses
have the form data and next_cursor.
State-changing requests from the apps and the console require an Idempotency-Key
header (UUID v4). The response is stored for 24 hours, per user. The same key with the
same request body returns the stored response. The same key with a different body
returns 409 IDEMPOTENCY_CONFLICT.
Every response carries X-Request-Id. A valid incoming value is echoed; otherwise one
is generated.
Every response carries RateLimit-Limit, RateLimit-Remaining, and RateLimit-Reset.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 35 of 118


<!-- PAGE 36 -->

Authenticated responses carry Cache-Control: no-store. The snapshot carries an ETag
and Cache-Control: private, max-age=0.
Resources outside the caller's scope return 404 NOT_FOUND.
Versioning: /api/v1 stays while any device reports schema_version 1. A breaking change
needs /api/v2 and a 90-day notice (Part 14.2).
Authentication: Bearer tokens for the mobile apps, the device, and the driver phone.
An HttpOnly session cookie for the admin console, with a CSRF header on every write
(Part 13).
8.2 Error envelope and codes
Every error response has the fields error.code, error.message, error.details (optional,
never contains personal data), and error.request_id. Error messages are generic when
they concern authentication, so they do not reveal whether an account or device exists.
Code
HTTP
Meaning
AUTH_REQUIRED
401
No valid credentials
SESSION_EXPIRED
401
Refresh failed or the session is revoked
DEVICE_REVOKED
401
Device token revoked
FORBIDDEN
403
The role is not allowed to do this
DEVICE_INACTIVE
403
Device retired or revoked
NOT_ON_ROUTE
403
Student is not on this trip
CAPTCHA_REQUIRED
403
CAPTCHA missing or failed
NOT_FOUND
404
Not found, or outside the caller's scope
VALIDATION_FAILED
400
Request does not match the schema. Field
errors listed
UNSUPPORTED_MEDIA_TYPE
415
Wrong content type
PAYLOAD_TOO_LARGE
413
Body exceeds the endpoint limit
QR_INVALID
422
QR fails its signature check
QR_EXPIRED
422
QR outside the current or previous slot
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 36 of 118


<!-- PAGE 37 -->

8.3 Endpoint catalogue
Roles use the codes in Part 10.1. Every route has an explicit auth decision (Part 13.2).
Code
HTTP
Meaning
CONFLICT
409
State conflict, or a sample with the same
sequence and different content
DUPLICATE_BOARDING
409
Already boarded on this trip
BOARDING_WINDOW_CLOSED
409
Outside the boarding window
SHIFT_NOT_ACTIVE
409
The shift is not active
BUS_ALREADY_ON_SHIFT
409
Another shift holds this bus
TRIP_NOT_ACTIVE
409
The trip is not active
IDEMPOTENCY_CONFLICT
409
Same key, different body
RATE_LIMITED
429
Limit exceeded. Retry-After is set
SERVICE_UNAVAILABLE
503
Maintenance or overload. Retry-After is set
INTERNAL_ERROR
500
Unexpected failure. No details returned. Logged
with request_id
Method and path
Who
Purpose
POST /auth/sso/start
Public
Start college SSO sign-in
(redirect)
GET /auth/sso/callback
Public
Complete SSO and create a
session
POST /auth/otp/request
DRV, CAPTCHA after the
first request in an hour
Send a sign-in code
POST /auth/otp/verify
DRV
Verify the code and create
a session
POST /auth/refresh
Any signed-in user
Rotate the refresh token
POST /auth/logout
Any signed-in user
End the current session
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 37 of 118


<!-- PAGE 38 -->

Method and path
Who
Purpose
GET /auth/sessions, DELETE
/auth/sessions/{id}
Any signed-in user
List and revoke own
sessions
POST /auth/mfa/enrol, POST
/auth/mfa/verify
Admin roles
TOTP enrolment and
verification
GET /me, PATCH /me
Any signed-in user
Profile (name and phone
only)
GET, PUT /me/notification-
preferences
Any signed-in user
Preferences. SAFETY
cannot be changed
POST /me/data-requests, GET
/me/data-requests
Any signed-in user
Export, correction,
deletion, withdrawal of
consent
GET /snapshot?route_id=
STU, FAC, DRV, SEC,
COR, SAD
Bus states for one route
(Part 9.11)
GET /fleet/live
SEC, COR, SAD, MGT
(counts)
All active buses
GET /buses/{id}
Per scope
Bus detail
GET /buses/{id}/track
COR, SAD
Both sources for the last 10
minutes
GET /routes/{id}/geometry
STU, FAC, DRV, COR, SAD
Route line and stops with
version
POST /telemetry
Device (ingest host)
Samples and events (Part
8.4)
POST /heartbeat
Device (ingest host)
Health report
POST /devices/token/rotate
Device (ingest host)
Receive a rotated token
POST /driver/locations
Driver session (ingest
host)
Phone samples
POST /driver/status
Driver session (ingest
host)
Phone health and
permissions
GET, POST /buses; GET, PATCH
/buses/{id}
COR, SAD write. TEC,
MGT read
Fleet records
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 38 of 118


<!-- PAGE 39 -->

Method and path
Who
Purpose
POST /devices/batch
TEC
Provision devices
GET /devices, GET /devices/{id}
TEC, COR, SAD
Device registry (masking
per Part 6.11)
POST /devices/{id}/tokens
TEC
Request rotation
POST /devices/{id}/revoke
COR, SAD
Revoke
POST /device-links, POST
/device-links/{id}/close
COR
Link and unlink
POST /firmware-releases, POST
/firmware-rollouts
TEC
Releases and rollout steps
POST /tickets; GET /tickets (in
scope); GET, PATCH /tickets/{id}
DRV (create), TEC, COR
Maintenance tickets
GET, POST /routes; GET, PATCH
/routes/{id}
COR writes. Others read
in scope
Routes
PUT /routes/{id}/stops
COR
Ordered stops with validity
dates
PUT /routes/{id}/geometry
COR
New geometry version
GET, POST /stops; PATCH
/stops/{id}
COR
Stop library. Deactivation
has an effective date
GET, POST /timetables
COR
Timetables
POST /route-bus-assignments
COR
Buses per route, trip type,
and weekday
POST /roster; POST
/roster/{id}/close
COR
Driver roster
POST /faculty-assignments;
POST /faculty-
assignments/{id}/close
COR
Faculty to bus
POST /student-routes; POST
/student-routes/{id}/close
COR
Student to route
POST /student-
routes/{id}/boarding-stop
STU (own), when notified
Choose a new boarding
stop
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 39 of 118


<!-- PAGE 40 -->

Method and path
Who
Purpose
GET, POST /users; PATCH
/users/{id}
COR
Users
POST /users/import
COR
CSV dry run, then commit
(Part 11.8)
POST /users/{id}/roles
SAD
Grant or revoke a role
POST /shifts
DRV
Start a shift after the pre-
trip check
GET /shifts/current
DRV
Resume the current shift
POST /shifts/{id}/end
DRV (own), COR
End the shift
POST /shifts/{id}/mode
DRV (own), COR
Change the mode with a
reason
POST /shifts/{id}/prompt-
response
DRV (own)
Answer the idle prompt
GET /trips
Per scope
Trips by date, route, or bus
POST /trips/{id}/cancel
COR
Cancel with a reason
GET /trips/{id}/summary
COR, FAC (own), MGT
(counts)
Trip summary
GET /trips/{id}/passengers
DRV (own shift), FAC
(own), COR, SAD
Expected passengers and
status
GET /trips/{id}/qr
DRV (own shift)
Current QR payload
POST /attendance/scan
STU
Scan a boarding QR
POST /attendance/manual
DRV (own shift), COR
Manual check-in
POST /attendance/{id}/correct
COR
Correct a status with a
reason
GET /attendance/me
STU
Own history
POST /leave; DELETE /leave/{id}
STU, FAC (create).
Creator (cancel)
Leave
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 40 of 118


<!-- PAGE 41 -->

Method and path
Who
Purpose
GET /absence-alerts; POST
/absence-alerts/{id}/ack
FAC (own), COR
Absence alerts
POST /sos
STU, FAC, DRV, SEC,
COR, SAD
Trigger an incident
GET /sos; GET /sos/{id}
SEC, COR, SAD, FAC
(own buses)
Incidents and timelines
POST /sos/{id}/ack, /responding,
/notes, /resolve
FAC, SEC, COR, SAD
Response actions
POST /sos/{id}/cancel
Trigger user (within 30 s),
COR
Cancel with a reason
POST /sos/drills
COR
Run a drill
POST /stop-requests; GET /stop-
requests
STU (create and own).
COR (all)
Stop requests
POST /stop-requests/{id}/vote
STU
Vote
POST /stop-
requests/{id}/approve, /reject,
/merge
COR
Review
GET /notifications; POST
/notifications/{id}/read; POST
/notifications/read-all
Any signed-in user (own)
Notification centre
GET, POST /announcements
Read in scope. COR
writes
Announcements
POST /exports; GET /exports/{id}
COR, FAC (attendance),
TEC (device), MGT
(counts). Requester
(status)
Reports
GET /audit-logs
SAD. COR (read-only)
Audit log
GET /settings; PUT
/settings/{key}
COR reads. SAD writes
with a reason
Configuration
GET, PUT /feature-flags/{key}
SAD
Feature flags
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 41 of 118


<!-- PAGE 42 -->

8.4 Ingestion contracts
Telemetry (POST /telemetry, device token). Envelope fields:
Sample fields: seq (integer 0 or more, increases by 1 per boot, gaps allowed); recorded_at
(UTC, or null when gps_valid is false); gps_valid (boolean); lat and lng (null when gps_valid
is false; lat -90 to 90, lng -180 to 180, at most 6 decimals); speed_kmh (0 to 250, or null);
heading_deg (0 to 360, optional); satellites (0 to 40, or null); hdop (0.5 to 99, or null);
ignition (ON, OFF, or UNKNOWN); vehicle_battery_mv (0 to 60000, optional).
Event fields: type (from the table in section 12 of the specification), seq (per boot,
separate from sample seq), occurred_at (UTC, or null), data (object, type-specific).
Heartbeat (POST /heartbeat, device token). device_id, boot_id, fw_version, sent_at,
uptime_s, network_status (REGISTERED, SEARCHING, DENIED, NO_SERVICE,
UNKNOWN), sim_status (READY, NOT_INSERTED, PIN_REQUIRED, LOCKED,
UNKNOWN), signal_rssi_dbm (-125 to 0), vehicle_battery_mv (0 to 60000, nullable),
device_battery_mv (0 to 10000, nullable), gps_status (FIX_VALID, NO_FIX,
MODULE_ERROR, DISABLED), buffer_bytes and buffer_capacity_bytes, ignition,
temperature_c (-40 to 85, optional).
Method and path
Who
Purpose
GET /health
Public
Liveness only
GET /health/ready
Internal network only
Readiness, including
database access
Field
Type
Rules
schema_version
integer
Must be 1
device_id
string
Must match the token's device
boot_id
string
8 to 16 lowercase hex characters
fw_version
string
Semantic version
sent_at
string
UTC. Used only for clock-skew detection
samples
array
0 to 50 items
events
array
0 to 20 items
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 42 of 118


<!-- PAGE 43 -->

Driver locations (POST /driver/locations, driver session with shift claim). shift_id,
app_version, device_model (max 64), samples (1 to 50): seq (increases per shift),
recorded_at (UTC), lat, lng, accuracy_m (0 to 1000), speed_mps (nullable), heading_deg
(nullable), provider (GPS, FUSED, NETWORK, UNKNOWN), is_mock (boolean). Body at
most 16 KB.
Driver status (POST /driver/status, driver session). app_version, os (ANDROID, IOS),
os_version, location_permission (ALWAYS, WHILE_IN_USE, DENIED),
notifications_permission (GRANTED, DENIED), battery_percent,
battery_optimisation_exempt (Android only, null on iOS), background_running,
gps_enabled, network (WIFI, CELLULAR, NONE).
Responses. Telemetry and driver locations return: ack_seq (the highest sequence
number where every earlier sample was accepted or rejected with a reason), rejected (list
of seq and reason), event_results (seq, status, incident_id where relevant), config
(moving_interval_s, stopped_interval_s, parked_heartbeat_s; or phone_interval_s and
active_source for driver locations), server_time. Heartbeat returns: config, server_time,
pending_action (NONE, UPDATE_CONFIG, REBOOT, or FIRMWARE_UPDATE with
firmware_target).
Device status codes. 200 processed. 400 invalid body, nothing stored, do not resend. 401
or 403 stop sending, check again every 15 minutes. 413 split the batch in half. 429 wait for
Retry-After. 5xx retry with backoff of 5, 10, 20, 40, 80, then 120 seconds, with plus or
minus 20 percent jitter. Timeout: resend the same body, which is safe because of the
duplicate rule.
Part 9. GPS, source selection, and bus state
9.1 What counts as a valid fix
Hardware fix is valid when all of these hold: gps_valid is true; satellites is at least 4
(hw.min_satellites); hdop is 5.0 or less (hw.max_hdop); the sample passed validation
(Part 5.2); the sample is not BUFFERED.
Phone fix is valid when all of these hold: accuracy_m is 50 or less
(phone.max_accuracy_m); provider is not NETWORK; is_mock is false; the sample
passed validation.
A source is fresh when its last valid fix is no more than 60 seconds old
(hw.stale_after_s).
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 43 of 118


<!-- PAGE 44 -->

9.2 Units and coordinate rules
Hardware speed_kmh is already in km/h. The firmware converts from knots (multiply
by 1.852) when it uses NMEA RMC. The server accepts 0 to 250.
Phone speed arrives in m/s. Convert to km/h by multiplying by 3.6.
Heading is 0 to 360 degrees.
Coordinates are WGS84 decimal degrees (SRID 4326). Round to 6 decimal places on
input (about 0.1 m).
Reject (0, 0) and any latitude or longitude outside its range.
Distances use the geography type, so results are in metres. Never compute distance
from degrees.
Ordering uses received_at and sequence numbers. Device clocks are never used for
ordering.
9.3 Selector algorithm
Run for bus B on every accepted sample for B, and every 5 seconds for each bus with an
active shift. Run inside one transaction that locks the bus_state row.
RUN FOR BUS B (inside a transaction, bus_state row locked):
1  If B has no ACTIVE shift:
       state = NOT_RUNNING, active_source = NONE. Stop.
2  hw_fresh    = last_hw_valid_at is within 60 s of now
3  phone_fresh = last_phone_valid_at is within 60 s of now
4  cooldown_ok = last automatic switch was more than 30 s ago
5  Apply the rule for the mode:
     MANUAL_HW:    active = HW. If not hw_fresh, state = STALE.
     MANUAL_PHONE: active = PHONE. If not phone_fresh, state = STALE.
     AUTO:
       active = HW  and not hw_fresh and phone_fresh and cooldown_ok    -> 
switch to PHONE, reason HW_STALE
       active = PHONE and consecutive_hw_valid >= 3 and cooldown_ok    -> 
switch to HW, reason HW_RECOVERED
       active = PHONE and not phone_fresh and hw_fresh and cooldown_ok -> 
switch to HW, reason PHONE_LOST
       active = NONE and hw_fresh                                       -> 
switch to HW, reason INITIAL
       active = NONE and phone_fresh                                    -> 
switch to PHONE, reason PHONE_FALLBACK
6  If neither source is fresh:
       state = STALE.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 44 of 118


<!-- PAGE 45 -->

       If neither source has been fresh for 120 s: state = UNAVAILABLE, raise 
one alert.
7  Otherwise: state = LIVE, with the active source.
8  Write bus_state with version + 1. If the active source changed, insert 
source_switches.
consecutive_hw_valid counts valid hardware fixes in a row. Any invalid sample resets it.
Returning to HW needs three valid fixes within 30 seconds.
9.4 Transitions
Manual changes ignore the cooldown. A manual change to a source that is not fresh
leaves the bus in STALE until that source recovers.
From
To
Trigger
Reason code
Driver sees
Coordinator
sees
NONE
HW
First valid
hardware fix after
shift start
INITIAL
Live, bus
tracker
Logged
NONE
PHONE
Hardware not
fresh, phone
fresh
PHONE_FALLBACK
Banner: using
your phone's
GPS
Alert
HW
PHONE
Hardware stale
for more than 60
s, phone fresh,
cooldown passed
HW_STALE
Banner
Alert within
30 s
PHONE
HW
Three valid
hardware fixes
within 30 s,
cooldown passed
HW_RECOVERED
Banner: bus
tracker is back
Logged
PHONE
HW
Phone not fresh,
hardware fresh
PHONE_LOST
Banner
Logged
Any
MANUAL_HW
Mode change by
driver or
coordinator
DRIVER_MODE or
ADMIN_OVERRIDE
Confirmation
Logged with
actor
Any
MANUAL_PHONE
Mode change by
driver or
coordinator
DRIVER_MODE or
ADMIN_OVERRIDE
Confirmation
Logged with
actor
Any
NONE
Shift ends
SHIFT_ENDED
Shift summary
Logged
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 45 of 118


<!-- PAGE 46 -->

9.5 Anti-flapping
Automatic switches are at least 30 seconds apart (selector.cooldown_s).
Returning to HW needs three valid fixes within 30 seconds (selector.return_fixes,
selector.return_window_s).
More than 6 switches in 600 seconds: hold the current source for 300 seconds and
raise a technician alert (selector.flap_limit, selector.flap_hold_s).
Every switch is written to source_switches with its reason code.
9.6 Modes and who can change them
AUTO is the default for each new shift, unless the coordinator set a different default
for that bus.
The driver changes the mode from the driver screen, with a confirmation sheet and an
optional note of up to 140 characters.
The coordinator can override the mode from the console, with a required reason.
Each change is logged with actor, reason, and time.
9.7 Phone cadence
Standby: while HW is active, the phone sends every 30 seconds
(phone.standby_interval_s).
Fallback: while PHONE is active, the phone sends every 10 seconds
(phone.fallback_interval_s).
The server states the interval in every driver response (phone_interval_s). The app
follows the server.
9.8 Idle detection and auto-end
Idle means speed below 3 km/h (shift.idle_speed_kmh). The bus is idle if the active
source reports it, and ignition is OFF when a hardware tracker is present.
After 20 minutes of idle (shift.idle_min), the driver receives a prompt: Are you still on
duty?
If the driver does not respond within 10 minutes (shift.idle_grace_min), the shift ends
with end_reason AUTO_IDLE.
A shift open for more than 14 hours (shift.timeout_h) ends with TIMEOUT, and a
coordinator alert is raised.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 46 of 118


<!-- PAGE 47 -->

9.9 Stop arrival and departure
ARRIVED: the bus is inside the stop radius (stop.radius_m, default 50 m) and speed is
below 5 km/h (stop.arrival_speed_kmh) continuously for 15 seconds
(stop.arrival_dwell_s).
DEPARTED: the bus is outside the radius for 10 seconds (stop.departure_dwell_s), or
speed is above 10 km/h (stop.departure_speed_kmh) after an arrival.
A manual arrival (driver tap) overrides detection for that stop only. It is stored with
method MANUAL.
Stops are checked in route order. If the bus departs a stop without an arrival, a
DEPARTED event is stored with method AUTO and no ARRIVED event. The driver sees
the stop as skipped.
Each event is stored in stop_events.
9.10 Pre-trip checks
The driver app runs these checks before the Start button is enabled. The server records
the results.
Check
Blocks start
Rule
Driver is rostered for the chosen
bus
Yes
Only rostered buses are listed
Trip type chosen
Yes
Pre-selected from the timetable
Hardware status
No (warning)
GREEN: heartbeat within 2
minutes and gps_status
FIX_VALID. AMBER: heartbeat
within 2 minutes, no fix. RED: no
heartbeat within 2 minutes
Phone location permission
Always (Android background
permission; iOS Always)
Yes
Fix screen shows the steps for
this phone
Notification permission
Yes
SOS depends on it
Battery optimisation exempt
(Android)
No (warning)
Opens the system setting
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 47 of 118


<!-- PAGE 48 -->

9.11 ETA
1. Let L be the route geometry of the trip's pinned version. Let f(p) be the fraction of the
line at which the bus position p projects: ST_LineLocatePoint(L, p). Distance along the
route is f(p) multiplied by ST_Length(L, geography).
2. For each remaining stop s: d(s) = (f(s) - f(p)) multiplied by the route length, in metres.
If d(s) is negative, the stop has been passed.
3. Speed estimate v: the median of moving speeds (above 3 km/h) over the last 5 minutes
(eta.speed_window_min). Clamp v to the range 10 to 60 km/h (eta.speed_min_kmh,
eta.speed_max_kmh). If there is no moving sample, use 20 km/h
(eta.speed_default_kmh).
4. ETA in seconds = d(s) divided by (v divided by 3.6). Round to the nearest minute.
5. Display: under 60 seconds shows Arriving. A passed stop shows Departed.
6. If the bus is more than 300 m from the route line, no ETA is shown and the card says
Off route.
7. Cache the result per (trip, route version, 3-second bucket).
9.12 Bus states
Check
Blocks start
Rule
Phone GPS fix with accuracy 50
m or better within 60 seconds
Yes, unless hardware
is GREEN
Shows the accuracy while
waiting
Network reachable
Yes
One successful driver status
call
State
Condition
Text for students and
faculty
Text for admin
NOT_RUNNING
No ACTIVE shift
Not running. Next trip
at the scheduled time
Not running
LIVE
ACTIVE shift and active
source fresh
Live · bus tracker, or
Live · driver's phone
Source, data
age, mode
STALE
ACTIVE shift, active source
not fresh, but not yet
UNAVAILABLE
Last update N seconds
ago. Grey marker
Stale, with
reason
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 48 of 118


<!-- PAGE 49 -->

NOT_RUNNING is never shown as Offline (R-20). Device health is shown separately (Part
9.13 and the visibility matrix in Part 6.8).
9.13 Device health
9.14 Plausibility and tracker checks
Jump check: distance from the last accepted valid sample of the same device
(ST_Distance on geography) divided by elapsed seconds, times 3.6. Above 150 km/h
(ingest.jump_max_kmh) is implausible. If the gap is more than 30 minutes
(ingest.jump_reset_min), reset the reference point.
Frozen position: speed above 5 km/h claimed for 5 minutes while the position moves
less than 10 metres raises a GPS frozen alert.
Source disagreement: while both sources are fresh and the bus is moving, a distance
above 300 m for more than 10 minutes is logged. A distance above 500 m for 2 minutes
raises a possible tracker swap alert to the technician and coordinator.
State
Condition
Text for students and
faculty
Text for admin
UNAVAILABLE
ACTIVE shift, no fresh
source for 120 seconds
Location unavailable.
Last seen at HH:MM
Alert open
NO_HARDWARE
ACTIVE shift, no device
linked, mode AUTO
Live · driver's phone
Notice: no
hardware
linked
State
Rule
ONLINE
Last heartbeat within twice the expected interval
(60 s while ignition is ON, 600 s while parked)
DELAYED
Older than ONLINE, but within 10 minutes while
ignition is ON or during a shift, and within 24 hours
while parked
OFFLINE
Older than 10 minutes while ignition is ON or during
a shift, or older than 24 hours while parked
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 49 of 118


<!-- PAGE 50 -->

9.15 Trip distance
Trip distance is the sum of distances between consecutive accepted valid samples from
the active source only. Samples from the other source are not counted, so distance is
never counted twice.
Part 10. Features and role workflows
10.1 Roles
A user may hold several roles. The app shows a role switcher when there is more than one.
10.2 Feature inventory
Each feature ID must be built and tested. The specification section gives the full
behaviour. Feature IDs and their specification sections are the coverage contract for
Phase P9.
Code
Role
STU
Student
FAC
Faculty (bus in-charge)
DRV
Driver
SEC
Security staff
COR
Transport coordinator
TEC
Technician
MGT
Management (read-only aggregate)
SAD
Super admin
Group
Features
Spec section
F-AUTH
F-AUTH-01 SSO sign-in; -02 driver email OTP; -03
sessions and refresh rotation; -04 admin MFA; -05
session management; -06 deactivation; -07 no
passwords
8
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 50 of 118


<!-- PAGE 51 -->

Group
Features
Spec section
F-USR
Users, roles, CSV import, deactivation with end
date, profile, data requests
4, 16.4, 29, 36
F-FLT
Buses, document expiry reminders, device
provisioning, device links, token rotation and
revocation, firmware releases and rollouts,
maintenance tickets, unlinked devices
7, 11, 16.4, 16.5, 33
F-RTE
Routes, stops, ordered stops, geometry versions,
timetables, route-bus assignments, holidays
16.4, 17, 36
F-ASG
Driver roster, faculty assignments, student routes,
boarding-stop change
16.4
F-SHF
Pre-trip check, shift start, running rules, end rules,
trip generation, late start, cancellation, trip
summary
15
F-TRK
Live map, snapshot, ETA, stop arrival and
departure, stale and unavailable display
17
F-ATT
QR boarding, manual check-in, statuses, cutoffs,
absence rule, leave, attendance views and exports
18
F-SOS
Triggers, tiers, acknowledgement, responding,
cancellation, resolution, drills, device delay flag
19
F-STP
Stop requests, validation, votes, review, approval,
effective dates
20
F-NTF
Categories, channels, preferences, quiet hours,
rate limits, SMS templates, in-app centre
21
F-ADM
Console pages, settings, feature flags,
announcements, global behaviour
16.6, 24
F-RPT
Reports and exports
23
F-PRV
Consent, notices, data requests, retention, breach
support
29
F-OPS
Operational alerts, jobs, observability, runbooks
22, 25, 31
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 51 of 118


<!-- PAGE 52 -->

10.3 Student workflows
Screens: sign-in, home (buses on my route), bus detail, my route and stops, boarding (QR
scanner), attendance history, leave, stop request, notifications, profile and privacy, help,
SOS.
1. First sign-in: SSO, then match the imported record. Confirm name and department. If
no route is set, show: your route is not set, contact the transport office.
2. Ask for notification permission with a reason. Never ask for location permission.
3. Show the privacy notice and record consent. Under-18 students see the guardian
consent flow before any feature is enabled (Part 14.3).
4. Home lists buses serving my route with a trip scheduled or active today. Bus detail
shows the source label, data age, speed, next stop, ETA to my stop, and remaining
stops.
5. Approaching alert: sent once per trip when the ETA to my stop is at or below my
threshold (default 5 minutes, range 2 to 15). Not sent if I am on leave or already
boarded.
6. Board the bus: scan the QR code shown by the driver. On success show: Boarded Bus
07 at 07:42.
7. Boarding failures show a specific message: QR expired, scan the current code; this bus
is not on your route today; you are already boarded; boarding window closed, ask the
driver to check you in; no connection, ask the driver to check you in.
8. Attendance history: one row per date, with morning and afternoon status.
9. Mark leave for one or more dates and trip types, until 30 minutes before scheduled
departure.
10. Request a stop (Part 11.7). Use SOS (Part 11.1): hold for 2 seconds.
11. Notification preferences (Part 11.4).
12. Profile: view name, department, and route. Request a correction, an export, or deletion.
View consent history. List and end sessions. Sign out.
13. Offline: last known positions stay visible for up to 10 minutes, marked offline. Boarding
needs a connection and is never queued. SOS retries every 10 seconds. If there is no
data connection, show the security office number from configuration.
Acceptance criteria:
AC-STU-01: with an active trip on my route, the bus appears within 3 seconds at the
95th percentile, with its source label.
AC-STU-02: a bus that does not serve my route returns 404 and is not listed.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 52 of 118


<!-- PAGE 53 -->

AC-STU-03: a valid QR inside the window creates one boarding record. A second scan
returns DUPLICATE_BOARDING with the original time.
AC-STU-04: after the window closes, a scan returns BOARDING_WINDOW_CLOSED. A
driver check-in with reason LATE records LATE_BOARDED.
AC-STU-05: no student response contains location data for any other person.
10.4 Faculty workflows
Screens: my buses, bus detail, today's attendance (morning and afternoon), alerts, SOS
console, leave list, reports for my buses, settings, help.
1. See assigned buses. The primary faculty member for each bus is marked.
2. Monitor a trip: position, next stop, ETA to each remaining stop in order, and boardings
so far against expected passengers.
3. Respond to an absence alert: open the student's attendance, add a note, and
acknowledge.
4. Respond to SOS: acknowledge, add notes, resolve with a note.
5. Mark leave for a student on my bus. The reason is a category only: Personal, Academic,
or Other. No free-text reason is stored.
6. Export attendance for my buses as CSV, for up to 31 days.
7. Call the driver from the bus detail screen.
8. Receive trip notices: started, late start, delay, cancellation, route change.
Acceptance criteria:
AC-FAC-01: a request for a bus I am not assigned to returns 404.
AC-FAC-02: with two assigned buses, both appear, and the bus picker switches the
view without a reload.
AC-FAC-03: an absence condition met at cutoff reaches my app within 5 minutes of
the cutoff.
10.5 Driver workflows
Screens: sign-in (OTP), roster, pre-trip check, live shift, trip summary, report a problem,
settings, help.
1. Sign in with the email OTP. Register this phone (device label stored). Ask for location
and notification permission with the reason shown first.
2. Run the pre-trip check (Part 9.10).
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 53 of 118


<!-- PAGE 54 -->

3. Start the shift (Part 6.7).
4. Drive. The map shows my position, the route line, the next stop, and the ETA. Stop
arrivals are detected (Part 9.9). If detection fails, Mark arrived is available.
5. Boarding: show the QR code, which rotates every 30 seconds with a countdown.
Manual check-in lists expected passengers. A passenger not on the list needs a reason.
6. Mode switch: Auto, Hardware, or Phone, with a confirmation sheet and an optional
note.
7. SOS: hold for 2 seconds, choose Emergency, Medical, Breakdown, or Other, add an
optional message, and send. The screen then shows the incident status.
8. Report a problem: Bus breakdown, Tracker problem, Phone problem, or Other. Free text
up to 500 characters. Creates a ticket.
9. End the shift (Part 9.8).
10. Offline: buffer phone location for up to 24 hours (about 8,640 samples at 10-second
intervals). Show Sending saved location, N points. Buffered samples follow Part 5.2.
11. While a shift runs, show a persistent on-screen indicator and a persistent notification.
12. Settings: permission status, battery optimisation status, phone model, app version,
sign out. Sign-out is blocked during a shift.
Acceptance criteria:
AC-DRV-01: a bus I am not rostered on is not listed. A direct request returns 404.
AC-DRV-02: with hardware RED, the shift can start with a warning, and the phone
becomes the primary source.
AC-DRV-03: without Always location permission, the start is blocked, and the fix
screen shows the steps for this phone.
AC-DRV-04: if the app closes mid-shift and reopens, the same shift resumes within 10
seconds with no duplicate shift.
10.6 Coordinator workflows (web console)
Pages: dashboard, live fleet map, buses, devices, routes and stops, timetables,
assignments, users, stop requests, SOS console, alerts, source log, attendance,
announcements, reports, audit log (read-only), settings (read-only except for SAD).
1. Create a bus with its registration and document expiry dates. Reminders go out 30 and
7 days before each expiry.
2. Link a device to a bus with a valid-from date (Part 6.5).
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 54 of 118


<!-- PAGE 55 -->

3. Create a route: name, code, ordered stops, geometry (drawn on the map or uploaded
as GeoJSON), and assignments for MORNING and AFTERNOON by weekday.
4. Set timetables per route and trip type.
5. Invite drivers by email and roster them on buses. A driver may be rostered on several
buses.
6. Assign faculty to buses. One is marked primary.
7. Import students by CSV (Part 11.8). The dry run shows row results before commit.
8. Review stop requests (Part 11.7).
9. Handle SOS: timeline, notes, responder, resolution, incident export (Part 11.1).
10. Override a mode with a reason.
11. Revoke a device token: type the bus number to confirm (Part 6.4).
12. Deactivate a user with an end date. Assignments close on that date and sessions are
revoked.
13. Publish an announcement to all users, one route, or one bus. Plain text, up to 1,000
characters. Expiry required.
14. Cancel a trip with a reason. Faculty and students on the route are notified.
15. Download reports (Part 11.6).
16. Review the source-switch log by bus and date range.
Acceptance criteria:
AC-COR-01: after a revoke, the device's next request is rejected within 5 seconds, and
a ticket appears on the technician's list.
AC-COR-02: a student CSV with 3 bad rows out of 400 blocks commit until they are
fixed or removed. The report lists the 3 row numbers.
AC-COR-03: a deactivated user disappears from all live views within 60 seconds.
10.7 Technician workflows (web console)
1. Provision a batch: enter device IDs with serial, IMEI, and ICCID (Part 6.2). Show the
one-time token. Print the label with the device_id and its QR.
2. Verify an installation: heartbeat within 2 minutes, valid GNSS fix within 5 minutes
outdoors, first samples within 1 minute. Record the commissioning checklist. The
device becomes Ready to link only after sign-off.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 55 of 118


<!-- PAGE 56 -->

3. Replace a device: choose the bus, the old device (retire or revoke, with reason), and
the new device. The new link starts at the same timestamp. History stays attached to
the old device.
4. Investigate a delayed or offline device: last heartbeat, last valid fix, battery, signal, SIM
status, buffer use, last ten events.
5. Roll out firmware: register the release (version, SHA-256, size). Steps: canary of 5
buses, then 25 percent, then the full fleet. The rollout pauses automatically on
FIRMWARE_FAILED above 2 percent, or on any device going OFFLINE within 30
minutes of its update.
6. Work tickets. Assign, note, and close with a resolution note. Tickets older than 48 hours
escalate to the coordinator.
7. Bench devices are excluded from fleet views, alerts, and reports.
Acceptance criteria:
AC-TEC-01: a provisioned device connects after flashing, and its first heartbeat arrives
within 2 minutes of power-up.
AC-TEC-02: after a replacement, the old device's history stays visible, and no sample is
ever attached to the wrong device.
10.8 Super admin workflows
All coordinator functions, plus: roles, college SSO and MFA policy, thresholds and feature
flags (each change needs a reason), notification templates and DLT IDs, backup and
restore status, the audit log, and the emergency access procedure (RB-13).
Rules: at least two super admin accounts must exist. The system blocks removing a super
admin when only one other remains. A super admin cannot disable MFA on their own
account.
10.9 Security staff workflows
Live map of all active buses (read-only), with source labels and states. Receive SOS,
acknowledge, mark responding, resolve with a note. Incident history for any bus and date.
No editing of buses, routes, users, or attendance. Every view and action is logged.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 56 of 118


<!-- PAGE 57 -->

10.10 Management workflows
Dashboards: on-time performance (trip starts against schedule), trips completed, SOS
count by week, device uptime summary, attendance by route as counts and percentages.
Aggregate only. Management cannot see individual location history, individual attendance
records, or individual SOS details beyond date, bus, and resolution status.
Part 11. Algorithms and rules for the feature groups
11.1 SOS: create, join, escalate, cancel, resolve
Create or join:
1. Work out the bus. For a device trigger, use the device link valid at the device's
triggered_at (fall back to received_at). For an app trigger, use the bus in the sender's
scope: the shift's bus for a driver, the bus shown on screen for faculty (which must be
in scope), and the active trip on the student's route if there is one. Security may send
with no bus.
2. Start a transaction and take a transaction-scoped advisory lock keyed on the bus
(pg_advisory_xact_lock on a hash of the bus_id). When there is no bus, lock on the
sender.
3. If an OPEN incident exists for this bus with received_at within the last 60 seconds
(sos.dedupe_s), add a JOINED event to it. Otherwise create a new incident and add a
TRIGGERED event.
4. Store device_triggered_at. If received_at minus device_triggered_at is more than 60
seconds (sos.device_delay_flag_s), set the incident flag DEVICE_DELAYED.
5. Write outbox rows for tier 0 recipients. The recipients are resolved when the outbox
row is processed, not when it is written.
6. Return incident_id. Two different buses always produce two incidents, even at the
same moment.
Escalation (the sos-escalator job runs every 15 seconds):
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 57 of 118


<!-- PAGE 58 -->

Escalation stops for the incident when any FAC, SEC, COR, or SAD user marks it
RESPONDING.
Acknowledgement by one recipient stops only that recipient's reminders.
If a tier has no configured recipients, the system raises a setup alert. It never uses
placeholder contacts.
The MVP sends no automatic voice calls. Tier 3 needs a person to call the list.
Telephony is a later feature.
Cancel: the user who triggered the incident can cancel within 30 seconds
(sos.cancel_window_s), with a reason (Accidental press, Resolved before sending,
Other). After any acknowledgement, only a coordinator can cancel. The status becomes
CANCELLED, all recipients are told, and the event is logged.
Resolve: a responder (FAC, SEC, COR, or SAD) marks the incident RESOLVED with a note
of up to 500 characters. The note is required. All recipients are notified.
Drill: a coordinator starts a drill (is_drill true). Recipients see a TEST label. Drills never
escalate beyond tier 0. Drill records are kept for one year.
Acceptance criteria:
AC-SOS-01: an SOS from the driver app creates the incident within 1 second, and tier 0
push is sent within 5 seconds at the 95th percentile.
Tier
Starts
Recipients
Channels
0
At trigger
Faculty assigned to the bus,
security staff on duty,
coordinators on the duty list,
and the sender
(confirmation)
Push (high priority), in-
app alert with sound
1
2 minutes without
acknowledgement
All coordinators and the bus
escalation contacts
Push, SMS (DLT
template), in-app
2
5 minutes without
acknowledgement
Super admins, the security
office number, and the
emergency desk email
Push, SMS, email
3
10 minutes without
acknowledgement
The emergency contact list,
repeated every 5 minutes
until resolved
SMS, push
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 58 of 118


<!-- PAGE 59 -->

AC-SOS-02: two triggers from the same bus 20 seconds apart produce one incident
with two trigger events.
AC-SOS-03: two buses triggering in the same second produce two incidents.
AC-SOS-04: with no acknowledgement for 2 minutes, tier 1 starts, and coordinators
receive push and SMS.
AC-SOS-05: after a faculty member acknowledges, the trigger user's cancellation is
refused with a message that a coordinator must cancel.
11.2 Boarding QR and scan validation
Token format: v1.<key_version>.<base64url payload>.<base64url signature>. The payload
is bus_id, trip_id, and slot, separated by pipes. The slot is floor(unix seconds divided by
30) (qr.rotation_s). The signature is HMAC-SHA256 over the payload, using the key named
by key_version from QR_HMAC_KEYS.
Generation: the server generates the token for each request from GET /trips/{id}/qr. It
only does so while the trip and shift are ACTIVE. Tokens are not stored.
Keys rotate monthly. The previous key stays valid for 7 days after rotation.
Validation order for POST /attendance/scan. The first failure returns its code and writes
nothing:
1. Session valid (AUTH_REQUIRED).
2. Token parses, the key version exists, and the HMAC matches in constant time
(QR_INVALID).
3. Slot is the current slot or the previous one (QR_EXPIRED).
4. Trip is ACTIVE and the bus in the token matches the trip's bus (TRIP_NOT_ACTIVE).
5. The student is expected on this trip: on the route for this trip type and date, and not on
leave (NOT_ON_ROUTE).
6. No BOARDED or LATE_BOARDED record exists for this trip and student
(DUPLICATE_BOARDING). The unique index is the final guard.
7. The boarding window is open (BOARDING_WINDOW_CLOSED otherwise). The
window opens 10 minutes before scheduled departure and closes 15 minutes after it
(boarding.window_before_min, boarding.window_after_min).
8. Insert the record with status BOARDED, method QR, and the student's boarding stop.
Return the bus number and time.
Rate limit: 10 scans per minute per user.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 59 of 118


<!-- PAGE 60 -->

11.3 Morning-present, afternoon-absent rule
Candidates: students with a MORNING record that is BOARDED, LATE_BOARDED, or
BOARDED_LATE, and an AFTERNOON record on the same service date.
Trigger: the afternoon boarding cutoff has passed (scheduled departure plus 15
minutes).
Condition: the afternoon status is ABSENT. A student with ON_LEAVE is never alerted.
Action: insert into absence_alerts with a unique (student_id, service_date). A conflict
means already alerted, so do nothing. Notify the primary faculty for the afternoon bus,
then any assigned faculty, then the coordinators.
Late boarding: when a BOARDED record is later created for an afternoon trip that has
an OPEN alert, set the alert to BOARDED_LATE and notify the faculty.
The job runs at each afternoon cutoff, and every 5 minutes as a safety net. Repeated
runs change nothing.
11.4 Notification dispatch
Channels and categories: Part 14 and the table in the specification section 21.1.
Retry schedule: 1 minute, 5 minutes, 30 minutes, 2 hours. After 6 attempts the delivery
becomes DEAD and an alert is raised.
Quiet hours: 22:00 to 06:00 IST (notify.quiet_start, notify.quiet_end). During quiet
hours, non-safety push is SUPPRESSED. The in-app copy remains.
Rate limit: at most 6 non-safety pushes per user per hour (notify.push_per_hour). Over
the limit, the push is SUPPRESSED and the in-app copy remains.
Grouping: same category within 120 seconds (notify.group_window_s) becomes one
message with a count.
SAFETY notifications ignore quiet hours and rate limits. They are never suppressed by
preferences.
Preferences are checked at dispatch time, not when the notification is written.
SMS: the rendered text must match an approved DLT template exactly. A mismatch
blocks the send and raises an alert. SMS never contains coordinates.
Email: non-safety email has an unsubscribe link that changes that category's
preference. Safety email has none.
Provider callbacks (SMS delivery reports, SES bounces and complaints) update the
delivery status. They are accepted only after signature verification (Part 13.19).
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 60 of 118


<!-- PAGE 61 -->

Dead-letter entries keep the template and category, and never the message body with
personal data.
11.5 Operational alerts
Severity 1: service or safety impact now, pages on-call at any hour. Severity 2: degraded,
response within one hour in service hours. Severity 3: fix by the next working day.
Alert
Condition
Severity
Recipients
Fleet silence
More than 20 percent of buses on
active shifts with no valid data for
3 minutes
1
Technician,
coordinator, on-
call
Bus unavailable
Active shift, no fresh source for 2
minutes
2
Coordinator,
faculty
Device offline
OFFLINE health (Part 9.13)
3, or 2
during a
shift
Technician
Source flapping
More than 6 switches in 10
minutes
3
Technician
Authentication
failures
More than 50 failed
authentications in 5 minutes for
one device
2
Security reviewer,
technician
Rejection spike
More than 20 percent of one
device's samples rejected in 10
minutes
3
Technician
GPS frozen
Part 9.14
3
Technician
Low vehicle
battery
LOW_VEHICLE_BATTERY event
3
Technician,
coordinator
Certificate expiry
Under 30 days (2), under 7 days (1)
1 or 2
Technician, on-call
API errors
5xx rate above 1 percent for 5
minutes
1
On-call
Database failover
Failover event
2
On-call
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 61 of 118


<!-- PAGE 62 -->

11.6 Reports and exports
Reports: attendance by trip, absence alerts, trip history, source usage, device uptime, SOS
incidents, stop requests, users by role, audit log, and data requests. Columns are limited
by role (Part 10 and Part 6.8).
Export pipeline:
1. The request creates an export_jobs row with status QUEUED and the filters. It is
written to the audit log.
2. The worker streams the rows to CSV in S3, with server-side encryption. It applies the
formula-injection rule (Part 13.16) to every cell.
3. Row limit 100,000 per export. Larger requests are split by date range, and the user is
told which ranges are included.
4. On completion the status becomes READY, row_count is stored, and a presigned
download link valid for 24 hours is issued on request.
5. The file is deleted after 7 days. The status becomes EXPIRED.
6. Each download is audited.
11.7 Stop requests
Submission:
Alert
Condition
Severity
Recipients
SOS not
delivered
Incident with zero delivered
recipients after 60 seconds
1
On-call,
coordinator
Backup stale
Last successful backup older than
25 hours
2
On-call
Job backlog
Queue depth above 1,000, or
oldest job older than 2 minutes
2
On-call
Document expiry
Bus document expires in 30 or 7
days
3
Coordinator
Unlinked device
Device sends data for more than
24 hours with no link
3
Coordinator
Setup incomplete
An SOS tier has no configured
recipients
2
Super admin
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 62 of 118


<!-- PAGE 63 -->

1. The pin must be within 300 metres of the route geometry: ST_DWithin(route line, pin,
300) (route.corridor_m). Otherwise REJECT_OUTSIDE_ROUTE.
2. Within 100 metres of an approved active stop on this route (stop.duplicate_m): reject
and name the existing stop. Nothing is created.
3. Within 100 metres of a PENDING request on this route: record the student as a vote on
that request.
4. One new request per student per 7 days (stop_request.limit_days).
5. Otherwise create the request with status PENDING.
Review: the coordinator sees the pin on the route map, the name, the vote count, and the
distance from the route line. Approve: edit name and pin, choose the sequence position
among existing stops, set effective_from (default next service day). Reject: reason
required. Merge: move votes into another pending request.
On approval: create the stop, insert it into route_stops at the chosen sequence from
effective_from, and bump the route version. Notify the requester and route students
(category ADMIN).
Rules: a request never changes an existing stop. Deactivating a stop has an effective date.
Students whose boarding stop is that stop are notified to choose a new one. If they do not
choose, the coordinator's default applies.
11.8 CSV import pipeline (users and fleet)
1. The console requests a presigned upload to the private import bucket. The policy limits
the size to 5 MB and the content type to text/csv.
2. The server reads the object, checks the first kilobyte is valid UTF-8 with no NUL bytes,
and checks the header row exactly.
3. Every row is validated with Zod. Rows starting with =, +, -, or @, or with a tab or carriage
return, are rejected. Duplicate keys in the file fail every row that repeats them. Limit
10,000 rows.
4. Each row is compared with existing records. Creates and updates are listed separately,
with old and new values for updates.
5. The dry run is stored with its result. Commit is allowed only when every row passes,
unless the coordinator chooses to commit passing rows only (default off).
6. Commit runs in one transaction per batch of 500 rows, writes an audit row per
changed record, and deletes the uploaded object after commit or after 24 hours.
Columns and rules for each file are in the specification section 36.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 63 of 118


<!-- PAGE 64 -->

11.9 Leave
Students can mark leave until 30 minutes before scheduled departure
(leave.cutoff_before_trip_min). Faculty can mark leave for their bus until the boarding
cutoff.
Leave sets the expected record to ON_LEAVE immediately.
Cancelling leave is allowed until the cutoff. It reverts the record to EXPECTED only if
no boarding has occurred.
Leave stores a category only: Personal, Academic, or Other.
Part 12. Admin console and scheduled jobs
12.1 Global behaviour
Top bar: role switcher, search across buses, routes, users, and devices, notifications,
sign out.
Status strip on every page: live buses, stale, unavailable, and open SOS incidents. An
open SOS is red and cannot be dismissed.
Idle timeout: 30 minutes for COR, TEC, MGT, and SAD, with a warning at 25 minutes. 15
minutes for SEC.
Destructive actions need confirmation and a reason. Unsaved changes warn before
navigation.
Every list page has loading, empty, and error states. The error state has a retry action.
Keyboard navigation and labels on every control (Part 15.6).
Admin pages are hidden from anyone without the role (Part 13.14).
12.2 Pages
Dashboard, live map, buses, devices, routes, stops, timetables, assignments (roster,
faculty, student routes), users, import, stop requests, SOS, alerts, source log, attendance,
announcements, reports, audit log, settings (SAD editable), feature flags (SAD).
12.3 Scheduled and background jobs
All jobs are idempotent. Failures retry with backoff. After 6 attempts a job is dead-lettered
and an alert is raised (Part 11.5).
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 64 of 118


<!-- PAGE 65 -->

Job
Schedule
Purpose
source-selector
Every 5 seconds per active bus,
and on each accepted sample
Source selection (Part 9.3)
stale-checker
Every 30 seconds
Stale, unavailable, and device
health states
shift-auto-end
Every 60 seconds
Idle prompts and auto-end (Part
9.8)
trip-generator
Daily at 00:30 IST
Creates trips for the next 7 days,
skipping holidays
late-start-check
Every 60 seconds in service
hours
TRIP_LATE_START, then
coordinator notice after 20
minutes
attendance-
expected-builder
On trip start
Creates EXPECTED rows, unique
per trip and student
boarding-cutoff
Every minute
Sets ABSENT after the cutoff
absence-evaluator
At each afternoon cutoff, and
every 5 minutes
Part 11.3
sos-escalator
Every 15 seconds
Escalation tiers (Part 11.1). Must
not skip. Alerts if its lag exceeds
30 seconds
notification-
dispatcher
Continuous
Sends queued notifications (Part
11.4)
device-health-
checker
Every minute
ONLINE, DELAYED, OFFLINE
(Part 9.13)
cert-and-token-
check
Daily
Certificate and device token
expiry
retention-purger
Daily at 02:00
Drops old partitions and applies
retention (Part 14.2)
partition-manager
Daily
Creates partitions seven days
ahead
export-generator
On request
Part 11.6
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 65 of 118


<!-- PAGE 66 -->

Part 13. Security hardening (mandatory)
Each item below has an Implement section and a Verify section. Both are required. Items
13.1 to 13.19 are the security checklist for the vibe-coded SaaS risks. Items 13.20 to 13.30
are the additional controls this system needs. Antigravity must not mark a phase done
until the Verify steps for its items pass, and the results are in the phase report.
13.1 Row-level security
Implement: as in Part 7.11. Enable and force row-level security on the listed tables. Run
the application as app_runtime, which is not the owner and has no BYPASSRLS. Set
app.user_id, app.roles, app.bus_ids, and app.route_ids inside every request
transaction. Policies fail closed: with no values set, they return no rows.
Verify: a test where student A's session cannot read student B's attendance, using
both the API and a raw query through app_runtime. A test where the request
transaction omits the session values returns zero rows. A test confirms app_runtime
cannot disable RLS.
13.2 Authentication on every API route
Implement: a global guard denies every route by default. Only routes marked @Public()
are reachable without credentials, and each of them is listed in a reviewed allowlist.
Every route declares its roles with @Roles(). Routes that read or write a specific object
also declare a scope check.
Job
Schedule
Purpose
coordinator-
summary
08:00 IST (configurable)
Daily summary: SOS in 24 hours,
absence alerts, delayed or offline
devices, pending stop requests,
late or cancelled trips, documents
expiring in 30 days
backup-verifier
Daily
Checks backup freshness and
runs a sample restore
rate-counter-
cleanup
Hourly
Removes expired rate counters
and idempotency keys
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 66 of 118


<!-- PAGE 67 -->

Verify: npm run verify:routes-auth generates the route inventory from the application
and fails if any route lacks an explicit auth decision. It runs in CI on every merge. A test
calls every route without credentials and expects 401, except the allowlist.
13.3 Never trust the frontend
Implement: the server derives the caller's scope, bus_id, source, and bus state. Zod
schemas are strict and reject unknown fields. The client never sends role, scope,
received_at, created_at, bus state, or active source. Status changes are checked
against a server-side state machine for SOS, attendance, stop requests, tickets, and
shifts. Hiding a button in the UI is never the control.
Verify: negative tests send each forbidden field, and each illegal state transition, and
expect 400 or 409 with nothing written.
13.4 Rate limiting
Implement: counters in rate_counters, updated with an atomic upsert per fixed
window. Responses are 429 with Retry-After and the RateLimit headers. WAF rate
rules sit in front of the ingest host and the sign-in endpoints. All limits are
configuration values.
Endpoint group
Limit
Key
SSO start and
callback
20 per minute
IP
OTP request
3 per hour
Account. Also 10 per hour per
IP. CAPTCHA after the first
request in an hour
OTP verify
5 attempts per code. Lock the
account for 15 minutes after 10
failures
Account
Device
authentication
failures
20 per 5 minutes
IP. More than 50 per device in
5 minutes raises an alert
Device telemetry
1 per 2 seconds, burst 5
Device
Device heartbeat
1 per 30 seconds, burst 3
Device
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 67 of 118


<!-- PAGE 68 -->

Verify: tests exceed each limit by one request and expect 429 with Retry-After. A test
checks the counters reset after the window.
13.5 Sanitise user input
Implement: normalise text to Unicode NFC, trim it, and reject control characters
(newlines are allowed only in multi-line fields). Enforce maximum lengths: name 100,
stop name 60, announcement title 120, announcement body 1,000, incident note 500,
ticket description 500, change reason 200. Names allow letters, spaces, apostrophes,
hyphens, and periods. Email is citext and validated. Phone numbers are E.164. Notes,
announcements, and tickets are plain text. URLs are not allowed in free-text fields.
SMS variables are checked against allowlisted patterns before rendering.
Output: React renders text only. The lint rule bans dangerouslySetInnerHTML and
innerHTML.
Verify: tests send script tags, control characters, over-length strings, and mixed
Unicode. The stored value and the rendered output are checked.
13.6 Parameterised queries
Implement: Prisma's typed queries for everything. Raw SQL only through Prisma.sql or
tagged templates. ESLint bans $queryRawUnsafe, $executeRawUnsafe, and any string
concatenation into a query call. A Semgrep rule checks the same.
Endpoint group
Limit
Key
Driver locations
1 per 5 seconds, burst 10
Driver session
Driver status
1 per 60 seconds
Driver session
SOS trigger
3 per minute
User
QR scan
10 per minute
User
Admin writes
60 per minute
User
Export requests
5 per hour
User
Import uploads
10 per hour
User
All ingestion
200 per second
(ingest.global_rps)
Service
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 68 of 118


<!-- PAGE 69 -->

Verify: search fields and filters are tested with injection payloads. The payloads must
match nothing and cause no error.
13.7 Lock down CORS
Implement: the allowlist is CORS_ALLOWED_ORIGINS, which contains the admin
console origin only. Credentials are allowed only for allowlisted origins. The wildcard
origin is never used with credentials. The ingest host returns no CORS headers. Native
apps do not use CORS.
Verify: a request from a foreign origin gets no Access-Control-Allow-Origin header. A
preflight from the admin origin succeeds.
13.8 HTTPS everywhere
Implement: the ALB HTTP listener returns 301 to HTTPS. A TLS security policy with TLS
1.2 as the minimum. HSTS on every response from the API and admin hosts. Session
cookies are Secure. The ingest host accepts HTTPS only. Android network security
config sets cleartextTrafficPermitted to false. iOS App Transport Security stays on.
Devices verify certificates, and verification cannot be turned off in production.
Verify: a test follows the HTTP redirect. A TLS scan runs in CI against staging. Cleartext
requests from the apps fail.
13.9 Stop IDOR bugs
Implement: identifiers are UUID v4. Every object fetch goes through a repository
method that takes the caller's context and applies the scope. Out-of-scope objects
return 404 NOT_FOUND, so the response never reveals that the object exists.
Verify: an IDOR suite generates, for every route with an identifier parameter, a request
by a user who does not own the object, for each role. Every such request must return
404, or 403 where the matrix says the role may see the route but not the object. The
suite must cover all identifier routes, and a route missing from it fails CI.
13.10 Debug mode off in production
Implement: NODE_ENV is production in deployed environments. Startup refuses to
run if any debug flag is set in production. Stack traces never appear in responses.
OpenAPI UI is disabled in production, and the OpenAPI JSON is served only in dev and
staging behind authentication. Source maps are uploaded to Sentry and never
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 69 of 118


<!-- PAGE 70 -->

published. X-Powered-By is removed. There are no /debug, /test, or /dev routes, which
the route inventory check confirms. Expo release builds disable the developer menu.
The admin console is built in production mode without developer tools.
Verify: a production build scan finds no debug strings, and a request to a deliberately
bad route returns the generic error envelope.
13.11 CAPTCHA on public forms
Implement: Cloudflare Turnstile protects the OTP request after the first request in an
hour, and any form reachable without signing in (for example, a help request, if added).
The server verifies the token with the secret and checks the hostname and action (RS-
08). A verification error denies the request, and the user is asked to retry. The client-
side widget is never the only check.
Verify: a missing or invalid token returns 403 CAPTCHA_REQUIRED. A valid token from
a different hostname is rejected.
13.12 Log admin actions
Implement: an audit interceptor records every write on every route used by COR, SAD,
or TEC, and every read of location history, export downloads, and SOS details by roles
other than responders. Each record holds actor, role, action, entity type and id, before
and after values (for writes), IP, user agent, and request id. The audit table is append-
only through grants and a trigger (Part 7.10). The audit log viewer is read-only.
Verify: a test lists every write route and checks that each one writes an audit row. A
test confirms that an update or delete on audit_logs is rejected.
13.13 Private storage buckets
Implement: all four Block Public Access settings are on for every bucket. Bucket
policies deny requests that are not TLS and deny unencrypted uploads. Objects use
SSE-KMS. Object keys are server-generated UUIDs. Downloads use presigned GET
links valid for 24 hours. Import uploads use presigned PUT links with a size limit and a
content type. Lifecycle rules delete exports after 7 days and imports after 1 day.
Access logging is on.
Verify: Terraform policy checks in CI (for example tfsec or Checkov). A test confirms
that an anonymous GET on an export object fails.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 70 of 118


<!-- PAGE 71 -->

13.14 Hide admin pages properly
Implement: the admin console runs on its own host. Admin modules are code-split and
loaded only for matching roles. Route guards show a not-found page for other roles.
Navigation is built from the caller's roles, not hidden with CSS. Admin-only API
resources return 404 NOT_FOUND to users without the role, so their existence is not
revealed. The mobile app contains no admin routes, strings, or links.
Verify: each admin endpoint returns 404 to a user without the role. A bundle scan
confirms the student and driver app bundles contain no admin module.
13.15 Update vulnerable packages
Implement: Renovate opens grouped update pull requests weekly. pnpm audit --prod --
audit-level=high blocks the merge. Critical findings are patched within 7 days and high
findings within 30 days. Base container images are pinned by digest and rebuilt weekly.
Expo SDK and native dependencies are updated per release, with device tests. The
lockfile is committed. Any package that is no longer maintained needs a recorded
exception.
Verify: the audit step fails on a planted high-severity dependency in a test branch, then
passes after the removal.
13.16 Check file upload types
Implement: CSV only for MVP imports. The presigned PUT sets the content type and
size limit. The server checks the extension and the content: valid UTF-8, no NUL bytes,
the exact header row, the size, and the row count. Formula-injection cells are rejected
(Part 11.8). File names are generated as UUIDs on the server, and the original name is
stored as text only, never used as a path. Parsing is streaming with a memory limit.
Uploaded objects are deleted after processing.
Future uploads (photos or documents, phase 2): require a new review, a MIME allowlist,
a magic-byte check, a malware scan hook, and removal of image metadata.
Verify: a renamed binary file, a file with a formula cell, a file over the size limit, and a file
with a wrong content type are all rejected, with no partial import.
13.17 Code security review
Implement: the pull request template includes a security checklist: authentication,
authorisation, input validation, output encoding, secrets, logs, migrations, and
dependencies. CODEOWNERS requires a security owner to review changes to
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 71 of 118


<!-- PAGE 72 -->

authentication, ingestion, row-level security policies, migrations, and infrastructure.
Semgrep rules cover: unsafe raw queries, dangerouslySetInnerHTML, eval, logging of
tokens, tokens in web storage, and fetch calls without a timeout. CodeQL and gitleaks
run in CI, and gitleaks runs as a pre-commit hook. A STRIDE threat model per
component is written in docs/security and reviewed before P8.
Verify: the Semgrep and CodeQL runs pass on the main branch. A planted violation in a
test branch is caught.
13.18 Security headers
API responses: Content-Security-Policy default-src none; frame-ancestors none. X-
Content-Type-Options nosniff. X-Frame-Options DENY. Referrer-Policy strict-origin-
when-cross-origin. Strict-Transport-Security max-age 31536000 with
includeSubDomains. Cross-Origin-Resource-Policy same-origin. Permissions-Policy
with geolocation, camera, and microphone set to empty. Cache-Control no-store on
authenticated routes. X-Powered-By removed.
Admin console (CloudFront response headers policy): default-src self; script-src self;
style-src self (no inline styles unless hashed); img-src self, data, and the map tile host;
connect-src self, the API host, and the map tile host; object-src none; base-uri self;
form-action self; frame-ancestors none. Plus the same HSTS, nosniff, Referrer-Policy,
and X-Frame-Options values.
Verify: an automated test reads the headers from each host and compares them with
the expected values.
13.19 Verify webhook signatures
Inventory: SNS messages for SES bounces and complaints, SMS provider delivery
reports, and any future provider.
SNS: validate the message signature using the signing certificate, hosted on an
allowlisted AWS domain (RS-07). Check the TopicArn against
SNS_EMAIL_TOPIC_ARNS. Reject messages older than 15 minutes. Confirm
subscriptions only for allowlisted topics. Deduplicate by MessageId.
SMS callbacks: compute HMAC-SHA256 over the timestamp and the raw body with
SMS_CALLBACK_SECRET, in the format given by the provider (RS-06). Compare in
constant time. Reject timestamps more than 300 seconds from server time.
Deduplicate by provider message id and status. Respond with 200 quickly, then
process through the outbox.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 72 of 118


<!-- PAGE 73 -->

Verify: tests for an invalid signature, an expired timestamp, a replayed message, an
unknown topic, and a duplicate event. Each must fail safely, with nothing written
except the rejection log.
13.20 Authentication and sessions
OIDC uses PKCE, state, and nonce. The email domain is restricted using the hosted-
domain or tenant claim (RS-09). Post-login redirects must match
SSO_ALLOWED_RETURN_URLS.
Access tokens last 15 minutes and are signed with an asymmetric key (for example
EdDSA or RS256, through jose). Refresh tokens are opaque and last 30 days for
students and staff, or 12 hours for drivers. They rotate on every use. Reuse of an old
refresh token revokes the whole family.
OTP codes are stored as HMAC, are single-use, and expire after 10 minutes. Error
messages never reveal whether an account exists.
TOTP uses 30-second steps with a window of one step either side. Recovery codes are
hashed with argon2id, and 10 are shown once.
Verify: tests for PKCE and state mismatch, a redirect to a non-allowlisted URL, refresh
reuse, a revoked session, and generic errors.
13.21 Device security
Per-device tokens, stored as HMAC values, revocable, compared in constant time, and
rate-limited (Part 6.3).
Device credentials are accepted only on the ingest host, and only on the device routes.
Device tokens cannot call any other route.
Firmware images are signed (Part 17 of the hardware specification).
Keys are versioned. No key is shared between devices.
Verify: a device token presented to an API host route returns 401. A revoked token is
rejected.
13.22 Mobile app security
Tokens live only in platform secure storage (expo-secure-store). Tokens never appear
in logs, analytics, crash reports, or notifications.
Certificate verification is on. Cleartext traffic is off (13.8).
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 73 of 118


<!-- PAGE 74 -->

Background location runs only during an active shift, with the on-screen indicator (Part
10.5).
Push payloads carry only what is needed: for SOS, the bus number and the category.
No names, phone numbers, or coordinates.
Deep links are validated against an allowlist of routes.
Phase 2: root and jailbreak detection, and certificate pinning (Part 18.3).
Verify: a scan of the built app for stored secrets, a check that push payloads contain
only the allowed fields, and a test that deep links to unknown routes are ignored.
13.23 Secrets and keys
Secrets are held in AWS Secrets Manager and loaded at startup. They are never
committed. .env files are git-ignored. gitleaks runs in CI.
Keys are versioned (DEVICE_TOKEN_HMAC_KEYS, QR_HMAC_KEYS,
OTP_HMAC_KEY). Rotation every 90 days, with the previous key still accepted during
the overlap window.
Each environment has its own keys. Startup refuses known placeholder values.
Verify: a test starts the service with a placeholder value and expects a refusal.
13.24 Data protection in transit and at rest
TLS everywhere (13.8). Encryption at rest with KMS for RDS, S3, backups, and the
Fargate ephemeral storage.
Field-level encryption, with an application-level key, for date_of_birth,
guardian_contact, and TOTP secrets. The key is held in KMS and is used through
envelope encryption.
Verify: the database has no plaintext values in those columns (a test reads the raw
column).
13.25 Business logic abuse and race conditions
Unique constraints: attendance (trip, student), leave (student, date, trip type), device
links, rosters, faculty primaries, active shifts per bus and per driver, absence alerts
(student, date).
Locks: an advisory lock per bus for SOS; SELECT FOR UPDATE on bus and device rows
when links change; versioned writes on bus_state.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 74 of 118


<!-- PAGE 75 -->

Idempotency keys on every app and console write (Part 8.1). Outbox uniqueness
prevents duplicate notifications.
Abuse limits: stop-request spam (Part 11.7), SOS floods (dedupe and rate limit),
attendance replay (QR slot window and single record).
Verify: concurrent tests. Two parallel scans must create one record. Two parallel shift
starts on the same bus must create one shift. Two parallel SOS triggers must create
one incident.
13.26 Log hygiene and personal data
Logger redaction for authorization, cookie, token, password, otp, phone, and email
fields. Coordinates are not logged except in the sample store.
No request bodies are logged on sensitive routes.
Sentry scrubbing is enabled.
Logs are kept 30 days, and access to logs is role-based.
Verify: a test sends a request with sensitive values and confirms none appear in the log
output.
13.27 Infrastructure and IAM
Least-privilege IAM for each service. No wildcard actions in production policies.
Private subnets for tasks and the database. The database is not publicly reachable.
Security groups allow only required ports.
AWS managed WAF rule sets (common rules, known bad inputs, IP reputation) on both
public hosts.
CloudTrail is on in every account with log file validation. AWS Config or an equivalent
check runs.
The root account has a hardware MFA key. A break-glass role requires approval and is
logged (RB-13).
Verify: a Terraform plan review in CI, and an automated check that no production policy
has a wildcard action.
13.28 Backup and recovery security
Backups are encrypted. Access to backups is restricted to the backup role.
A restore test runs each quarter, in a separate environment.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 75 of 118


<!-- PAGE 76 -->

Deletion requests are reflected in backups within the backup retention period. This is
documented in the privacy notice.
Non-production backups are never copies of production.
13.29 Dependency and supply-chain controls
Lockfiles are committed. Container images are signed. GitHub Actions are pinned to a
commit SHA. The GITHUB_TOKEN has least privilege.
Branch protection on main requires review and passing checks. No direct commits to
main.
An SBOM is generated for each release.
Verify: a branch protection check in CI and an SBOM file exists for each release tag.
13.30 Security testing and sign-off
security:scan runs on every merge. The authorisation matrix and IDOR suite run on
every merge.
OWASP ZAP baseline scan runs weekly against staging.
A manual penetration test runs before launch. Its scope document is written in P8.
High and critical findings block release.
A security.txt file with a disclosure contact is published on the admin host.
Verify: the phase P8 report lists every check above with its result.
Part 14. Privacy, retention, operations, and configuration
14.1 Privacy principles
Collect only what each feature needs.
Students' own location is never collected (R-19).
Driver phone location is collected only during an active shift, with a visible indicator (R-
18).
No third-party analytics or advertising SDK receives location or personal data. Crash
reporting removes personal data before sending.
The Privacy screen in each app explains what is collected, when, and who can see it.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 76 of 118


<!-- PAGE 77 -->

14.2 Retention
The college's counsel and policy owner confirm the final values (decision 9 in Part 18.2).
The defaults are:
Rules:
The retention job (daily at 02:00) drops expired partitions and deletes expired rows in
batches of 1,000, so it never locks a large table for long.
Data
Default retention
At end of retention
Location samples
(hardware and phone)
90 days
Partition dropped
Device heartbeats
90 days
Partition dropped
Device events
1 year
Deleted
Trip summaries
2 years
Deleted
Attendance records
2 years, or the
academic-year policy
Deleted
Absence alerts
1 year
Deleted
SOS incidents and
timelines
3 years
Personal fields anonymised.
Counts kept
Stop requests
2 years
Deleted
In-app notifications
90 days
Deleted
Notification delivery
records
90 days
Deleted
Audit logs
2 years
Deleted
Export files
7 days
Deleted from storage
Application logs
30 days
Deleted. Contain no personal data
Accounts
Until deactivation plus
90 days
Personal fields deleted.
Pseudonymous ID kept for
historical reports
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 77 of 118


<!-- PAGE 78 -->

A deletion request removes attendance and location records. It anonymises SOS
records, and keeps audit records where the law or policy requires them. The user is
told what was kept and why.
Deleted data is removed from backups as the backup retention period expires (Part
13.28).
Each retention run writes a summary to the audit log: table, rows affected, and the cut-
off date.
14.3 Consent, age, and limited mode
Privacy notice versions are stored in notice_versions. Each user sees the current
version at sign-in and when it changes. Consent is recorded per purpose: app use and
account, driver location during shifts, attendance records, and notifications.
Age comes from date_of_birth. A student with no date of birth is treated as under 18
until the coordinator confirms it.
Under-18 students: a verification link is sent to the guardian contact. The guardian
enters a one-time code sent to that contact. The consent record stores the guardian's
identifier and the time. The method must be confirmed by counsel before launch
(decision 7).
Until guardian consent is recorded, the student sees only the notice and the SOS
button. No attendance, no bus positions, and no notifications other than SAFETY.
Counsel confirms this position (decision 8).
Withdrawal of consent is available in the Profile screen. Withdrawal stops the matching
processing. It does not remove SOS or audit records.
14.4 Configuration defaults
Every value is held in the settings table, with the default below. Changes need the super
admin role and a reason, and are audited. Code reads the value at runtime, never a copy.
Area
Key: default
Hardware validity
hw.stale_after_s: 60. hw.min_satellites: 4.
hw.max_hdop: 5.0. hw.gps_lost_after_s: 30.
hw.gps_lost_ticket_min: 10
Phone validity
phone.max_accuracy_m: 50.
phone.standby_interval_s: 30.
phone.fallback_interval_s: 10
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 78 of 118


<!-- PAGE 79 -->

Area
Key: default
Device cadence
hw.moving_interval_s: 10. hw.stopped_interval_s:
30. hw.parked_heartbeat_s: 600.
hw.heartbeat_moving_s: 60
Vehicle voltage
vehicle.battery_mv_12v: 11800.
vehicle.battery_mv_24v: 23500
Ingestion
ingest.future_tolerance_s: 60.
ingest.buffered_after_min: 10.
ingest.stale_timestamp_days: 7.
ingest.jump_max_kmh: 150. ingest.jump_reset_min:
30. ingest.clock_skew_s: 300.
ingest.service_area_buffer_km: 10.
ingest.batch_max: 50. ingest.body_max_kb: 8.
ingest.phone_body_max_kb: 16. ingest.global_rps:
200
Selector
selector.cooldown_s: 30. selector.return_fixes: 3.
selector.return_window_s: 30.
selector.both_down_s: 120. selector.flap_limit: 6 in
600 s. selector.flap_hold_s: 300
Shifts
shift.idle_min: 20. shift.idle_speed_kmh: 3.
shift.idle_grace_min: 10. shift.timeout_h: 14.
shift.late_start_min: 10.
shift.late_start_coordinator_min: 20.
trip.generate_days_ahead: 7
Stops and ETA
stop.radius_m: 50. stop.arrival_speed_kmh: 5.
stop.arrival_dwell_s: 15. stop.departure_dwell_s: 10.
stop.departure_speed_kmh: 10.
eta.speed_min_kmh: 10. eta.speed_max_kmh: 60.
eta.speed_default_kmh: 20.
eta.speed_window_min: 5. snapshot.cache_s: 3
Attendance
qr.rotation_s: 30. boarding.window_before_min: 10.
boarding.window_after_min: 15.
leave.cutoff_before_trip_min: 30.
approach.default_min: 5 (range 2 to 15)
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 79 of 118


<!-- PAGE 80 -->

14.5 Observability
Logs: structured JSON with timestamp, level, service, request_id, role, route, status,
and duration. Device_id and bus_id are allowed. Names, emails, phone numbers,
coordinates, and tokens are never logged (Part 13.26). Retention 30 days.
Metrics: ingestion requests and rejects by reason; samples accepted and rejected per
minute; selector transitions by reason; snapshot latency and cache hit rate; SOS
creation-to-delivery latency and failures; notification delivery by channel; queue depth
and oldest job age; heartbeats per minute; device health counts; authentication
failures and lockouts; database connections, replication lag, and storage growth.
Tracing: OpenTelemetry across the API and workers, sampled at 10 percent. SOS and
ingestion are sampled at 100 percent.
Dashboards: fleet health (live, stale, unavailable buses; online, delayed, offline
devices); ingestion; SOS; notifications; platform (CPU, memory, database, queue);
business (trips started against schedule, boardings per trip).
Area
Key: default
SOS
sos.dedupe_s: 60. sos.cancel_window_s: 30.
sos.escalation_min: 0, 2, 5, 10.
sos.device_delay_flag_s: 60
Stop requests
route.corridor_m: 300. stop.duplicate_m: 100.
stop_request.limit_days: 7
Notifications
notify.quiet_start: 22:00. notify.quiet_end: 06:00.
notify.push_per_hour: 6. notify.group_window_s:
120. notify.retry_min: 1, 5, 30, 120.
summary.send_time: 08:00
Sessions and OTP
session.idle_min: 30 (SEC: 15). otp.ttl_min: 10.
otp.attempts: 5. otp.lock_min: 15
Documents
doc.expiry_warn_days: 30, 7
Clients
app.poll_foreground_s: 10. web.poll_s: 10
Calendar
service.hours: 05:30 to 22:30. holidays: college
calendar, set each year
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 80 of 118


<!-- PAGE 81 -->

External probes every 30 seconds against the API, the ingest host, and the admin
console, from two providers. A probe failure is an alert even when internal metrics look
healthy.
Runbooks RB-01 to RB-13 are listed in Part 16 (P9-T4). Each has a trigger, the first five
minutes, diagnosis, mitigation, a communication template, and a post-incident review
within five working days.
14.6 Non-functional requirements
Area
Requirement
How it is measured
API availability
99.5 percent per month
External probes
Ingestion
availability
99.9 percent per month target. Tracked
from launch
Success rate
Position
freshness
95th percentile of position age at most 15
seconds, for buses with a fresh source
recorded_at to snapshot
SOS latency
Incident within 1 second. Tier 0 push
within 5 seconds. Both at the 95th
percentile
sos_events timestamps
API latency
Snapshot p95 at most 300 ms. Other
reads p95 at most 500 ms. Writes p95 at
most 800 ms
Metrics
Capacity
100 buses at launch, designed for 200.
5,000 registered users. 500 concurrent
app users at peak
Load test (Part 15.3)
Recovery
Recovery point 15 minutes or less.
Recovery time 1 hour or less
Quarterly restore test
App cold start
3 seconds or less on a mid-range Android
phone with 4 GB RAM
Device test
App size
40 MB or less (Android download). 60 MB
or less (iOS)
Build report
Driver battery
8 percent per hour or less of background
tracking on the reference phone
Two-hour test
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 81 of 118


<!-- PAGE 82 -->

Part 15. Testing and the no-mock rules
15.1 Test levels and gates
Area
Requirement
How it is measured
Data use
Driver app 1 MB per hour or less in
fallback. Student app 2 MB per day or less
Measurement
Offline
Driver buffers 24 hours. Student sees
cached data for up to 10 minutes
T-OFF tests
Accessibility
WCAG 2.1 AA on the web. Dynamic text
up to 200 percent in the app. Labels on
every control. Status is never shown by
colour alone
Automated and device
checks
Localisation
English at launch. All strings externalised.
IST display. Dates shown as 19 Oct 2026
Review
Browsers
Last two versions of Chrome, Edge,
Safari, and Firefox
Test matrix
Mobile OS
Android 10 and later, iOS 16 and later.
Confirm against the devices in use
Store settings
Time sync
Server time from NTP. Devices sync from
GNSS or the network
Clock-skew alerts
Level
Scope
Tools
Gate
Unit
packages/domain,
services, validation, ETA,
QR, selector, state
machines
Vitest
80 percent line coverage
on packages/domain.
Every service function
tested
Integration
Full endpoints against
PostgreSQL with PostGIS
Supertest,
Testcontainers
Each endpoint has a
success test and a failure
test for each error code it
can return
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 82 of 118


<!-- PAGE 83 -->

15.2 Required test cases
Each case is written before its feature is built. The IDs are the coverage contract.
Ingestion: T-ING-01 valid batch of 50 samples returns ack_seq of 50. T-ING-02 identical
resend creates no rows. T-ING-03 same sequence with different content returns
CONFLICT. T-ING-04 timestamp 90 seconds ahead is rejected. T-ING-05 (0, 0) is
rejected. T-ING-06 a 200 km/h jump is stored flagged and rejected. T-ING-07 a 9 KB
body returns 413. T-ING-08 a revoked token returns DEVICE_REVOKED within 5
seconds. T-ING-09 token rotation activates on first use and retires the old token. T-
ING-10 two-hour-old buffered samples are stored as BUFFERED and never update live
state.
Level
Scope
Tools
Gate
Contract
Replay of recorded
device messages from
every firmware version
Test harness
Every build
Security
Authorisation matrix,
IDOR suite, route
inventory, headers,
CORS, injection, rate
limits
Custom suites,
ZAP baseline
Every merge (matrix and
IDOR). Weekly (ZAP)
Web end-to-
end
Coordinator and
technician flows
Playwright
Every merge to main
Mobile end-
to-end
Student, faculty, and
driver flows on real
devices and a device
farm
Maestro
Every release candidate
Accessibility
Each console page and
app screen
axe-core, device
checks
Every release candidate
Load and
failover
Part 15.3
k6, scripted
failover
Before launch and before
each minor release
Pilot
Three buses for two
weeks
Feedback and
logs
Pilot exit criteria (Part 16,
P9)
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 83 of 118


<!-- PAGE 84 -->

Selector: T-SEL-01 hardware stale for 60 seconds switches to PHONE with HW_STALE
within 5 seconds of the threshold. T-SEL-02 three valid fixes in 30 seconds switch back
to HW. T-SEL-03 seven switches in 10 minutes hold the source for 5 minutes and raise
an alert. T-SEL-04 neither source fresh for 120 seconds gives UNAVAILABLE with one
alert. T-SEL-05 manual HW with dead hardware stays STALE with no automatic switch.
Shifts: T-SHF-01 start blocked without Always permission. T-SHF-02 second shift on
one bus returns BUS_ALREADY_ON_SHIFT. T-SHF-03 driver not on roster gets 404 for
the bus. T-SHF-04 twenty minutes idle gives a prompt, and auto-end after ten more
minutes without a response.
Authentication: T-AUTH-01 ten failed OTP attempts lock the account for 15 minutes. T-
AUTH-02 a deactivated user loses access within 60 seconds. T-AUTH-03 a reused
refresh token revokes the family. T-AUTH-04 PKCE and state mismatch are rejected. T-
AUTH-05 generic error messages on OTP and sign-in.
Security: T-SEC-01 the authorisation matrix matches Part 6.8 and Part 10.1 for every
endpoint and role. T-SEC-02 a student requesting another route's snapshot gets 404. T-
SEC-03 an export cell beginning with = is escaped. T-SEC-04 each rate limit returns 429
with Retry-After. T-SEC-05 each admin endpoint returns 404 to a user without the role.
T-SEC-06 each webhook invalid case in Part 13.19 fails safely.
Privacy: T-PRV-01 an under-18 student without consent sees only the notice and SOS. T-
PRV-02 a deletion request removes attendance and location records and anonymises
SOS records. T-PRV-03 retention purges expired partitions and writes the summary.
Attendance: T-ATT-01 a QR from 30 seconds ago is accepted, and one from 65 seconds
ago returns QR_EXPIRED. T-ATT-02 a second scan returns DUPLICATE_BOARDING. T-
ATT-03 morning boarded and afternoon absent creates an alert within 5 minutes of the
cutoff. T-ATT-04 leave prevents the alert.
SOS: T-SOS-01 tier 0 push within 5 seconds at the 95th percentile. T-SOS-02 two
triggers 20 seconds apart give one incident. T-SOS-03 two buses in the same second
give two incidents. T-SOS-04 no acknowledgement for 2 minutes starts tier 1. T-SOS-05
cancellation after acknowledgement is refused. T-SOS-06 a missing tier recipient list
raises the setup alert.
Notifications: T-NTF-01 a SAFETY notification during quiet hours with preferences off
is delivered. T-NTF-02 the seventh non-safety push in an hour is suppressed and kept
in the in-app centre. T-NTF-03 an SMS that does not match its DLT template is blocked.
Offline: T-OFF-01 driver phone offline for 30 minutes buffers and flushes in order. T-
OFF-02 student app offline for 10 minutes marks cached data offline.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 84 of 118


<!-- PAGE 85 -->

Concurrency: T-CON-01 two parallel scans create one record. T-CON-02 two parallel
shift starts create one shift. T-CON-03 two parallel SOS triggers create one incident.
Accessibility: T-A11Y-01 automated scan of each console page has zero critical
violations.
Each edge case in section 37 of the specification has a test.
15.3 Load and failover
T-LOAD-01: 50 buses at 10-second intervals and 500 app users polling every 10 seconds.
Snapshot p95 at most 300 ms, ingestion p95 at most 500 ms, zero errors.
T-LOAD-02: five buses trigger SOS within 10 seconds. Five incidents, and tier 0 delivery
within 5 seconds.
T-FO-01: kill one API task during load. No failed ingestion after retries, and the other
task serves.
T-FO-02: database failover. Service recovers within the recovery time, with no data
loss.
T-FO-03: certificate rotation rehearsal on staging. The test-bench module connects
with the new chain.
T-FO-04: kill a worker during a job. The job retries, with no duplicate records.
15.4 No-mock verification and purge
verify:no-mock fails the build if any file outside tests/fixtures/, tools/simulator/, and
docs/ contains a fake-data marker. The markers are: the words fake, dummy, lorem ipsum,
placeholder value, demo account, example.com, test@, the number ranges used for test
phone numbers, and the patterns 9999999999 and 0000000000. It also fails if any
application file imports from tests/fixtures or tools/simulator.
The words sample and samples are domain terms in this system (location samples). The
platform mock flag is stored as is_mock. The scanner does not ban them. Instead, the
scanner checks that a sample is never created from literal values in application code.
verify:prod-clean runs against the production database and fails if any of these hold:
Any business table has a row with is_synthetic set to true.
Any user has an email outside COLLEGE_EMAIL_DOMAINS, except the driver
accounts that have a recorded exception.
Any phone number matches a test range.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 85 of 118


<!-- PAGE 86 -->

Any device has a device_id that was not provisioned through the technician flow (no
provisioning event in device_events or the audit log).
Any bus, route, or stop name contains a fake-data marker.
Any announcement or notification body contains a fake-data marker.
The script writes its report to docs/progress/prod-clean-<date>.md. A failure blocks
release (R-M6).
db:purge-synthetic deletes rows where is_synthetic is true, in dependency order,
children first. It refuses to run unless APP_ENV is dev or staging, and refuses when the
database is marked production. It writes a purge record with the row counts by table to
docs/progress. Test runs clean up their own data (R-M4), so the purge is normally for
manual test data (R-M8).
Simulator exclusion: a build test checks that the production container image contains no
tools/simulator files and no tests/fixtures files.
15.5 Test data policy
Factories live in tests/fixtures/ and create data flagged is_synthetic true.
Factories use values that are obviously test values: emails under test.invalid, names
starting with Test, device IDs in the HW_9nn range, bus numbers in the 9nn range, and
phone numbers in the reserved range the verifier knows.
Factories refuse to run when APP_ENV is production.
Each test starts from an empty database or a transaction, and does not depend on
another test.
15.6 Mobile and accessibility testing
Maestro runs the student, faculty, and driver flows on at least five Android models and
two iOS models, including the reference phone used for the battery test.
Background location is tested for two hours on each reference phone. The test checks
the battery limit, the indicator, and the buffering.
Permission flows are tested on each platform, including the Android battery
optimisation case and the iOS Always-denied case.
Accessibility: axe-core on every console page, and manual checks with a screen reader
on the key flows (sign-in, live map, SOS).
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 86 of 118


<!-- PAGE 87 -->

Part 16. Build phases and tasks
Build in this order. Each phase has a plan, tasks, and an exit check. Do not start a phase
until the previous phase report is approved. Each task ID is used in commit messages and
in the phase report.
Phase P0: Foundation
Goal: a secure, empty platform that signs users in, enforces access, and has the test
harness and database controls in place.
P0-T1 Monorepo scaffolding: pnpm workspaces, Turborepo, TypeScript strict, ESLint
(including the unsafe-pattern rules), Prettier, pre-commit hooks (gitleaks, lint), pull
request template, CODEOWNERS, Renovate configuration.
P0-T2 Configuration package: Zod environment schema (Part 3.3), startup refusal rules,
the defaults table (Part 14.4) as code and as seed data.
P0-T3 Database: Prisma schema for every table in Part 7 and in addition push_tokens
(user_id, install_id, token_encrypted, platform, last_seen_at, revoked_at), which the
specification needs for push delivery but Part 7 did not list. Migrations run as
app_migrator. Create app_runtime and app_worker with the grants in Part 7.11. Enable
and force row-level security on the listed tables. Create the audit append-only trigger
and grants. Partitioned tables for location_samples and device_heartbeats, with the
partition manager.
P0-T4 Test harness: Testcontainers with PostgreSQL and PostGIS. Factories in
tests/fixtures (Part 15.5). Transaction-per-test helper. Clean-up hook.
P0-T5 Migration policy: expand-only check in CI. A migration that drops or renames a
column or table fails unless it is in the contract phase, and the check records it.
P0-T6 Authentication core: SSO through openid-client (RS-09) with PKCE, state, and
nonce; domain restriction; return-URL allowlist; session model with refresh rotation
and reuse detection; logout; session list. Driver OTP: HMAC storage, single use,
attempt limits, lockout, Turnstile after the first request in an hour.
P0-T7 Default-deny guard, @Public(), @Roles(), scope decorators, and the route
inventory with verify:routes-auth.
P0-T8 HTTP hardening: Helmet and headers (Part 13.18), CORS allowlist, error envelope,
request IDs, pino logger with redaction, Sentry, OpenAPI JSON in dev and staging only.
P0-T9 Rate limiter (rate_counters) and idempotency middleware (Part 8.1).
P0-T10 Observability baseline: health endpoints, metrics, traces, dashboards skeleton,
external probes.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 87 of 118


<!-- PAGE 88 -->

P0-T11 Infrastructure for dev (Terraform): VPC with private subnets, ALB with HTTPS
and HTTP redirect, ECS service, RDS PostgreSQL Multi-AZ with PostGIS, private S3
buckets, KMS keys, Secrets Manager, WAF, ACM, Route 53 records for the three hosts,
CloudFront for the admin console.
Exit: SSO sign-in works in dev. verify:routes-auth passes. RLS tests pass (Part 13.1). CI is
green. Security headers test passes on the API host.
Phase P1: Ingestion and the source engine
Goal: devices and driver phones send data, the server stores it correctly, picks one source
per bus, and serves a snapshot.
P1-T1 Device tokens: generation, HMAC storage, key versions, activation on first use,
rotation with overlap, revocation (Part 6.2 to 6.4).
P1-T2 Device links with locking and the attribution rule (Part 6.5 and 6.6).
P1-T3 Telemetry pipeline stages S1 to S13 (Part 5.2), with the validation rules in
packages/domain.
P1-T4 Heartbeat and event pipelines (Part 5.4 and 5.5), device health states, and the
event handlers that do not depend on other features (battery, module error, boot,
firmware failed, tamper, unknown types).
P1-T5 Driver phone endpoints and the shift claim (Part 5.3 and 6.7). The shift service is
included here, with its locks, so the claim can be issued.
P1-T6 packages/domain: validity rules, jump check, time checks, plausibility, frozen-
position check, unit conversions (Part 9.1, 9.2, 9.14). Unit tests for each rule and each
edge case.
P1-T7 Source selector with the locked bus_state row, source_switches, the outbox
trigger, the anti-flapping rules, and the phone cadence in responses (Part 9.3 to 9.7).
P1-T8 Snapshot API with scope resolution, the ETag, the 3-second cache per route
version, and the 404 rule (Part 5.6 and 6.9).
P1-T9 ETA and stop arrival (Part 9.9 and 9.11) in packages/domain, with PostGIS queries
and tests for passed, off-route, and arriving cases.
P1-T10 Contract test harness with recorded messages (test data only).
P1-T11 Simulator in tools/simulator, with the guardrails in Part 3.2 and R-M5. It drives 50
buses, hardware and phone sources, all failure behaviours in the specification section
32.2.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 88 of 118


<!-- PAGE 89 -->

Exit: the simulator drives the states correctly. The contract harness passes. Load test T-
LOAD-01 passes in staging.
Phase P2: Student and faculty apps
P2-T1 Expo app shell: Expo Router, auth storage in SecureStore, role switcher,
navigation guards by role.
P2-T2 Home map with MapLibre (section 17 of the specification): snapshot polling
every 10 seconds in the foreground, bus markers with source badges, clustering, route
line and stops, stale styling.
P2-T3 Bus detail: ETA to my stop, remaining stops, route progress, data age, Not
running and Trip completed states.
P2-T4 Notification centre and preferences. Push token registration into push_tokens.
SAFETY channel setup on Android.
P2-T5 Faculty views: my buses with the bus picker, the bus detail with driver contact,
today's attendance (morning and afternoon).
P2-T6 Approaching-alert setting (2 to 15 minutes).
P2-T7 Offline states, cached data banners, and the no-connection messages.
P2-T8 Accessibility and string externalisation.
P2-T9 Boarding QR scanner: camera scan of the driver's rotating QR code (expo-
camera), POST /attendance/scan, a confirmation screen with the bus number and time,
and the specific failure messages in Part 10.3 step 7. Nothing is queued offline.
P2-T10 Stop request screens: pin placement on the route map, proposed name (max 60
characters), submission with the checks in Part 11.7, status tracking, and voting on
pending requests.
P2-T11 Leave screen: mark leave for dates and trip types until the cutoff, and cancel
until the cutoff (Part 11.9).
P2-T12 Attendance history screen (GET /attendance/me): one row per date with
morning and afternoon status.
P2-T13 Profile and privacy screens: name and phone, correction, export, deletion and
consent-withdrawal requests, consent history, session list, and sign-out of other
devices.
P2-T14 Trip completed view: the trip summary is visible for 30 minutes after the trip
ends (Part 6.10).
Exit: acceptance criteria AC-STU-01 to 05 and AC-FAC-01 to 03 pass on device.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 89 of 118


<!-- PAGE 90 -->

Phase P3: Driver app and phone tracking
P3-T1 Driver OTP sign-in, roster list, device registration (label).
P3-T2 Permissions and the pre-trip check (Part 9.10), with fix screens for each platform.
P3-T3 Shift start, resume after restart, end, idle prompt, the 14-hour timeout.
P3-T4 Background location task with a foreground service (Android) and background
location mode (iOS), the on-screen and notification indicator, and the phone buffer in
expo-sqlite (confirm in RS-20) holding up to 24 hours. Flush in order with the batch
rules.
P3-T5 Mode switch with confirmation and note, SOS button with the 2-second hold,
and the incident status screen.
P3-T6 Boarding QR display with the 30-second countdown, manual check-in list with
reasons.
P3-T7 Report a problem, creating a ticket.
P3-T8 Mock-location handling: stored with the flag, never live, driver warning,
coordinator alert.
P3-T15 Manual stop arrival: Mark arrived overrides detection for that stop only (Part
9.9). Skipped stops are shown to the driver.
P3-T16 Prerequisites moved from P6, so that the driver SOS button and the faculty
absence alerts have a working path: the SOS create-or-join service (P6-T1), the outbox
table, and the notification dispatcher core with FCM push for tier 0, retries, and dead
letters (the core part of P6-T3). Build these before P3-T5 starts. P6 completes the rest.
P3-T17 Driver trip summary screen, showing the fields in Part 20.9 after the shift ends.
P3-T18 Shift auto-end job (shift-auto-end, Part 12.3), implementing the idle rules in Part
9.8.
Exit: AC-DRV-01 to 04 pass on device. Two-hour battery test passes on the reference
phone.
Phase P4: Coordinator and technician consoles
P4-T1 Web shell: role-based routes, lazy-loaded admin modules, route guards, CSP and
headers via CloudFront, session idle timeout, MFA enrolment.
P4-T2 Buses; devices with batch provisioning and the one-time token display; device
links; token rotation and revocation with the typed confirmation; device health pages.
P4-T3 Routes: stops library, ordered stops, geometry editor on the map or GeoJSON
upload, timetables, route-bus assignments, holidays.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 90 of 118


<!-- PAGE 91 -->

P4-T4 Roster, faculty assignments, student routes.
P4-T5 Users: invitations, CSV import with dry run and commit (Part 11.8), deactivation
with end date.
P4-T6 Live fleet map, source-switch log, comparison view (two tracks, last 10 minutes).
P4-T7 Tickets, firmware release registration and staged rollout controls.
P4-T8 Settings (super admin edits with reason), feature flags, audit log viewer.
P4-T9 Bench mode: a technician sets a device to BENCH. Bench devices are excluded
from fleet views, alerts, reports, and the production purge check (Part 10.7 step 7). The
change is audited.
Exit: AC-COR-01 to 03 and AC-TEC-01 to 02 pass. T-SEC-05 passes for every admin route.
Phase P5: Attendance and alerts
P5-T1 Trip generator (daily job, holidays), expected-passenger builder on trip start.
P5-T2 QR token generation and scan validation (Part 11.2) with key versions and the
rate limit.
P5-T3 Manual check-in, FLAGGED_GUEST, LATE_BOARDED, coordinator corrections
with reasons.
P5-T4 Boarding-cutoff job and the absence evaluator (Part 11.3).
P5-T5 Leave flows for students and faculty, with cutoffs and cancellation.
P5-T6 Absence alerts for faculty: list, detail, acknowledgement, notes, late boarding
update.
P5-T7 Operational alerts (Part 11.5), the coordinator daily summary, and attendance
exports (CSV).
Exit: T-ATT-01 to 04 and T-CON-01 pass.
Phase P6: SOS, stop requests, and notifications
P6-T1 SOS create and join with the advisory lock, dedupe, device delay flag, and events
(Part 11.1). The core is built in P3-T16; this task completes the join rules and the tests for
AC-SOS-02 and AC-SOS-03.
P6-T2 Escalator job, tiers, acknowledgement, responding, notes, cancellation window,
resolution. Incident timeline CSV export through POST /exports (type SOS_TIMELINE,
Part 11.6).
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 91 of 118


<!-- PAGE 92 -->

P6-T3 Notification dispatcher (the outbox and tier 0 push core are built in P3-T16) with
FCM HTTP v1 (RS-05), the SMS adapter with DLT templates (RS-06), SES email (RS-07),
retries, dead letters, quiet hours, rate limits, grouping, and preference checks at
dispatch.
P6-T4 Provider callbacks with signature verification (Part 13.19).
P6-T5 Drills and the setup alert for empty tier recipient lists.
P6-T6 Stop requests: submission checks (Part 11.7), votes, merge, review, approval with
effective dates, and the deactivation notice to affected students.
P6-T7 SOS console in the admin web, and the SOS screens in the apps.
P6-T8 Security staff mobile screens: read-only live map of all active buses, SOS receive,
acknowledge, responding, and resolve with a note, and incident history per bus and
date (spec 16.7; Part 10.9).
Exit: T-SOS-01 to 06, T-NTF-01 to 03, T-CON-03, and T-LOAD-02 pass.
Phase P7: Reports, privacy, and retention
P7-T1 Reports and exports (Part 11.6): streaming CSV to S3, the row limit, the signed
link, expiry, audit.
P7-T2 Data requests: export, correction, deletion, withdrawal of consent, with
anonymisation rules (Part 14.2).
P7-T3 Consent: notice versions, consent records, under-18 guardian verification,
limited mode (Part 14.3).
P7-T4 Retention jobs and the partition manager, with the summary to the audit log.
P7-T5 Announcements (plain text, scope, expiry).
P7-T6 Audit coverage test: every write route writes an audit row (Part 13.12).
P7-T7 Management dashboards (web): on-time performance, trips completed, SOS
count by week, device uptime summary, and attendance by route as counts and
percentages. Aggregate only (spec 16.8; Part 10.10).
Exit: T-PRV-01 to 03 pass. Export tests pass, including the formula-injection test.
Phase P8: Security hardening and load
P8-T1 Run every Verify step in Part 13 and fix each failure. Record the results in
docs/security.
P8-T2 OWASP ZAP baseline against staging. Fix high findings.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 92 of 118


<!-- PAGE 93 -->

P8-T3 IDOR suite covers every identifier route. Authorisation matrix matches Part 6.8
and 10.1.
P8-T4 Dependency updates, pinned base images, SBOM per release.
P8-T5 STRIDE threat model reviewed and signed in docs/security.
P8-T6 Penetration test scope document prepared. The test is booked for before launch.
P8-T7 Backup and restore drill, with the measured recovery time recorded.
P8-T8 Load test T-LOAD-01, the SOS burst T-LOAD-02, and the failover drills T-FO-01 to
T-FO-04.
Exit: all Part 13 checks pass. No high or critical findings open.
Phase P9: Release readiness and pilot
P9-T1 Accessibility fixes from automated and manual checks (Part 15.6).
P9-T2 Mobile release builds with EAS. Store listings and declarations: the Play location
declaration (RS-03), the App Store review notes (RS-04). Accounts owned by the
college.
P9-T3 Run verify:no-mock and verify:prod-clean. Run db:purge-synthetic on staging.
Keep the reports.
P9-T4 Runbooks RB-01 to RB-13 written in docs/runbooks. RB-01, RB-02, RB-03, and RB-
08 are rehearsed.
P9-T5 Pilot: three buses, two drivers, three faculty, ten students, one coordinator.
Feedback form and logs. Exit criteria (below).
P9-T6 Production infrastructure applied through Terraform. Super admins
bootstrapped by a one-time command that takes the emails from the configuration,
never from seed files.
P9-T7 Final launch checklist (Part 17) signed off, and the coverage report (Part 19)
complete.
Pilot exit criteria: live position available for at least 99 percent of active-shift minutes. SOS
delivered within 5 seconds at the 95th percentile in drills. At least 95 percent of boardings
recorded within 2 minutes of departure. No cross-role data exposure found. No Severity 1
incident open.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 93 of 118


<!-- PAGE 94 -->

Traceability to the specification
Specification section
Prompt part
Built in
1 to 3 Product, scope, glossary
Part 1, 10.1
P0
4 and 5 Roles and permissions
Part 6.8, 10.1
P0, P4
6 and 7 Architecture and stack
Part 2, 5
P0
8 Authentication
Part 13.20
P0
9 and 10 Domain and data model
Part 7
P0
11 Device and driver contract
Part 5.2 to 5.4, 8.4
P1
12 Events
Part 5.5
P1
13 and 14 Source selection and states
Part 9
P1
15 Shifts and trips
Part 6.7, 9.8, 9.10
P1, P3
16 Features by role
Part 10
P2 to P6
17 Live tracking and ETA
Part 9.9, 9.11
P1, P2
18 Attendance
Part 11.2, 11.3, 11.9
P5
19 SOS
Part 11.1
P6
20 Stop requests
Part 11.7
P6
21 Notifications
Part 11.4, 13.19
P6
22 Operational alerts
Part 11.5
P5, P8
23 Reports
Part 11.6
P7
24 Admin console
Part 12.1, 12.2
P4
25 Background jobs
Part 12.3
P1 to P7
26 and 27 API catalogue and
conventions
Part 8
P0 to P7
28 Security
Part 13
P0, P8
29 Privacy and retention
Part 14.1 to 14.3
P7
30 Non-functional
Part 14.6
P8, P9
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 94 of 118


<!-- PAGE 95 -->

Part 17. Launch checklist (release gate)
Every box must be ticked before production launch. Each tick needs the evidence file
named in the phase report.
Security
Specification section
Prompt part
Built in
31 Operations
Part 14.5, 16 (P9-T4)
P0, P9
32 Testing
Part 15
All phases
33 CI/CD and release
Part 16 (P9-T2)
P0, P9
34 Deployment
Part 16 (P0-T11, P9-
T6)
P0, P9
35 Configuration
Part 14.4
P0
36 Import formats
Part 11.8
P4
37 Edge cases
Part 15.2
P1 to P7
38 Release gate
Part 17
P9
39 Milestones
Part 16
All phases
40 Future features
Part 18.3
Not built
41 Open decisions
Part 18.2
Before the related
phase
Every Verify step in Part 13 passes. Results are in docs/security.
verify:routes-auth passes. Only the reviewed allowlist is reachable without
credentials.
The IDOR suite covers every identifier route, with zero failures.
The authorisation matrix matches Part 6.8 and Part 10.1.
Penetration test complete. No high or critical findings open.
Dependency audit is clean at high severity. SBOM generated for the release.
All secrets are in Secrets Manager. gitleaks is clean.
Debug is off. OpenAPI UI is off. No public source maps.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 95 of 118


<!-- PAGE 96 -->

Functional
Privacy
Data hygiene (no mock data)
Security headers verified on the API, ingest, and admin hosts. TLS scan is acceptable.
Webhook signature tests pass (Part 13.19).
Audit coverage test passes. The audit table rejects updates and deletes.
Storage buckets are private. An anonymous download fails.
CAPTCHA is enforced on OTP requests.
Every rate limit returns 429 with Retry-After.
Every acceptance criterion AC-* in Part 10 passes in staging and on real devices.
SOS: tier 0 within 5 seconds at the 95th percentile. Escalation tested. A drill has run
end to end.
Source selection suite (T-SEL) passes.
Attendance (T-ATT) and concurrency (T-CON) suites pass.
Notification suite (T-NTF) passes. All SMS templates are approved in the DLT registry.
Stop requests pass their tests.
CSV imports pass their tests. A dry run of the college's own file is done before commit,
with no data committed until the launch window.
Reports and exports pass, including the formula-injection test.
Counsel has signed off the notice text, the guardian consent method, the limited
mode, the retention values, and the breach process.
The under-18 flow has been tested from start to finish.
Each data request type has been tested from start to finish.
verify:no-mock passes.
verify:prod-clean passes on the production database. The report is saved.
Staging synthetic data is purged, and the purge report is saved.
The simulator and test fixtures are absent from the production image.
Every user email is on a college domain, except recorded driver exceptions. Super
admins are bootstrapped by the one-time command.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 96 of 118


<!-- PAGE 97 -->

Infrastructure and operations
Mobile
Pilot and governance
Part 18. Decisions, defaults, and scope
18.1 Defaults used until a decision is made
The build uses these defaults. Each one is recorded in docs/decisions/defaults-used.md
when it is used.
Every SOS tier has its real recipients entered by the college. No tier raises a setup
alert.
Production Terraform is applied. The drift check is clean.
Backups are on. A restore drill ran within the last 30 days, and its measured recovery
time is recorded.
Alarms are configured (Part 14.5). The on-call engineer has received a test alert.
Runbooks RB-01 to RB-13 are written. RB-01, RB-02, RB-03, and RB-08 have been
rehearsed.
External probes are live for all three hosts.
Certificates are valid, renewal is verified, and the ingest chain has been tested on the
test-bench module.
Android foreground service and iOS background location are verified on real devices.
The Play location declaration and the App Store review notes are submitted.
The minimum supported app version is set, and the force-update screen is tested.
The battery test passes on the reference phone.
Accessibility scans are clean. A screen reader check of sign-in, the live map, and SOS is
complete.
Pilot exit criteria are met (Part 16, P9).
Every open decision marked before-launch in Part 18.2 is signed off.
Phase reports P0 to P9 are approved.
The coverage report (Part 19.2) lists zero uncovered features.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 97 of 118


<!-- PAGE 98 -->

Decision
Default
Reference
Database
PostgreSQL 16 with PostGIS
Specification 41,
decision 1
Cloud provider
AWS, India region
Decision 2
Map
MapLibre with OpenStreetMap
Decision 3
Boarding at launch
QR codes shown by the driver
Decision 4
Driver phones
College-issued phones preferred.
Personal phones only with recorded
consent
Decision 5
Security staff
visibility
Read-only, all active buses
Decision 6
Parental consent
method
Guardian one-time code. Counsel
confirms
Decision 7
Under-18 without
consent
Limited mode as specified. Counsel
confirms
Decision 8
Retention
Part 14.2 values
Decision 9
Emergency contacts
Entered by the college. Until then, a
setup alert is raised and no placeholder is
used
Decision 10
Critical Alerts on iOS
Not used. Time-sensitive interruption
level
Decision 11
Absence rule
As specified in Part 11.3
Decision 12
Default mode
AUTO
Decision 13
GNSS source
Confirm with the ECE team. Software is
the same either way
Decision 14
Operating systems
Android 10 and later, iOS 16 and later
Decision 15
Regional disaster
recovery
Accept the 4-hour regional recovery for
the MVP
Decision 16
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 98 of 118


<!-- PAGE 99 -->

18.2 Open decisions and when each is needed
If a decision is still open when its phase starts, use the default in 18.1, record it, and
continue. Ask only if the default is unsafe.
18.3 Scope
In scope: every feature in the inventory in Part 10.2, delivered through phases P0 to P9.
Out of scope for the MVP. Do not build these. The data model deliberately has no tables
for them:
#
Decision
Needed before
1
Database choice
P0
2
Cloud provider
P0
3
Map provider
P2
4
Boarding method at launch
P5
5
Driver phones (college-issued or personal)
P3
6
Security staff visibility
P4
7
Parental consent method
P7
8
Limited mode for under-18 students without
consent
P7
9
Retention periods
P7
10
Emergency escalation contacts and duty lists
P6
11
Critical Alerts on iOS
P6
12
Absence rule confirmation with faculty
P5
13
Default mode and switching
P3
14
GNSS source (module internal or external)
Firmware freeze (ECE team)
15
Supported operating system versions
P2
16
Regional disaster recovery
Launch
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 99 of 118


<!-- PAGE 100 -->

RFID check-in at runtime, including the card registry. The RFID event type exists in the
ingest contract only as a rejected type with a stored IGNORED status.
Parent accounts and parent notifications.
Automated voice calls for SOS escalation.
PDF reports and scheduled report emails.
Occupancy estimation from boardings and alightings.
Fare collection or any payment.
A multi-college user interface. The college_id column exists.
A public map that needs no sign-in.
Turn-by-turn navigation.
A Google Maps layer.
Root and jailbreak detection, and certificate pinning in the apps.
Offline mode for the coordinator console.
Languages other than English.
Vehicle document uploads.
Nearest-stop help for students using their phone location.
Predictive ETA using traffic data.
Messaging between faculty and drivers.
Ratings and feedback for buses.
Live push with Server-Sent Events or WebSockets. The MVP uses polling.
Snap-to-route display of markers.
Redis, and any other cache beyond the in-process cache.
18.4 Gaps closed while writing this prompt
The specification is the detailed reference. Writing this prompt surfaced these points,
which are now built as described:
push_tokens table added. The specification needs it for push delivery.
is_synthetic added to every business table, for the no-mock rules.
idempotency_keys and rate_counters tables added. The specification required both
behaviours but did not give a storage design.
The phone-side buffer is expo-sqlite, subject to confirmation in RS-20.
The export and import pipelines are specified step by step (Part 11.6 and 11.8).
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 100 of 118


<!-- PAGE 101 -->

verify:no-mock, verify:prod-clean, verify:routes-auth, and db:purge-synthetic were
added so the no-mock rules are enforced.
The specification's device_assignments table is named device_links in this prompt. The
meaning is the same.
Part 19. Rules when something fails, and the coverage report
19.1 When something fails
Fix the cause. Do not weaken a test, skip a test, delete an assertion, or disable a
security rule to make a build pass.
If a dependency upgrade breaks the build, pin the last working version, record it in
docs/decisions, and open an issue with the ID.
If a required research output contradicts this prompt, stop and log it in
docs/decisions/conflicts.md.
If you cannot complete a task, write the blocker in the phase report and do not mark
the task done.
19.2 Coverage report (required before launch)
Write docs/progress/coverage.md. It has one row for every feature ID in Part 10.2 and
every acceptance criterion AC-* and test case T-* named in Part 11 and Part 15.2. Each row
lists the code path, the test file, and the status: built and passing, deferred (with a
decision ID), or missing. A missing row, or a row with no test file, fails the launch gate.
19.3 Final summary
Write docs/progress/final-summary.md. It lists what was built by phase, the defaults used,
the open decisions and their status, the known limits, and the out-of-scope items
confirmed in Part 18.3. Also include the outputs of verify:no-mock, verify:prod-clean, and
verify:routes-auth from the final run.
19.4 Reporting
End every phase report with one line: Ready for approval: yes, or no, followed by the
blocking items.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 101 of 118


<!-- PAGE 102 -->

Part 20. Completeness addendum (binding)
This part was added after a full audit of AG-MASTER-1.0 against SW-MVP-1.0 and the
requirements agreed in the design discussion. Each item below was missing or only
referenced, and is now stated in full. These items are binding, like the rest of this prompt.
20.1 Permission matrix (who may do what)
Y: full. A: assigned buses or own scope only. O: own records only. R: read-only. -: no access.
This matrix is the authority for the authorisation tests (T-SEC-01).
Capability
STU
FAC
DRV
SEC
COR
TEC
MGT
SAD
View live bus
positions
A
A
A
Y (all
active)
Y
R
R
(counts)
Y
See active source
label
Y
Y
A
Y
Y
Y
R
Y
See source-switch
log
-
-
A
-
Y
Y
R
Y
Start and end own
shift
-
-
Y
-
-
-
-
-
Change mode
-
-
A
-
Y
(override)
-
-
Y
Show boarding QR
-
-
A
-
-
-
-
-
Scan QR to board
O
-
-
-
-
-
-
-
Manual check-in
-
-
A
-
Y
-
-
Y
View attendance
O
A
A
-
Y
-
R
(counts)
Y
Mark leave
O
A
-
-
Y
-
-
Y
Send SOS
Y
Y
Y
Y
Y
-
-
Y
Receive SOS
-
A
A
(own
bus)
Y
Y
-
-
Y
Acknowledge and
resolve SOS
-
A
-
Y
Y
-
-
Y
Submit stop request
O
-
-
-
-
-
-
-
Review stop
requests
-
-
-
-
Y
-
-
Y
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 102 of 118


<!-- PAGE 103 -->

Decision default: SEC sees all active buses, read-only (decision 6).
20.2 Business rules R-01 to R-20
These rules are referenced throughout this prompt. Each must be enforced in code and
tested.
R-01: A bus has at most one active hardware link at a time.
R-02: A device has at most one active bus link at a time.
R-03: A driver may be rostered on several buses but may run only one shift at a time.
R-04: A bus may run only one shift at a time.
R-05: Links, rosters, and assignments are dated. Old rows are closed, never deleted.
Capability
STU
FAC
DRV
SEC
COR
TEC
MGT
SAD
Manage buses,
routes, stops,
timetables
-
-
-
-
Y
-
-
Y
Register devices,
rotate tokens
-
-
-
-
-
Y
-
Y
Link device to bus
-
-
-
-
Y
-
-
Y
Revoke device token
-
-
-
-
Y
-
-
Y
Manage assignments
(roster, faculty,
student routes)
-
-
-
-
Y
-
-
Y
Import and
deactivate users
-
-
-
-
Y
-
-
Y
Assign roles
-
-
-
-
-
-
-
Y
Report a bus problem
(ticket)
-
-
Y
-
Y
Y
-
Y
Publish
announcements
-
-
-
-
Y
-
-
Y
Reports
O (own
attendance)
A
-
-
Y
R (device
reports)
R
Y
Audit log
-
-
-
-
R
-
-
Y
Thresholds and
feature flags
-
-
-
-
R
-
-
Y
Process personal
data requests
O
O
O
O
Y
-
-
Y
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 103 of 118


<!-- PAGE 104 -->

R-06: A student has at most one active route per trip type on a given date.
R-07: Every sample keeps the device or driver that produced it, even after a
reassignment.
R-08: Records are deactivated, not deleted. Hard deletion happens only through a
personal-data deletion request or the retention job.
R-09: Audit log rows are append-only. The application role has no update or delete
permission on the audit table.
R-10: Only the server chooses the active source. Clients display what the server
returns.
R-11: SOS cannot be disabled by settings, quiet hours, or muting.
R-12: Students see only buses serving their route on today's active trips.
R-13: A stop request never edits an existing stop. Approval creates a new stop.
R-14: One attendance record per trip and student.
R-15: All timestamps are stored in UTC.
R-16: A driver's phone location is accepted only during an active shift, only for the bus
on that driver's roster, and only for that bus.
R-17: Location history is visible only to COR and SAD. Other roles see live and last-
known positions only.
R-18: Phone location is collected only during an active shift and only with the driver's
permission.
R-19: Student devices do not send location to the server in the MVP.
R-20: A bus with no active shift is shown as Not running, never as Offline.
20.3 Identifier note
Research tasks are RS-01 to RS-15 (Part 4). The R-01 to R-20 identifiers are business rules
(Part 20.2). Where an earlier part says R-01 to R-15 next to a research output, read it as RS-
01 to RS-15.
20.4 Settings each user controls
Student: notification categories and channels (SAFETY always on), approach threshold
from 2 to 15 minutes (default 5), name and phone, session list, privacy (export,
correction, deletion, withdrawal of consent).
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 104 of 118


<!-- PAGE 105 -->

Faculty: notification categories and channels, the phone number used for escalation
(taken from the profile phone), which of their assigned buses send absence and trip
alerts (default all), session list, privacy requests.
Driver: mode switch with an optional note of up to 140 characters, permission and
battery optimisation status (read), consent notice, app version and phone model
(read), sign out (blocked during a shift), session list.
Coordinator: announcements, the default mode for each bus, the duty lists and bus
escalation contacts (Part 20.5), trip cancellation, assignments.
Super admin: thresholds and feature flags (each change needs a reason), the
emergency desk contacts, MFA policy, SSO configuration, roles.
Every user: sign out other devices, sessions list, privacy requests. There are no
passwords.
20.5 SOS details
Categories: EMERGENCY, MEDICAL, BREAKDOWN, OTHER, and UNKNOWN (for
hardware presses, which carry no category). Stored on the incident and on each
trigger event.
Optional message: plain text, at most 280 characters (default). Never shown in a push
notification body.
Recipient configuration, held in settings and reviewed by the coordinator:
sos.bus_escalation_contacts (per bus), sos.on_duty_security (per day),
sos.on_duty_coordinators (per day), sos.security_office_phone,
sos.emergency_desk_email, sos.emergency_contacts (tier 3). If any tier is empty, raise
the setup alert. Never use placeholder contacts.
Delivery requirements: an Android notification channel named SOS with high
importance and full-screen intent. iOS time-sensitive interruption level. An in-app
alarm sound plays until acknowledged, at the device alarm volume where the platform
allows. Each recipient's state is recorded as QUEUED, SENT, DELIVERED, or FAILED. If
an incident has zero delivered recipients after 60 seconds, raise a Severity 1 alert.
Escalation timers count from the incident's first_triggered_at, not from when the
escalator job happens to run.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 105 of 118


<!-- PAGE 106 -->

20.6 Firmware download contract
When the heartbeat response has pending_action FIRMWARE_UPDATE, it also carries
firmware_target, firmware_sha256, firmware_size_bytes, firmware_url (a presigned
GET link valid for 15 minutes), and firmware_signature (a detached signature over the
image).
The server issues the link only to devices eligible in the current rollout step, only while
the device is parked with the vehicle voltage above threshold and no SOS pending.
Each issue is audited.
The device downloads over HTTPS, checks the size, the SHA-256, and the signature
against its embedded public key, installs into the inactive slot, and reports
FIRMWARE_UPDATED or FIRMWARE_FAILED.
The release signing key is an asymmetric KMS key used only by the release pipeline.
The application never holds the private key.
20.7 MFA and sessions by role
TOTP is required for SEC, COR, TEC, MGT, and SAD. It is not required for STU, FAC, or
DRV.
Idle timeouts follow Part 12.1.
20.8 Route geometry upload (GeoJSON)
Accept a LineString only, with at least 2 and at most 2,000 points, in WGS84 longitude
and latitude order.
All points must lie inside the service area.
Maximum file size 2 MB. The same content checks apply as to CSV (Part 13.16).
Each upload creates a new geometry version. Existing trips keep the version pinned at
their start.
20.9 Trip summary fields
Computed when a trip completes. Distance in kilometres to one decimal place, from the
active source only (Part 9.15). Duration from first to last valid sample. Average moving
speed, excluding samples below 3 km/h. Stops arrived and departed, with times.
Boardings by method (QR, DRIVER), and late boardings. Source usage as percentages of
trip time for HW, PHONE, and no source. Failover count. Longest data gap in minutes. SOS
incidents linked to the trip.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 106 of 118


<!-- PAGE 107 -->

20.10 CI, CD, and release
CI steps, in order: install from the lockfile; lint; typecheck; unit tests; contract tests;
API integration tests; container image build; dependency scan; secret scan; static
analysis; OpenAPI generation with a breaking-change check against the last release;
migration check.
CD: staging deploys automatically when main changes. Production requires approval
from an engineer other than the author, and from the super admin. Canary: update one
of the two API tasks, watch error rate and latency for 15 minutes, then update the
second.
Mobile release: EAS Build and EAS Submit. Android staged rollout at 10 percent, then
50, then 100 over three days, with crash-free sessions at or above 99.5 percent. iOS
phased release over seven days. The API enforces the minimum supported app
version. Over-the-air JavaScript updates are for non-native fixes only.
Rollback: redeploy the previous API image within 10 minutes. No down-migrations in
production. For mobile, halt the staged rollout and ship a fix.
Migrations are expand-then-contract and run only in the change window (Part 14.5,
service hours). Risky features ship behind flags that default to off in production.
20.11 Deployment specifics
Hostnames: api, ingest (its own certificate chain, DNS TTL 60 seconds), admin, and
status, all under the college domain.
Region: an AWS region in India with every required service. All personal and location
data stays in India.
API: ECS on Fargate, minimum 2 tasks across 2 availability zones. Autoscale between 2
and 6 tasks at 60 percent CPU. Workers: minimum 2 tasks, scaled on queue depth.
Load balancer: HTTPS listener. Liveness check on /health every 10 seconds. Readiness
on /health/ready decides which tasks receive traffic. Deregistration delay 30 seconds.
A separate listener rule for ingest, behind WAF rate rules.
Database: RDS PostgreSQL 16, Multi-AZ, with PostGIS. Storage autoscaling. Point-in-
time recovery for 7 days. Daily snapshots kept 30 days. RDS Proxy for pooling.
Storage: S3 with versioning, KMS encryption, public access blocked, and a lifecycle rule
that deletes exports after 7 days.
Certificates: ACM with automatic renewal. Expiry monitored (Part 11.5).
Configuration: secrets in Secrets Manager, non-secret values in Parameter Store.
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 107 of 118


<!-- PAGE 108 -->

Infrastructure as code: Terraform. Dev, staging, and production in separate AWS
accounts. Console changes are not allowed except through RB-13.
Backups: restore drill each quarter, with the measured time recorded.
Disaster recovery: single region for the MVP. The regional procedure takes about 4
hours, which is accepted unless decision 16 changes it.
Cost: budget alerts at 50, 80, and 100 percent of the monthly budget.
20.12 Runbooks
Write each runbook in docs/runbooks with a trigger, the first five minutes, diagnosis,
mitigation, a communication template, and a post-incident review within five working
days.
RB-01 Fleet silence.
RB-02 SOS not delivered.
RB-03 API errors above threshold.
RB-04 Database failover.
RB-05 Device token compromise.
RB-06 Certificate renewal failure.
RB-07 Queue backlog.
RB-08 Rolling back an API or app release.
RB-09 Restoring from backup.
RB-10 Halting a firmware rollout.
RB-11 Notification provider outage.
RB-12 Personal data breach response.
RB-13 Use of the emergency access account.
20.13 Reports and who may open them
Report
Roles
Attendance by trip
COR, FAC (own buses), MGT (counts only)
Absence alerts
COR, FAC (own buses)
Trip history
COR, FAC (own buses), MGT (aggregate)
Source usage per bus per day
COR, TEC
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 108 of 118


<!-- PAGE 109 -->

Each export is written to the audit log with its filters and row count (Part 11.6).
20.14 CSV import columns
All files are UTF-8 with a header row, at most 5 MB and 10,000 rows. Dates are YYYY-MM-
DD. Times are HH:MM campus time. Every file is dry-run first (Part 11.8).
Report
Roles
Device uptime
TEC, COR
SOS incidents
COR, SEC (own view), SAD
Stop requests
COR
Users by role (no sensitive columns)
COR, SAD
Audit log
SAD. COR read-only
Data requests
COR, SAD
File
Columns
Rules
users.csv
college_id, full_name, email, role,
phone, department, year_of_study,
date_of_birth, route_code,
boarding_stop_code, bus_number,
is_primary
One role per row. college_id and
email unique. Email on a college
domain, except DRV. role is STU,
FAC, DRV, TEC, or COR. STU needs
route_code, boarding_stop_code,
and date_of_birth. FAC and DRV
need bus_number. is_primary is
yes or no for FAC
buses.csv
bus_number, registration_number,
capacity, insurance_expiry,
fitness_expiry, pollution_expiry,
permit_expiry
bus_number and
registration_number unique.
Capacity 1 to 150
devices.csv
device_id, serial_number, imei,
iccid
device_id HW_ and 3 or 4 digits.
imei 15 digits. iccid 19 or 20 digits.
Provisioning only
stops.csv
stop_code, name, latitude,
longitude, radius_m
Inside the service area. radius_m
defaults to 50
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 109 of 118


<!-- PAGE 110 -->

Rules: cells starting with =, +, -, or @ are rejected. Duplicate keys in a file fail every row
that repeats them. Updates to existing records are shown in the dry run with old and new
values. Imports never change a record silently.
20.15 Edge cases
Each case has a test (Part 15.2). Required behaviour is listed for each.
File
Columns
Rules
routes.csv
route_code, name
route_code unique
route_stops.csv
route_code, stop_code, sequence
Sequence unique within a route,
starting at 1
timetables.csv
route_code, trip_type,
departure_time, weekday_mask
trip_type MORNING or
AFTERNOON. weekday_mask
such as MON-FRI or MON,WED,FRI
roster.csv
bus_number, driver_email,
valid_from
driver_email must match a DRV
user
#
Scenario
Required behaviour
1
Two physical devices share a
device_id
The second device's token fails with 401. Sev
2 alert. Nothing is mixed
2
Device reboots during a batch
New boot_id. Unacknowledged samples
resent with the old boot_id
3
Device clock two hours ahead
CLOCK_SKEW recorded. Ordering uses
received_at
4
Cellular down 40 minutes, then flush
Samples older than 10 minutes are
BUFFERED and never update live state
5
Driver phone dies, hardware works
Hardware stays active. Only the phone
status changes
6
Hardware and phone both fail
UNAVAILABLE after 120 seconds.
Coordinator alerted
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 110 of 118


<!-- PAGE 111 -->

#
Scenario
Required behaviour
7
Tracker moved to another bus without
an update
Positions diverge by more than 500 m for 2
minutes while moving. Possible tracker swap
alert
8
Two drivers start the same bus
Second start blocked with
BUS_ALREADY_ON_SHIFT, showing who
holds it
9
Student scans on a bus not serving
their route
NOT_ON_ROUTE. Nothing written
10
Student changes route mid-term
New dated assignment. Past attendance
unchanged
11
Trip cancelled after some boardings
Boardings kept. Trip CANCELLED. Summary
marked cancelled
12
Driver ends shift while SOS is open
Blocked. Only the coordinator can end it,
with a reason
13
SOS from a bus with no hardware
Incident from the phone trigger. Noted as no
hardware button
14
Device revoked while its bus is on
shift
Hardware rejected within 5 seconds. Phone
continues. Alert
15
Student deactivated on a boarding
day
Removed from expected lists from the
effective date. Boardings kept
16
Bus has no faculty
Alerts go to the coordinator. Console
warning shown
17
Route has no students
Trip runs. Empty list. No absence alerts
18
Route geometry edited during a trip
Trip keeps the version pinned at its start
19
Stop removed while the bus heads to
it
Skipped in ETA. Driver notified
20
24 hours of buffered data flushed
About 173 requests at one per 2 seconds,
about 6 minutes. Live state only from fresh
data
21
Hardware and phone fresh but 300 m
apart
Active source used. Alert only if it lasts 10
minutes
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 111 of 118


<!-- PAGE 112 -->

20.16 Test IDs added
T-MOB-01: two hours of background tracking on each reference phone uses no more
than 8 percent battery per hour.
T-MOB-02: Android battery optimisation enabled shows the pre-trip warning.
T-MOB-03: iOS with Always permission denied blocks the start and shows the fix
steps.
T-FO-01 to T-FO-04 and T-LOAD-01 to T-LOAD-02 are in Part 15.3.
T-A11Y-01 is in Part 15.2.
20.17 Configuration keys added
ops.peak_windows: set at kickoff. Releases avoid these windows.
sos.message_max_chars: 280.
#
Scenario
Required behaviour
22
Phone reports a mock location
Stored, flagged, never live. Driver warned.
Coordinator alerted
23
Notification for a deactivated user
SUPPRESSED and logged
24
Student on two routes for one trip
type
Second assignment blocked (R-06)
25
Export of 120,000 rows
Split by date range. User told which ranges
are included
26
Screenshot of a boarding QR
Valid for one 30-second slot only. Residual
risk recorded
27
New SOS after the earlier incident
was resolved
New incident. Joining applies only to OPEN
incidents
28
Bus loses all power during an SOS
Sent only if the device had backup power.
Limit recorded in the hardware
specification
29
Threshold changed during a trip
Applies from the next evaluation. Logged
30
Public holiday
Trip generator skips dates in the holiday
calendar
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 112 of 118


<!-- PAGE 113 -->

sos.escalation contacts and duty lists: stored as configuration values, not as code.
firmware.url_ttl_s: 900.
sos.security_office_phone: shown to students offline (Part 10.3).
20.18 Software does not depend on the controller model
The software depends only on the ingest contract (Part 8.4) and its versioning rules. It
must not depend on the controller model (ESP8266 or ESP32), the GNSS source, or the
firmware language. A change to the contract follows Part 8.1 versioning.
Part 21. Amendments, register, and reading lists (binding)
This part records what changed in this version, the conflict register, the specification
sections to read for each phase, and the coverage gate. It applies with the rest of this
prompt.
21.1 What changed in this version
Device status: PROVISIONED is accepted only on the first request (Parts 5.2 and 6.3).
Resolves C-01.
Student app: tasks P2-T9 to P2-T14 (boarding QR scanner, stop requests, leave,
attendance history, profile and privacy, trip completed view).
Security staff mobile screens (P6-T8) and management dashboards (P7-T7).
Build order: the SOS create-or-join service and the notification dispatcher core moved
to P3-T16, so the driver SOS button and the faculty absence alerts have a working path.
Bench mode: device status BENCH and task P4-T9.
Storage added: sos_incidents.category, buses.default_mode,
student_profiles.approach_threshold_min, source_switches.note.
Field name: is_mock everywhere, replacing mocked. Resolves C-03.
Incident timeline CSV export through POST /exports (P6-T2). GET /tickets added to
Part 8.3.
Research: RS-01 to RS-15 are the research IDs. RS-16 to RS-20 added (Part 4).
Broken reference fixed: Part 12.1 now points to Part 15.6.
Job-to-task map added (21.6).
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 113 of 118


<!-- PAGE 114 -->

21.2 Conflict register
Applied means the text in this version already follows the resolution. Awaiting means the
named owner must confirm before the affected task is built.
ID
Issue
Resolution in this version
Owner
Status
C-
01
Part 5.2 required
status ACTIVE, but
Parts 6.2 and 6.3
let a
PROVISIONED
device connect
PROVISIONED is accepted
only on its first request,
with first_used_at empty.
That request sets ACTIVE
in the same transaction
Engineering
lead with the
ECE team
Applied.
Awaiting
engineering
confirmation
C-
02
Turnstile on OTP
requests is not in
the specification
(F-AUTH-02)
Kept as an added bot
control, recorded in
docs/decisions/defaults-
used.md
Engineering
lead and
counsel
Applied.
Awaiting
confirmation
C-
03
The field was
called mocked
here and is_mock
in the specification
is_mock everywhere
Engineering
lead
Applied
C-
04
SOS category is
captured (spec
19.1) but had no
column
category column added to
sos_incidents
Engineering
lead
Applied
C-
05
Heartbeat
returned
firmware_target
only, so the device
could not
download the
image
Part 20.6 defines
firmware_url, sha256, size,
and signature
ECE team
Awaiting ECE
confirmation of
the device side
(HW-SPEC
section 17)
C-
06
Export download
link lifetime: spec
section 23 says 24
hours
24 hours for exports (Parts
11.6 and 13.13). Firmware
links stay at 15 minutes
(Part 20.6)
Product
owner
Awaiting
product owner
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 114 of 118


<!-- PAGE 115 -->

21.3 Specification sections to read before each phase
Read each listed section in full before starting the phase. Record the section numbers
read in docs/progress/PXX-plan.md.
ID
Issue
Resolution in this version
Owner
Status
C-
07
Release gate
required every
email to be on a
college domain,
but spec section 4
allows driver email
Non-college driver email
allowed only with a
recorded exception (Parts
15.4 and 17)
Product
owner and
counsel
Applied
C-
08
Part 5.5 described
the SOS handler,
which depends on
the SOS service
built later
The SOS handler is built in
P3-T16. P1-T4 excludes SOS
from its handlers
Engineering
lead
Applied
Phase
Specification sections
P0
1, 2, 4, 6, 7, 8, 10, 28, 31, 33, 34, 35
P1
5, 9, 10.5, 11, 12, 13, 14, 17.3, 25, 26.2, 26.3, 30, 32.2,
32.3
P2
13.7, 16.1, 16.2, 17, 20, 21, 30
P3
11.7, 13.1, 13.2, 13.6, 15, 16.3, 18.3, 19 (driver triggers),
30, 32.3
P4
5, 16.4, 16.5, 16.6, 16.8, 24, 26.4, 26.5, 26.6, 26.9, 27,
33.8, 13.8, 36
P5
18, 21.1 to 21.6, 21.9, 22, 25, 26.7
P6
19, 20, 21, 26.8, 26.9
P7
10.10, 22 (privacy-related alerts), 23, 26.9, 29
P8
28, 30, 31, 32, 33
P9
30, 31.6, 32, 33, 34, 36, 37, 38, 39
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 115 of 118


<!-- PAGE 116 -->

21.4 Roles: who creates them and how they sign in (spec section 4)
21.5 Notification categories and channels (spec section 21.1)
Role
Created by
Sign-in
Admin MFA
STU
Imported from college records
College SSO
No
FAC
Coordinator
College SSO
No
DRV
Coordinator
Email OTP
No
SEC
Coordinator
College SSO
Yes
COR
Super admin
College SSO
Yes
TEC
Coordinator
College SSO
Yes
MGT
Super admin
College SSO
Yes
SAD
Set at deployment (minimum two)
College SSO
Yes
Category
Examples
Default
channels
Can be turned off
Quiet
hours
apply
SAFETY
SOS and its status
changes; bus
unavailable (faculty)
Push and in-
app. SMS
for SOS
No
No
ATTENDANCE
Boarding
confirmation, absence
alert, leave
confirmation
Push and in-
app
Boarding
confirmation: yes.
Faculty absence
alert: no
Yes, except
absence
alerts
TRIP
Started, approaching
stop, late start, delay,
cancellation
Push and in-
app
Yes
Yes
ADMIN
Stop request decision,
announcements,
route change, expiry
reminders
Push, in-
app, email
Yes
Yes
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 116 of 118


<!-- PAGE 117 -->

21.6 Background job to task map (spec section 25, Part 12.3)
Category
Examples
Default
channels
Can be turned off
Quiet
hours
apply
SYSTEM
Sign-in from a new
device, consent
updates, data request
updates
Email and
in-app
Consent and
security: no.
Others: yes
Yes
Job
Built in
source-selector
P1-T7
stale-checker
P1-T7
device-health-checker
P1-T4
shift-auto-end
P3-T18
trip-generator
P5-T1
late-start-check
P5-T1 (schedule) and P3-T3 (shift creation)
attendance-expected-builder
P3-T3 and P5-T1
boarding-cutoff
P5-T4
absence-evaluator
P5-T7
sos-escalator
P6-T2
notification-dispatcher
P3-T16 (core), P6-T3 (complete)
cert-and-token-check
P8-T1
retention-purger
P7-T4
partition-manager
P0-T3
export-generator
P7-T1
coordinator-summary
P5-T7
backup-verifier
P8-T7
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 117 of 118


<!-- PAGE 118 -->

21.7 Coverage gate (extends Part 19.2)
docs/progress/coverage.md must map every item below to a task, a test, and a status
before the release gate (Part 17):
Feature IDs in Part 10.2.
Business rules R-01 to R-20 (Part 20.2).
Acceptance criteria AC-* in Parts 10 and 11, and the criteria in specification sections 16
to 19.
Endpoints in Part 8.3, checked against the route inventory.
Configuration keys in Part 14.4.
Test cases in Part 15.2, including the T-MOB, T-A11Y, and T-FO cases.
Edge cases in Part 20.15.
Release gate items in Part 17.
Jobs in Part 21.6.
Operational alerts in specification section 22.
Event types in Part 5.5 and specification section 12.
Roles (Part 21.4) and the permissions matrix (Part 20.1).
Conflicts C-01 to C-08 must show Applied, or a named owner's approval, before the
release gate.
Job
Built in
rate-counter-cleanup
P0-T9
Antigravity Master Build Prompt: College Bus Tracker (AG-MASTER-1.0)
Page 118 of 118
