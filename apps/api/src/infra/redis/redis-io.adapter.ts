import { IoAdapter } from '@nestjs/platform-socket.io';
import { type INestApplicationContext } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { type ServerOptions } from 'socket.io';
import type { RedisService } from './redis.service';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(app: INestApplicationContext, private readonly origins: string[]) {
    super(app);
  }

  async connect(redis: RedisService | undefined): Promise<void> {
    const pub = redis?.duplicate();
    const sub = redis?.duplicate();
    if (pub && sub) {
      try {
        await Promise.all([pub.connect?.().catch(() => undefined), sub.connect?.().catch(() => undefined)]);
        if (pub.status === 'ready' && sub.status === 'ready') this.adapterConstructor = createAdapter(pub, sub);
      } catch {
        this.adapterConstructor = null;
      }
    }
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.origins, credentials: true },
      transports: ['websocket', 'polling'],
    });
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}
