import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { GlobalAuthGuard } from './common/guards/auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor.js';
import { RateLimiterMiddleware } from './common/middleware/rate-limiter.middleware.js';
import { IdempotencyMiddleware } from './common/middleware/idempotency.middleware.js';

@Module({
  imports: [HealthModule, AuthModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GlobalAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimiterMiddleware, IdempotencyMiddleware)
      .forRoutes('*');
  }
}
