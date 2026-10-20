import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Request, Response, NextFunction } from 'express';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Security Headers with Helmet (AG-MASTER-1.0 §13.18)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      xContentTypeOptions: true,
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

  // 2. Custom header policies & X-Powered-By strip
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    res.removeHeader('X-Powered-By');
    if (req.headers['authorization'] || req.cookies?.['session']) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });

  // 3. Cookie Parser
  app.use(cookieParser());

  // 4. CORS Allowlist (AG-MASTER-1.0 §13.7)
  const allowedOrigins = process.env['CORS_ALLOWED_ORIGINS']
    ? process.env['CORS_ALLOWED_ORIGINS'].split(',')
    : ['http://localhost:5173'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS request blocked by server policy'));
      }
    },
    credentials: true,
  });

  // 5. Global API Prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env['PORT'] || 3000;
  await app.listen(port);
  console.log(`College Bus Tracker API listening on port ${port}`);
  return app;
}

if (process.argv[1] && process.argv[1].endsWith('main.ts')) {
  bootstrap().catch((err) => {
    console.error('Fatal startup error in API:', err);
    process.exit(1);
  });
}
