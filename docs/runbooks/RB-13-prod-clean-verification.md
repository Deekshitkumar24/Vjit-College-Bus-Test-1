# RB-13: Production Clean Verification & Zero-Synthetic Data Audit

## 1. Purpose
Mandatory pre-launch procedure ensuring that zero synthetic, mock, or test data exists in the production database (Rule A-10, P9-T3).

## 2. Zero Synthetic Data Rule (Non-Negotiable)
Synthetic data is strictly forbidden in production. Any row with `is_synthetic = true`, mock email domains (`@example.com`, `@test.edu`), or synthetic serials must fail deployment.

## 3. Verification Script Execution
Run the verification check against target database:
```bash
pnpm tsx scripts/verify-prod-clean.ts
```

The script audits:
- `users`: zero records with `is_synthetic = true` or test emails
- `buses`: zero mock bus numbers or dummy VINs
- `devices`: zero test tokens or mock IMEIs
- `location_samples`: zero synthetic coordinates
- `attendance_records`: zero simulated boarding entries

If any synthetic record is discovered, run `pnpm db:purge-synthetic` immediately and re-audit before production gate sign-off.
