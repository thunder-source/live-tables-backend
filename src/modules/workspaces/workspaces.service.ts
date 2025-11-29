import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember, WorkspaceRole } from './entities/workspace-member.entity';
import { User } from '../users/entities/user.entity';
import { CreateWorkspaceDto, UpdateWorkspaceDto, InviteMemberDto } from './dto/workspace.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async create(user: User, createWorkspaceDto: CreateWorkspaceDto): Promise<Workspace> {
    const { slug } = createWorkspaceDto;

    // Check if slug exists
    const existing = await this.workspaceRepository.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException('Workspace with this slug already exists');
    }

    // Use transaction to create workspace and add owner as member
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create workspace
      const workspace = this.workspaceRepository.create({
        ...createWorkspaceDto,
        ownerId: user.id,
      });
      const savedWorkspace = await queryRunner.manager.save(workspace);

      // Add owner as member
      const member = this.memberRepository.create({
        workspaceId: savedWorkspace.id,
        userId: user.id,
        role: WorkspaceRole.OWNER,
        joinedAt: new Date(),
      });
      await queryRunner.manager.save(member);

      await queryRunner.commitTransaction();
      return savedWorkspace;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllForUser(userId: string): Promise<Workspace[]> {
    return this.workspaceRepository
      .createQueryBuilder('workspace')
      .innerJoin('workspace.members', 'member') // Assuming relation is defined in entity, if not we need to add it or use subquery
      .where('member.userId = :userId', { userId })
      .andWhere('workspace.isActive = :isActive', { isActive: true })
      .getMany();
  }

  async findOne(id: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  async update(id: string, updateWorkspaceDto: UpdateWorkspaceDto): Promise<Workspace> {
    const workspace = await this.findOne(id);
    
    Object.assign(workspace, updateWorkspaceDto);
    return await this.workspaceRepository.save(workspace);
  }

  async remove(id: string): Promise<void> {
    const result = await this.workspaceRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Workspace not found');
    }
  }

  async inviteMember(
    workspaceId: string,
    inviterId: string,
    inviteDto: InviteMemberDto,
  ): Promise<WorkspaceMember> {
    const { email, role } = inviteDto;

    // Find user by email
    const userToInvite = await this.userRepository.findOne({ where: { email } });
    if (!userToInvite) {
      // In a real app, we might create a pending invitation for non-existing users
      throw new NotFoundException('User with this email not found');
    }

    // Check if already a member
    const existingMember = await this.memberRepository.findOne({
      where: { workspaceId, userId: userToInvite.id },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this workspace');
    }

    const member = this.memberRepository.create({
      workspaceId,
      userId: userToInvite.id,
      role,
      invitedBy: inviterId,
      invitedAt: new Date(),
      // Auto-join for now since we are inviting existing users
      joinedAt: new Date(), 
    });

    return await this.memberRepository.save(member);
  }

  async removeMember(workspaceId: string, memberId: string): Promise<void> {
    // Prevent removing the last owner
    const member = await this.memberRepository.findOne({ where: { workspaceId, userId: memberId } });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === WorkspaceRole.OWNER) {
      const ownersCount = await this.memberRepository.count({
        where: { workspaceId, role: WorkspaceRole.OWNER },
      });
      if (ownersCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner of the workspace');
      }
    }

    await this.memberRepository.delete({ workspaceId, userId: memberId });
  }

  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return await this.memberRepository.find({
      where: { workspaceId },
      relations: ['user'],
    });
  }

  async getUserRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
    const member = await this.memberRepository.findOne({
      where: { workspaceId, userId },
    });
    return member ? member.role : null;
  }
}
