# RS-20: expo-sqlite Offline Storage & Background Buffer for Driver App

**Document ID:** RS-20  
**Source:** `expo-sqlite` (v14) Documentation, React Native TaskManager Guides  
**Date Checked:** 20 October 2026  

---

## 1. Requirement & Capacity Sizing
Under `SW-MVP-1.0` §11.7 and `AG-MASTER-1.0` §10.5 (#10):
- The driver mobile phone must buffer location samples locally during network outages for up to **24 hours**.
- At a 10-second sampling interval (`phone.fallback_interval_s`), 24 hours produces:
  $$\frac{24 \text{ hours} \times 3600 \text{ seconds}}{10 \text{ seconds/sample}} = 8,640 \text{ samples}$$
- Storage volume estimate: At approximately 120 bytes per JSON sample row, 8,640 records occupy ~1.04 MB. An embedded SQLite database on a modern smartphone easily supports this footprint with negligible overhead.

---

## 2. Background Concurrency & Thread Safety with `expo-sqlite`
- In `Expo SDK 51`, `expo-sqlite` introduces the new `SQLiteDatabase` async API (`openDatabaseAsync`), which uses native SQLite WAL (Write-Ahead Logging) mode.
- **Background Headless Tasks:** When `expo-task-manager` executes the background location task registered via `TaskManager.defineTask`, it operates in a headless JS context.
- **Safe SQLite Operations in Background:**
  1. Initialize connection using WAL mode: `PRAGMA journal_mode = WAL;`.
  2. Single sequential buffer writer pattern prevents database lock collisions between background location tasks and UI threads.
  3. Batch insertion (`INSERT INTO buffered_samples ...`) inside explicit transactions guarantees atomic persistence even if the operating system terminates the process.

---

## 3. Buffer Schema & Replay Logic
```sql
CREATE TABLE IF NOT EXISTS phone_sample_buffer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  recorded_at TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy_m REAL NOT NULL,
  speed_mps REAL,
  heading_deg REAL,
  provider TEXT NOT NULL,
  is_mock INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_buffer_shift_seq ON phone_sample_buffer (shift_id, seq ASC);
```

- **Replay Sequence:** When network connectivity is re-established:
  1. The app queries up to 50 samples in chronological order (`ORDER BY seq ASC LIMIT 50`).
  2. Transmits the batch to `POST /api/v1/driver/locations`.
  3. Deletes rows from `phone_sample_buffer` only up to the server-confirmed `ack_seq`.
  4. Repeats at a rate of 1 batch every 2 seconds until the buffer is emptied (`SW-MVP-1.0` §11.8).
