import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Table } from '../entities/table.entity';
import { TableColumn } from '../entities/column.entity';
import { CreateTableDto, UpdateTableDto } from '../dto/table.dto';
import { CreateColumnDto } from '../dto/column.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    @InjectRepository(TableColumn)
    private readonly columnRepository: Repository<TableColumn>,
    private readonly dataSource: DataSource,
  ) {}

  async create(baseId: string, userId: string, createTableDto: CreateTableDto): Promise<Table> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate physical table name
      const tableId = uuidv4();
      const physicalTableName = `internal_data_${tableId.replace(/-/g, '_')}`;

      // Create table metadata
      const table = this.tableRepository.create({
        ...createTableDto,
        baseId,
        createdBy: userId,
        physicalTableName,
        schemaVersion: 1,
      });

      const savedTable = await queryRunner.manager.save(table);

      // Create physical JSONB table in database
      await this.createPhysicalJsonbTable(queryRunner, physicalTableName);

      // Create column metadata if provided
      if (createTableDto.columns && createTableDto.columns.length > 0) {
        const columns = createTableDto.columns.map((colDto, index) => {
          return this.columnRepository.create({
            ...colDto,
            tableId: savedTable.id,
            createdBy: userId,
            physicalColumnName: this.sanitizeColumnName(colDto.name),
            position: colDto.position ?? index,
          });
        });

        await queryRunner.manager.save(columns);
      }

      await queryRunner.commitTransaction();
      return savedTable;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllByBase(baseId: string): Promise<Table[]> {
    return await this.tableRepository.find({
      where: { baseId },
      relations: ['creator', 'columns'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Table> {
    const table = await this.tableRepository.findOne({
      where: { id },
      relations: ['creator', 'base', 'columns'],
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    return table;
  }

  async update(id: string, updateTableDto: UpdateTableDto): Promise<Table> {
    const table = await this.findOne(id);
    
    Object.assign(table, updateTableDto);
    return await this.tableRepository.save(table);
  }

  async remove(id: string): Promise<void> {
    const table = await this.findOne(id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Soft delete table metadata
      await queryRunner.manager.softRemove(table);

      // Drop physical table
      await queryRunner.query(`DROP TABLE IF EXISTS "${table.physicalTableName}"`);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async createPhysicalJsonbTable(queryRunner: any, tableName: string): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "${tableName}" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        created_by UUID,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by UUID,
        deleted_at TIMESTAMP NULL
      );
    `);

    // Create GIN index for JSONB data
    await queryRunner.query(`
      CREATE INDEX "idx_${tableName}_data_gin" ON "${tableName}" USING GIN(data);
    `);

    // Create index for soft delete
    await queryRunner.query(`
      CREATE INDEX "idx_${tableName}_deleted_at" ON "${tableName}" (deleted_at);
    `);
  }

  private sanitizeColumnName(name: string): string {
    // Convert to lowercase, replace spaces with underscores, remove special chars
    return name
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 63); // PostgreSQL column name limit
  }

  async incrementSchemaVersion(tableId: string): Promise<void> {
    await this.tableRepository.increment({ id: tableId }, 'schemaVersion', 1);
  }
}
