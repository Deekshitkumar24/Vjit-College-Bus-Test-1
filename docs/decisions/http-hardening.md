# RS-15: HTTP Hardening, Helmet Configuration, and NestJS Production Guards

**Document ID:** RS-15  
**Sources:**

- Helmet Documentation: `https://helmetjs.github.io/` (Pinned Version: `v7.1.0`)
- NestJS Security & Middleware: `https://docs.nestjs.com/security/helmet` (Pinned Version: NestJS `v10.4.1`)
- OWASP REST Security Cheat Sheet: `https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html` (Version: 2024.1)  
  **Date Checked:** 20 October 2026 (Re-confirmed 21 October 2026)  
  **Quoted Verification (NestJS Documentation):**

> "Helmet can help protect your app from some well-known web vulnerabilities by setting HTTP headers appropriately. Generally, Helmet is just a collection of smaller middleware functions that set security-related HTTP headers."  
> **Quoted Verification (Helmet Documentation):**  
> "By default, Helmet includes 15 smaller middlewares that set security-related headers, including Content-Security-Policy, Strict-Transport-Security, and X-Content-Type-Options."

---

## 1. NestJS Architecture & Global Middleware Integration

In `services/api/src/main.ts`, the NestJS application bootstraps with Helmet, cookie-parser, global validation pipes, and custom security header middleware:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Helmet configuration for strict headers
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
    }),
  );

  // 2. Cookie parser for signed session handling
  app.use(cookieParser());

  // 3. Explicit permissions policy and cache control
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    res.removeHeader('X-Powered-By');
    if (req.headers.authorization || req.cookies?.session) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });

  // 4. NestJS Global Validation Pipe with strict rejection
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 5. Standard Error Envelope Mapping (Part 8.2)
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
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
