# Defaults Used Until Formal Sign-Off

**Document Status:** Baseline Configuration Defaults  
**Reference:** AG-MASTER-1.0 Part 18.1  
**Date:** 20 October 2026

---

The build uses these defaults. Each one is recorded here when utilized in implementation:

| Decision Area                         | Default Applied                                                                            | Reference                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| **Database**                          | PostgreSQL 16 with PostGIS 3.4                                                             | `SW-MVP-1.0` §41 #1, `AG-MASTER-1.0` Part 18.1  |
| **Cloud Provider**                    | AWS, in an India region                                                                    | `SW-MVP-1.0` §41 #2, `AG-MASTER-1.0` Part 18.1  |
| **Map Provider**                      | MapLibre with OpenStreetMap tiles                                                          | `SW-MVP-1.0` §41 #3, `AG-MASTER-1.0` Part 18.1  |
| **Boarding at Launch**                | Dynamic HMAC QR codes shown on driver phone; RFID in Phase 2                               | `SW-MVP-1.0` §41 #4, `AG-MASTER-1.0` Part 18.1  |
| **Driver Phones**                     | College-issued phones preferred; personal phones permitted with recorded consent           | `SW-MVP-1.0` §41 #5, `AG-MASTER-1.0` Part 18.1  |
| **Security Staff Visibility**         | Read-only visibility over all active buses across campus                                   | `SW-MVP-1.0` §41 #6, `AG-MASTER-1.0` Part 18.1  |
| **Parental Consent Method**           | Guardian verification by one-time code sent to guardian contact                            | `SW-MVP-1.0` §41 #7, `AG-MASTER-1.0` Part 18.1  |
| **Under-18 Without Consent**          | Limited mode as specified (privacy notice + SOS button only)                               | `SW-MVP-1.0` §41 #8, `AG-MASTER-1.0` Part 18.1  |
| **Data Retention Periods**            | Part 14.2 values (location/heartbeat 90 days; summaries 2 years; events 1 year)            | `SW-MVP-1.0` §41 #9, `AG-MASTER-1.0` Part 18.1  |
| **Emergency Escalation Contacts**     | Provided by college in settings. If any tier is empty, raise setup alert (no placeholders) | `SW-MVP-1.0` §41 #10, `AG-MASTER-1.0` Part 18.1 |
| **Critical Alerts on iOS**            | Not used in MVP; standard time-sensitive interruption level used                           | `SW-MVP-1.0` §41 #11, `AG-MASTER-1.0` Part 18.1 |
| **Morning-Present, Afternoon-Absent** | As specified in `SW-MVP-1.0` §18.6 and `AG-MASTER-1.0` Part 11.3                           | `SW-MVP-1.0` §41 #12, `AG-MASTER-1.0` Part 18.1 |
| **Default Tracking Mode**             | `AUTO` default for each new shift; driver and coordinator can switch                       | `SW-MVP-1.0` §41 #13, `AG-MASTER-1.0` Part 18.1 |
| **GNSS Source**                       | Confirmed with ECE team; software API contract remains unchanged either way                | `SW-MVP-1.0` §41 #14, `AG-MASTER-1.0` Part 18.1 |
| **Supported Operating Systems**       | Android 10 and later, iOS 16 and later                                                     | `SW-MVP-1.0` §41 #15, `AG-MASTER-1.0` Part 18.1 |
| **Regional Disaster Recovery**        | Accept 4-hour regional recovery for MVP                                                    | `SW-MVP-1.0` §41 #16, `AG-MASTER-1.0` Part 18.1 |
| **Bot Protection on OTP**             | Cloudflare Turnstile on driver sign-in OTP requests after first attempt in an hour         | `AG-MASTER-1.0` §13.4, §13.11, Conflict C-02    |
| **Device Status BENCH (Q4)**          | Confirmed: BENCH is an active device status in devices.status enum                         | AG-MASTER-1.0 Part 7.2, Part 21.1, P4-T9        |
| **SOS Category Storage (Q5)**         | Confirmed: Stored in sos_incidents.category column                                         | AG-MASTER-1.0 Part 7.7, Part 21.1               |
| **SSO Provider (Q12)**                | Confirmed: Both Google Workspace and Microsoft Entra ID supported via runtime config       | User Decision, AG-MASTER-1.0 Part 8.3, RS-09    |
| **AWS Region (Q15)**                  | Confirmed: AWS India Region p-south-1 (Mumbai)                                             | User Decision, AG-MASTER-1.0 Part 18.1, RS-19   |
