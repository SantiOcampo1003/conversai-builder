import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AgentAccessService } from '../common/agent-access.service';
import { WhatsAppLineRow, WhatsAppLinesService } from './whatsapp-lines.service';

// Forma de uuid como la acepta Postgres: @IsUUID rechaza ids reales como el del super admin (000…)
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateLineDto {
  @Matches(UUID_SHAPE, { message: 'clientId inválido' }) clientId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lineName: string;
}

/** Línea por la API oficial con un número que administra la plataforma (solo super admin). */
export class CreateMetaLineDto {
  @Matches(UUID_SHAPE, { message: 'clientId inválido' }) clientId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lineName: string;
  @Matches(/^\d{5,30}$/, { message: 'Phone Number ID inválido' }) phoneNumberId: string;
  @IsOptional() @Matches(/^\d{5,30}$/, { message: 'WABA ID inválido' }) wabaId?: string;
}

/** "Conectar con Facebook": lo que devuelve el popup de Embedded Signup. */
export class EmbeddedSignupDto {
  @Matches(UUID_SHAPE, { message: 'clientId inválido' }) clientId: string;
  @IsString() @IsNotEmpty() @MaxLength(100) lineName: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) code: string;
  @Matches(/^\d{5,30}$/, { message: 'Phone Number ID inválido' }) phoneNumberId: string;
  @Matches(/^\d{5,30}$/, { message: 'WABA ID inválido' }) wabaId: string;
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

  /** Usa el token de la plataforma: por eso es solo para el super admin (un cliente no debe enlazar números de Fractal). */
  @Post('meta')
  async createMeta(@Headers('authorization') auth: string | undefined, @Body() dto: CreateMetaLineDto) {
    await this.access.assertSuperAdmin(auth);
    return { line: await this.lines.createMetaLine(dto.clientId, dto.lineName, dto.phoneNumberId, dto.wabaId ?? null) };
  }

  /** El cliente conecta su propio número con su cuenta de Meta: lo puede hacer el admin del cliente. */
  @Post('meta/embedded-signup')
  async embeddedSignup(@Headers('authorization') auth: string | undefined, @Body() dto: EmbeddedSignupDto) {
    await this.access.assertClientAccess(auth, dto.clientId, 'manage');
    return {
      line: await this.lines.connectWithEmbeddedSignup(dto.clientId, dto.lineName, dto.code, dto.phoneNumberId, dto.wabaId),
    };
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
