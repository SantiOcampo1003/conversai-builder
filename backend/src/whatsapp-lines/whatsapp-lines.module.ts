import { Module } from '@nestjs/common';
import { AgentAccessService } from '../common/agent-access.service';
import { WhatsAppCloudClient } from '../whatsapp-cloud/whatsapp-cloud.client';
import { EvolutionInstancesClient } from './evolution-instances.client';
import { WhatsAppLinesController } from './whatsapp-lines.controller';
import { WhatsAppLinesService } from './whatsapp-lines.service';

@Module({
  controllers: [WhatsAppLinesController],
  providers: [WhatsAppLinesService, EvolutionInstancesClient, WhatsAppCloudClient, AgentAccessService],
})
export class WhatsAppLinesModule {}
