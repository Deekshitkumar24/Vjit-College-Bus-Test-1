## Task Information
- **Task ID:** <!-- e.g., P0-T1 -->
- **Specification Sections Covered:** <!-- e.g., SW-MVP-1.0 §8, HW-SPEC-1.0 §5 -->

## Security & Quality Checklist (AG-MASTER-1.0 §13.17)
- [ ] Authentication and role authorization checked
- [ ] Every new input validated with Zod at the boundary
- [ ] No raw/unparameterized SQL queries (`$queryRawUnsafe` banned)
- [ ] No secrets, keys, passwords, or personal data in logs or code
- [ ] Migrations are expand-only and backward compatible
- [ ] `verify:no-mock` passes (no mock/dummy data in application code)
- [ ] Unit & integration tests added and passing
- [ ] Phase progress report updated
