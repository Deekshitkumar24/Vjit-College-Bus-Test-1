# RS-15: HTTP Hardening, Helmet Configuration, and Production Guards

**Document ID:** RS-15  
**Source:** Helmet Documentation, OWASP REST Security Cheat Sheet, NestJS Security Guide  
**Date Checked:** 20 October 2026  

---

## 1. Helmet & Response Headers Configuration (`AG-MASTER-1.0` §13.18)
In `services/api/src/main.ts`, Helmet is configured to apply strict HTTP response headers:

```typescript
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    xContentTypeOptions: true, // nosniff
    xFrameOptions: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  })
);

// Explicit header controls
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.removeHeader('X-Powered-By');
  if (req.headers.authorization || req.cookies?.session) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});
```

---

## 2. CORS Policy Architecture (`AG-MASTER-1.0` §13.7)
- **Ingest Host (`ingest.[college_domain]`):** Returns **NO CORS headers**. Hardware trackers and mobile apps communicate via native sockets/HTTPS and do not execute in browser DOM sandboxes.
- **API Host (`api.[college_domain]`):**
  - Origin allowlist is strictly pinned to `CORS_ALLOWED_ORIGINS` (only the static admin web console origin `https://admin.[college_domain]`).
  - Wildcard `*` is explicitly banned.
  - `credentials: true` is allowed only for the matching admin console origin.

---

## 3. Disabling OpenAPI / Swagger UI in Production (`AG-MASTER-1.0` §13.10)
Swagger documentation is generated automatically from code but strictly protected:
```typescript
if (process.env.NODE_ENV !== 'production') {
  const config = new DocumentBuilder()
    .setTitle('College Bus Tracker API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
```
In production environments (`NODE_ENV === 'production'`), the `/api/docs` route is completely unregistered, and raw OpenAPI JSON schemas are restricted to development and staging tiers.
