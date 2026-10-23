# RB-04: Firmware Canary & Rollback Procedure

## 1. Purpose
Safe rollout and emergency rollback protocol for tracker firmware images (Part 24, Decision C-05).

## 2. Canary Deployment
1. Upload signed binary (`firmware.bin`) to S3/MinIO firmware bucket.
2. Register release metadata (Version, SHA-256 hash, signature, size).
3. Assign release to Canary group (5% of fleet = 2-3 buses).
4. Monitor Canary telemetry for 48 hours: zero spontaneous reboots, GNSS fix success > 99%.
5. Promote to Staged Rollout (25%, 50%, 100%).

## 3. Rollback
If crash loop, memory leak, or communication failure occurs:
1. Update `firmware_releases` status to `WITHDRAWN`.
2. Heartbeat API immediately returns rollback target version.
3. Devices download previous stable image via 15-minute presigned URL.
