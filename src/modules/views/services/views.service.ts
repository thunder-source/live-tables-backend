import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { View } from '../entities/view.entity';
import { CreateViewDto, UpdateViewDto } from '../dto/view.dto';

@Injectable()
export class ViewsService {
  constructor(
    @InjectRepository(View)
    private readonly viewRepository: Repository<View>,
  ) {}

  async create(baseId: string, userId: string, createViewDto: CreateViewDto): Promise<View> {
    const view = this.viewRepository.create({
      ...createViewDto,
      baseId,
      createdBy: userId,
    });

    return await this.viewRepository.save(view);
  }

  async findAllByBase(baseId: string): Promise<View[]> {
    return await this.viewRepository.find({
      where: { baseId },
      relations: ['creator', 'table'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAllByTable(tableId: string): Promise<View[]> {
    return await this.viewRepository.find({
      where: { tableId },
      relations: ['creator'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<View> {
    const view = await this.viewRepository.findOne({
      where: { id },
      relations: ['creator', 'table', 'base'],
    });

    if (!view) {
      throw new NotFoundException('View not found');
    }

    return view;
  }

  async update(id: string, updateViewDto: UpdateViewDto): Promise<View> {
    const view = await this.findOne(id);

    Object.assign(view, updateViewDto);
    return await this.viewRepository.save(view);
  }

  async remove(id: string): Promise<void> {
    const view = await this.findOne(id);

    // Soft delete
    await this.viewRepository.softRemove(view);
  }

  async verifyViewAccess(viewId: string, userId: string): Promise<View> {
    const view = await this.findOne(viewId);

    // Check if user has access (either creator or view is public)
    if (!view.isPublic && view.createdBy !== userId) {
      throw new ForbiddenException('Access denied to this view');
    }

    return view;
  }
}
