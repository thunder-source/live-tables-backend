import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableColumn, ColumnType } from '../entities/column.entity';
import { CreateColumnDto, UpdateColumnDto, ReorderColumnsDto } from '../dto/column.dto';
import { TablesService } from './tables.service';

@Injectable()
export class ColumnsService {
  constructor(
    @InjectRepository(TableColumn)
    private readonly columnRepository: Repository<TableColumn>,
    private readonly tablesService: TablesService,
  ) {}

  async create(tableId: string, userId: string, createColumnDto: CreateColumnDto): Promise<TableColumn> {
    // Verify table exists
    await this.tablesService.findOne(tableId);

    // Get next position if not provided
    if (createColumnDto.position === undefined) {
      const maxPosition = await this.columnRepository
        .createQueryBuilder('column')
        .where('column.tableId = :tableId', { tableId })
        .select('MAX(column.position)', 'max')
        .getRawOne();
      
      createColumnDto.position = (maxPosition.max ?? -1) + 1;
    }

    const column = this.columnRepository.create({
      ...createColumnDto,
      tableId,
      createdBy: userId,
      physicalColumnName: this.sanitizeColumnName(createColumnDto.name),
    });

    const savedColumn = await this.columnRepository.save(column);

    // Increment table schema version
    await this.tablesService.incrementSchemaVersion(tableId);

    return savedColumn;
  }

  async findAllByTable(tableId: string): Promise<TableColumn[]> {
    return await this.columnRepository.find({
      where: { tableId },
      order: { position: 'ASC' },
      relations: ['creator'],
    });
  }

  async findOne(id: string): Promise<TableColumn> {
    const column = await this.columnRepository.findOne({
      where: { id },
      relations: ['table', 'creator'],
    });

    if (!column) {
      throw new NotFoundException('Column not found');
    }

    return column;
  }

  async update(id: string, updateColumnDto: UpdateColumnDto): Promise<TableColumn> {
    const column = await this.findOne(id);

    Object.assign(column, updateColumnDto);
    const updated = await this.columnRepository.save(column);

    // Increment table schema version
    await this.tablesService.incrementSchemaVersion(column.tableId);

    return updated;
  }

  async remove(id: string): Promise<void> {
    const column = await this.findOne(id);

    // Soft delete
    await this.columnRepository.softRemove(column);

    // Increment table schema version
    await this.tablesService.incrementSchemaVersion(column.tableId);
  }

  async reorder(tableId: string, reorderDto: ReorderColumnsDto): Promise<void> {
    // Verify table exists
    await this.tablesService.findOne(tableId);

    // Update positions
    for (const { columnId, position } of reorderDto.columnPositions) {
      await this.columnRepository.update({ id: columnId, tableId }, { position });
    }
  }

  validateColumnType(type: ColumnType, value: any): boolean {
    switch (type) {
      case ColumnType.TEXT_SHORT:
        return typeof value === 'string' && value.length <= 500;
      case ColumnType.TEXT_LONG:
        return typeof value === 'string';
      case ColumnType.NUMBER_INT:
        return Number.isInteger(value);
      case ColumnType.NUMBER_DECIMAL:
        return typeof value === 'number';
      case ColumnType.BOOLEAN:
        return typeof value === 'boolean';
      case ColumnType.DATE:
      case ColumnType.DATETIME:
        // Check if valid ISO date string
        return typeof value === 'string' && !isNaN(Date.parse(value));
      default:
        return false;
    }
  }

  coerceValue(type: ColumnType, value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

    try {
      switch (type) {
        case ColumnType.TEXT_SHORT:
        case ColumnType.TEXT_LONG:
          return String(value);
        case ColumnType.NUMBER_INT:
          return parseInt(value, 10);
        case ColumnType.NUMBER_DECIMAL:
          return parseFloat(value);
        case ColumnType.BOOLEAN:
          if (typeof value === 'boolean') return value;
          if (typeof value === 'string') {
            return value.toLowerCase() === 'true' || value === '1';
          }
          return Boolean(value);
        case ColumnType.DATE:
        case ColumnType.DATETIME:
          if (value instanceof Date) return value.toISOString();
          return new Date(value).toISOString();
        default:
          return value;
      }
    } catch (error) {
      throw new BadRequestException(`Cannot coerce value to type ${type}`);
    }
  }

  private sanitizeColumnName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 63);
  }
}
