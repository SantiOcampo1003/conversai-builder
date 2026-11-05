import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { WhatsAppCloudClient } from './whatsapp-cloud.client';
import { WhatsAppCloudController } from './whatsapp-cloud.controller';
import { WhatsAppCloudService } from './whatsapp-cloud.service';

@Module({
  imports: [ChatModule],
  controllers: [WhatsAppCloudController],
  providers: [WhatsAppCloudService, WhatsAppCloudClient],
})
export class WhatsAppCloudModule {}
