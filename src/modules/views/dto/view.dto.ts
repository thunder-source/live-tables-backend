import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class FilterDto {
  @ApiProperty({ example: 'status' })
  @IsString()
  field: string;

  @ApiProperty({ example: 'eq', enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'in', 'between'] })
  @IsString()
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between';

  @ApiProperty({ example: 'active' })
  value: any;
}

class SortDto {
  @ApiProperty({ example: 'createdAt' })
  @IsString()
  field: string;

  @ApiProperty({ example: 'desc', enum: ['asc', 'desc'] })
  @IsString()
  direction: 'asc' | 'desc';
}

class ComputedColumnDto {
  @ApiProperty({ example: 'total' })
  @IsString()
  name: string;

  @ApiProperty({ example: '{price} * {quantity}' })
  @IsString()
  formula: string;

  @ApiProperty({ example: 'NUMBER_DECIMAL' })
  @IsString()
  type: string;
}

export class ViewConfigurationDto {
  @ApiPropertyOptional({ type: [FilterDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FilterDto)
  filters?: FilterDto[];

  @ApiPropertyOptional({ type: [SortDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SortDto)
  sorts?: SortDto[];

  @ApiPropertyOptional({ example: ['name', 'status', 'createdAt'] })
  @IsOptional()
  @IsString({ each: true })
  visibleColumns?: string[];

  @ApiPropertyOptional({ type: [ComputedColumnDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ComputedColumnDto)
  computedColumns?: ComputedColumnDto[];

  @ApiPropertyOptional({ example: 'category' })
  @IsOptional()
  @IsString()
  groupBy?: string;
}

export class CreateViewDto {
  @ApiProperty({ example: 'Active Campaigns' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'View showing only active campaigns' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'uuid-of-table' })
  @IsUUID()
  @IsNotEmpty()
  tableId: string;

  @ApiProperty({ type: ViewConfigurationDto })
  @ValidateNested()
  @Type(() => ViewConfigurationDto)
  configuration: ViewConfigurationDto;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

export class UpdateViewDto {
  @ApiPropertyOptional({ example: 'Updated View Name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ type: ViewConfigurationDto })
  @ValidateNested()
  @Type(() => ViewConfigurationDto)
  @IsOptional()
  configuration?: ViewConfigurationDto;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
