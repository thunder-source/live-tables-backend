import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Base } from '../entities/base.entity';
import { CreateBaseDto, UpdateBaseDto } from '../dto/base.dto';

@Injectable()
export class BasesService {
  constructor(
    @InjectRepository(Base)
    private readonly baseRepository: Repository<Base>,
  ) {}

  async create(workspaceId: string, userId: string, createBaseDto: CreateBaseDto): Promise<Base> {
    const base = this.baseRepository.create({
      ...createBaseDto,
      workspaceId,
      createdBy: userId,
    });

    return await this.baseRepository.save(base);
  }

  async findAllByWorkspace(workspaceId: string): Promise<Base[]> {
    return await this.baseRepository.find({
      where: { workspaceId },
      relations: ['creator'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Base> {
    const base = await this.baseRepository.findOne({
      where: { id },
      relations: ['creator', 'workspace'],
    });

    if (!base) {
      throw new NotFoundException('Base not found');
    }

    return base;
  }

  async update(id: string, updateBaseDto: UpdateBaseDto): Promise<Base> {
    const base = await this.findOne(id);
    
    Object.assign(base, updateBaseDto);
    return await this.baseRepository.save(base);
  }

  async remove(id: string): Promise<void> {
    const base = await this.findOne(id);
    
    // Soft delete
    await this.baseRepository.softRemove(base);
  }

  async verifyBaseAccess(baseId: string, workspaceId: string): Promise<void> {
    const base = await this.baseRepository.findOne({
      where: { id: baseId, workspaceId },
    });

    if (!base) {
      throw new ForbiddenException('Access denied to this base');
    }
  }
}
