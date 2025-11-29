import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { WorkspaceRole } from '../../modules/workspaces/entities/workspace-member.entity';
import { WorkspacesService } from '../../modules/workspaces/workspaces.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private workspacesService: WorkspacesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const params = request.params;
    
    // Try to find workspaceId in params
    const workspaceId = params.id || params.workspaceId;

    if (!user || !workspaceId) {
      // If we can't identify user or workspace, we can't check roles
      // If the route requires roles but we lack context, deny access
      throw new ForbiddenException('Cannot verify workspace permissions');
    }

    const userRole = await this.workspacesService.getUserRole(workspaceId, user.id);

    if (!userRole) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    // Check if user has one of the required roles
    // We can also implement hierarchy checks here (e.g. Owner > Admin > Editor > Viewer)
    const hasRole = requiredRoles.includes(userRole);
    
    if (!hasRole) {
       // Implement hierarchy check
       if (this.hasHigherPrivilege(userRole, requiredRoles)) {
         return true;
       }
       throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  private hasHigherPrivilege(userRole: WorkspaceRole, requiredRoles: WorkspaceRole[]): boolean {
    const hierarchy = {
      [WorkspaceRole.OWNER]: 4,
      [WorkspaceRole.ADMIN]: 3,
      [WorkspaceRole.EDITOR]: 2,
      [WorkspaceRole.VIEWER]: 1,
    };

    const userLevel = hierarchy[userRole] || 0;
    
    // Check if user level is >= any of the required roles
    return requiredRoles.some(role => userLevel >= (hierarchy[role] || 0));
  }
}
