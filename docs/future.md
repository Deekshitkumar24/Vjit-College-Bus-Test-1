# Future Features & Backlog (Post-MVP)

**Document Status:** Backlog & Deferred Feature Inventory  
**Reference:** AG-MASTER-1.0 Part 1.5, Part 18.3; SW-MVP-1.0 Section 40  
**Date:** 20 October 2026

---

The following capabilities are deliberately **out of scope for the MVP** and must not have database tables, APIs, or mock implementations created during MVP phases:

1. **RFID Card Check-In at Runtime:** Hardware tap scanning and student card registry (`SW-MVP-1.0` §18.8, §40). The `RFID_TAP` event exists in the ingest contract only as a recognized type that is stored with status `IGNORED`.
2. **Parent Accounts & Parent Notifications:** Dedicated guardian login dashboards, student location monitoring by parents, and automated parental arrival alerts.
3. **Automated Telephony / Voice Calls:** Automated PSTN voice calls for SOS escalation at Tier 2 and Tier 3.
4. **PDF Reports & Scheduled Report Emails:** Dynamic PDF generation and automated weekly executive email dispatches.
5. **Passenger Occupancy Sensing & Passenger Counting:** Headcount calculation from boardings vs alightings or infrared door sensors.
6. **Fare Collection & Payment Gateways:** Student ticketing, cashless wallet payments, and fee reconciliations.
7. **Multi-College Multi-Tenant UI:** Self-service onboarding and institutional isolation across distinct universities in a single UI (the database schema includes `college_id` for future tenancy, but the UI is single-tenant for MVP).
8. **Public Map (No Sign-In):** Unauthenticated public URLs or embeddable iframe maps.
9. **Turn-by-Turn GPS Navigation for Drivers:** In-app turn-by-turn spoken guidance.
10. **Google Maps Layer Option:** Commercial Google Maps SDK integration.
11. **Mobile Root & Jailbreak Detection / Certificate Pinning:** Advanced mobile runtime protection.
12. **Offline Mode for Coordinator Web Console:** Local storage caching for administrative web operations.
13. **Multilingual Localisation:** Languages beyond English (UI strings are externalized to facilitate future translations).
14. **Vehicle Document File Uploads:** Uploading PDF/image scans of bus insurance and fitness certificates (only expiry dates are tracked in MVP).
15. **Nearest-Stop Student Geo-Recommendation:** Using student device GPS in the foreground to suggest nearby stops.
16. **Predictive AI ETA:** Machine-learning ETA models incorporating external live municipal traffic congestion feeds.
17. **In-App Messaging:** Direct chat between faculty and drivers.
18. **Vehicle & Driver Ratings:** Student feedback and star ratings for bus conditions.
19. **Real-Time WebSocket / SSE Push for Live Map:** Live streaming via WebSockets or Server-Sent Events to replace 10-second snapshot polling.
20. **Snap-to-Route Vehicle Marker Display:** Snapping map icons to road centerlines rather than raw coordinates.
21. **Distributed Redis Caching:** Distributed cache layer beyond the in-process 3-second cache.
