import { IsNotEmpty, IsString, IsOptional, IsEnum, IsEmail, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspaceRole } from '../entities/workspace-member.entity';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'My Workspace', description: 'Workspace name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'my-workspace', description: 'Unique workspace slug' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional({ example: 'A workspace for my team', description: 'Workspace description' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'Updated Workspace Name', description: 'Workspace name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description', description: 'Workspace description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png', description: 'Workspace logo URL' })
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiPropertyOptional({ description: 'Workspace settings object' })
  @IsOptional()
  settings?: Record<string, any>;
}

export class InviteMemberDto {
  @ApiProperty({ example: 'member@example.com', description: 'Email of user to invite' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ 
    enum: WorkspaceRole, 
    default: WorkspaceRole.VIEWER,
    description: 'Role to assign to the invited member'
  })
  @IsEnum(WorkspaceRole)
  @IsOptional()
  role?: WorkspaceRole = WorkspaceRole.VIEWER;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: WorkspaceRole, description: 'New role for the member' })
  @IsEnum(WorkspaceRole)
  @IsNotEmpty()
  role: WorkspaceRole;
}

