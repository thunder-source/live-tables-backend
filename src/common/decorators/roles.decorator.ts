import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '../../modules/workspaces/entities/workspace-member.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: WorkspaceRole[]) => SetMetadata(ROLES_KEY, roles);
