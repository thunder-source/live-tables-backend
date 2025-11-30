import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';
import { INestApplicationContext, Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(RedisIoAdapter.name);

  constructor(private app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const configService = this.app.get(ConfigService);
    // Use REDIS_URL or fallback to localhost. 
    // Ensure your .env has REDIS_URL or similar.
    const redisHost = configService.get<string>('REDIS_HOST') || 'localhost';
    const redisPort = configService.get<number>('REDIS_PORT') || 6379;
    const redisUrl = `redis://${redisHost}:${redisPort}`;

    this.logger.log(`Connecting to Redis at ${redisUrl} for Socket.IO Adapter...`);

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => this.logger.error('Redis Pub Client Error', err));
    subClient.on('error', (err) => this.logger.error('Redis Sub Client Error', err));

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Redis Adapter initialized successfully.');
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
