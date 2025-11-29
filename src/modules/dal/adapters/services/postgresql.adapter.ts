import { Pool, PoolConfig, QueryResult as PgQueryResult } from 'pg';
import {
  IDatabaseAdapter,
  ConnectionConfig,
  SchemaInfo,
  TableInfo,
  ColumnInfo,
  QueryResult,
} from '../interfaces/database-adapter.interface';
import { LogicalQueryPlan } from '../../lqp/interfaces/logical-query-plan.interface';
import { FilterExpression } from '../../lqp/interfaces/filter.interface';
import { SortExpression } from '../../lqp/interfaces/sort.interface';
import { JoinExpression } from '../../lqp/interfaces/join.interface';

export class PostgreSQLAdapter implements IDatabaseAdapter {
  private pool: Pool | null = null;
  private config: ConnectionConfig | null = null;

  /**
   * Establishes a connection to PostgreSQL using connection pooling.
   */
  async connect(config: ConnectionConfig): Promise<void> {
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port || 5432,
      user: config.username,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections || 10,
      idleTimeoutMillis: config.idleTimeout || 30000,
      connectionTimeoutMillis: config.connectionTimeout || 10000,
    };

    this.pool = new Pool(poolConfig);
    this.config = config;

    // Test the connection
    const client = await this.pool.connect();
    client.release();
  }

  /**
   * Closes the connection pool.
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.config = null;
    }
  }

  /**
   * Tests the connection by executing a simple query.
   */
  async testConnection(): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      const result = await this.pool.query('SELECT 1 as test');
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Discovers the schema of the PostgreSQL database.
   * @param scope Optional schema name (default: 'public')
   */
  async discoverSchema(scope?: string): Promise<SchemaInfo> {
    if (!this.pool) {
      throw new Error('Not connected. Call connect() first.');
    }

    const schemaName = scope || 'public';

    // Query to get all tables in the schema
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const tablesResult = await this.pool.query(tablesQuery, [schemaName]);
    const tables: TableInfo[] = [];

    // For each table, get column information
    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;

      const columnsQuery = `
        SELECT
          c.column_name,
          c.data_type,
          c.is_nullable,
          CASE
            WHEN pk.column_name IS NOT NULL THEN true
            ELSE false
          END as is_primary_key
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku
            ON tc.constraint_name = ku.constraint_name
            AND tc.table_schema = ku.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = $1
            AND tc.table_name = $2
        ) pk ON c.column_name = pk.column_name
        WHERE c.table_schema = $1 AND c.table_name = $2
        ORDER BY c.ordinal_position;
      `;

      const columnsResult = await this.pool.query(columnsQuery, [
        schemaName,
        tableName,
      ]);

      const columns: ColumnInfo[] = columnsResult.rows.map((col: any) => ({
        name: col.column_name,
        type: col.data_type,
        isNullable: col.is_nullable === 'YES',
        isPrimaryKey: col.is_primary_key,
      }));

      tables.push({
        name: tableName,
        columns,
      });
    }

    return { tables };
  }

  /**
   * Executes a Logical Query Plan by translating it to SQL.
   */
  async executeLogicalQuery(lqp: LogicalQueryPlan): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Not connected. Call connect() first.');
    }

    const { sql, params } = this.translateLQPToSQL(lqp);
    const result = await this.pool.query(sql, params);

    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
      fields: result.fields,
    };
  }

  /**
   * Executes a raw SQL query.
   */
  async executeRawQuery(query: string): Promise<any> {
    if (!this.pool) {
      throw new Error('Not connected. Call connect() first.');
    }

    const result = await this.pool.query(query);
    return result.rows;
  }

  /**
   * Translates a Logical Query Plan to SQL with parameterized queries.
   */
  private translateLQPToSQL(lqp: LogicalQueryPlan): {
    sql: string;
    params: any[];
  } {
    const params: any[] = [];
    let paramCounter = 1;

    // Build SELECT clause
    let selectClause = 'SELECT ';
    if (lqp.fields && lqp.fields.length > 0) {
      selectClause += lqp.fields.map((f) => `"${f}"`).join(', ');
    } else {
      selectClause += '*';
    }

    // Build FROM clause
    let fromClause = ` FROM "${lqp.source.tableId}"`;

    // Build JOIN clauses
    let joinClause = '';
    if (lqp.joins && lqp.joins.length > 0) {
      joinClause = lqp.joins
        .map((join) => this.buildJoinClause(join))
        .join(' ');
    }

    // Build WHERE clause
    let whereClause = '';
    if (lqp.filters && lqp.filters.length > 0) {
      const filterSQL = this.buildFilterClause(
        lqp.filters,
        params,
        paramCounter,
      );
      whereClause = ` WHERE ${filterSQL.sql}`;
      paramCounter = filterSQL.paramCounter;
    }

    // Build ORDER BY clause
    let orderByClause = '';
    if (lqp.sorts && lqp.sorts.length > 0) {
      orderByClause = this.buildSortClause(lqp.sorts);
    }

    // Build LIMIT/OFFSET clause
    let limitClause = '';
    if (lqp.pagination) {
      if (lqp.pagination.limit) {
        limitClause += ` LIMIT $${paramCounter}`;
        params.push(lqp.pagination.limit);
        paramCounter++;
      }
      if (lqp.pagination.offset) {
        limitClause += ` OFFSET $${paramCounter}`;
        params.push(lqp.pagination.offset);
        paramCounter++;
      }
    }

    const sql =
      selectClause +
      fromClause +
      joinClause +
      whereClause +
      orderByClause +
      limitClause;

    return { sql, params };
  }

  /**
   * Builds JOIN clause from JoinExpression.
   */
  private buildJoinClause(join: JoinExpression): string {
    const joinType = join.type.toUpperCase();
    const targetTable = join.alias
      ? `"${join.targetTableId}" AS "${join.alias}"`
      : `"${join.targetTableId}"`;
    const targetRef = join.alias || join.targetTableId;

    return ` ${joinType} JOIN ${targetTable} ON "${join.on.sourceField}" = "${targetRef}"."${join.on.targetField}"`;
  }

  /**
   * Builds WHERE clause from FilterExpression array.
   */
  private buildFilterClause(
    filters: FilterExpression[],
    params: any[],
    paramCounter: number,
  ): { sql: string; paramCounter: number } {
    if (filters.length === 0) {
      return { sql: '', paramCounter };
    }

    // Handle combined filters with AND
    const filterSQLs: string[] = [];
    for (const filter of filters) {
      const result = this.buildSingleFilter(filter, params, paramCounter);
      filterSQLs.push(result.sql);
      paramCounter = result.paramCounter;
    }

    return {
      sql: filterSQLs.join(' AND '),
      paramCounter,
    };
  }

  /**
   * Builds SQL for a single filter expression.
   */
  private buildSingleFilter(
    filter: FilterExpression,
    params: any[],
    paramCounter: number,
  ): { sql: string; paramCounter: number } {
    // Handle logical operators (AND, OR)
    if (filter.operator === 'and' || filter.operator === 'or') {
      if (!filter.conditions || filter.conditions.length === 0) {
        return { sql: '', paramCounter };
      }

      const conditionSQLs: string[] = [];
      for (const condition of filter.conditions) {
        const result = this.buildSingleFilter(condition, params, paramCounter);
        if (result.sql) {
          conditionSQLs.push(result.sql);
          paramCounter = result.paramCounter;
        }
      }

      const operator = filter.operator.toUpperCase();
      return {
        sql: `(${conditionSQLs.join(` ${operator} `)})`,
        paramCounter,
      };
    }

    // Handle field-based operators
    if (!filter.field) {
      throw new Error('Filter field is required for non-logical operators');
    }

    const field = `"${filter.field}"`;
    let sql = '';

    switch (filter.operator) {
      case 'eq':
        sql = `${field} = $${paramCounter}`;
        params.push(filter.value);
        paramCounter++;
        break;
      case 'neq':
        sql = `${field} != $${paramCounter}`;
        params.push(filter.value);
        paramCounter++;
        break;
      case 'gt':
        sql = `${field} > $${paramCounter}`;
        params.push(filter.value);
        paramCounter++;
        break;
      case 'gte':
        sql = `${field} >= $${paramCounter}`;
        params.push(filter.value);
        paramCounter++;
        break;
      case 'lt':
        sql = `${field} < $${paramCounter}`;
        params.push(filter.value);
        paramCounter++;
        break;
      case 'lte':
        sql = `${field} <= $${paramCounter}`;
        params.push(filter.value);
        paramCounter++;
        break;
      case 'like':
        sql = `${field} LIKE $${paramCounter}`;
        params.push(filter.value);
        paramCounter++;
        break;
      case 'in':
        if (!Array.isArray(filter.value)) {
          throw new Error('IN operator requires an array value');
        }
        const inParams = filter.value
          .map(() => {
            const p = `$${paramCounter}`;
            paramCounter++;
            return p;
          })
          .join(', ');
        sql = `${field} IN (${inParams})`;
        params.push(...filter.value);
        break;
      case 'nin':
        if (!Array.isArray(filter.value)) {
          throw new Error('NIN operator requires an array value');
        }
        const ninParams = filter.value
          .map(() => {
            const p = `$${paramCounter}`;
            paramCounter++;
            return p;
          })
          .join(', ');
        sql = `${field} NOT IN (${ninParams})`;
        params.push(...filter.value);
        break;
      case 'is_null':
        sql = `${field} IS NULL`;
        break;
      case 'is_not_null':
        sql = `${field} IS NOT NULL`;
        break;
      default:
        throw new Error(`Unsupported filter operator: ${filter.operator}`);
    }

    return { sql, paramCounter };
  }

  /**
   * Builds ORDER BY clause from SortExpression array.
   */
  private buildSortClause(sorts: SortExpression[]): string {
    if (sorts.length === 0) {
      return '';
    }

    const sortClauses = sorts.map(
      (sort) => `"${sort.field}" ${sort.direction.toUpperCase()}`,
    );

    return ` ORDER BY ${sortClauses.join(', ')}`;
  }
}
