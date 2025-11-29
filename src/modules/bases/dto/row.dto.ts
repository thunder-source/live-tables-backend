import { IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRowDto {
  @ApiProperty({ 
    description: 'Row data as key-value pairs where keys are column names',
    example: { 'Campaign Name': 'Summer Sale 2025', 'Budget': 50000, 'Active': true }
  })
  @IsNotEmpty()
  data: Record<string, any>;
}

export class UpdateRowDto {
  @ApiProperty({ 
    description: 'Partial row data to update',
    example: { 'Budget': 75000, 'Active': false }
  })
  @IsNotEmpty()
  data: Record<string, any>;

  @ApiPropertyOptional({ description: 'Current version for optimistic locking' })
  @IsInt()
  @IsOptional()
  version?: number;
}

export class BulkCreateRowsDto {
  @ApiProperty({ 
    description: 'Array of row data objects',
    example: [
      { 'Campaign Name': 'Winter Sale', 'Budget': 30000, 'Active': true },
      { 'Campaign Name': 'Spring Sale', 'Budget': 40000, 'Active': true }
    ]
  })
  @IsNotEmpty()
  rows: Array<Record<string, any>>;
}

export class QueryRowsDto {
  @ApiPropertyOptional({ example: 10, description: 'Number of items per page' })
  @IsInt()
  @IsOptional()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 0, description: 'Offset for pagination' })
  @IsInt()
  @IsOptional()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ 
    description: 'Filter conditions as JSON',
    example: { 'Active': true, 'Budget': { $gt: 10000 } }
  })
  @IsOptional()
  filters?: Record<string, any>;

  @ApiPropertyOptional({ 
    description: 'Sort fields and directions',
    example: [{ field: 'Budget', direction: 'desc' }]
  })
  @IsOptional()
  sorts?: Array<{ field: string; direction: 'asc' | 'desc' }>;
}
