import { Module } from '@nestjs/common';
import { LangchainService } from './langchain.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [IntegrationsModule, NotificationsModule],
  providers: [LangchainService],
  exports: [LangchainService],
})
export class LangchainModule {}
