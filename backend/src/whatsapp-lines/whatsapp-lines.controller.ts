import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { AgentAccessService } from '../common/agent-access.service';
import { WhatsAppLinesService } from './whatsapp-lines.service';

// Forma de uuid como la acepta Postgres: @IsUUID rechaza ids reales como el del super admin (000…)
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateLineDto {
  @Matches(UUID_SHAPE, { message: 'clientId inválido' }) clientId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lineName: string;
}

/** Líneas de WhatsApp del cliente. El navegador nunca habla con Evolution directamente. */
@Controller('api/whatsapp-lines')
export class WhatsAppLinesController {
  constructor(
    private readonly lines: WhatsAppLinesService,
    private readonly access: AgentAccessService,
  ) {}

  @Get()
  async list(@Headers('authorization') auth: string | undefined, @Query('clientId', ParseUUIDPipe) clientId: string) {
    await this.access.assertClientAccess(auth, clientId, 'view');
    return this.lines.listAndSync(clientId);
  }

  @Post()
  async create(@Headers('authorization') auth: string | undefined, @Body() dto: CreateLineDto) {
    await this.access.assertClientAccess(auth, dto.clientId, 'manage');
    return { line: await this.lines.create(dto.clientId, dto.lineName) };
  }

  @Post(':id/refresh')
  @HttpCode(200)
  async refresh(@Headers('authorization') auth: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    await this.authorize(auth, id, 'view');
    return { line: await this.lines.refresh(id) };
  }

  @Post(':id/reconnect')
  @HttpCode(200)
  async reconnect(@Headers('authorization') auth: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    await this.authorize(auth, id, 'manage');
    return { line: await this.lines.reconnect(id) };
  }

  @Post(':id/logout')
  @HttpCode(200)
  async logout(@Headers('authorization') auth: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    await this.authorize(auth, id, 'manage');
    return { line: await this.lines.logout(id) };
  }

  @Delete(':id')
  async remove(@Headers('authorization') auth: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    await this.authorize(auth, id, 'manage');
    await this.lines.remove(id);
    return { ok: true };
  }

  private async authorize(auth: string | undefined, lineId: string, level: 'view' | 'manage') {
    await this.access.assertClientAccess(auth, await this.lines.clientIdOf(lineId), level);
  }
}
