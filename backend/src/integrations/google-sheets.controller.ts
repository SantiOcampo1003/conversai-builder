import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { AgentAccessService } from '../common/agent-access.service';
import { GoogleSheetsService } from './google-sheets.service';

class AgentDto {
  @IsString()
  @IsNotEmpty()
  agentId: string;
}

@Controller('api/integrations/google-sheets')
export class GoogleSheetsController {
  constructor(
    private readonly sheets: GoogleSheetsService,
    private readonly access: AgentAccessService,
  ) {}

  /** Correo de la cuenta de servicio con el que el cliente comparte su hoja. No es secreto. */
  @Get('info')
  info() {
    return { configured: this.sheets.isConfigured(), serviceAccountEmail: this.sheets.getServiceAccountEmail() };
  }

  @Post('test')
  @HttpCode(200)
  async test(@Headers('authorization') auth: string | undefined, @Body() dto: AgentDto) {
    await this.access.assertCanManage(auth, dto.agentId);
    const error = await this.sheets.testConnection(dto.agentId);
    return { ok: !error, error };
  }

  @Post('sync-all')
  @HttpCode(200)
  async syncAll(@Headers('authorization') auth: string | undefined, @Body() dto: AgentDto) {
    await this.access.assertCanManage(auth, dto.agentId);
    const { error, rows } = await this.sheets.syncAll(dto.agentId);
    return { ok: !error, error, rows };
  }
}
