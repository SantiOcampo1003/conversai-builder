import { Module } from '@nestjs/common';
import { AgentAccessService } from '../common/agent-access.service';
import { GoogleSheetsController } from './google-sheets.controller';
import { GoogleSheetsService } from './google-sheets.service';

@Module({
  controllers: [GoogleSheetsController],
  providers: [GoogleSheetsService, AgentAccessService],
  exports: [GoogleSheetsService],
})
export class IntegrationsModule {}
