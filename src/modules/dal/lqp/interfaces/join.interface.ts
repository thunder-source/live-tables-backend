export interface JoinExpression {
  type: 'inner' | 'left' | 'right' | 'full';
  targetTableId: string;
  on: {
    sourceField: string;
    targetField: string;
  };
  alias?: string;
}
