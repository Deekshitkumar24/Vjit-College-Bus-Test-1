# RS-10: PostGIS Spatial Queries & Spatial Indexing

**Document ID:** RS-10  
**Source:** PostGIS 3.4 Official Documentation  
**Date Checked:** 20 October 2026

---

## 1. Coordinate Systems & Types

- **Data Type:** `geography(Point, 4326)` for vehicle locations and stop coordinates; `geography(LineString, 4326)` for route paths.
- **Unit Standards:** Distance calculations on `geography` automatically return results in **metres** based on the WGS84 spheroid (never degrees).
- **Indexing:** Every spatial column is indexed with a Generalized Search Tree (`GIST`) index for O(log N) bounding-box spatial filtering:
  ```sql
  CREATE INDEX idx_location_samples_geom ON location_samples USING GIST (geom);
  CREATE INDEX idx_stops_location ON stops USING GIST (location);
  CREATE INDEX idx_route_geometries_line ON route_geometries USING GIST (line);
  ```

---

## 2. Core Operational Spatial Queries

### 2.1 Route Corridor Proximity Check (`ST_DWithin`)

Used for stop request validation (must be within 300m of route line per `SW-MVP-1.0` §20.1, `AG-MASTER-1.0` §11.7):

```sql
SELECT ST_DWithin(
  rg.line,
  ST_SetSRID(ST_MakePoint($proposed_lng, $proposed_lat), 4326)::geography,
  300.0 -- route.corridor_m in metres
) AS is_within_corridor
FROM route_geometries rg
WHERE rg.route_id = $route_id AND rg.valid_to IS NULL;
```

### 2.2 Route Line-Projection & Distance Along Route

Used for dynamic ETA and next-stop ordering (`SW-MVP-1.0` §17.5, `AG-MASTER-1.0` §9.11):

```sql
WITH route_data AS (
  SELECT
    line::geometry AS line_geom,
    ST_Length(line) AS total_length_m
  FROM route_geometries
  WHERE route_id = $route_id AND valid_to IS NULL
)
SELECT
  total_length_m,
  -- Fraction (0.0 to 1.0) of bus projection along line:
  ST_LineLocatePoint(line_geom, ST_SetSRID(ST_MakePoint($bus_lng, $bus_lat), 4326)) AS bus_fraction,
  -- Distance from route start to current bus projection in metres:
  ST_LineLocatePoint(line_geom, ST_SetSRID(ST_MakePoint($bus_lng, $bus_lat), 4326)) * total_length_m AS bus_distance_m
FROM route_data;
```

### 2.3 Stop Arrival & Dwell Detection

Calculates whether a vehicle is within a stop radius (50m) (`SW-MVP-1.0` §17.4):

```sql
SELECT s.id AS stop_id, s.name,
       ST_Distance(s.location, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography) AS distance_m
FROM stops s
JOIN route_stops rs ON rs.stop_id = s.id
WHERE rs.route_id = $route_id AND rs.valid_to IS NULL
  AND ST_DWithin(s.location, ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography, s.radius_m);
```
