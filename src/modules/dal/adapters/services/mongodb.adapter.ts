import { MongoClient, Db, Collection, Document } from 'mongodb';
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

export class MongoDBAdapter implements IDatabaseAdapter {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private config: ConnectionConfig | null = null;

  /**
   * Establishes a connection to MongoDB with retry logic.
   */
  async connect(config: ConnectionConfig): Promise<void> {
    const connectionString = config.connectionString || this.buildConnectionString(config);

    const options = {
      maxPoolSize: config.maxConnections || 10,
      serverSelectionTimeoutMS: config.connectionTimeout || 10000,
      ssl: config.ssl,
    };

    this.client = new MongoClient(connectionString, options);

    // Retry logic with exponential backoff
    const maxRetries = config.maxRetries || 3;
    let retries = 0;
    let lastError: Error | null = null;

    while (retries < maxRetries) {
      try {
        await this.client.connect();
        this.db = this.client.db(config.database);
        this.config = config;
        return;
      } catch (error) {
        lastError = error as Error;
        retries++;
        if (retries < maxRetries) {
          const delay = Math.pow(2, retries) * 1000; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to connect to MongoDB after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Closes the MongoDB connection.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.config = null;
    }
  }

  /**
   * Tests the MongoDB connection.
   */
  async testConnection(): Promise<boolean> {
    if (!this.db) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      await this.db.admin().ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Discovers the schema (collections and their structure) of the MongoDB database.
   * MongoDB is schemaless, so we analyze sample documents to infer structure.
   */
  async discoverSchema(scope?: string): Promise<SchemaInfo> {
    if (!this.db) {
      throw new Error('Not connected. Call connect() first.');
    }

    const collections = await this.db.listCollections().toArray();
    const tables: TableInfo[] = [];

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      const collection = this.db.collection(collectionName);

      // Sample some documents to infer structure (limit to 100 for performance)
      const sampleDocs = await collection.find().limit(100).toArray();

      if (sampleDocs.length === 0) {
        tables.push({
          name: collectionName,
          columns: [],
        });
        continue;
      }

      // Analyze documents to discover fields
      const fieldMap = new Map<string, Set<string>>();

      for (const doc of sampleDocs) {
        this.analyzeDocument(doc, fieldMap);
      }

      const columns: ColumnInfo[] = Array.from(fieldMap.entries()).map(
        ([fieldName, types]) => ({
          name: fieldName,
          type: Array.from(types).join(' | '), // Multiple types possible in MongoDB
          isNullable: true, // MongoDB doesn't enforce nullability
          isPrimaryKey: fieldName === '_id',
        }),
      );

      tables.push({
        name: collectionName,
        columns,
      });
    }

    return { tables };
  }

  /**
   * Executes a Logical Query Plan by translating it to MongoDB aggregation pipeline.
   */
  async executeLogicalQuery(lqp: LogicalQueryPlan): Promise<QueryResult> {
    if (!this.db) {
      throw new Error('Not connected. Call connect() first.');
    }

    const collection = this.db.collection(lqp.source.tableId);
    const pipeline = this.translateLQPToAggregation(lqp);

    const cursor = collection.aggregate(pipeline);
    const rows = await cursor.toArray();

    return {
      rows,
      rowCount: rows.length,
    };
  }

  /**
   * Executes a raw MongoDB query (not recommended, LQP preferred).
   */
  async executeRawQuery(query: string): Promise<any> {
    throw new Error(
      'Raw query execution not supported for MongoDB. Use executeLogicalQuery instead.',
    );
  }

  /**
   * Builds MongoDB connection string from config.
   */
  private buildConnectionString(config: ConnectionConfig): string {
    const protocol = config.ssl ? 'mongodb+srv' : 'mongodb';
    const auth =
      config.username && config.password
        ? `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@`
        : '';
    const host = config.host || 'localhost';
    const port = config.port ? `:${config.port}` : '';

    return `${protocol}://${auth}${host}${port}`;
  }

  /**
   * Analyzes a document to extract field names and types.
   */
  private analyzeDocument(
    doc: Document,
    fieldMap: Map<string, Set<string>>,
    prefix: string = '',
  ): void {
    for (const [key, value] of Object.entries(doc)) {
      const fieldName = prefix ? `${prefix}.${key}` : key;

      if (!fieldMap.has(fieldName)) {
        fieldMap.set(fieldName, new Set());
      }

      const type = this.getMongoType(value);
      fieldMap.get(fieldName)!.add(type);

      // Recursively analyze nested objects (limit depth to 1 for performance)
      if (type === 'object' && !prefix) {
        this.analyzeDocument(value as Document, fieldMap, fieldName);
      }
    }
  }

  /**
   * Gets the MongoDB type of a value.
   */
  private getMongoType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object') return 'object';
    return typeof value;
  }

  /**
   * Translates a Logical Query Plan to MongoDB aggregation pipeline.
   */
  private translateLQPToAggregation(lqp: LogicalQueryPlan): Document[] {
    const pipeline: Document[] = [];

    // Build $match stage (filters)
    if (lqp.filters && lqp.filters.length > 0) {
      const matchCondition = this.buildMatchStage(lqp.filters);
      if (Object.keys(matchCondition).length > 0) {
        pipeline.push({ $match: matchCondition });
      }
    }

    // Build $sort stage
    if (lqp.sorts && lqp.sorts.length > 0) {
      const sortStage = this.buildSortStage(lqp.sorts);
      pipeline.push({ $sort: sortStage });
    }

    // Build $skip and $limit stages (pagination)
    if (lqp.pagination) {
      if (lqp.pagination.offset) {
        pipeline.push({ $skip: lqp.pagination.offset });
      }
      if (lqp.pagination.limit) {
        pipeline.push({ $limit: lqp.pagination.limit });
      }
    }

    // Build $project stage (field selection)
    if (lqp.fields && lqp.fields.length > 0) {
      const projectStage: Document = {};
      for (const field of lqp.fields) {
        projectStage[field] = 1;
      }
      pipeline.push({ $project: projectStage });
    }

    // Note: Joins are complex in MongoDB and would require $lookup stages
    // This is a simplified implementation
    if (lqp.joins && lqp.joins.length > 0) {
      for (const join of lqp.joins) {
        pipeline.push({
          $lookup: {
            from: join.targetTableId,
            localField: join.on.sourceField,
            foreignField: join.on.targetField,
            as: join.alias || join.targetTableId,
          },
        });
      }
    }

    return pipeline;
  }

  /**
   * Builds MongoDB $match stage from FilterExpression array.
   */
  private buildMatchStage(filters: FilterExpression[]): Document {
    if (filters.length === 0) {
      return {};
    }

    // If multiple filters, combine with AND
    if (filters.length === 1) {
      return this.buildFilterCondition(filters[0]);
    }

    return {
      $and: filters.map((filter) => this.buildFilterCondition(filter)),
    };
  }

  /**
   * Builds MongoDB query condition from a single FilterExpression.
   */
  private buildFilterCondition(filter: FilterExpression): Document {
    // Handle logical operators
    if (filter.operator === 'and') {
      return {
        $and: (filter.conditions || []).map((cond) =>
          this.buildFilterCondition(cond),
        ),
      };
    }

    if (filter.operator === 'or') {
      return {
        $or: (filter.conditions || []).map((cond) =>
          this.buildFilterCondition(cond),
        ),
      };
    }

    // Handle field-based operators
    if (!filter.field) {
      throw new Error('Filter field is required for non-logical operators');
    }

    switch (filter.operator) {
      case 'eq':
        return { [filter.field]: filter.value };
      case 'neq':
        return { [filter.field]: { $ne: filter.value } };
      case 'gt':
        return { [filter.field]: { $gt: filter.value } };
      case 'gte':
        return { [filter.field]: { $gte: filter.value } };
      case 'lt':
        return { [filter.field]: { $lt: filter.value } };
      case 'lte':
        return { [filter.field]: { $lte: filter.value } };
      case 'like':
        // Convert SQL LIKE to MongoDB regex
        const regexPattern = filter.value.replace(/%/g, '.*').replace(/_/g, '.');
        return { [filter.field]: { $regex: regexPattern, $options: 'i' } };
      case 'in':
        return { [filter.field]: { $in: filter.value } };
      case 'nin':
        return { [filter.field]: { $nin: filter.value } };
      case 'is_null':
        return { [filter.field]: null };
      case 'is_not_null':
        return { [filter.field]: { $ne: null } };
      default:
        throw new Error(`Unsupported filter operator: ${filter.operator}`);
    }
  }

  /**
   * Builds MongoDB $sort stage from SortExpression array.
   */
  private buildSortStage(sorts: SortExpression[]): Document {
    const sortStage: Document = {};

    for (const sort of sorts) {
      sortStage[sort.field] = sort.direction === 'asc' ? 1 : -1;
    }

    return sortStage;
  }
}
