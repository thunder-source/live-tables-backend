import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface UserPresence {
  userId: string;
  username: string;
  avatarUrl?: string;
  color?: string;
  status: 'online' | 'idle';
  lastActive: number;
  cursor?: { x: number; y: number; fieldId?: string };
  selection?: { type: 'cell' | 'row' | 'col'; ids: string[] };
}

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  private readonly logger = new Logger(PresenceService.name);
  private readonly TTL = 3600; // 1 hour TTL for presence keys

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const port = this.configService.get<number>('REDIS_PORT') || 6379;
    // TODO: Add password support if needed
    this.redis = new Redis({ host, port });
    this.logger.log(`PresenceService connected to Redis at ${host}:${port}`);
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  private getRoomKey(room: string) {
    return `presence:${room}`;
  }

  async addUser(room: string, userId: string, userInfo: Partial<UserPresence>) {
    const key = this.getRoomKey(room);
    const presence: UserPresence = {
      userId,
      username: userInfo.username || 'Anonymous',
      status: 'online',
      lastActive: Date.now(),
      ...userInfo,
    };
    await this.redis.hset(key, userId, JSON.stringify(presence));
    await this.redis.expire(key, this.TTL);
    return presence;
  }

  async removeUser(room: string, userId: string) {
    const key = this.getRoomKey(room);
    await this.redis.hdel(key, userId);
  }

  async getUsers(room: string): Promise<UserPresence[]> {
    const key = this.getRoomKey(room);
    const data = await this.redis.hgetall(key);
    return Object.values(data).map((u) => JSON.parse(u));
  }

  async updateCursor(room: string, userId: string, cursor: any) {
    // We might not want to persist cursor to Redis for every move if it's high frequency.
    // But for "last known position" it's useful.
    // For now, we'll just broadcast, but if we want late-joiners to see cursors, we need to store it.
    // Let's store it but maybe throttle updates to Redis if needed.
    const key = this.getRoomKey(room);
    const userStr = await this.redis.hget(key, userId);
    if (userStr) {
      const user = JSON.parse(userStr);
      user.cursor = cursor;
      user.lastActive = Date.now();
      await this.redis.hset(key, userId, JSON.stringify(user));
    }
  }

  async updateSelection(room: string, userId: string, selection: any) {
    const key = this.getRoomKey(room);
    const userStr = await this.redis.hget(key, userId);
    if (userStr) {
      const user = JSON.parse(userStr);
      user.selection = selection;
      user.lastActive = Date.now();
      await this.redis.hset(key, userId, JSON.stringify(user));
    }
  }
}
