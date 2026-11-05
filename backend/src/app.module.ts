import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatModule } from './chat/chat.module';
import { DatabaseModule } from './database/database.module';
import { LangchainModule } from './langchain/langchain.module';
import { EmailModule } from './email/email.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WhatsAppLinesModule } from './whatsapp-lines/whatsapp-lines.module';
import { WhatsAppCloudModule } from './whatsapp-cloud/whatsapp-cloud.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    LangchainModule,
    ChatModule,
    EmailModule,
    IntegrationsModule,
    NotificationsModule,
    WhatsAppLinesModule,
    WhatsAppCloudModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
