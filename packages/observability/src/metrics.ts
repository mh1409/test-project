import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export class Metrics {
  readonly registry = new Registry();
  readonly httpRequestDuration: Histogram<'method' | 'route' | 'status'>;
  readonly httpRequestsTotal: Counter<'method' | 'route' | 'status'>;
  readonly httpErrorsTotal: Counter<'method' | 'route' | 'code'>;
  readonly dbQueryDuration: Histogram<'model' | 'action'>;
  readonly queueJobs: Counter<'queue' | 'status'>;
  readonly queueSize: Gauge<'queue' | 'state'>;
  readonly cacheOps: Counter<'result'>;
  readonly outboxPending: Gauge<string>;
  readonly businessEvents: Counter<'event'>;

  constructor(prefix = 'souq_') {
    collectDefaultMetrics({ register: this.registry, prefix });
    this.httpRequestDuration = new Histogram({
      name: `${prefix}http_request_duration_seconds`,
      help: 'HTTP request latency',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });
    this.httpRequestsTotal = new Counter({
      name: `${prefix}http_requests_total`,
      help: 'HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
    this.httpErrorsTotal = new Counter({
      name: `${prefix}http_errors_total`,
      help: 'HTTP error responses by error code',
      labelNames: ['method', 'route', 'code'],
      registers: [this.registry],
    });
    this.dbQueryDuration = new Histogram({
      name: `${prefix}db_query_duration_seconds`,
      help: 'Database query latency',
      labelNames: ['model', 'action'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [this.registry],
    });
    this.queueJobs = new Counter({
      name: `${prefix}queue_jobs_total`,
      help: 'Background jobs by outcome',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });
    this.queueSize = new Gauge({
      name: `${prefix}queue_size`,
      help: 'Queue depth by state',
      labelNames: ['queue', 'state'],
      registers: [this.registry],
    });
    this.cacheOps = new Counter({
      name: `${prefix}cache_ops_total`,
      help: 'Cache hits/misses',
      labelNames: ['result'],
      registers: [this.registry],
    });
    this.outboxPending = new Gauge({
      name: `${prefix}outbox_pending`,
      help: 'Pending outbox events',
      registers: [this.registry],
    });
    this.businessEvents = new Counter({
      name: `${prefix}business_events_total`,
      help: 'Domain events emitted',
      labelNames: ['event'],
      registers: [this.registry],
    });
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
