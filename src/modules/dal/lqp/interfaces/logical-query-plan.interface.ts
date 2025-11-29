import { FilterExpression } from './filter.interface';
import { SortExpression } from './sort.interface';
import { JoinExpression } from './join.interface';
import { ComputedColumnExpression } from './computed-column.interface';

export interface PaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface LogicalQueryPlan {
  source: {
    type: 'internal_table' | 'external_connection';
    tableId: string; // Internal table ID or External table name/ID
    connectionId?: string; // Required for external connections
  };
  fields?: string[]; // List of fields to select. If undefined, select all.
  filters?: FilterExpression[];
  sorts?: SortExpression[];
  joins?: JoinExpression[];
  computedColumns?: ComputedColumnExpression[];
  pagination?: PaginationParams;
}
