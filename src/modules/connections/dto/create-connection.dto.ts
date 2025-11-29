import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsObject,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ConnectionType {
  POSTGRESQL = 'postgresql',
  MONGODB = 'mongodb',
  MYSQL = 'mysql',
}

export class ConnectionConfigDto {
  @ApiProperty({ example: 'localhost' })
  @IsString()
  @IsNotEmpty()
  host: string;

  @ApiProperty({ example: 5432 })
  @IsNumber()
  port: number;

  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'mydb' })
  @IsString()
  @IsNotEmpty()
  database: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  ssl?: boolean;

  @ApiProperty({ example: 'mongodb://...' , required: false, description: 'For MongoDB, you can provide a connection string instead' })
  @IsOptional()
  @IsString()
  connectionString?: string;
}

export class CreateConnectionDto {
  @ApiProperty({ example: 'Production PostgreSQL' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ConnectionType, example: ConnectionType.POSTGRESQL })
  @IsEnum(ConnectionType)
  type: ConnectionType;

  @ApiProperty({ type: ConnectionConfigDto })
  @ValidateNested()
  @Type(() => ConnectionConfigDto)
  @IsObject()
  config: ConnectionConfigDto;
}
