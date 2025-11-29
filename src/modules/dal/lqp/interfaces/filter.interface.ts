export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'in'
  | 'nin'
  | 'is_null'
  | 'is_not_null'
  | 'and'
  | 'or';

export interface FilterExpression {
  field?: string;
  operator: FilterOperator;
  value?: any;
  conditions?: FilterExpression[]; // For 'and' / 'or' operators
}
