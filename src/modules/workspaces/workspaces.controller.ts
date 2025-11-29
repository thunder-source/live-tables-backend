import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto, InviteMemberDto } from './dto/workspace.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { WorkspaceRole } from './entities/workspace-member.entity';

@ApiTags('Workspaces')
@ApiBearerAuth('JWT-auth')
@Controller('workspaces')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({ status: 201, description: 'Workspace created successfully' })
  create(@CurrentUser() user: User, @Body() createWorkspaceDto: CreateWorkspaceDto) {
    return this.workspacesService.create(user, createWorkspaceDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all workspaces for current user' })
  @ApiResponse({ status: 200, description: 'Workspaces retrieved successfully' })
  findAll(@CurrentUser() user: User) {
    return this.workspacesService.findAllForUser(user.id);
  }

  @Get(':id')
  @Roles(WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get workspace by ID' })
  @ApiResponse({ status: 200, description: 'Workspace found' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.workspacesService.findOne(id);
  }

  @Patch(':id')
  @Roles(WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Update workspace' })
  @ApiResponse({ status: 200, description: 'Workspace updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(id, updateWorkspaceDto);
  }

  @Delete(':id')
  @Roles(WorkspaceRole.OWNER)
  @ApiOperation({ summary: 'Delete workspace' })
  @ApiResponse({ status: 200, description: 'Workspace deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.workspacesService.remove(id);
  }

  @Post(':id/members')
  @Roles(WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Invite member to workspace' })
  @ApiResponse({ status: 201, description: 'Member invited successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  inviteMember(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() inviteDto: InviteMemberDto,
  ) {
    return this.workspacesService.inviteMember(id, user.id, inviteDto);
  }

  @Delete(':id/members/:memberId')
  @Roles(WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Remove member from workspace' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.workspacesService.removeMember(id, memberId);
  }

  @Get(':id/members')
  @Roles(WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get workspace members' })
  @ApiResponse({ status: 200, description: 'Members retrieved successfully' })
  getMembers(@Param('id', ParseUUIDPipe) id: string) {
    return this.workspacesService.getMembers(id);
  }
}
