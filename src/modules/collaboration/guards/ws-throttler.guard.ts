import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

@Injectable()
export class WsThrottlerGuard implements CanActivate {
  private readonly logger = new Logger(WsThrottlerGuard.name);
  private readonly rateLimits = new Map<string, RateLimitInfo>();
  
  // Default: 30 events per 10 seconds
  private readonly maxEvents = 30;
  private readonly windowMs = 10000; // 10 seconds

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const event = context.switchToWs().getPattern();
    const userId = client.data.user?.sub;

    if (!userId) {
      return true; // Auth guard should handle this
    }

    const key = `${userId}:${event}`;
    const now = Date.now();
    const limitInfo = this.rateLimits.get(key);

    if (!limitInfo || now > limitInfo.resetTime) {
      // Reset window
      this.rateLimits.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (limitInfo.count >= this.maxEvents) {
      this.logger.warn(`Rate limit exceeded for user ${userId} on event ${event}`);
      throw new WsException('Rate limit exceeded. Please slow down.');
    }

    limitInfo.count++;
    return true;
  }
}
