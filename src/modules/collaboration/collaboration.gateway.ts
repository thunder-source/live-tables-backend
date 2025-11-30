import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsAuthMiddleware } from './middlewares/ws-auth.middleware';
import { PresenceService } from './presence.service';
import { WsPermissionGuard } from './guards/ws-permission.guard';
import { CollaborationService } from './collaboration.service';
import { WsThrottlerGuard } from './guards/ws-throttler.guard';

@WebSocketGateway({
  cors: {
    origin: '*', // TODO: Configure for production
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: 'ws',
  transports: ['websocket', 'polling'],
  pingInterval: 10000, // 10 seconds heartbeat
  pingTimeout: 5000,   // 5 seconds timeout
  perMessageDeflate: {
    threshold: 1024, // Compress messages > 1KB
  },
})
export class CollaborationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  private readonly logger = new Logger(CollaborationGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly presenceService: PresenceService,
    private readonly collaborationService: CollaborationService,
  ) {}

  afterInit(server: Server) {
    const middleware = WsAuthMiddleware(this.jwtService, this.configService);
    server.use(middleware);
    this.logger.log('WsAuthMiddleware initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}, User ID: ${client.data.user?.sub}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  @UseGuards(WsPermissionGuard)
  async handleJoinRoom(client: Socket, payload: { room: string }) {
    client.join(payload.room);
    const userId = client.data.user.sub;
    const userInfo = { username: client.data.user.username || 'User' };
    
    await this.presenceService.addUser(payload.room, userId, userInfo);
    
    this.logger.log(`Client ${client.id} joined room ${payload.room}`);
    client.emit('joined_room', { room: payload.room });
    client.to(payload.room).emit('user_joined', { userId, ...userInfo });
    
    const users = await this.presenceService.getUsers(payload.room);
    client.emit('presence_sync', users);
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(client: Socket, payload: { room: string }) {
    client.leave(payload.room);
    const userId = client.data.user.sub;
    
    await this.presenceService.removeUser(payload.room, userId);
    
    this.logger.log(`Client ${client.id} left room ${payload.room}`);
    client.to(payload.room).emit('user_left', { userId });
  }

  @SubscribeMessage('cursor_move')
  @UseGuards(WsPermissionGuard, WsThrottlerGuard)
  handleCursorMove(client: Socket, payload: { room: string; cursor: any }) {
    const userId = client.data.user.sub;
    client.to(payload.room).emit('user_cursor_move', { userId, cursor: payload.cursor });
    this.presenceService.updateCursor(payload.room, userId, payload.cursor);
  }

  @SubscribeMessage('selection_change')
  @UseGuards(WsPermissionGuard, WsThrottlerGuard)
  handleSelectionChange(client: Socket, payload: { room: string; selection: any }) {
    const userId = client.data.user.sub;
    client.to(payload.room).emit('user_selection_change', { userId, selection: payload.selection });
    this.presenceService.updateSelection(payload.room, userId, payload.selection);
  }

  @SubscribeMessage('user_idle')
  @UseGuards(WsPermissionGuard)
  handleUserIdle(client: Socket, payload: { room: string; idle: boolean }) {
    const userId = client.data.user.sub;
    client.to(payload.room).emit('user_idle', { userId, idle: payload.idle });
  }

  @SubscribeMessage('typing')
  @UseGuards(WsPermissionGuard)
  handleTyping(client: Socket, payload: { room: string; isTyping: boolean }) {
    const userId = client.data.user.sub;
    client.to(payload.room).emit('typing', { userId, isTyping: payload.isTyping });
  }

  @SubscribeMessage('update_row')
  @UseGuards(WsPermissionGuard)
  async handleUpdateRow(
    client: Socket,
    payload: { room: string; tableId: string; rowId: string; data: Record<string, any>; version?: number },
    callback?: (response: any) => void,
  ) {
    const userId = client.data.user.sub;
    
    const result = await this.collaborationService.handleRowUpdate(
      this.server,
      userId,
      payload,
    );

    if (callback) {
      callback(result);
    }

    if (!result.success) {
      client.emit('update_failed', {
        rowId: payload.rowId,
        error: result.error,
      });
    }
  }

  @SubscribeMessage('batch_update')
  @UseGuards(WsPermissionGuard)
  async handleBatchUpdate(
    client: Socket,
    payload: { room: string; tableId: string; updates: Array<{ rowId: string; data: Record<string, any>; version?: number }> },
    callback?: (response: any) => void,
  ) {
    const userId = client.data.user.sub;
    
    const result = await this.collaborationService.handleBatchUpdate(
      this.server,
      userId,
      payload,
    );

    if (callback) {
      callback(result);
    }
  }
}
