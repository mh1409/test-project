import { trace, context, SpanStatusCode, type Span, type Tracer } from '@opentelemetry/api';

export interface TracingOptions {
  serviceName: string;
  enabled: boolean;
  endpoint?: string;
}

let sdk: { shutdown(): Promise<void> } | null = null;

/**
 * Starts OpenTelemetry Node SDK with OTLP/HTTP exporter and auto instrumentation
 * (http, express, pg, ioredis...). Must be called before the app imports its
 * frameworks to instrument them; call from an instrumentation preload file.
 */
export async function startTracing(opts: TracingOptions): Promise<void> {
  if (!opts.enabled || sdk) return;
  const [{ NodeSDK }, { OTLPTraceExporter }, { getNodeAutoInstrumentations }, { resourceFromAttributes }, semconv] =
    await Promise.all([
      import('@opentelemetry/sdk-node'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/auto-instrumentations-node'),
      import('@opentelemetry/resources'),
      import('@opentelemetry/semantic-conventions'),
    ]);
  const node = new NodeSDK({
    resource: resourceFromAttributes({ [semconv.ATTR_SERVICE_NAME]: opts.serviceName }),
    traceExporter: new OTLPTraceExporter(opts.endpoint ? { url: `${opts.endpoint.replace(/\/$/, '')}/v1/traces` } : {}),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });
  node.start();
  sdk = node;
}

export async function stopTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}

export function getTracer(name = 'souq'): Tracer {
  return trace.getTracer(name);
}

/** Wrap an async operation in a span; records exceptions and status. */
export async function withSpan<T>(name: string, fn: (span: Span) => Promise<T>, attributes?: Record<string, string | number | boolean>): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span) => {
    if (attributes) span.setAttributes(attributes);
    try {
      return await fn(span);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}

export function currentTraceId(): string | undefined {
  return trace.getSpan(context.active())?.spanContext().traceId;
}
