import { Injectable } from '@nestjs/common';
import { LogicalQueryPlan, PaginationParams } from '../interfaces/logical-query-plan.interface';
import { FilterExpression } from '../interfaces/filter.interface';
import { SortExpression } from '../interfaces/sort.interface';

@Injectable()
export class LqpBuilderService {
  private lqp: LogicalQueryPlan;

  constructor() {
    this.reset();
  }

  private reset() {
    this.lqp = {
      source: {
        type: 'internal_table',
        tableId: '',
      },
      fields: [],
      filters: [],
      sorts: [],
      joins: [],
      computedColumns: [],
      pagination: {},
    };
  }

  fromInternalTable(tableId: string): this {
    this.reset();
    this.lqp.source = {
      type: 'internal_table',
      tableId,
    };
    return this;
  }

  fromExternalConnection(connectionId: string, tableId: string): this {
    this.reset();
    this.lqp.source = {
      type: 'external_connection',
      tableId,
      connectionId,
    };
    return this;
  }

  select(fields: string[]): this {
    this.lqp.fields = fields;
    return this;
  }

  filter(filter: FilterExpression): this {
    if (!this.lqp.filters) {
      this.lqp.filters = [];
    }
    this.lqp.filters.push(filter);
    return this;
  }

  sort(sort: SortExpression): this {
    if (!this.lqp.sorts) {
      this.lqp.sorts = [];
    }
    this.lqp.sorts.push(sort);
    return this;
  }

  paginate(pagination: PaginationParams): this {
    this.lqp.pagination = pagination;
    return this;
  }

  build(): LogicalQueryPlan {
    // Return a deep copy to prevent mutation after build
    return JSON.parse(JSON.stringify(this.lqp));
  }
}
