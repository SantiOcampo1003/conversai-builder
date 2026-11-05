import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { AgentAccessService } from '../common/agent-access.service';
import { WhatsAppLineRow, WhatsAppLinesService } from './whatsapp-lines.service';

// Forma de uuid como la acepta Postgres: @IsUUID rechaza ids reales como el del super admin (000…)
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateLineDto {
  @Matches(UUID_SHAPE, { message: 'clientId inválido' }) clientId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lineName: string;
}

/** El QR solo lo ve quien gestiona la línea: con él cualquiera podría vincular su propio teléfono. */
const forLevel = (line: WhatsAppLineRow, level: 'view' | 'manage'): WhatsAppLineRow =>
  level === 'manage' ? line : { ...line, qr_code: null };

/** Líneas de WhatsApp del cliente. El navegador nunca habla con Evolution directamente. */
@Controller('api/whatsapp-lines')
export class WhatsAppLinesController {
  constructor(
    private readonly lines: WhatsAppLinesService,
    private readonly access: AgentAccessService,
  ) {}

  @Get()
  async list(@Headers('authorization') auth: string | undefined, @Query('clientId', ParseUUIDPipe) clientId: string) {
    const level = await this.access.clientAccessLevel(auth, clientId);
    const { lines, syncError } = await this.lines.listAndSync(clientId);
    return { lines: lines.map((line) => forLevel(line, level)), syncError };
  }

  @Post()
  async create(@Headers('authorization') auth: string | undefined, @Body() dto: CreateLineDto) {
    await this.access.assertClientAccess(auth, dto.clientId, 'manage');
    return { line: await this.lines.create(dto.clientId, dto.lineName) };
  }

  @Post(':id/refresh')
  @HttpCode(200)
  async refresh(@Headers('authorization') auth: string | undefined, @Param('id', ParseUUIDPipe) id: string) {
    const level = await this.access.clientAccessLevel(auth, await this.lines.clientIdOf(id));
    return { line: forLevel(await this.lines.refresh(id, level === 'manage'), level) };
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

  private async authorize(auth: string | undefined, lineId: string, level: 'manage') {
    await this.access.assertClientAccess(auth, await this.lines.clientIdOf(lineId), level);
  }
}
