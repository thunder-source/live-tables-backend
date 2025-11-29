import { IsNotEmpty, IsString, IsOptional, IsHexColor } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBaseDto {
  @ApiProperty({ example: 'Marketing Projects', description: 'Base name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'All marketing-related project tracking', description: 'Base description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '#FF5733', description: 'Hex color code for the base' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ example: 'rocket', description: 'Icon name or identifier' })
  @IsString()
  @IsOptional()
  icon?: string;
}

export class UpdateBaseDto {
  @ApiPropertyOptional({ example: 'Updated Base Name', description: 'Base name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description', description: 'Base description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '#3366FF', description: 'Hex color code' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ example: 'star', description: 'Icon name or identifier' })
  @IsString()
  @IsOptional()
  icon?: string;
}
