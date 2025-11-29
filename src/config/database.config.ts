import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('database.host'),
  port: configService.get<number>('database.port'),
  username: configService.get<string>('database.username'),
  password: configService.get<string>('database.password'),
  database: configService.get<string>('database.database'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: configService.get<boolean>('database.synchronize'),
  logging: configService.get<boolean>('database.logging'),
  ssl: configService.get<string>('nodeEnv') === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
});

export const getMiniDbConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  name: 'miniDb',
  host: configService.get<string>('miniDb.host'),
  port: configService.get<number>('miniDb.port'),
  username: configService.get<string>('miniDb.username'),
  password: configService.get<string>('miniDb.password'),
  database: configService.get<string>('miniDb.database'),
  entities: [__dirname + '/../modules/tables/entities/*.entity{.ts,.js}'],
  synchronize: configService.get<boolean>('miniDb.synchronize'),
  logging: false,
  ssl: configService.get<string>('nodeEnv') === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
});
