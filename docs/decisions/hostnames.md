# Hostnames and Domains Decision (D-12)

**Decision ID:** D-12  
**Date:** 2026-10-23  
**Status:** In Force  

## Policy on `*.dev.collegebus.internal`

1. **Status:** Any hostname matching `*.dev.collegebus.internal` (e.g. `api.dev.collegebus.internal`, `admin.dev.collegebus.internal`) is strictly a **configuration placeholder**, not an active or deployed infrastructure asset.
2. **Replacement Protocol:** When external input **E1** (`AWS_PROFILE`, `AWS_REGION`, `API_PUBLIC_HOST`) is supplied, these placeholder values must be immediately replaced with the actual registered domain name.
3. **Approval:** Per rule D-12, **no owner GO is required** for replacing internal configuration placeholders with the real domain provided in E1.
