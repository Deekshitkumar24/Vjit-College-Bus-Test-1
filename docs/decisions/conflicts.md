# Conflicts Register: AG-MASTER-1.0 vs SW-MVP-1.0 & HW-SPEC-1.0

**Document Status:** Active Conflict Register  
**Reference:** AG-MASTER-1.0 Part 21.2  
**Date:** 20 October 2026  

---

| ID | Issue Description | Resolution in AG-MASTER-1.0 | Owner | Status |
|---|---|---|---|---|
| **C-01** | `SW-MVP-1.0` Part 5.2 required status `ACTIVE`, but Parts 6.2 and 6.3 let a `PROVISIONED` device connect. | `PROVISIONED` is accepted only on its first request, with `first_used_at` empty. That request sets `ACTIVE` in the same transaction. | Engineering Lead with ECE Team | Applied. Awaiting engineering confirmation |
| **C-02** | Turnstile on OTP requests is not in the specification (`F-AUTH-02`). | Kept as an added bot control, recorded in `docs/decisions/defaults-used.md`. | Engineering Lead and Counsel | Applied. Awaiting confirmation |
| **C-03** | The field was called `mocked` in draft notes and `is_mock` in the specification. | `is_mock` used everywhere. | Engineering Lead | Applied |
| **C-04** | SOS category is captured (`SW-MVP-1.0` §19.1) but had no column in `sos_incidents`. | `category` column added to `sos_incidents`. | Engineering Lead | Applied |
| **C-05** | Heartbeat returned `firmware_target` only, so the device could not download the image. | Part 20.6 defines `firmware_url` (presigned S3 GET link valid for 15 mins), `sha256`, `size`, and `signature`. | ECE Team | Awaiting ECE confirmation of device side (`HW-SPEC-1.0` §17) |
| **C-06** | Export download link lifetime: spec §23 says 24 hours. | 24 hours for exports (Parts 11.6 and 13.13). Firmware links stay at 15 minutes (Part 20.6). | Product Owner | Awaiting product owner |
| **C-07** | Release gate required every email to be on a college domain, but spec §4 allows driver email. | Non-college driver email allowed only with a recorded exception (Parts 15.4 and 17). | Product Owner and Counsel | Applied |
| **C-08** | Part 5.5 described the SOS handler, which depends on the SOS service built later. | The SOS handler is built in `P3-T16`. `P1-T4` excludes SOS from its initial handlers. | Engineering Lead | Applied |
