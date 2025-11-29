import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Table } from '../entities/table.entity';
import { TableColumn } from '../entities/column.entity';

// Import LQP types from DAL module
interface LogicalQueryPlan {
  source: {
    type: 'internal_table' | 'external_connection';
    tableId?: string;
    connectionId?: string;
  };
  filters?: FilterExpression[];
  sorts?: SortExpression[];
  joins?: JoinExpression[];
  computedColumns?: ComputedColumnExpression[];
  pagination?: PaginationParams;
}

interface FilterExpression {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between';
  value: any;
}

interface SortExpression {
  field: string;
  direction: 'asc' | 'desc';
}

interface JoinExpression {
  type: 'inner' | 'left' | 'right';
  targetTable: string;
  onField: string;
  targetField: string;
}

interface ComputedColumnExpression {
  name: string;
  expression: string;
  type: string;
}

interface PaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface QueryResult {
  rows: any[];
  total: number;
  hasMore?: boolean;
  nextCursor?: string;
}

@Injectable()
export class InternalDbExecutorService {
  constructor(
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    @InjectRepository(TableColumn)
    private readonly columnRepository: Repository<TableColumn>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Execute a Logical Query Plan on an internal JSONB table
   */
  async executeQuery(tableId: string, lqp: LogicalQueryPlan): Promise<QueryResult> {
    // Validate source is internal table
    if (lqp.source.type !== 'internal_table') {
      throw new BadRequestException('Executor only supports internal tables');
    }

    // Get table metadata with columns
    const table = await this.getTableWithColumns(tableId);

    // Build SQL query from LQP
    const { query, params, countQuery, countParams } = this.buildSqlFromLqp(
      table.physicalTableName,
      table.columns,
      lqp,
    );

    // Execute count query for total
    const countResult = await this.dataSource.query(countQuery, countParams);
    const total = parseInt(countResult[0].count, 10);

    // Execute main query
    const rows = await this.dataSource.query(query, params);

    // Determine if there are more results
    const limit = lqp.pagination?.limit || 10;
    const offset = lqp.pagination?.offset || 0;
    const hasMore = offset + rows.length < total;

    return {
      rows,
      total,
      hasMore,
    };
  }

  /**
   * Build JSONB-aware SQL from Logical Query Plan
   */
  private buildSqlFromLqp(
    physicalTableName: string,
    columns: TableColumn[],
    lqp: LogicalQueryPlan,
  ): { query: string; params: any[]; countQuery: string; countParams: any[] } {
    const params: any[] = [];
    let paramIndex = 1;

    // Base query
    let query = `SELECT * FROM "${physicalTableName}" WHERE deleted_at IS NULL`;
    let countQuery = `SELECT COUNT(*) as count FROM "${physicalTableName}" WHERE deleted_at IS NULL`;

    // Apply filters
    if (lqp.filters && lqp.filters.length > 0) {
      const filterResult = this.applyJsonbFilters(lqp.filters, columns, paramIndex);
      if (filterResult.conditions.length > 0) {
        const filterClause = ` AND ${filterResult.conditions.join(' AND ')}`;
        query += filterClause;
        countQuery += filterClause;
        params.push(...filterResult.params);
        paramIndex += filterResult.params.length;
      }
    }

    // Store count params (same as filter params)
    const countParams = [...params];

    // Apply sorts
    if (lqp.sorts && lqp.sorts.length > 0) {
      const sortClauses = this.applyJsonbSorts(lqp.sorts, columns);
      if (sortClauses.length > 0) {
        query += ` ORDER BY ${sortClauses.join(', ')}`;
      }
    } else {
      query += ` ORDER BY created_at DESC`;
    }

    // Apply pagination
    const limit = lqp.pagination?.limit || 10;
    const offset = lqp.pagination?.offset || 0;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    return { query, params, countQuery, countParams };
  }

  /**
   * Apply JSONB filters with proper operators
   */
  private applyJsonbFilters(
    filters: FilterExpression[],
    columns: TableColumn[],
    startParamIndex: number,
  ): { conditions: string[]; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = startParamIndex;

    for (const filter of filters) {
      const column = columns.find(
        (col) => col.name === filter.field || col.physicalColumnName === filter.field,
      );

      if (!column) {
        continue; // Skip unknown columns
      }

      const fieldName = column.physicalColumnName;
      const fieldType = column.type;

      switch (filter.operator) {
        case 'eq':
          conditions.push(`data->>'${fieldName}' = $${paramIndex}`);
          params.push(String(filter.value));
          paramIndex++;
          break;

        case 'ne':
          conditions.push(`data->>'${fieldName}' != $${paramIndex}`);
          params.push(String(filter.value));
          paramIndex++;
          break;

        case 'gt':
          if (fieldType === 'NUMBER_INT' || fieldType === 'NUMBER_DECIMAL') {
            conditions.push(`(data->>'${fieldName}')::numeric > $${paramIndex}`);
          } else if (fieldType === 'DATE' || fieldType === 'DATETIME') {
            conditions.push(`(data->>'${fieldName}')::timestamp > $${paramIndex}`);
          } else {
            conditions.push(`data->>'${fieldName}' > $${paramIndex}`);
          }
          params.push(filter.value);
          paramIndex++;
          break;

        case 'gte':
          if (fieldType === 'NUMBER_INT' || fieldType === 'NUMBER_DECIMAL') {
            conditions.push(`(data->>'${fieldName}')::numeric >= $${paramIndex}`);
          } else if (fieldType === 'DATE' || fieldType === 'DATETIME') {
            conditions.push(`(data->>'${fieldName}')::timestamp >= $${paramIndex}`);
          } else {
            conditions.push(`data->>'${fieldName}' >= $${paramIndex}`);
          }
          params.push(filter.value);
          paramIndex++;
          break;

        case 'lt':
          if (fieldType === 'NUMBER_INT' || fieldType === 'NUMBER_DECIMAL') {
            conditions.push(`(data->>'${fieldName}')::numeric < $${paramIndex}`);
          } else if (fieldType === 'DATE' || fieldType === 'DATETIME') {
            conditions.push(`(data->>'${fieldName}')::timestamp < $${paramIndex}`);
          } else {
            conditions.push(`data->>'${fieldName}' < $${paramIndex}`);
          }
          params.push(filter.value);
          paramIndex++;
          break;

        case 'lte':
          if (fieldType === 'NUMBER_INT' || fieldType === 'NUMBER_DECIMAL') {
            conditions.push(`(data->>'${fieldName}')::numeric <= $${paramIndex}`);
          } else if (fieldType === 'DATE' || fieldType === 'DATETIME') {
            conditions.push(`(data->>'${fieldName}')::timestamp <= $${paramIndex}`);
          } else {
            conditions.push(`data->>'${fieldName}' <= $${paramIndex}`);
          }
          params.push(filter.value);
          paramIndex++;
          break;

        case 'like':
          conditions.push(`data->>'${fieldName}' ILIKE $${paramIndex}`);
          params.push(filter.value);
          paramIndex++;
          break;

        case 'in':
          if (Array.isArray(filter.value)) {
            const placeholders = filter.value.map(() => {
              const ph = `$${paramIndex}`;
              paramIndex++;
              return ph;
            });
            conditions.push(`data->>'${fieldName}' IN (${placeholders.join(', ')})`);
            params.push(...filter.value.map(String));
          }
          break;

        case 'between':
          if (Array.isArray(filter.value) && filter.value.length === 2) {
            if (fieldType === 'NUMBER_INT' || fieldType === 'NUMBER_DECIMAL') {
              conditions.push(
                `(data->>'${fieldName}')::numeric BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
              );
            } else if (fieldType === 'DATE' || fieldType === 'DATETIME') {
              conditions.push(
                `(data->>'${fieldName}')::timestamp BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
              );
            } else {
              conditions.push(
                `data->>'${fieldName}' BETWEEN $${paramIndex} AND $${paramIndex + 1}`,
              );
            }
            params.push(filter.value[0], filter.value[1]);
            paramIndex += 2;
          }
          break;
      }
    }

    return { conditions, params };
  }

  /**
   * Apply JSONB sorts with type casting
   */
  private applyJsonbSorts(sorts: SortExpression[], columns: TableColumn[]): string[] {
    const sortClauses: string[] = [];

    for (const sort of sorts) {
      const column = columns.find(
        (col) => col.name === sort.field || col.physicalColumnName === sort.field,
      );

      if (!column) {
        continue; // Skip unknown columns
      }

      const fieldName = column.physicalColumnName;
      const direction = sort.direction.toUpperCase();

      // Cast based on column type for proper sorting
      switch (column.type) {
        case 'NUMBER_INT':
        case 'NUMBER_DECIMAL':
          sortClauses.push(`(data->>'${fieldName}')::numeric ${direction}`);
          break;
        case 'DATE':
        case 'DATETIME':
          sortClauses.push(`(data->>'${fieldName}')::timestamp ${direction}`);
          break;
        case 'BOOLEAN':
          sortClauses.push(`(data->>'${fieldName}')::boolean ${direction}`);
          break;
        default:
          sortClauses.push(`data->>'${fieldName}' ${direction}`);
      }
    }

    return sortClauses;
  }

  /**
   * Get table with columns
   */
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

  /**
   * Build computed columns (future enhancement)
   */
  async evaluateComputedColumns(
    tableId: string,
    computedColumns: ComputedColumnExpression[],
  ): Promise<any> {
    // TODO: Implement formula evaluation for computed columns
    // This will parse and evaluate expressions like SUM, AVG, CONCAT, etc.
    throw new Error('Computed columns not yet implemented');
  }
}
