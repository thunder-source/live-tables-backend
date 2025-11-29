import { IsNotEmpty, IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateColumnDto } from './column.dto';

export class CreateTableDto {
  @ApiProperty({ example: 'Campaigns', description: 'Table name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Track all marketing campaigns', description: 'Table description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ 
    description: 'Initial column definitions',
    type: [CreateColumnDto] 
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateColumnDto)
  columns?: CreateColumnDto[];
}

export class UpdateTableDto {
  @ApiPropertyOptional({ example: 'Updated Table Name', description: 'Table name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description', description: 'Table description' })
  @IsString()
  @IsOptional()
  description?: string;
}
