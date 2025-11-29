import { LogicalQueryPlan } from '../../lqp/interfaces/logical-query-plan.interface';

export interface ConnectionConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
  [key: string]: any; // For adapter-specific config
}

export interface SchemaInfo {
  tables: TableInfo[];
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields?: any[];
}

export interface IDatabaseAdapter {
  /**
   * Establishes a connection to the database.
   */
  connect(config: ConnectionConfig): Promise<void>;

  /**
   * Closes the connection to the database.
   */
  disconnect(): Promise<void>;

  /**
   * Tests the connection to ensure it is valid.
   */
  testConnection(): Promise<boolean>;

  /**
   * Discovers the schema of the connected database.
   * @param scope Optional scope (e.g., schema name for PostgreSQL)
   */
  discoverSchema(scope?: string): Promise<SchemaInfo>;

  /**
   * Executes a Logical Query Plan against the database.
   * @param lqp The logical query plan to execute.
   */
  executeLogicalQuery(lqp: LogicalQueryPlan): Promise<QueryResult>;

  /**
   * Executes a raw query string (optional).
   * @param query The raw query string.
   */
  executeRawQuery?(query: string): Promise<any>;
}
