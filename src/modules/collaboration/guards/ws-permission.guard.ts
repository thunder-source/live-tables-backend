import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsPermissionGuard implements CanActivate {
  private readonly logger = new Logger(WsPermissionGuard.name);

  constructor(
    // Inject services here later
    // private readonly workspacesService: WorkspacesService,
    // private readonly tablesService: TablesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const data = context.switchToWs().getData();
    const user = client.data.user;

    if (!user) {
      this.logger.warn('WsPermissionGuard: No user found on socket');
      throw new WsException('Unauthorized');
    }

    const room = data?.room;
    if (!room) {
      // If no room specified in data, and this guard is applied to join_room, it's invalid.
      // But if applied globally, we might skip for other events.
      // Let's assume it's applied to @SubscribeMessage('join_room')
      return true;
    }

    this.logger.log(`Checking permission for user ${user.sub} to join ${room}`);

    // Parse room: "type:id"
    const [type, id] = room.split(':');

    if (!type || !id) {
      this.logger.warn(`Invalid room format: ${room}`);
      return false;
    }

    // TODO: Implement actual DB checks
    // if (type === 'workspace') { ... }
    // if (type === 'table') { ... }

    return true;
  }
}
