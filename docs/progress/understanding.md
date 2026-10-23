# College Bus Tracker: System Understanding & Specification Analysis

**Document Status:** Done Specification Analysis & Requirements Baseline  
**Based on:** `SW-MVP-1.0` (Software MVP Specification) and `HW-SPEC-1.0` (Hardware Specification)  
**Date:** October 2026

---

## 1. Project Summary

### 1.1 What the Project Is

The **College Bus Tracker** is an enterprise-grade transit tracking, student safety, attendance, and emergency management platform designed for a fleet of 50 or more college buses (`SW-MVP-1.0` §1.1, §1.4; `HW-SPEC-1.0` §1.4). It consists of:

1. Dedicated on-vehicle hardware trackers installed on each bus (`HW-SPEC-1.0` §1.1).
2. A cross-platform mobile application (iOS and Android built with React Native/Expo) serving students, faculty, and drivers (`SW-MVP-1.0` §1.1, §7).
3. A centralized administrative web console (built with React, Vite, and shadcn/ui) serving transport coordinators, technicians, security officers, and management (`SW-MVP-1.0` §1.1, §7, §24).
4. A resilient backend API and asynchronous background job worker architecture (Node.js/NestJS, PostgreSQL + PostGIS, and pg-boss) hosted on AWS in an India region (`SW-MVP-1.0` §6.1, §6.2, §7, §34.2, §41 #2).

### 1.2 Who Uses It

The platform serves seven explicit roles across mobile and web interfaces (`SW-MVP-1.0` §4, §5):

- **Students (STU):** Track assigned buses in real time, view stop ETAs, scan dynamic boarding QR codes to record attendance, submit stop requests, apply for trip leaves, and raise SOS emergencies.
- **Faculty (FAC):** Monitor assigned buses and trip progress, verify student check-ins, receive automated morning-present/afternoon-absent student safety alerts, call drivers, mark student leaves, and acknowledge/resolve emergency alerts.
- **Drivers (DRV):** Perform digital pre-trip safety checks, transmit backup GPS telemetry during active shifts, display dynamically rotating HMAC boarding QR codes, execute manual student check-ins, report maintenance tickets, toggle tracking modes, and trigger emergency SOS alerts.
- **Campus & Gate Security (SEC):** View a live, read-only fleet map of all active buses, immediately receive Tier 0 SOS alarms with full incident timelines, and coordinate emergency responses.
- **Transport Coordinators (COR):** Manage fleet assets, link hardware devices to buses, design routes/geometries/stops, configure timetables, roster drivers, assign faculty, import student rosters via CSV, review stop requests, override tracking modes, and supervise emergency incidents.
- **Technicians (TEC):** Provision hardware trackers, flash unique cryptographic tokens, verify bench/installation checklists, monitor device hardware health (battery, cellular RSSI, GNSS fix quality, buffer use), execute staged firmware rollouts, and resolve maintenance tickets.
- **Management (MGT):** Review high-level aggregated performance metrics (fleet on-time rates, trip completion statistics, weekly SOS counts, route attendance rates, device uptime) without exposure to personally identifiable information (PII) or raw location histories.
- **Super Admins (SAD):** Manage role allocations, SSO domain/OIDC configurations, security thresholds, feature flags, audit logs, DLT SMS templates, and emergency break-glass procedures.

### 1.3 Why It Exists

College transport operations face critical safety liabilities and operational visibility challenges:

- **Student Safety & Transit Accountability:** The system provides definitive proof of student boarding and triggers automated escalation alerts when a student who commuted to college in the morning fails to board the afternoon return bus (`SW-MVP-1.0` §1.2 G5, §18.6).
- **Zero Black-Box Failures (High Reliability Telemetry):** Standalone hardware trackers frequently suffer from power disconnects, cellular dead zones, or GNSS multipath issues. College Bus Tracker implements a transparent **dual-source architecture**: on-bus hardware is the primary source, while the driver's phone serves as an active, shift-scoped fallback source (`SW-MVP-1.0` §1.2 G2, §13). Every user always knows which source is providing location data (`SW-MVP-1.0` §1.2 G3, §13.7).
- **Life-Safety Emergency Response:** A physical guarded panic button on the bus dashboard and software SOS triggers across apps deliver high-priority emergency alerts to campus security, faculty, and administrators within 5 seconds (`SW-MVP-1.0` §1.2 G4, §19.3; `HW-SPEC-1.0` §5.5).
- **Regulatory and Data Privacy Compliance:** Designed from inception to meet India's Digital Personal Data Protection (DPDP) Act requirements, enforcing verifiable parental consent for minors under 18, strict purpose limitation, data minimization, and automated retention purges (`SW-MVP-1.0` §1.2 G7, §29).

---

## 2. How the Hardware and Software Connect

### 2.1 What the Tracker Sends

Each hardware tracker (ESP8266 or ESP32 paired with a Quectel EC200U-CN LTE/GNSS module) interacts with the backend over HTTPS using a unique pre-shared 256-bit bearer token stored in protected flash memory (`HW-SPEC-1.0` §5.1, §8, §13.3; `SW-MVP-1.0` §11.1). The tracker communicates through three primary channels:

1. **Telemetry Batches (`POST /api/v1/telemetry`):** (`SW-MVP-1.0` §11.2, §11.3)
   - Transmits batches of up to 50 location samples (max payload size 8 KB).
   - Sampling cadence: every 10 seconds when moving (> 3 km/h), every 30 seconds when stopped with ignition ON, and no samples taken when parked with ignition OFF (`HW-SPEC-1.0` §10.1).
   - Minimum gap between buffer flush requests: at most one request every 2 seconds when recovering from offline storage (`HW-SPEC-1.0` §10.1; `SW-MVP-1.0` §11.8).
   - Each sample contains: monotonically increasing sequence number `seq`, persistent boot identifier `boot_id`, UTC timestamp `recorded_at`, fix status `gps_valid`, coordinates `lat` and `lng` (up to 6 decimal places), `speed_kmh`, `heading_deg`, satellite count `satellites`, horizontal dilution of precision `hdop`, `ignition` state (`ON`, `OFF`, `UNKNOWN`), and vehicle voltage `vehicle_battery_mv`.
   - Embedded hardware events: `BOOT`, `IGNITION_ON`, `IGNITION_OFF`, `SOS`, `GPS_LOST`, `GPS_RECOVERED`, `NETWORK_RESTORED`, `BUFFER_OVERFLOW`, `LOW_VEHICLE_BATTERY`, `LOW_DEVICE_BATTERY`, `MODULE_ERROR`, `CONFIG_APPLIED`, `FIRMWARE_UPDATED`, `FIRMWARE_FAILED`, `TAMPER`, `DOOR_OPEN`/`DOOR_CLOSE`, `RFID_TAP`, and `CLOCK_SYNC` (`HW-SPEC-1.0` §10.4; `SW-MVP-1.0` §12).

2. **Device Heartbeats (`POST /api/v1/heartbeat`):** (`SW-MVP-1.0` §11.2, §11.6)
   - Sent every 60 seconds while ignition is ON, and every 10 minutes while parked (ignition OFF) (`HW-SPEC-1.0` §10.1; `SW-MVP-1.0` §11.6).
   - Reports: `uptime_s`, `network_status` (`REGISTERED`, `SEARCHING`, etc.), `sim_status` (`READY`, `LOCKED`, etc.), `signal_rssi_dbm` (-125 to 0), `vehicle_battery_mv`, internal `device_battery_mv`, `gps_status` (`FIX_VALID`, `NO_FIX`, `MODULE_ERROR`, `DISABLED`), `buffer_bytes` used and `buffer_capacity_bytes`, `ignition`, and internal temperature `temperature_c`.

3. **Token Rotation & Firmware (`POST /api/v1/devices/token/rotate`):** (`SW-MVP-1.0` §11.1, §11.2; `HW-SPEC-1.0` §8.14, §17)
   - Fetches rotated tokens with overlapping 24-hour activation windows.
   - Responds to `pending_action` directives from heartbeats (`REBOOT`, `UPDATE_CONFIG`, `FIRMWARE_UPDATE`).

### 2.2 What the Server Does with Each Message

The server runs an atomic 14-step ingestion and validation pipeline (`SW-MVP-1.0` §11.5):

1. **Authentication:** Verifies token via HMAC-SHA256 against server-held secret (returns 401 if revoked, 403 if inactive) (`SW-MVP-1.0` §11.1, §11.5).
2. **Device State Verification:** Ensures device status is `ACTIVE`. A newly provisioned device in status `PROVISIONED` is accepted only on its first authenticated request, which transitions it to `ACTIVE` (`SW-MVP-1.0` §11.5, §16.5; `HW-SPEC-1.0` §13.2; see Section 6.1).
3. **Payload Inspection:** Enforces strict 8 KB size limits (returns 413) and schema conformity (returns 400 with field errors) (`SW-MVP-1.0` §11.3, §11.5).
4. **Sanity & Range Checks:** Validates latitude (-90 to 90), longitude (-180 to 180), speed (0 to 250 km/h), satellites (0 to 40), HDOP (0.5 to 99) (`SW-MVP-1.0` §11.3).
5. **Timestamp Validation:** Rejects samples > 60 seconds in future (`FUTURE_TIMESTAMP`) or > 7 days old (`STALE_TIMESTAMP`). Samples older than 10 minutes are accepted but flagged as `BUFFERED` (used exclusively for historical audit, never live state) (`SW-MVP-1.0` §11.5, §18; `HW-SPEC-1.0` §11).
6. **Deduplication:** Deduplicates on `(device_id, boot_id, seq)`. Identical duplicates return 200 silently; conflicting payloads with identical sequence numbers return 409 `CONFLICT` or per-sample rejection (`SW-MVP-1.0` §11.5; `HW-SPEC-1.0` §11).
7. **Spatial Integrity Checks:** Rejects Null Island (0,0) with `NULL_ISLAND`. Enforces geofenced service area (campus and route corridors + 10 km buffer); outside points are stored but flagged `OUT_OF_AREA` (`SW-MVP-1.0` §11.5).
8. **Kinematic Plausibility Filter:** Calculates velocity between consecutive valid samples; if implied speed exceeds 150 km/h, rejects point with `IMPLAUSIBLE_JUMP` (resets reference if gap > 30 minutes) (`SW-MVP-1.0` §11.5).
9. **Clock Skew Detection:** If `sent_at` deviates from server UTC by > 300 seconds, flags `CLOCK_SKEW` and alerts technicians (`SW-MVP-1.0` §11.5).
10. **Storage & Queueing:** Commits accepted samples, rejected samples with error codes, and hardware events in a single database transaction. Returns `ack_seq` acknowledging up to the continuous verified sequence, allowing hardware to safely purge flash buffers (`SW-MVP-1.0` §11.4, §11.5).
11. **Trigger Source Selection:** Triggers source selector job to update `bus_state` (`SW-MVP-1.0` §11.5, §13).

### 2.3 What the Driver's Phone Adds

The driver's mobile phone acts as a managed backup sensor when an active shift is underway (`SW-MVP-1.0` §11.7, §13):

- **Shift-Bound Ingestion:** Telemetry (`POST /api/v1/driver/locations`) is authenticated via a driver session token tied specifically to an `ACTIVE` `shift_id` and restricted to buses on that driver's roster (`SW-MVP-1.0` R-16, §11.7). Outside an active shift, phone tracking is strictly disabled (§29.1, R-18).
- **Adaptive Cadence:** In **Standby Mode** (hardware healthy and active), phone transmits background GPS samples every 30 seconds. In **Fallback Mode** (hardware stale or offline), server instructs phone via `phone_interval_s` response field to increase transmission rate to every 10 seconds (`SW-MVP-1.0` §11.7, §13.6).
- **Phone Quality & Mock Filtering:** Rejects network-cell locations (`provider == NETWORK`), requires horizontal accuracy `accuracy_m <= 50m`, and blocks simulated coordinates (`is_mock == true`) (`SW-MVP-1.0` §11.7, §13.1).
- **Diagnostics Reporting (`POST /api/v1/driver/status`):** Concurrently transmits phone health metrics every 5 minutes: OS version, background permission state (`ALWAYS`), battery level, battery optimization exemptions, and network connectivity (`SW-MVP-1.0` §11.7).

### 2.4 How the Apps Show the Result

The client applications display the server's authoritative decision via the Route Snapshot API (`GET /api/v1/snapshot?route_id=...`), polled every 10 seconds by active foreground apps (`SW-MVP-1.0` §17.2, §17.3):

- **Authoritative Source State & Non-Color Dependence:** The specification explicitly mandates that color must never be the only way a state is shown; each state must also have text and an icon (`SW-MVP-1.0` §13.7, §30). The states and their text labels are (`SW-MVP-1.0` §13.7, §14.1):
  - `Live, bus tracker`: Bus is moving on shift, active source is the hardware tracker (`LIVE`, active `HW`).
  - `Live, driver's phone`: Bus is moving on shift, active source is the driver's backup phone (`LIVE`, active `PHONE`).
  - `Last update N seconds ago`: Location data has stopped updating (> 60s) but has not yet exceeded 120 seconds (`STALE`).
  - `Location unavailable. Last seen at HH:MM`: No fresh data received from either source for >= 120 seconds (`UNAVAILABLE`).
  - `Not running. Next trip at HH:MM`: Bus has no active shift (`NOT_RUNNING`). No marker is shown. It is never shown as "Offline" to students (`SW-MVP-1.0` R-20, §14.1).
- **Source Transparency:** The active source is rendered prominently beside the bus marker, never buried in submenus (`SW-MVP-1.0` §13.7).
- **Stop ETAs:** Dynamically projected along route line geometries based on the median moving speed over the past 5 minutes (clamped between 10 km/h and 60 km/h; default 20 km/h), displaying "Arriving" under 60 seconds (`SW-MVP-1.0` §17.5).

---

## 3. Users and Roles

The system enforces strict Role-Based Access Control (RBAC) and scope limitations (`SW-MVP-1.0` §4, §5):

| Role Code | Role Name             | Who They Are                                 | Authentication & Sign-in                                                                                | Admin MFA Required | Home Screen                 | Key Capabilities & Permissions Summary                                                                                                                                                                                                                                                                 |
| --------- | --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **STU**   | Student               | Enrolled college students                    | College SSO (OpenID Connect: Google Workspace / Microsoft Entra ID). No password. (`SW-MVP-1.0` §4, §8) | No                 | Live Map                    | View live positions of buses serving their assigned route only (`SW-MVP-1.0` §5, R-12); view stop ETAs; scan rotating boarding QR code; view personal attendance history; mark leaves (up to 30 min before departure); submit stop requests; trigger SOS (`SW-MVP-1.0` §16.1).                         |
| **FAC**   | Faculty               | Teachers linked to specific buses            | College SSO (OpenID Connect). (`SW-MVP-1.0` §4, §8)                                                     | No                 | My Buses                    | Monitor live trips for assigned buses; view morning and afternoon attendance lists; receive automated afternoon absence alerts; mark leaves for students on their bus; call drivers directly; receive and resolve SOS incidents (`SW-MVP-1.0` §16.2).                                                  |
| **DRV**   | Driver                | Bus drivers                                  | Email OTP (6-digit code sent via email, valid 10 min, 5 attempts max). (`SW-MVP-1.0` §4, §8, §14)       | No                 | Start Shift                 | View rostered buses; execute pre-trip safety checklist; start/end shifts; display dynamic 30-second HMAC boarding QR code; perform manual student check-ins; toggle tracking mode (Auto/HW/Phone); report maintenance tickets; trigger SOS (`SW-MVP-1.0` §16.3).                                       |
| **SEC**   | Campus Security       | Campus gate & control room security staff    | College SSO (OpenID Connect). (`SW-MVP-1.0` §4, §8)                                                     | Yes (TOTP)         | Live Map (All active buses) | Read-only live map of all active fleet buses across campus; immediate full-screen receipt of Tier 0 SOS emergency alerts with real-time timelines; acknowledge and resolve emergencies; no rights to edit routes or attendance (`SW-MVP-1.0` §16.7).                                                   |
| **COR**   | Transport Coordinator | Transport office administrative staff        | College SSO (OpenID Connect). (`SW-MVP-1.0` §4, §8)                                                     | Yes (TOTP)         | Administrative Dashboard    | Full fleet management: create buses, link devices, create routes and stop geometries, assign timetables, roster drivers, assign faculty, import student CSV rosters, review/merge stop requests, override tracking modes, manage SOS incidents, export CSV reports (`SW-MVP-1.0` §16.4).               |
| **TEC**   | Technician            | Maintenance & ECE workshop personnel         | College SSO (OpenID Connect). (`SW-MVP-1.0` §4, §8)                                                     | Yes (TOTP)         | Device Health               | Batch provision hardware trackers; generate device tokens; view real-time hardware telemetry and health diagnostics (voltage, RSSI, satellite lock, buffer); execute staged firmware rollouts; manage maintenance tickets; run bench tests; no access to student attendance data (`SW-MVP-1.0` §16.5). |
| **MGT**   | Management            | College Executive Leadership                 | College SSO (OpenID Connect). (`SW-MVP-1.0` §4, §8)                                                     | Yes (TOTP)         | Aggregate Dashboard         | High-level read-only operational analytics: fleet on-time percentage, done trips, weekly SOS volume, device uptime ratios, aggregate route attendance percentages. Absolutely no access to individual student records, raw GPS logs, or PII (`SW-MVP-1.0` §16.8).                                      |
| **SAD**   | Super Admin           | Senior IT System Owners (minimum 2 required) | College SSO (OpenID Connect) + Emergency break-glass account. (`SW-MVP-1.0` §4, §8, §16.6)              | Yes (TOTP)         | System Settings             | Super-user authority: assign user roles, configure SSO OIDC parameters and MFA policies, modify system thresholds and feature flags with mandatory audit reasons, view full append-only audit logs, inspect backups, oversee DLT SMS configurations (`SW-MVP-1.0` §16.6).                              |

### 3.1 Permissions Matrix (`SW-MVP-1.0` §5)

_Legend:_  
`Y` = Full access  
`A` = Assigned buses or own scope only  
`O` = Own records only  
`R` = Read-only  
`-` = No access

| Capability                                           |     STU      |   FAC   |     DRV     |      SEC       |     COR      |       TEC       |      MGT      | SAD |
| ---------------------------------------------------- | :----------: | :-----: | :---------: | :------------: | :----------: | :-------------: | :-----------: | :-: |
| View live bus positions                              |      A       |    A    |      A      | Y (all active) |      Y       |        R        | R (aggregate) |  Y  |
| See active source label                              |      Y       |    Y    |      A      |       Y        |      Y       |        Y        |       R       |  Y  |
| See source-switch log                                |      -       |    -    |      A      |       -        |      Y       |        Y        |       R       |  Y  |
| Start and end own shift                              |      -       |    -    |      Y      |       -        |      -       |        -        |       -       |  -  |
| Change mode                                          |      -       |    -    |      A      |       -        | Y (override) |        -        |       -       |  Y  |
| Show boarding QR                                     |      -       |    -    |      A      |       -        |      -       |        -        |       -       |  -  |
| Scan QR to board                                     |      O       |    -    |      -      |       -        |      -       |        -        |       -       |  -  |
| Manual check-in                                      |      -       |    -    |      A      |       -        |      Y       |        -        |       -       |  Y  |
| View attendance                                      |      O       |    A    |      A      |       -        |      Y       |        -        | R (aggregate) |  Y  |
| Mark leave                                           |      O       |    A    |      -      |       -        |      Y       |        -        |       -       |  Y  |
| Send SOS                                             |      Y       |    Y    |      Y      |       Y        |      Y       |        -        |       -       |  Y  |
| Receive SOS                                          |      -       |    A    | A (own bus) |       Y        |      Y       |        -        |       -       |  Y  |
| Acknowledge and resolve SOS                          |      -       |    A    |      -      |       Y        |      Y       |        -        |       -       |  Y  |
| Submit stop request                                  |      O       |    -    |      -      |       -        |      -       |        -        |       -       |  -  |
| Review stop requests                                 |      -       |    -    |      -      |       -        |      Y       |        -        |       -       |  Y  |
| Manage buses, routes, stops, timetables              |      -       |    -    |      -      |       -        |      Y       |        -        |       -       |  Y  |
| Register devices, rotate tokens                      |      -       |    -    |      -      |       -        |      -       |        Y        |       -       |  Y  |
| Link device to bus                                   |      -       |    -    |      -      |       -        |      Y       |        -        |       -       |  Y  |
| Revoke device token                                  |      -       |    -    |      -      |       -        |      Y       |        -        |       -       |  Y  |
| Manage assignments (roster, faculty, student routes) |      -       |    -    |      -      |       -        |      Y       |        -        |       -       |  Y  |
| Import users, deactivate users                       |      -       |    -    |      -      |       -        |      Y       |        -        |       -       |  Y  |
| Assign roles                                         |      -       |    -    |      -      |       -        |      -       |        -        |       -       |  Y  |
| Report a bus problem (ticket)                        |      -       |    -    |      Y      |       -        |      Y       |        Y        |       -       |  Y  |
| Publish announcements                                |      -       |    -    |      -      |       -        |      Y       |        -        |       -       |  Y  |
| Reports                                              | O (own att.) |    A    |      -      |       -        |      Y       | R (device rpts) |       R       |  Y  |
| Audit log                                            |      -       |    -    |      -      |       -        |      R       |        -        |       -       |  Y  |
| Thresholds and feature flags                         |      -       |    -    |      -      |       -        |      R       |        -        |       -       |  Y  |
| Process personal data requests                       |   O (own)    | O (own) |   O (own)   |    O (own)     |      Y       |        -        |       -       |  Y  |

---

## 4. Main Flows (Step-by-Step)

### 4.1 Driver Starting a Shift (`SW-MVP-1.0` §15.1, §15.2, §16.3)

1. **Sign-In:** Driver opens the mobile app, enters their email, receives a 6-digit email OTP, and authenticates (`SW-MVP-1.0` §8 F-AUTH-02, §16.3).
2. **Bus & Trip Selection:** Driver selects a bus from their authorized roster and picks the trip type (`MORNING` or `AFTERNOON`, pre-selected based on timetable) (`SW-MVP-1.0` §15.1).
3. **Automated Pre-Trip Diagnostics:** The app runs an 8-point automated pre-flight check (`SW-MVP-1.0` §15.1):
   - Confirms driver is rostered on the bus (blocks on failure).
   - Verifies trip type selection (blocks on failure).
   - Inspects hardware tracker status via server: Green (heartbeat < 2m and fix valid), Amber (heartbeat < 2m, no fix), or Red (no heartbeat < 2m). _Non-blocking: if Red, start is permitted with a warning and phone tracking becomes primary._
   - Validates phone location permission is set to `Always` (blocks on failure; shows OS remediation guide).
   - Confirms push notification permission is granted (blocks on failure).
   - Checks battery optimization exemption on Android (warns if not disabled).
   - Obtains phone GPS fix with accuracy <= 50m within 60 seconds (blocks unless hardware status is Green).
   - Confirms backend network reachability via driver status ping (blocks on failure).
4. **Shift Activation:** Driver taps "Start Shift". Server checks that no other shift is currently active on that bus (returns 409 `BUS_ALREADY_ON_SHIFT` if locked) (`SW-MVP-1.0` §15.2, §37 #8).
5. **State Initialization:** Server creates the `shift` record (`ACTIVE`), sets bus mode to `AUTO`, creates `EXPECTED` attendance records for all assigned route students not on leave, triggers phone standby background tracking, and dispatches a push notification to assigned faculty (`SW-MVP-1.0` §15.2).

### 4.2 Student Boarding the Bus (`SW-MVP-1.0` §18.1, §18.2, §18.5, §16.1)

1. **Boarding Window Opens:** 10 minutes prior to scheduled departure (or from actual departure if delayed), the boarding window opens (`SW-MVP-1.0` §18.5).
2. **Dynamic QR Generation:** The driver's active shift screen displays a dynamic QR code that regenerates every 30 seconds with a countdown timer. The payload includes `bus_id`, `trip_id`, and a 30-second time slot signed with HMAC-SHA256 using the monthly rotating attendance secret key (`SW-MVP-1.0` §18.1).
3. **Scan Execution:** Student boards the vehicle, opens the mobile app, taps "Board bus", and scans the driver's QR code using their device camera (`SW-MVP-1.0` §16.1, §18.2).
4. **Server Validation Pipeline:** Student app submits token to `POST /api/v1/attendance/scan`. Server checks in strict sequence:
   - Valid student session (`AUTH_REQUIRED`).
   - HMAC signature integrity (`QR_INVALID`).
   - Token slot freshness—accepts current slot or immediately preceding slot (covering 30s clock/network drift) (`QR_EXPIRED`).
   - Trip is active for specified bus (`TRIP_NOT_ACTIVE`).
   - Student is expected on this trip: on the route for the trip type and date, and not on leave (`NOT_ON_ROUTE`).
   - Student is not already checked in (`DUPLICATE_BOARDING`).
   - Boarding window is currently open (`BOARDING_WINDOW_CLOSED`).
5. **Attendance Commitment:** Server writes `attendance_records` row (`status = BOARDED`, `method = QR`, `boarding_stop_id = student.boarding_stop_id`). Returns confirmation to student ("Boarded Bus 01 at 07:42") and increments live boarding count on driver and faculty dashboards (`SW-MVP-1.0` §18.2, §16.1, §16.2).

### 4.3 SOS Emergency Alert (`SW-MVP-1.0` §19, §10.7; `HW-SPEC-1.0` §5.5, §10.4)

1. **Triggering the Alert:**
   - _Via Hardware:_ Driver presses physical red guarded panic button on dashboard for >= 300 ms. Tracker activates red LED, sounds buzzer, and immediately sends `SOS` event (`POST /api/v1/telemetry`), retrying every 5 seconds until acknowledged (`HW-SPEC-1.0` §5.5, §10.4).
   - _Via Mobile App:_ Driver, student, faculty, or security holds the in-app SOS button for 2 seconds (with visual countdown), optionally selecting category (`Emergency`, `Medical`, `Breakdown`, `Other`) (`SW-MVP-1.0` §19.1).
2. **Server Incident Creation / Deduplication:** Within 1 second of receipt, server evaluates open incidents for that bus. If an incident was opened within the last 60 seconds, it attaches the event as a `JOINED` record; otherwise, it spawns a new `sos_incidents` record (`status = OPEN`, `current_tier = 0`) (`SW-MVP-1.0` §19.2).
3. **Tier 0 Fan-Out (< 5 Seconds):** Server broadcasts high-priority push notifications and full-screen in-app audible alarm modals to assigned bus faculty, on-duty campus security, and transport coordinators. Also sends confirmation back to device, causing tracker LED to transition from solid red to slow blinking red for 60 seconds (`SW-MVP-1.0` §19.3, §19.5; `HW-SPEC-1.0` §9, §10.4).
4. **Escalation Hierarchy (Checked every 15s by background job):** (`SW-MVP-1.0` §19.3, §19.4)
   - _Tier 1 (2 min unacknowledged):_ Push and SMS (via DLT transactional gateway) to all coordinators and bus escalation contacts.
   - _Tier 2 (5 min unacknowledged):_ Push, SMS, and email to Super Admins, the security office number, and the college emergency desk email.
   - _Tier 3 (10 min unacknowledged):_ SMS and push to the college emergency contact list, repeated every 5 minutes until resolved.
5. **Response & Resolution:** Any authorized responder (FAC, SEC, COR) marks the incident `RESPONDING`, which immediately stops escalation for the incident (`SW-MVP-1.0` §19.4). Following emergency mitigation, the responder marks the incident `RESOLVED` with a mandatory descriptive note (up to 500 characters) (`SW-MVP-1.0` §19.7).

### 4.4 Stop Request Submission & Approval (`SW-MVP-1.0` §20)

1. **Student Submission:** Student opens route map, places a pin for a proposed stop, and enters a proposed name (up to 60 chars) (`SW-MVP-1.0` §20.1).
2. **Server Spatial Validation:** (`SW-MVP-1.0` §20.1)
   - Checks frequency limit (max 1 request per student per 7 days).
   - Validates pin is within 300 meters of the existing route geometry LineString (rejects with `REJECT_OUTSIDE_ROUTE` if outside).
   - Checks proximity to existing approved stops; if <= 100 meters, rejects with reference to existing stop.
   - Checks proximity to existing pending requests; if <= 100 meters, registers the student as a vote for the existing pending request.
   - If clean, creates `stop_requests` record (`PENDING`).
3. **Peer Voting:** Other students assigned to that route can view pending proposals and cast a single supporting vote (`SW-MVP-1.0` §20.2).
4. **Coordinator Review & Action:** Coordinator reviews pending stops on the web console map, examining vote tallies, proposed coordinates, and distance from the route line. Coordinator can:
   - _Approve:_ Adjust pin location/name, select insertion sequence in route stop order, and set `effective_from` date (`SW-MVP-1.0` §20.3, §20.4).
   - _Reject:_ Provide mandatory reason (Outside service area, Too close, Unsafe location, Other) (`SW-MVP-1.0` §20.3).
   - _Merge:_ Combine into another pending request, aggregating votes (`SW-MVP-1.0` §20.3).
5. **Activation:** On `effective_from`, the stop is inserted into active route stops and reflected in subsequent trip timetables and snapshot APIs (`SW-MVP-1.0` §20.4).

### 4.5 Morning-Present, Afternoon-Absent Safety Alert (`SW-MVP-1.0` §18.6, §25)

1. **Attendance Baseline:** A student assigned to a bus route checks in during the morning trip (`status = BOARDED` or `LATE_BOARDED`) (`SW-MVP-1.0` §18.6).
2. **Afternoon Cutoff Evaluation:** The student has an `EXPECTED` record for the afternoon return trip. The afternoon boarding cutoff passes (15 minutes after scheduled/actual departure) (`SW-MVP-1.0` §18.5, §18.6).
3. **Boarding-Cutoff Job Execution:** The per-minute `boarding-cutoff` worker marks all unboarded students on that trip as `ABSENT` (`SW-MVP-1.0` §18.4, §25).
4. **Absence-Evaluator Execution:** The `absence-evaluator` background job triggers immediately after cutoff (and every 5 minutes as a safety net) (`SW-MVP-1.0` §18.6, §25).
5. **Rule Verification:** Evaluates condition: Morning trip is `BOARDED`/`LATE_BOARDED` AND Afternoon trip is `ABSENT` AND student is NOT marked `ON_LEAVE` (`SW-MVP-1.0` §18.6).
6. **Alert Dispatch:** Spawns an `absence_alerts` record (limited to once per student per service date). Immediately pushes high-priority push notifications and in-app alerts to the primary faculty assigned to the afternoon bus (falling back to all assigned faculty, then coordinator) (`SW-MVP-1.0` §18.6).
7. **Resolution:** Faculty investigates, adds notes, and acknowledges the alert. If the student boards late, the check-in is logged as `LATE_BOARDED` and the absence alert automatically transitions to `BOARDED_LATE` (`SW-MVP-1.0` §18.6).

---

## 5. Key Rules and Numbers

Below is a consolidated index of critical numerical thresholds, operational parameters, and strict rules across both specifications:

### 5.1 Telemetry, Ingestion & Quality Filters

- **Hardware Telemetry Cadence:** 10s when moving (> 3 km/h), 30s when stopped (ignition ON), 600s (10 min) when parked (ignition OFF) (`HW-SPEC-1.0` §10.1; `SW-MVP-1.0` §35 `hw.moving_interval_s`, `hw.stopped_interval_s`, `hw.parked_heartbeat_s`).
- **Buffer Flush Cadence:** Minimum gap of at most 1 request every 2 seconds during reconnection (`HW-SPEC-1.0` §10.1; `SW-MVP-1.0` §11.8).
- **Batch Sizes & Payload Limits:** Max 50 samples per request (`HW-SPEC-1.0` §8.6; `SW-MVP-1.0` §11.3, §35 `ingest.batch_max`). Max payload size 8 KB for hardware (`SW-MVP-1.0` §11.3), 16 KB for driver phone (`SW-MVP-1.0` §11.7).
- **GNSS Quality Thresholds:** Satellites >= 4, HDOP <= 5.0 for valid fix (`HW-SPEC-1.0` §8.3; `SW-MVP-1.0` §13.1, §35 `hw.min_satellites`, `hw.max_hdop`). Commissioning outdoor check expects >= 6 satellites and HDOP <= 2.0 (`HW-SPEC-1.0` §15 #5).
- **Phone GPS Thresholds:** Horizontal accuracy `accuracy_m` <= 50m (`SW-MVP-1.0` §13.1, §35 `phone.max_accuracy_m`); provider must NOT be `NETWORK`; `is_mock` must be false (`SW-MVP-1.0` §11.7, §13.1).
- **Timestamp Tolerances:** Future timestamps > 60s rejected (`FUTURE_TIMESTAMP`); timestamps > 7 days rejected (`STALE_TIMESTAMP`); timestamps > 10 min marked `BUFFERED` (history only) (`SW-MVP-1.0` §11.5, §35 `ingest.future_tolerance_s`, `ingest.buffered_after_min`, `ingest.stale_timestamp_days`).
- **Plausibility & Geofencing Limits:** Implied speed jump > 150 km/h rejected (`IMPLAUSIBLE_JUMP`) unless time gap > 30 min (`SW-MVP-1.0` §11.5, §35 `ingest.jump_max_kmh`, `ingest.jump_reset_min`). Service area buffer is campus and route corridors + 10 km (`SW-MVP-1.0` §11.5, §35 `ingest.service_area_buffer_km`).
- **Clock Skew:** Discrepancy > 300 seconds between device `sent_at` and server UTC raises `CLOCK_SKEW` alert (`SW-MVP-1.0` §11.5, §35 `ingest.clock_skew_s`).
- **Ingestion Throughput Limits:** Hardware telemetry: 1 req / 2s (burst 5); Heartbeat: 1 req / 30s (burst 3); Driver locations: 1 req / 5s (burst 10); Driver status: 1 req / 60s (burst 3); Global ingestion ceiling: 200 req/sec (`SW-MVP-1.0` §11.8, §35 `ingest.global_rps`).

### 5.2 Source Selection & State Logic

- **Freshness Window:** Valid fix no older than 60 seconds is considered fresh (`SW-MVP-1.0` §13.1, §35 `hw.stale_after_s`).
- **Automatic Switching Cooldown:** Minimum 30 seconds between automatic source transitions (`SW-MVP-1.0` §13.3, §35 `selector.cooldown_s`).
- **Return to Hardware Requirement:** Requires 3 consecutive valid hardware fixes within 30 seconds to fail back from phone to hardware (`SW-MVP-1.0` §13.3, §35 `selector.return_fixes`, `selector.return_window_s`).
- **Both Sources Down / Unavailable:** If neither source is fresh for 120 seconds, bus state becomes `UNAVAILABLE` and triggers an alert (`SW-MVP-1.0` §13.3, §35 `selector.both_down_s`).
- **Anti-Flapping Protection:** If a bus switches > 6 times in 10 minutes, lock source for 5 minutes (300s) and alert technician (`SW-MVP-1.0` §13.5, §35 `selector.flap_limit`, `selector.flap_hold_s`).
- **Phone Reporting Cadences:** Standby mode (HW active) = 30 seconds; Fallback mode (Phone active) = 10 seconds (`SW-MVP-1.0` §13.6, §35 `phone.standby_interval_s`, `phone.fallback_interval_s`).
- **Snapshot Polling & Cache:** Clients poll every 10 seconds; server caches snapshots for 3 seconds per route (`SW-MVP-1.0` §17.2, §17.3, §35 `snapshot.cache_s`, `app.poll_foreground_s`, `web.poll_s`).

### 5.3 Shifts, Timetables & Stop Detection

- **Stop Detection Geometric Radii & Dwell:** Stop arrival: inside stop radius (default 50m) at speed < 5 km/h for 15 seconds (`SW-MVP-1.0` §17.4, §35 `stop.radius_m`, `stop.arrival_speed_kmh`, `stop.arrival_dwell_s`). Stop departure: outside radius for 10 seconds OR speed > 10 km/h (`SW-MVP-1.0` §17.4, §35 `stop.departure_dwell_s`, `stop.departure_speed_kmh`).
- **ETA Speed Calculation Window:** Median moving speed (> 3 km/h) over past 5 minutes, clamped between 10 km/h and 60 km/h (fallback default 20 km/h) (`SW-MVP-1.0` §17.5, §35 `eta.speed_window_min`, `eta.speed_min_kmh`, `eta.speed_max_kmh`, `eta.speed_default_kmh`). ETA < 60s displays "Arriving" (§17.5).
- **Shift Auto-End (Idle Detection):** Speed < 3 km/h for 20 minutes with ignition OFF triggers driver prompt. If no response within 10 minutes, shift auto-terminates (`AUTO_IDLE`) (`SW-MVP-1.0` §15.4, §35 `shift.idle_min`, `shift.idle_speed_kmh`, `shift.idle_grace_min`).
- **Shift Max Duration:** Shifts older than 14 hours automatically end with `TIMEOUT` and page coordinator (`SW-MVP-1.0` §15.4, §35 `shift.timeout_h`).
- **Late Start Alerts:** Trip unstarted 10 minutes after scheduled departure notifies faculty (`TRIP_LATE_START`); 20 minutes unstarted notifies coordinator (`SW-MVP-1.0` §15.6, §35 `shift.late_start_min`, `shift.late_start_coordinator_min`).
- **Schedule Generation Horizon:** Nightly job generates trips 7 days ahead (`SW-MVP-1.0` §15.5, §35 `trip.generate_days_ahead`).

### 5.4 Attendance, Leave & Stop Requests

- **Boarding Window:** Opens 10 minutes before scheduled departure; closes 15 minutes after scheduled/actual departure (`SW-MVP-1.0` §18.5, §35 `boarding.window_before_min`, `boarding.window_after_min`).
- **Boarding QR Token Rotation:** Rotates every 30 seconds; server accepts current slot + 1 previous slot (30s grace) (`SW-MVP-1.0` §18.1, §35 `qr.rotation_s`).
- **Leave Submission Deadline:** Students can mark leave up to 30 minutes before scheduled departure (`SW-MVP-1.0` §18.7, §35 `leave.cutoff_before_trip_min`). Faculty can mark leave until the boarding cutoff (§18.7).
- **Stop Request Geometry Checks:** Request pin must be within 300 meters of route line (`SW-MVP-1.0` §20.1, §35 `route.corridor_m`). Cannot be within 100 meters of existing approved stop or pending request (`SW-MVP-1.0` §20.1, §35 `stop.duplicate_m`). Max 1 request per student per 7 days (`SW-MVP-1.0` §20.1, §35 `stop_request.limit_days`).

### 5.5 Emergency (SOS) & Notifications

- **Hardware Panic Debounce & Stuck Button:** Debounce requires low level sustained for 300 ms (`HW-SPEC-1.0` §5.5, §10.4). Button held > 10 seconds sends exactly 1 SOS, then ignores button until release (`HW-SPEC-1.0` §5.5).
- **Mobile SOS Press:** In-app button must be held for 2.0 seconds with visual countdown (`SW-MVP-1.0` §19.1).
- **SOS Escalation Milestones:** Tier 0 = Immediate (< 5s target); Tier 1 = 2 minutes without ack; Tier 2 = 5 minutes without ack; Tier 3 = 10 minutes without ack (repeated every 5m) (`SW-MVP-1.0` §19.3, §35 `sos.escalation_min`).
- **SOS Incident Joining Window:** Second SOS trigger from same bus within 60 seconds joins existing incident (`SW-MVP-1.0` §19.2, §35 `sos.dedupe_s`).
- **SOS Cancellation Window:** Triggering user can cancel within 30 seconds if unacknowledged (`SW-MVP-1.0` §19.6, §35 `sos.cancel_window_s`).
- **Hardware Delay Flag:** If difference between device `triggered_at` and server `received_at` > 60 seconds, marked `DEVICE_DELAYED` (`SW-MVP-1.0` §19.8, §35 `sos.device_delay_flag_s`).
- **Notification Rate Limits & Quiet Hours:** Non-safety push capped at 6 per user per hour (`SW-MVP-1.0` §21.3, §35 `notify.push_per_hour`). Notification deduplication/grouping window: 2 minutes (`SW-MVP-1.0` §21.3, §35 `notify.group_window_s`). Quiet hours default 22:00 to 06:00 campus time (`SW-MVP-1.0` §21.4, §35 `notify.quiet_start`, `notify.quiet_end`). _SAFETY alerts completely bypass quiet hours and rate limits (§21.3, §21.4)._

### 5.6 Hardware Electrical, Voltage & Thermal Thresholds

- **Vehicle Voltage Classes & Low Battery Cut-Off:**
  - 12 V Class: Low-voltage event at 11.8 V (`SW-MVP-1.0` §12, §35 `vehicle.battery_mv_12v`); hardware transmission cut-off at 11.0 V (`HW-SPEC-1.0` §6.3). Firmware update threshold: 12.0 V (`HW-SPEC-1.0` §17).
  - 24 V Class: Low-voltage event at 23.5 V (`SW-MVP-1.0` §12, §35 `vehicle.battery_mv_24v`); hardware transmission cut-off at 22.0 V (`HW-SPEC-1.0` §6.3). Firmware update threshold: 24.0 V (`HW-SPEC-1.0` §17).
- **Backup Battery:** Minimum 10 minutes runtime at idle plus one SOS transmission attempt (`HW-SPEC-1.0` §6.4).
- **Operating & Storage Temperatures:** Operating range: -10°C to +55°C; Storage range: -20°C to +60°C (`HW-SPEC-1.0` §7). Enclosure rating: minimum IP54 (`HW-SPEC-1.0` §5, §7).
- **Fuse Rating:** Proposed 2.0 A automotive blade fuse on battery-side feed (`HW-SPEC-1.0` §6.1).
- **Ignition Sense Debounce:** 500 ms sustained logic high before asserting `IGNITION_ON` (`HW-SPEC-1.0` §5.4, §10.4).

---

## 6. Conflicts and Gaps Between Specifications

A rigorous comparative review of `HW-SPEC-1.0` and `SW-MVP-1.0` identifies the following discrepancies, technical contradictions, missing definitions, and unconfirmed decision points:

### 6.1 Device Status Lifecycle Discrepancy (C-01)

- In `SW-MVP-1.0` §11.5 (step 2), the ingestion validation pipeline requires that the device status must already be `ACTIVE`. Any request from a non-active device returns HTTP 403 `DEVICE_INACTIVE`.
- However, in `SW-MVP-1.0` §16.5 (workflow 1) and `HW-SPEC-1.0` §13.2 (step 1 & 5), batch-provisioned devices are assigned status `PROVISIONED`, and the server automatically promotes them to `ACTIVE` only upon the success of their first authenticated request.
- _Conflict:_ If §11.5 step 2 immediately rejects any non-ACTIVE device with 403, a newly provisioned device in status `PROVISIONED` can never make its first request to transition to `ACTIVE`.

### 6.2 Ingestion Conflict Handling (200 vs 409)

- In `SW-MVP-1.0` §11.5 (step 7) and `HW-SPEC-1.0` §11, when a sample with an existing `(device_id, boot_id, seq)` is received with different content, it is rejected with reason `CONFLICT`. The response is returned as HTTP 200 with an entry in the `rejected` array (`[{"seq": ..., "reason": "CONFLICT"}]`), allowing the device to advance its `ack_seq` and continue operation.
- In contrast, the error code table in `SW-MVP-1.0` §27 lists `CONFLICT` as returning HTTP 409 (`State conflict, for example a duplicate CONFLICT sample`). (Note: the claim that HTTP 409 makes the hardware retry or halt the batch is an inference, not a statement from the specification).

### 6.3 Firmware Download URL Missing from Heartbeat

- In `SW-MVP-1.0` §33.8 and `HW-SPEC-1.0` §17, devices are instructed to download new firmware images over HTTPS using a signed URL.
- However, in `SW-MVP-1.0` §11.6, the heartbeat response contract specifies only `pending_action: FIRMWARE_UPDATE` and `firmware_target: <version>`. The heartbeat response schema contains no `firmware_url` or signed storage link, leaving the device with no endpoint to download the payload.

### 6.4 Missing `BENCH` Status in Device Data Model

- In `SW-MVP-1.0` §16.5 (workflow 7), the technician console allows registering a device as `BENCH` so it is excluded from fleet views, alerts, and reports.
- However, in `SW-MVP-1.0` §10.2, the data model for `devices.status` defines only `(PROVISIONED, ACTIVE, REVOKED, RETIRED)` with check constraints. `BENCH` is omitted from the valid enumeration.

### 6.5 SOS Category Captured but Missing in Schema

- In `SW-MVP-1.0` §19.1, SOS triggers from the Driver app, Faculty app, and Security app require or support selecting a category (`Emergency`, `Medical`, `Breakdown`, `Other`), while hardware panic button presses default to category `UNKNOWN`.
- However, in `SW-MVP-1.0` §10.7, the `sos_incidents` table schema defines: `bus_id, trip_id, first_trigger_type, first_triggered_at, status, current_tier, resolved_at, resolution_note, is_drill`. There is no `category` column defined on `sos_incidents` or `sos_events`.

### 6.6 Battery Threshold Discrepancy (Low Voltage Event vs Cut-Off)

- In `SW-MVP-1.0` §12 and §35 (`vehicle.battery_mv_12v`, `vehicle.battery_mv_24v`), the server defines `LOW_VEHICLE_BATTERY` event thresholds at **11,800 mV (11.8 V)** for 12V systems and **23,500 mV (23.5 V)** for 24V systems.
- In `HW-SPEC-1.0` §6.3, the low-voltage cut-off is defined as **11.0 V** (12V class) and **22.0 V** (24V class), at which point the tracker stops transmitting entirely.
- In `HW-SPEC-1.0` §17, firmware updates require vehicle voltage to be above **12.0 V** (12V class) and **24.0 V** (24V class).
- _Gap:_ The hardware spec does not clarify whether the device firmware generates the `LOW_VEHICLE_BATTERY` event at the 11.8V/23.5V early warning thresholds or only when approaching the 11.0V/22.0V shutdown cut-off.

### 6.7 Microcontroller Pin Shortage & UART Limitations

- `HW-SPEC-1.0` §5.2 and §5.3 explicitly warn that the proposed **ESP8266** microcontroller has only **one receive-capable hardware UART** (UART0), which is dedicated to the Quectel EC200U-CN cellular AT command interface.
- If the EC200U-CN module order code lacks integrated GNSS (requiring an external NEO-6M GNSS receiver per Option B in `HW-SPEC-1.0` §5.2), reading NMEA over a software serial port at 9600 baud risks dropped sentences and instability (`HW-SPEC-1.0` §5.2).
- In addition, optional door sensors (`HW-SPEC-1.0` §5.9) and tamper switches (`HW-SPEC-1.0` §5.10) cannot be connected due to a lack of available GPIOs on the ESP8266 (`HW-SPEC-1.0` §5.3). `HW-SPEC-1.0` §5.3 and §22 (#1) recommend upgrading to the **ESP32**.

### 6.8 Storage the Specification Does Not Define

The data model in `SW-MVP-1.0` §10 omits database structures for three required operational variables:

1. **Student Approaching Alert Threshold:** `SW-MVP-1.0` §16.1 (workflow 5) defines that students can adjust their stop approaching alert threshold between 2 and 15 minutes (default 5 minutes). No column in `users`, `student_profiles`, or `notification_preferences` (§10.1, §10.4, §10.9) stores this value.
2. **Bus Default Mode:** `SW-MVP-1.0` §13.2 and §15.2 state that a new shift starts in `AUTO` unless the coordinator sets a different default mode for that bus. However, the `buses` table in §10.2 contains no `default_mode` column.
3. **Driver Mode Switch Note:** `SW-MVP-1.0` §16.3 only (workflow 6) states that when a driver changes tracking mode, an optional note of up to 140 characters is stored (no mention in §13.2). However, `source_switches` in §10.5 defines only `bus_id, from_source, to_source, reason_code, actor_type, actor_id, at`, omitting a note column.

### 6.9 SIM Plan, APN, and Data Caps

- `HW-SPEC-1.0` §5.1, §7, and §22 (#14) states that the cellular APN is set in firmware and the data plan/cap is `CONFIRM`.
- In `SW-MVP-1.0` §30, data usage for the driver phone is budgeted at 1 MB/hour, but hardware tracker data consumption under heavy 10-second reporting (plus buffer flushing) requires an explicit data quota agreement with telecom providers.

### 6.10 Peripheral Inclusions in MVP

- **Tamper Switch & Door Sensors:** `HW-SPEC-1.0` §5.9, §5.10 lists door sensors and enclosure tamper switches as optional (`CONFIRM`), while `SW-MVP-1.0` §12 includes handlers for `TAMPER` and `DOOR_OPEN`/`DOOR_CLOSE`. Whether hardware units deployed for MVP will physically include these switches remains undetermined.
- **RFID Card Readers:** `HW-SPEC-1.0` §5.8 and `SW-MVP-1.0` §18.8, §41 (#4) state RFID is deferred to Phase 2; MVP relies solely on dynamic QR codes.

### 6.11 Open Decisions Log (`SW-MVP-1.0` §41)

All 16 formal open decisions defined in `SW-MVP-1.0` §41, detailing recommended outcomes, responsible owners, and the milestone/phase each one blocks:

| #      | Open Decision                                                             | Specification Recommendation                                                                                   | Designated Owner                | Phase / Milestone Blocked  |
| ------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------- |
| **1**  | **Database Selection:** PostgreSQL with PostGIS vs MongoDB Atlas          | PostgreSQL. It supports geographic queries for route corridors and ETA, dated links, and transactions for SOS. | Engineering Lead                | **Before M0**              |
| **2**  | **Cloud Provider & Region:** AWS in an India region (using ECS, RDS, ALB) | AWS, in an India region where every required service is available.                                             | Engineering Lead, College IT    | **Before M0**              |
| **3**  | **Map Provider:** MapLibre with OSM vs Google Maps Platform               | MapLibre with OpenStreetMap tiles, with a layer switch for Google Maps later.                                  | Product Owner                   | **Before M2**              |
| **4**  | **Boarding Method at Launch:** QR code vs RFID card reader                | QR at launch. RFID in Phase 2.                                                                                 | Transport Office                | **Before M5**              |
| **5**  | **Driver Phone Provisioning Policy:** Dedicated vs Personal               | College-issued phones for each bus where budget allows. Personal phones with consent as fallback.              | Transport Office, Legal Counsel | **Before M3**              |
| **6**  | **Security Staff (SEC) Visibility Scope:** All active buses vs restricted | Read-only visibility over all active buses across campus.                                                      | Security Office, Legal Counsel  | **Before M4**              |
| **7**  | **Parental Consent Verification Method:** Verification link & OTP         | Guardian verification by one-time code sent to guardian contact, confirmed by counsel.                         | Legal Counsel                   | **Before M6**              |
| **8**  | **Limited Mode for Under-18 Students:** Restrictions without consent      | As specified: minors without guardian consent see only privacy notice and SOS button.                          | Legal Counsel                   | **Before M6**              |
| **9**  | **Data Retention Periods:** Schedule defined in §29.4                     | As listed in §29.4 (e.g., location/heartbeats 90 days, trip summaries 2 years).                                | Policy Owner                    | **Before M6**              |
| **10** | **Emergency Escalation Contacts:** On-duty lists & escalation trees       | College provides on-duty coordinator and security desk contact lists.                                          | Security Office, Coordinator    | **Before M3**              |
| **11** | **iOS SOS Critical Alerts Entitlement:** Apple entitlement vs standard    | Not in MVP. Time-sensitive interruption level used.                                                            | Product Owner                   | **Before M3**              |
| **12** | **Morning-Present, Afternoon-Absent Rule:** Business logic sign-off       | As specified in §18.6: alert primary faculty when morning boarded and afternoon absent.                        | Faculty Committee               | **Before M5**              |
| **13** | **Default Tracking Mode & Driver Switching:** Tracking mode authority     | AUTO by default. Drivers can switch modes in the app.                                                          | Transport Office                | **Before M3**              |
| **14** | **GNSS Source Selection:** Module internal vs external receiver           | Confirm in HW-SPEC. Software ingest API remains unchanged either way.                                          | ECE Team                        | **Before Firmware Freeze** |
| **15** | **Supported Mobile OS Versions:** Minimum baseline devices                | Android 10 and later, iOS 16 and later. Confirm against devices in use.                                        | Product Owner                   | **Before M2**              |
| **16** | **Regional Disaster Recovery Strategy:** Standby region vs 4h restore     | Accept 4-hour regional backup restore for MVP, or upgrade to standby region.                                   | Super Admin, College IT         | **Before Launch**          |

### 6.12 Implementation Additions Outside the Specification

The following items are additions introduced by the build prompt and hardening guidelines that are not in the original specification, listed and marked so the team can decide whether to accept them:

- **Student approach threshold:** `student_profiles.approach_threshold_min`, range 2 to 15, default 5 (defined by the build prompt, not in the specification).
- **Bus default mode:** `buses.default_mode`, default `AUTO` (defined by the build prompt, not in the specification).
- **Driver mode-switch note:** `source_switches.note`, up to 140 characters (defined by the build prompt, not in the specification).
- **SOS category:** `sos_incidents.category` (`EMERGENCY`, `MEDICAL`, `BREAKDOWN`, `OTHER`, `UNKNOWN`) (defined by the build prompt, not in the specification).
- **Turnstile on OTP:** Cloudflare Turnstile anti-bot challenge on driver sign-in OTP requests (`F-AUTH-02`) (defined by the build prompt, not in the specification).
- **`push_tokens`:** Dedicated database table for persisting mobile push notification device tokens (`FCM`/`APNs`) (defined by the build prompt, not in the specification).
- **`rate_counters`:** Persistence table for tracking atomic sliding-window rate limits (defined by the build prompt, not in the specification).
- **`idempotency_keys`:** Database table for caching responses to prevent duplicate operations and detect mutation conflicts (defined by the build prompt, not in the specification).
- **`is_synthetic`:** Column on business tables flagging synthetic and simulation data to prevent leakage into production (defined by the build prompt, not in the specification).
- **`expo-sqlite`:** Local SQLite database on the driver mobile app for storing offline location samples for up to 24 hours (defined by the build prompt, not in the specification).

---

## 7. Questions Requiring Clarification Before Building

The following 15 numbered questions must be answered before building:

1. **Device activation on first request:** Should a device be ACTIVE from its first request, or only after a separate activation step?
   - **Blocks:** M1.
2. **Firmware download URL:** How does the device receive its firmware download URL?
   - **Blocks:** M1 and M4.
3. **Duplicate sample response, 200 or 409:** For a duplicate sample with different content, should the response be 200 with a rejected entry, or HTTP 409?
   - **Blocks:** M1.
4. **BENCH device status:** Is BENCH a device status?
   - **Blocks:** M0 and M4.
5. **SOS category storage:** Where is the SOS category stored?
   - **Blocks:** M0 and M3.
6. **GNSS source:** Is the GNSS source inside the EC200U-CN, or a separate NEO-6M? (`HW-SPEC-1.0` §5.2, §22 #1)
   - **Blocks:** the firmware freeze (SW-MVP-1.0 §41 #14).
7. **LOW_VEHICLE_BATTERY threshold:** Should the device send LOW_VEHICLE_BATTERY at 11.8 V (12 V) or 23.5 V (24 V), or only near the 11.0 V and 22.0 V cut-offs? (`HW-SPEC-1.0` §6.3; `SW-MVP-1.0` §12, §35; Section 6.6)
   - **Blocks:** M1 and the hardware firmware.
8. **Mix of 12 V and 24 V buses:** What is the mix of 12 V and 24 V buses? (`HW-SPEC-1.0` §22 #3)
   - **Blocks:** the hardware build.
9. **Backup battery in the MVP:** Is the backup battery included in the MVP? (`HW-SPEC-1.0` §6.4, §22 #4)
   - **Blocks:** the hardware build.
10. **Tamper switches and door sensors:** Are the door sensors and tamper switches in the MVP production batch? (`HW-SPEC-1.0` §5.9, §5.10, §22 #7, #8)
    - **Blocks:** the hardware build and M4.
11. **Security visibility of all active buses:** Should Security see all active buses, read-only? (`SW-MVP-1.0` §5, §41 #6)
    - **Blocks:** M4 (SW-MVP-1.0 §41 #6).
12. **SSO provider:** Will college SSO use Google Workspace or Microsoft Entra ID? (`SW-MVP-1.0` §8)
    - **Blocks:** M0.
13. **Driver phones, college-issued or personal:** Will drivers use college-issued phones or their own phones? (`SW-MVP-1.0` §41 #5)
    - **Blocks:** M3 (SW-MVP-1.0 §41 #5).
14. **DLT registration:** Which DLT entity and SMS templates are registered? (`SW-MVP-1.0` §21.5)
    - **Blocks:** M3.
15. **AWS region:** Which AWS region will host the system? (`SW-MVP-1.0` §41 #2)
    - **Blocks:** M0 (SW-MVP-1.0 §41 #2).
