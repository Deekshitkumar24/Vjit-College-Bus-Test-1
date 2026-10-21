# RS-16: Hardware-Software Contract Audit & Verification

**Document ID:** RS-16  
**Audited Documents:** `HW-SPEC-1.0` Sections 8, 9, 10, 12, 13 and `SW-MVP-1.0` Sections 11, 12  
**Date Checked:** 20 October 2026 (Re-confirmed 21 October 2026)  
**Status:** Audit Completed; Conflicts Tracked Against AG-MASTER-FINAL-1.0 Part 1.2  
**Quoted Verification:** "HW-SPEC-1.0 §13.2 defines initial device status as PROVISIONED, whereas SW-MVP-1.0 §11.5 step 2 requires ACTIVE."

---

## 1. Section-by-Section Audit

### 1.1 HW-SPEC-1.0 Section 8 (Firmware Responsibilities) vs SW-MVP-1.0 Section 11

- **Buffer Overflow & Record Dropping:** `HW-SPEC-1.0` §8.5 drops oldest records and sends `BUFFER_OVERFLOW`. `SW-MVP-1.0` §12 logs this event and opens a ticket if repeated. -> **MATCH.**
- **Batch Sending & ACKs:** `HW-SPEC-1.0` §8.6 batches up to 50 samples over HTTPS and deletes only samples up to `ack_seq`. `SW-MVP-1.0` §11.4 response schema contains `ack_seq` and list of `rejected` samples. -> **MATCH.**
- **Heartbeat Interval:** `HW-SPEC-1.0` §8.10 sends heartbeat every 60s while ignition is ON, and every 10 minutes while parked. `SW-MVP-1.0` §11.6 matches this exactly. -> **MATCH.**
- **Firmware Updates:** `HW-SPEC-1.0` §8.15 acts on `pending_action: FIRMWARE_UPDATE` from heartbeat, downloads image, verifies SHA-256 and signature. However, `SW-MVP-1.0` §11.6 heartbeat response omitted the download URL. -> **OPEN GAP / CONFLICT C-05 (See Section 2).**

### 1.2 HW-SPEC-1.0 Section 9 (Operating States) vs SW-MVP-1.0 Section 14

- Five operating states defined: `Booting`, `Connecting`, `Running`, `Parked`, `Fault`.
- `HW-SPEC-1.0` states that SOS can be raised from any state. `SW-MVP-1.0` §19.1 accepts SOS from hardware at any time. -> **MATCH.**
- LED Patterns: Solid Red = Fault or SOS pending; Slow blinking red = SOS confirmed by server for 60s. `SW-MVP-1.0` §19.3 returns confirmation causing this behavior. -> **MATCH.**

### 1.3 HW-SPEC-1.0 Section 10 (Data Sent) vs SW-MVP-1.0 Section 11 & 12

- Sample cadence: Moving (> 3 km/h) = 10s; Stopped = 30s; Parked = no samples (`HW-SPEC-1.0` §10.1; `SW-MVP-1.0` §11.4, §35). -> **MATCH.**
- Sample fields: `seq, recorded_at, gps_valid, lat, lng, speed_kmh, heading_deg, satellites, hdop, ignition, vehicle_battery_mv`. All fields map 1-to-1 to `SW-MVP-1.0` §11.3 telemetry schema. -> **MATCH.**
- Event list: `BOOT, IGNITION_ON, IGNITION_OFF, SOS, GPS_LOST, GPS_RECOVERED, NETWORK_RESTORED, BUFFER_OVERFLOW, LOW_VEHICLE_BATTERY, LOW_DEVICE_BATTERY, MODULE_ERROR, CONFIG_APPLIED, FIRMWARE_UPDATED, FIRMWARE_FAILED, TAMPER, DOOR_OPEN, DOOR_CLOSE, RFID_TAP, CLOCK_SYNC`. Matches `SW-MVP-1.0` §12 exactly. -> **MATCH.**

### 1.4 HW-SPEC-1.0 Section 12 (Failure Modes) vs SW-MVP-1.0 Section 12 & 22

- `GPS_LOST`: triggered after 30s no fix with ignition ON. Server invalidates hardware fix for selector; tickets if > 10m. -> **MATCH.**
- `MODULE_ERROR` and `BOOT (WATCHDOG/BROWNOUT)`: ticket opened after 3 occurrences in 24 hours. -> **MATCH.**
- Low Battery Threshold: `HW-SPEC-1.0` §6.3 defines cutoff at 11.0V/22.0V, while `SW-MVP-1.0` §12/§35 sets alert at 11.8V/23.5V. (Logged as Question 7 / Decision D-02 in `AG-MASTER-FINAL-1.0` Part 1.3).

### 1.5 HW-SPEC-1.0 Section 13 (Device Identity & Provisioning) vs SW-MVP-1.0 Section 11.1 & 16.5

- Initial device status: `HW-SPEC-1.0` §13.2 sets device to `PROVISIONED` and server moves to `ACTIVE` on first authenticated request. However, `SW-MVP-1.0` §11.5 step 2 requires `ACTIVE` and rejects others with HTTP 403 `DEVICE_INACTIVE`. -> **CONFLICT C-01 (See Section 2).**

---

## 2. Formal Conflict Register Status

1. **Conflict C-01: Device Status Lifecycle Discrepancy**
   - **Status:** **Applied, awaiting engineering confirmation.**
   - **Resolution in Contract:** A `PROVISIONED` device is accepted only on its first authenticated request, when `first_used_at` is null. That request sets status `ACTIVE` and `first_used_at` in one transaction. Every later request requires `ACTIVE`.
   - **Owners to Confirm:** Engineering lead, ECE team.

2. **Conflict C-05: Firmware Download URL Missing from Heartbeat**
   - **Status:** **Awaiting ECE confirmation of the device side (`HW-SPEC-1.0` Section 17).**
   - **Resolution in Contract:** `FIRMWARE_UPDATE` heartbeat response adds `firmware_url` (presigned S3 GET, valid 15 minutes), `firmware_sha256`, `firmware_size_bytes`, and detached `firmware_signature`.
