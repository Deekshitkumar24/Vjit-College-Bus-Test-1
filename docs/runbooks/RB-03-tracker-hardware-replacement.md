# RB-03: Tracker Hardware Replacement & Provisioning

## 1. Purpose
Provides step-by-step instructions for replacing a faulty, damaged, or tampered hardware tracker on a college bus without corrupting telemetry history (AC-TEC-02).

## 2. Procedure
1. **De-link Old Device:**
   - Technician navigates to Technician Console -> Devices -> Select Device.
   - Click "Retire Device". Status updates to `RETIRED`, valid_to timestamp is set on `device_links`.
   - Existing heartbeats and location samples remain permanently attached to old device ID.
2. **Provision New Device:**
   - Scan IMEI barcode on new EC200U tracker.
   - Ensure firmware version matches current target release (`1.0.0`).
   - Create device record with status `PROVISIONED`.
3. **Bind to Bus:**
   - Select Bus Registration Number (e.g., `KA-01-AB-1234`).
   - Link new device. New record created in `device_links` with `valid_from = NOW()`.
4. **Bench Validation:**
   - Power on device on bench. Confirm GNSS fix within 2 minutes.
   - First authenticated ingestion transitions device status to `ACTIVE`.
