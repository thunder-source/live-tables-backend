import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { BasesModule } from '../bases/bases.module';
import { CollaborationGateway } from './collaboration.gateway';
import { PresenceService } from './presence.service';
import { CollaborationService } from './collaboration.service';

@Module({
  imports: [AuthModule, ConfigModule, BasesModule],
  providers: [CollaborationGateway, PresenceService, CollaborationService],
  exports: [CollaborationGateway, PresenceService, CollaborationService],
})
export class CollaborationModule {}
