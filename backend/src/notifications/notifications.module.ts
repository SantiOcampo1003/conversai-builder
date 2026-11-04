import { Module } from '@nestjs/common';
import { AgentAccessService } from '../common/agent-access.service';
import { EvolutionClient } from './evolution.client';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, EvolutionClient, AgentAccessService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
