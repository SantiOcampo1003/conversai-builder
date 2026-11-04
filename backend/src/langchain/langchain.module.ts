import { Module } from '@nestjs/common';
import { LangchainService } from './langchain.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [IntegrationsModule],
  providers: [LangchainService],
  exports: [LangchainService],
})
export class LangchainModule {}
