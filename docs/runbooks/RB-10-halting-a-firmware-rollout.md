# RB-10: Halting a Firmware Rollout

## 1. Trigger
Firmware canary update causes device crash loop, GPS freeze, or elevated battery drain on reference fleet.

## 2. First Five Minutes
1. Access firmware management console / API.
2. Revoke active firmware target URL in `firmware_updates` table.
3. Set device firmware target back to stable baseline version.
4. Alert ECE hardware team.

## 3. Diagnosis
- Analyze heartbeat error codes returned by upgraded units.
- Check device cellular signal levels and crash dump telemetry.

## 4. Mitigation
- Issue rollback firmware image via next heartbeat response (H1-H8 / C-05).
- Physically quarantine affected vehicles if tracker fails to communicate.
- Deploy field technician with manual serial flasher if OTA recovery fails.

## 5. Communication Template
> FIRMWARE ADVISORY: Firmware OTA rollout halted due to diagnostic alert. Devices reverted to stable baseline.

## 6. Post-Incident Review
A blameless post-incident review must be conducted within five working days. The review must document root causes, action items, and prevention mechanisms.
