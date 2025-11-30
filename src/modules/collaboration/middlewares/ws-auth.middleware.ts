import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

export type SocketMiddleware = (socket: Socket, next: (err?: Error) => void) => void;

export const WsAuthMiddleware = (jwtService: JwtService, configService: ConfigService): SocketMiddleware => {
  const logger = new Logger('WsAuthMiddleware');
  return async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      
      if (!token) {
        logger.warn(`Authentication failed for socket ${socket.id}: No token provided`);
        return next(new Error('Authentication error'));
      }

      const secret = configService.get<string>('jwt.secret') || 'dev-secret-key';
      const payload = await jwtService.verifyAsync(token, { secret });
      
      socket.data.user = payload;
      next();
    } catch (error) {
      logger.warn(`Authentication failed for socket ${socket.id}: Invalid token`);
      next(new Error('Authentication error'));
    }
  };
};
