import { Global, Injectable, Module } from '@nestjs/common';
import type { JobName, JobPayloads } from '../queue/queue.constants';

export type JobHandler<N extends JobName> = (payload: JobPayloads[N], meta: { jobId: string; attempt: number }) => Promise<void>;

/**
 * Modules register job handlers here (typically in onModuleInit). The worker process
 * dispatches BullMQ jobs to registered handlers; the API process uses the same registry
 * for the in-process fallback when Redis is unavailable.
 */
@Injectable()
export class JobRegistry {
  private readonly handlers = new Map<JobName, JobHandler<JobName>>();

  register<N extends JobName>(name: N, handler: JobHandler<N>): void {
    if (this.handlers.has(name)) throw new Error(`Job handler already registered for ${name}`);
    this.handlers.set(name, handler as unknown as JobHandler<JobName>);
  }

  get<N extends JobName>(name: N): JobHandler<N> | undefined {
    return this.handlers.get(name) as JobHandler<N> | undefined;
  }

  has(name: JobName): boolean {
    return this.handlers.has(name);
  }

  names(): JobName[] {
    return [...this.handlers.keys()];
  }
}

@Global()
@Module({ providers: [JobRegistry], exports: [JobRegistry] })
export class JobsModule {}
