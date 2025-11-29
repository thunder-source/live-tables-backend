import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './services/connections.service';
import { EncryptionService } from './services/encryption.service';
import { Connection } from './entities/connection.entity';
import { AdapterRegistryService } from '../dal/adapters/services/adapter-registry.service';

@Module({
  imports: [TypeOrmModule.forFeature([Connection])],
  controllers: [ConnectionsController],
  providers: [ConnectionsService, EncryptionService, AdapterRegistryService],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
