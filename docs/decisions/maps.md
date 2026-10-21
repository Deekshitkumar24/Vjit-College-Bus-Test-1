# RS-13: MapLibre GL JS & MapLibre React Native Architecture

**Document ID:** RS-13  
**Sources:**

- MapLibre GL JS Documentation: `https://maplibre.org/maplibre-gl-js/docs/` (Pinned Version: `v4.7.1`)
- MapLibre Native for React Native: `https://github.com/maplibre/maplibre-react-native` (Pinned Version: `v10.1.1`)  
  **Date Checked:** 20 October 2026 (Re-confirmed 21 October 2026)  
  **Quoted Verification (MapLibre React Native):**

> "A community-supported MapLibre Native binding for React Native supporting vector and raster map rendering on iOS and Android with custom layers, sources, and offline map pack caching."  
> **Quoted Verification (MapLibre GL JS):**  
> "MapLibre GL JS is an open source TypeScript library for publishing maps on your websites. It’s fast, powerful, and responsive."

---

## 1. Web Console Map Integration (`apps/admin-web`)

- **Library:** `maplibre-gl` (`v4.7.1`)
- **Tile Provider:** OpenStreetMap standard raster/vector tiles via free tile servers (e.g., Carto / Stadia or self-hosted vector tiles) (`SW-MVP-1.0` §17.1).
- **Style Configuration:** Extracted to a clean configuration token (`VITE_MAP_STYLE_URL`) so a transition to a Google Maps or Mapbox style layer can be performed with zero code refactoring (`SW-MVP-1.0` §17.1, §41 #3).
- **Features Implemented:**
  - _Fleet Marker Clustering:_ Clustered within 40 pixels; tapping a cluster expands to show individual buses (`SW-MVP-1.0` §17.1).
  - _Route Geometry Rendering:_ Displays `LineString` route overlays with stop markers and radii circles (50m default).
  - _Comparison View (COR / SAD only):_ Plots two color-coded tracks showing the last 10 minutes of both Hardware and Phone locations simultaneously (`SW-MVP-1.0` §13.8, §26.2).

---

## 2. Mobile App Map Integration (`apps/mobile`)

- **Library:** `@maplibre/maplibre-react-native` (`v10.1.1`)
- **Compatibility:** Fully certified for React Native 0.74 / Expo SDK 51 with custom Expo config plugin.
- **Components & Layers:**
  - `MapLibreGL.MapView`: Interactive hardware-accelerated canvas for student/faculty/driver tracking.
  - `MapLibreGL.ShapeSource` & `MapLibreGL.LineLayer`: Displays current route geometry.
  - `MapLibreGL.PointAnnotation` / `SymbolLayer`: Renders vehicle markers with direction arrows indicating heading (0 to 360 degrees) and adjacent source status badges (`Live, bus tracker`, `Live, driver's phone`, or `STALE` grey marker) (`SW-MVP-1.0` §13.7, §17.1).
- **Offline / Stale Fallback:**
  - If network connectivity is lost, the last known bus position remains cached on screen for up to 10 minutes with an explicit "Cached / Offline" status banner (`SW-MVP-1.0` §16.1 #14, §17.6).
