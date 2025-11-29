import { createPool, Pool, PoolOptions, RowDataPacket, FieldPacket } from 'mysql2/promise';
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

export class MySQLAdapter implements IDatabaseAdapter {
  private pool: Pool | null = null;
  private config: ConnectionConfig | null = null;

  /**
   * Establishes a connection to MySQL using connection pooling.
   */
  async connect(config: ConnectionConfig): Promise<void> {
    const poolConfig: PoolOptions = {
      host: config.host,
      port: config.port || 3306,
      user: config.username,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? {} : undefined,
      connectionLimit: config.maxConnections || 10,
      connectTimeout: config.connectionTimeout || 10000,
      waitForConnections: true,
      queueLimit: 0,
    };

    this.pool = createPool(poolConfig);
    this.config = config;

    // Test the connection
    const connection = await this.pool.getConnection();
    connection.release();
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
      const [rows] = await this.pool.query('SELECT 1 as test');
      return Array.isArray(rows) && rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Discovers the schema of the MySQL database.
   */
  async discoverSchema(scope?: string): Promise<SchemaInfo> {
    if (!this.pool) {
      throw new Error('Not connected. Call connect() first.');
    }

    const databaseName = scope || this.config?.database;

    if (!databaseName) {
      throw new Error('Database name is required for schema discovery');
    }

    // Query to get all tables in the database
    const tablesQuery = `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME;
    `;

    const [tablesResult] = await this.pool.query<RowDataPacket[]>(tablesQuery, [
      databaseName,
    ]);
    const tables: TableInfo[] = [];

    // For each table, get column information
    for (const tableRow of tablesResult) {
      const tableName = tableRow.TABLE_NAME;

      const columnsQuery = `
        SELECT
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION;
      `;

      const [columnsResult] = await this.pool.query<RowDataPacket[]>(
        columnsQuery,
        [databaseName, tableName],
      );

      const columns: ColumnInfo[] = columnsResult.map((col) => ({
        name: col.COLUMN_NAME,
        type: col.DATA_TYPE,
        isNullable: col.IS_NULLABLE === 'YES',
        isPrimaryKey: col.COLUMN_KEY === 'PRI',
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
    const [rows, fields] = await this.pool.query<RowDataPacket[]>(sql, params);

    return {
      rows,
      rowCount: rows.length,
      fields: fields as any[],
    };
  }

  /**
   * Executes a raw SQL query.
   */
  async executeRawQuery(query: string): Promise<any> {
    if (!this.pool) {
      throw new Error('Not connected. Call connect() first.');
    }

    const [rows] = await this.pool.query(query);
    return rows;
  }

  /**
   * Translates a Logical Query Plan to SQL with parameterized queries.
   */
  private translateLQPToSQL(lqp: LogicalQueryPlan): {
    sql: string;
    params: any[];
  } {
    const params: any[] = [];

    // Build SELECT clause
    let selectClause = 'SELECT ';
    if (lqp.fields && lqp.fields.length > 0) {
      selectClause += lqp.fields.map((f) => `\`${f}\``).join(', ');
    } else {
      selectClause += '*';
    }

    // Build FROM clause
    let fromClause = ` FROM \`${lqp.source.tableId}\``;

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
      const filterSQL = this.buildFilterClause(lqp.filters, params);
      whereClause = ` WHERE ${filterSQL}`;
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
        limitClause += ` LIMIT ?`;
        params.push(lqp.pagination.limit);
      }
      if (lqp.pagination.offset) {
        limitClause += ` OFFSET ?`;
        params.push(lqp.pagination.offset);
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
      ? `\`${join.targetTableId}\` AS \`${join.alias}\``
      : `\`${join.targetTableId}\``;
    const targetRef = join.alias || join.targetTableId;

    return ` ${joinType} JOIN ${targetTable} ON \`${join.on.sourceField}\` = \`${targetRef}\`.\`${join.on.targetField}\``;
  }

  /**
   * Builds WHERE clause from FilterExpression array.
   */
  private buildFilterClause(
    filters: FilterExpression[],
    params: any[],
  ): string {
    if (filters.length === 0) {
      return '';
    }

    // Handle combined filters with AND
    const filterSQLs: string[] = [];
    for (const filter of filters) {
      const sql = this.buildSingleFilter(filter, params);
      filterSQLs.push(sql);
    }

    return filterSQLs.join(' AND ');
  }

  /**
   * Builds SQL for a single filter expression.
   */
  private buildSingleFilter(
    filter: FilterExpression,
    params: any[],
  ): string {
    // Handle logical operators (AND, OR)
    if (filter.operator === 'and' || filter.operator === 'or') {
      if (!filter.conditions || filter.conditions.length === 0) {
        return '';
      }

      const conditionSQLs: string[] = [];
      for (const condition of filter.conditions) {
        const sql = this.buildSingleFilter(condition, params);
        if (sql) {
          conditionSQLs.push(sql);
        }
      }

      const operator = filter.operator.toUpperCase();
      return `(${conditionSQLs.join(` ${operator} `)})`;
    }

    // Handle field-based operators
    if (!filter.field) {
      throw new Error('Filter field is required for non-logical operators');
    }

    const field = `\`${filter.field}\``;
    let sql = '';

    switch (filter.operator) {
      case 'eq':
        sql = `${field} = ?`;
        params.push(filter.value);
        break;
      case 'neq':
        sql = `${field} != ?`;
        params.push(filter.value);
        break;
      case 'gt':
        sql = `${field} > ?`;
        params.push(filter.value);
        break;
      case 'gte':
        sql = `${field} >= ?`;
        params.push(filter.value);
        break;
      case 'lt':
        sql = `${field} < ?`;
        params.push(filter.value);
        break;
      case 'lte':
        sql = `${field} <= ?`;
        params.push(filter.value);
        break;
      case 'like':
        sql = `${field} LIKE ?`;
        params.push(filter.value);
        break;
      case 'in':
        if (!Array.isArray(filter.value)) {
          throw new Error('IN operator requires an array value');
        }
        const inPlaceholders = filter.value.map(() => '?').join(', ');
        sql = `${field} IN (${inPlaceholders})`;
        params.push(...filter.value);
        break;
      case 'nin':
        if (!Array.isArray(filter.value)) {
          throw new Error('NIN operator requires an array value');
        }
        const ninPlaceholders = filter.value.map(() => '?').join(', ');
        sql = `${field} NOT IN (${ninPlaceholders})`;
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

    return sql;
  }

  /**
   * Builds ORDER BY clause from SortExpression array.
   */
  private buildSortClause(sorts: SortExpression[]): string {
    if (sorts.length === 0) {
      return '';
    }

    const sortClauses = sorts.map(
      (sort) => `\`${sort.field}\` ${sort.direction.toUpperCase()}`,
    );

    return ` ORDER BY ${sortClauses.join(', ')}`;
  }
}
