export interface ComputedColumnExpression {
  alias: string;
  expression: string; // Formula string, e.g., "field1 + field2"
  targetType?: string; // Resulting data type
}
