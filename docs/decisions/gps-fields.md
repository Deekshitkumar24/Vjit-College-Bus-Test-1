# RS-14: Expo Location API Fields (Android vs iOS) & Mock Detection

**Document ID:** RS-14  
**Source:** `expo-location` (v17) Documentation and Native Source Code  
**Date Checked:** 20 October 2026

---

## 1. Field Mapping: `LocationObject` to Domain `LocationSample`

When `expo-location` captures a coordinate update on the driver's phone, the `LocationObject` contains:

```typescript
export interface ExpoLocationCoords {
  latitude: number; // Decimal degrees (-90 to 90)
  longitude: number; // Decimal degrees (-180 to 180)
  altitude: number | null;
  accuracy: number | null; // Radius of 68% confidence in metres
  altitudeAccuracy: number | null;
  heading: number | null; // Degrees relative to true north (0 to 360)
  speed: number | null; // Speed in METRES PER SECOND (m/s)
}
```

### 1.1 Speed Conversion

- `expo-location` reports `speed` in **metres per second (m/s)** (`SW-MVP-1.0` §11.7; `AG-MASTER-1.0` §9.2).
- The driver app transmits `speed_mps` to `POST /api/v1/driver/locations`.
- The server pipeline multiplies `speed_mps` by `3.6` to convert to `speed_kmh` before storing in `location_samples` and updating `bus_state` (`SW-MVP-1.0` §11.7).

### 1.2 Coordinate Rounding

- Coordinates are rounded on ingest to **6 decimal places** (~0.1 metre precision) in accordance with `AG-MASTER-1.0` §9.2.

---

## 2. Mock Location Detection (`is_mock`)

Under `SW-MVP-1.0` §11.7 and Conflict C-03 (`is_mock` everywhere):

- **Android Support:** Android provides `Location.isFromMockProvider()` natively. In Expo, this is surfaced as `location.mocked` (boolean). The driver ingestion payload formats this as `is_mock: boolean`.
- **iOS Support:** iOS does not provide a direct public API for mock locations. If simulated coordinates are injected via developer tools, detection is best-effort (e.g. evaluating sensor anomalies or sudden unrealistic jumps).
- **Server Guard:** If `is_mock === true`, the server stores the sample with its flag but **never uses it to update live bus position** (`SW-MVP-1.0` §11.7, §37 #22). A coordinator security warning is immediately triggered.
