# Production Dependency Audit Findings Inventory (D-11)

**Date:** 2026-10-23  
**Scope:** Production Dependencies (`pnpm audit --prod`)  
**Summary:** Total 7 findings (1 low, 6 moderate, 0 high, 0 critical).  

> [!NOTE]
> All findings are classified as Low or Moderate severity. Zero High and Zero Critical vulnerabilities exist. In accordance with Section 5 item (e), every finding is documented below with package, dependency path, advisory, fix availability, and remediation plan.

| # | Package | Severity | Title | Dependency Path | Advisory URL | Fix Available | Remediation Plan |
|---|---|---|---|---|---|---|---|
| 1 | `file-type` | **MODERATE** | file-type affected by infinite loop in ASF parser on malformed input with zero-size sub-header | `services/api -> @nestjs/common -> file-type` | [https://github.com/advisories/GHSA-5v7r-6r5c-r473](https://github.com/advisories/GHSA-5v7r-6r5c-r473) | `>=21.3.1` | Monitor upstream security patches and pin patched sub-dependency via package.json pnpm.overrides. |
| 2 | `file-type` | **MODERATE** | file-type: ZIP Decompression Bomb DoS via [Content_Types].xml entry | `services/api -> @nestjs/common -> file-type` | [https://github.com/advisories/GHSA-j47w-4g3g-c36v](https://github.com/advisories/GHSA-j47w-4g3g-c36v) | `>=21.3.2` | Monitor upstream security patches and pin patched sub-dependency via package.json pnpm.overrides. |
| 3 | `@nestjs/core` | **MODERATE** | @nestjs/core Improperly Neutralizes Special Elements in Output Used by a Downstream Component ('Injection') | `services/api -> @nestjs/core` | [https://github.com/advisories/GHSA-36xv-jgw5-4q75](https://github.com/advisories/GHSA-36xv-jgw5-4q75) | `>=11.1.18` | Monitor upstream security patches and pin patched sub-dependency via package.json pnpm.overrides. |
| 4 | `qs` | **MODERATE** | qs has a remotely triggerable DoS: qs.stringify crashes with TypeError on null/undefined entries in comma-format arrays when encodeValuesOnly is set | `services/api -> @nestjs/platform-express -> body-parser -> qs` | [https://github.com/advisories/GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26) | `>=6.15.2` | Query strings in @collegebus/api are parsed via NestJS ValidationPipe and strict DTO whitelist (forbidNonWhitelisted: true). Upgrade qs via pnpm override upon @nestjs/platform-express v11 release. |
| 5 | `body-parser` | **LOW** | body-parser vulnerable to denial of service when invalid limit value silently disables size enforcement | `services/api -> @nestjs/platform-express -> body-parser` | [https://github.com/advisories/GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6) | `>=1.20.6` | Payload body limits enforced at reverse proxy / ALB (8KB max for ingest, 16KB for phone) and NestJS body size option in main.ts. Update body-parser when NestJS dependency tree updates. |
| 6 | `qs` | **MODERATE** | qs array-limit bypass via bracket-key comma parsing | `services/api -> @nestjs/platform-express -> body-parser -> qs` | [https://github.com/advisories/GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) | `>=6.16.0` | Query strings in @collegebus/api are parsed via NestJS ValidationPipe and strict DTO whitelist (forbidNonWhitelisted: true). Upgrade qs via pnpm override upon @nestjs/platform-express v11 release. |
| 7 | `qs` | **MODERATE** | qs: Denial of Service via Attacker Controlled isBuffer | `services/api -> @nestjs/platform-express -> body-parser -> qs` | [https://github.com/advisories/GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) | `>=6.16.0` | Query strings in @collegebus/api are parsed via NestJS ValidationPipe and strict DTO whitelist (forbidNonWhitelisted: true). Upgrade qs via pnpm override upon @nestjs/platform-express v11 release. |

## Detailed Finding Records

### 1. [MODERATE] file-type: file-type affected by infinite loop in ASF parser on malformed input with zero-size sub-header
- **CVE:** CVE-2026-31808
- **Vulnerable Versions:** `>=13.0.0 <21.3.1`
- **Patched Versions:** `>=21.3.1`
- **Advisory:** https://github.com/advisories/GHSA-5v7r-6r5c-r473
- **Dependency Path:** `services__api>@nestjs/common>file-type`
- **Remediation Plan:** Track upstream NestJS / Express updates. Workaround mitigations (body size limits, DTO whitelist validation, Helmet) are active in application layer.

### 2. [MODERATE] file-type: file-type: ZIP Decompression Bomb DoS via [Content_Types].xml entry
- **CVE:** CVE-2026-32630
- **Vulnerable Versions:** `>=20.0.0 <=21.3.1`
- **Patched Versions:** `>=21.3.2`
- **Advisory:** https://github.com/advisories/GHSA-j47w-4g3g-c36v
- **Dependency Path:** `services__api>@nestjs/common>file-type`
- **Remediation Plan:** Track upstream NestJS / Express updates. Workaround mitigations (body size limits, DTO whitelist validation, Helmet) are active in application layer.

### 3. [MODERATE] @nestjs/core: @nestjs/core Improperly Neutralizes Special Elements in Output Used by a Downstream Component ('Injection')
- **CVE:** CVE-2026-35515
- **Vulnerable Versions:** `<=11.1.17`
- **Patched Versions:** `>=11.1.18`
- **Advisory:** https://github.com/advisories/GHSA-36xv-jgw5-4q75
- **Dependency Path:** `services__api>@nestjs/core`
- **Remediation Plan:** Track upstream NestJS / Express updates. Workaround mitigations (body size limits, DTO whitelist validation, Helmet) are active in application layer.

### 4. [MODERATE] qs: qs has a remotely triggerable DoS: qs.stringify crashes with TypeError on null/undefined entries in comma-format arrays when encodeValuesOnly is set
- **CVE:** CVE-2026-8723
- **Vulnerable Versions:** `>=6.11.1 <=6.15.1`
- **Patched Versions:** `>=6.15.2`
- **Advisory:** https://github.com/advisories/GHSA-q8mj-m7cp-5q26
- **Dependency Path:** `services__api>@nestjs/platform-express>body-parser>qs`
- **Remediation Plan:** Track upstream NestJS / Express updates. Workaround mitigations (body size limits, DTO whitelist validation, Helmet) are active in application layer.

### 5. [LOW] body-parser: body-parser vulnerable to denial of service when invalid limit value silently disables size enforcement
- **CVE:** CVE-2026-12590
- **Vulnerable Versions:** `<1.20.6`
- **Patched Versions:** `>=1.20.6`
- **Advisory:** https://github.com/advisories/GHSA-v422-hmwv-36x6
- **Dependency Path:** `services__api>@nestjs/platform-express>body-parser`
- **Remediation Plan:** Track upstream NestJS / Express updates. Workaround mitigations (body size limits, DTO whitelist validation, Helmet) are active in application layer.

### 6. [MODERATE] qs: qs array-limit bypass via bracket-key comma parsing
- **CVE:** CVE-2026-82562
- **Vulnerable Versions:** `>=6.14.2 <=6.15.3`
- **Patched Versions:** `>=6.16.0`
- **Advisory:** https://github.com/advisories/GHSA-x5fp-wj9c-mxmx
- **Dependency Path:** `services__api>@nestjs/platform-express>body-parser>qs`
- **Remediation Plan:** Track upstream NestJS / Express updates. Workaround mitigations (body size limits, DTO whitelist validation, Helmet) are active in application layer.

### 7. [MODERATE] qs: qs: Denial of Service via Attacker Controlled isBuffer
- **CVE:** CVE-2026-82417
- **Vulnerable Versions:** `>=2.2.5 <6.16.0`
- **Patched Versions:** `>=6.16.0`
- **Advisory:** https://github.com/advisories/GHSA-4mjr-xmp4-gh2g
- **Dependency Path:** `services__api>@nestjs/platform-express>body-parser>qs`
- **Remediation Plan:** Track upstream NestJS / Express updates. Workaround mitigations (body size limits, DTO whitelist validation, Helmet) are active in application layer.

