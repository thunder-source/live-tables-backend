import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Table } from '../entities/table.entity';
import { TableColumn } from '../entities/column.entity';
import { CreateRowDto, UpdateRowDto, BulkCreateRowsDto, QueryRowsDto } from '../dto/row.dto';
import { ColumnsService } from './columns.service';

export interface RowData {
  id: string;
  data: Record<string, any>;
  version: number;
  created_at: Date;
  created_by: string;
  updated_at: Date;
  updated_by: string;
  deleted_at: Date | null;
}

@Injectable()
export class RowsService {
  constructor(
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    @InjectRepository(TableColumn)
    private readonly columnRepository: Repository<TableColumn>,
    private readonly columnsService: ColumnsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(tableId: string, userId: string, createRowDto: CreateRowDto): Promise<RowData> {
    const table = await this.getTableWithColumns(tableId);

    // Validate and coerce data
    const validatedData = await this.validateAndCoerceRowData(table.columns, createRowDto.data);

    // Insert into physical table
    const result = await this.dataSource.query(`
      INSERT INTO "${table.physicalTableName}" (data, created_by, created_at, updated_at, version)
      VALUES ($1::jsonb, $2::uuid, NOW(), NOW(), 1)
      RETURNING *
    `, [JSON.stringify(validatedData), userId]);

    return result[0];
  }

  async findAll(tableId: string, query: QueryRowsDto): Promise<{ rows: RowData[]; total: number }> {
    const table = await this.getTableWithColumns(tableId);

    let sqlQuery = `SELECT * FROM "${table.physicalTableName}" WHERE deleted_at IS NULL`;
    const params: any[] = [];
    let paramIndex = 1;

    // Apply filters
    if (query.filters) {
      const filterConditions = this.buildJsonbFilters(query.filters, table.columns, paramIndex);
      if (filterConditions.conditions.length > 0) {
        sqlQuery += ` AND ${filterConditions.conditions.join(' AND ')}`;
        params.push(...filterConditions.params);
        paramIndex += filterConditions.params.length;
      }
    }

    // Get total count
    const countResult = await this.dataSource.query(`SELECT COUNT(*) as count FROM (${sqlQuery}) as subquery`, params);
    const total = parseInt(countResult[0].count, 10);

    // Apply sorting
    if (query.sorts && query.sorts.length > 0) {
      const sortClauses = query.sorts.map(sort => {
        const column = table.columns.find(col => col.name === sort.field || col.physicalColumnName === sort.field);
        if (!column) return null;

        const direction = sort.direction.toUpperCase();
        
        // Cast based on column type for proper sorting
        switch (column.type) {
          case 'NUMBER_INT':
          case 'NUMBER_DECIMAL':
            return `(data->>'${column.physicalColumnName}')::numeric ${direction}`;
          case 'DATE':
          case 'DATETIME':
            return `(data->>'${column.physicalColumnName}')::timestamp ${direction}`;
          case 'BOOLEAN':
            return `(data->>'${column.physicalColumnName}')::boolean ${direction}`;
          default:
            return `data->>'${column.physicalColumnName}' ${direction}`;
        }
      }).filter(Boolean);

      if (sortClauses.length > 0) {
        sqlQuery += ` ORDER BY ${sortClauses.join(', ')}`;
      }
    } else {
      sqlQuery += ` ORDER BY created_at DESC`;
    }

    // Apply pagination
    sqlQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(query.limit || 10, query.offset || 0);

    const rows = await this.dataSource.query(sqlQuery, params);

    return { rows, total };
  }

  async findOne(tableId: string, rowId: string): Promise<RowData> {
    const table = await this.getTableWithColumns(tableId);

    const result = await this.dataSource.query(`
      SELECT * FROM "${table.physicalTableName}"
      WHERE id = $1 AND deleted_at IS NULL
    `, [rowId]);

    if (!result || result.length === 0) {
      throw new NotFoundException('Row not found');
    }

    return result[0];
  }

  async update(tableId: string, rowId: string, userId: string, updateRowDto: UpdateRowDto): Promise<RowData> {
    const table = await this.getTableWithColumns(tableId);

    // Get current row data
    const currentRow = await this.findOne(tableId, rowId);

    // Merge with new data
    const mergedData = { ...currentRow.data, ...updateRowDto.data };

    // Validate and coerce merged data
    const validatedData = await this.validateAndCoerceRowData(table.columns, mergedData, true);

    // Update with optimistic locking
    let query = `
      UPDATE "${table.physicalTableName}"
      SET data = $1::jsonb, updated_by = $2::uuid, updated_at = NOW(), version = version + 1
      WHERE id = $3 AND deleted_at IS NULL
    `;
    const params: any[] = [JSON.stringify(validatedData), userId, rowId];

    // Add version check for optimistic locking
    if (updateRowDto.version !== undefined) {
      query += ` AND version = $4`;
      params.push(updateRowDto.version);
    }

    query += ` RETURNING *`;

    const result = await this.dataSource.query(query, params);

    if (!result || result.length === 0) {
      throw new ConflictException('Row was modified by another user. Please refresh and try again.');
    }

    return result[0];
  }

  async remove(tableId: string, rowId: string): Promise<void> {
    const table = await this.getTableWithColumns(tableId);

    const result = await this.dataSource.query(`
      UPDATE "${table.physicalTableName}"
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
    `, [rowId]);

    if (result[1] === 0) {
      throw new NotFoundException('Row not found');
    }
  }

  async bulkCreate(tableId: string, userId: string, bulkCreateDto: BulkCreateRowsDto): Promise<RowData[]> {
    const table = await this.getTableWithColumns(tableId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results: RowData[] = [];

      for (const rowData of bulkCreateDto.rows) {
        const validatedData = await this.validateAndCoerceRowData(table.columns, rowData);

        const result = await queryRunner.query(`
          INSERT INTO "${table.physicalTableName}" (data, created_by, created_at, updated_at, version)
          VALUES ($1::jsonb, $2::uuid,  NOW(), NOW(), 1)
          RETURNING *
        `, [JSON.stringify(validatedData), userId]);

        results.push(result[0]);
      }

      await queryRunner.commitTransaction();
      return results;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async getTableWithColumns(tableId: string): Promise<Table> {
    const table = await this.tableRepository.findOne({
      where: { id: tableId },
      relations: ['columns'],
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    return table;
  }

  private async validateAndCoerceRowData(
    columns: TableColumn[],
    data: Record<string, any>,
    isPartialUpdate: boolean = false,
  ): Promise<Record<string, any>> {
    const validatedData: Record<string, any> = {};

    for (const column of columns) {
      const value = data[column.name] ?? data[column.physicalColumnName];

      // Check required fields
      if (column.isRequired && (value === null || value === undefined) && !isPartialUpdate) {
        // Use default value if available
        if (column.defaultValue !== null && column.defaultValue !== undefined) {
          validatedData[column.physicalColumnName] = this.columnsService.coerceValue(
            column.type,
            column.defaultValue,
          );
        } else {
          throw new BadRequestException(`Required field '${column.name}' is missing`);
        }
      } else if (value !== null && value !== undefined) {
        // Validate type
        if (!this.columnsService.validateColumnType(column.type, value)) {
          // Try to coerce
          try {
            validatedData[column.physicalColumnName] = this.columnsService.coerceValue(column.type, value);
          } catch {
            throw new BadRequestException(`Invalid value for field '${column.name}' of type ${column.type}`);
          }
        } else {
          validatedData[column.physicalColumnName] = value;
        }
      }
    }

    return validatedData;
  }

  private buildJsonbFilters(
    filters: Record<string, any>,
    columns: TableColumn[],
    startParamIndex: number,
  ): { conditions: string[]; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = startParamIndex;

    for (const [key, value] of Object.entries(filters)) {
      const column = columns.find(col => col.name === key || col.physicalColumnName === key);
      if (!column) continue;

      const fieldName = column.physicalColumnName;

      if (typeof value === 'object' && value !== null) {
        // Handle operators like { $gt: 100 }, { $like: 'test%' }
        for (const [operator, operatorValue] of Object.entries(value)) {
          switch (operator) {
            case '$gt':
              conditions.push(`(data->>'${fieldName}')::numeric > $${paramIndex}`);
              params.push(operatorValue);
              paramIndex++;
              break;
            case '$gte':
              conditions.push(`(data->>'${fieldName}')::numeric >= $${paramIndex}`);
              params.push(operatorValue);
              paramIndex++;
              break;
            case '$lt':
              conditions.push(`(data->>'${fieldName}')::numeric < $${paramIndex}`);
              params.push(operatorValue);
              paramIndex++;
              break;
            case '$lte':
              conditions.push(`(data->>'${fieldName}')::numeric <= $${paramIndex}`);
              params.push(operatorValue);
              paramIndex++;
              break;
            case '$like':
              conditions.push(`data->>'${fieldName}' ILIKE $${paramIndex}`);
              params.push(operatorValue);
              paramIndex++;
              break;
            case '$ne':
              conditions.push(`data->>'${fieldName}' != $${paramIndex}`);
              params.push(operatorValue);
              paramIndex++;
              break;
          }
        }
      } else {
        // Exact match
        conditions.push(`data->>'${fieldName}' = $${paramIndex}`);
        params.push(String(value));
        paramIndex++;
      }
    }

    return { conditions, params };
  }
}
