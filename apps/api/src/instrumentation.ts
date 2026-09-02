// Preloaded via `node -r ./dist/instrumentation.js` or imported first in main.ts.
import { startTracing } from '@souq/observability';

const enabled = process.env.OTEL_ENABLED === 'true' || process.env.OTEL_ENABLED === '1';
if (enabled) {
  void startTracing({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'souq-api',
    enabled: true,
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });
}
