import { IsNotEmpty, IsString, IsOptional, IsEnum, IsBoolean, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ColumnType } from '../entities/column.entity';

export class CreateColumnDto {
  @ApiProperty({ example: 'Campaign Name', description: 'Column name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ 
    enum: ColumnType, 
    example: ColumnType.TEXT_SHORT, 
    description: 'Column data type' 
  })
  @IsEnum(ColumnType)
  @IsNotEmpty()
  type: ColumnType;

  @ApiPropertyOptional({ example: false, description: 'Is this column required?' })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional({ example: 'Untitled', description: 'Default value for this column' })
  @IsString()
  @IsOptional()
  defaultValue?: string;

  @ApiPropertyOptional({ 
    description: 'Validation rules as JSON object',
    example: { minLength: 3, maxLength: 100 }
  })
  @IsOptional()
  validationRules?: Record<string, any>;

  @ApiPropertyOptional({ example: 1, description: 'Column position/order' })
  @IsInt()
  @IsOptional()
  @Min(0)
  position?: number;
}

export class UpdateColumnDto {
  @ApiPropertyOptional({ example: 'Updated Column Name', description: 'Column name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: false, description: 'Is this column required?' })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional({ example: 'New Default', description: 'Default value' })
  @IsString()
  @IsOptional()
  defaultValue?: string;

  @ApiPropertyOptional({ description: 'Updated validation rules' })
  @IsOptional()
  validationRules?: Record<string, any>;
}

export class ReorderColumnsDto {
  @ApiProperty({ 
    description: 'Array of column IDs with new positions',
    example: [{ columnId: 'uuid-1', position: 0 }, { columnId: 'uuid-2', position: 1 }]
  })
  @IsNotEmpty()
  columnPositions: Array<{ columnId: string; position: number }>;
}
