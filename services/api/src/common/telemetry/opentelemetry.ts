import { trace, context, Span, Tracer } from '@opentelemetry/api';

const TRACER_NAME = 'college-bus-tracker-api';

export function getTracer(): Tracer {
  return trace.getTracer(TRACER_NAME, '1.0.0');
}

export async function withSpan<T>(
  spanName: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(spanName, { attributes });

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn(span);
      span.end();
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // SpanStatusCode.ERROR = 2
      span.end();
      throw error;
    }
  });
}
