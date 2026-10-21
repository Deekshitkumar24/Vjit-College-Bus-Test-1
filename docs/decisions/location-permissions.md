# RS-02, RS-03, RS-17: Location Permissions, Policies, and Declarations

**Document IDs:** RS-02, RS-03, RS-17  
**Sources:**

- Google Play Policy Center - Location Permissions: `https://support.google.com/googleplay/android-developer/answer/9799150` (Policy Version: November 2023 / 2024 Policy Update)
- Android Developers - Foreground Service Types: `https://developer.android.com/about/versions/14/changes/fgs-types-required` (Target API Level 34 / Android 14)  
  **Date Checked:** 20 October 2026 (Re-confirmed 21 October 2026)  
  **Quoted Verification (Google Play Location Policy):**

> "You should only access location in the background if it is critical to the core functionality of your app and provides clear user benefit. Apps that track user location in the background must provide prominent in-app disclosure and obtain user consent before runtime requests."  
> **Quoted Verification (Android 14 FGS Requirements):**  
> "If your app targets Android 14 (API level 34) or higher, it must specify appropriate foreground service types for each foreground service inside the app."

---

## 1. RS-02: Expo Background Location Configuration

### 1.1 Android Foreground Service

- **Permissions Required:**
  - `android.permission.ACCESS_FINE_LOCATION`
  - `android.permission.ACCESS_COARSE_LOCATION`
  - `android.permission.ACCESS_BACKGROUND_LOCATION` (requested step-wise after fine location)
  - `android.permission.FOREGROUND_SERVICE`
  - `android.permission.FOREGROUND_SERVICE_LOCATION` (Mandatory for Android 14+ / API level 34)
  - `android.permission.POST_NOTIFICATIONS` (Android 13+)
- **Config Plugin Options (`app.json`):**
  ```json
  [
    "expo-location",
    {
      "locationAlwaysAndWhenInUsePermission": "Allow College Bus Tracker to use your location during active driving shifts to report bus position to students and dispatch.",
      "locationAlwaysPermission": "Allow College Bus Tracker to access your location in the background during driving shifts.",
      "locationWhenInUsePermission": "Allow College Bus Tracker to access your location while driving.",
      "isAndroidForegroundServiceEnabled": true,
      "isAndroidBackgroundLocationEnabled": true
    }
  ]
  ```
- **Foreground Service Notification:**
  - Mandatory persistent notification while driving shift is active (`SW-MVP-1.0` §16.3 #11).
  - High priority with notification channel `driving_location_service`.
  - Content: "Active Shift: Sharing Bus Location - Shift ID #...".

### 1.2 iOS Permissions & Background Modes

- **Info.plist Strings:**
  - `NSLocationWhenInUseUsageDescription`: "Your location is used to broadcast the bus position to students while your driving shift is active."
  - `NSLocationAlwaysAndWhenInUseUsageDescription`: "Your location is needed in the background to continuously update the college bus live position even when the phone is locked."
- **UIBackgroundModes:** `location`
- **iOS App Swiped-Away Behaviour:**
  - In iOS, if an app using standard `startLocationUpdatesAsync` is forcibly terminated (swiped away from app switcher) by the user, iOS kills background location delivery until the user relaunches the app or significant motion wakes the app.
  - Mitigations:
    1. Driver training and pre-trip check warning: App must remain in background, not force-closed.
    2. Server-side detector: If phone telemetry stops while shift is active and HW is offline, server transitions bus state to `STALE` after 60s and `UNAVAILABLE` after 120s, sending operational alert (`SW-MVP-1.0` §13.3, §22).

---

## 2. RS-03: Google Play Background Location Policy & Declaration Form

### 2.1 Core Policy Compliance

- Google Play strictly regulates background location: background access must provide clear direct user benefit and cannot be solely for advertising or analytics.
- **Justification for Driver App:** The driver role is an authorized transportation operator. Background location is the critical real-time safety backup for vehicle tracking during assigned transit shifts.
- **In-App Prominent Disclosure:**
  - Displayed before any runtime location permission request (`SW-MVP-1.0` §16.3 #1).
  - Explicit modal explaining: "College Bus Tracker collects location data during active driving shifts even when the app is closed or not in use, to enable students and transport coordinators to track vehicle arrival."
  - User must tap "Agree & Continue" before system prompt is triggered.

### 2.2 Google Play Declaration Video & Form

- Submission requires a video recording of the physical device demonstrating:
  1. Driver signing in via email OTP.
  2. Prominent disclosure dialog appearing.
  3. System permission prompt sequence (Fine location -> Background "Allow all the time").
  4. Active shift with persistent foreground notification icon.
  5. Minimizing the app and showing that location is still being tracked and transmitted.

---

## 3. RS-17: Google Play Data Safety Form Declarations

Under Google Play's Data Safety declaration requirements:

1. **Data Types Collected:**
   - _Location:_ Approximate location (`ACCESS_COARSE_LOCATION`) and Precise location (`ACCESS_FINE_LOCATION`).
   - _Personal Info:_ Name, Email address, Phone number.
2. **Data Usage Purpose:**
   - App functionality (vehicle routing, ETA computation, attendance verification).
   - Emergency and safety features (SOS incidents).
3. **Data Sharing:**
   - Ephemeral location coordinates are shared with authenticated students and faculty assigned to that route.
   - **No data is shared with third-party advertisers or data brokers.**
4. **Security Practices:**
   - Data is encrypted in transit over HTTPS (TLS 1.2+).
   - Data deletion mechanism is available via the Privacy section (`SW-MVP-1.0` §16.1 #13, §29.3).
