# RS-12: PostgreSQL Row-Level Security (RLS) & Prisma Multi-Tenancy

**Document ID:** RS-12  
**Source:** PostgreSQL 16 Documentation, Prisma Interactive Transactions Guide  
**Date Checked:** 20 October 2026  

---

## 1. Context & Defense-in-Depth RLS Architecture
To guarantee zero cross-role and cross-tenant data leakage (`SW-MVP-1.0` §1.4, `AG-MASTER-1.0` §7.11, §13.1), PostgreSQL Row-Level Security (RLS) is forced across all personal and operational data tables.

Three distinct database roles are established:
1. `app_migrator`: Owns tables and migrations. Never used at runtime.
2. `app_runtime`: Used by `services/api`. Non-owner, has **NO `BYPASSRLS`** privilege.
3. `app_worker`: Used by `services/worker`. Granted only permissions needed for background jobs.

---

## 2. Session Context Injection per Transaction
Prisma does not have native RLS session injection. Therefore, every client request processed by the API runs inside an interactive Prisma transaction that initializes Postgres configuration variables before executing queries (`AG-MASTER-1.0` §7.11, §13.1):

```typescript
export async function withRlsContext<T>(
  prisma: PrismaClient,
  context: { userId: string; roles: string[]; busIds: string[]; routeIds: string[] },
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Parameterized session configuration injection (is_local = true limits to current tx)
    await tx.$executeRaw`
      SELECT 
        set_config('app.user_id', ${context.userId}, true),
        set_config('app.roles', ${context.roles.join(',')}, true),
        set_config('app.bus_ids', ${context.busIds.join(',')}, true),
        set_config('app.route_ids', ${context.routeIds.join(',')}, true);
    `;
    return fn(tx);
  });
}
```

---

## 3. Sample Fail-Closed Policy Implementations

### 3.1 Student Attendance Isolation
```sql
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records FORCE ROW LEVEL SECURITY;

CREATE POLICY attendance_isolation_policy ON attendance_records
  AS RESTRICTIVE
  FOR ALL
  TO app_runtime
  USING (
    -- Super Admin & Coordinator have full access:
    'SAD' = ANY(string_to_array(current_setting('app.roles', true), ',')) OR
    'COR' = ANY(string_to_array(current_setting('app.roles', true), ',')) OR
    -- Student can only see their own records:
    (
      'STU' = ANY(string_to_array(current_setting('app.roles', true), ',')) AND
      student_id = NULLIF(current_setting('app.user_id', true), '')::uuid
    ) OR
    -- Faculty can see records for their assigned buses:
    (
      'FAC' = ANY(string_to_array(current_setting('app.roles', true), ',')) AND
      EXISTS (
        SELECT 1 FROM trips t 
        WHERE t.id = attendance_records.trip_id 
          AND t.bus_id::text = ANY(string_to_array(current_setting('app.bus_ids', true), ','))
      )
    )
  );
```
*Verification Rule:* If a transaction does not invoke `set_config` to inject `app.user_id` and `app.roles`, all queries return zero rows (fail closed).
