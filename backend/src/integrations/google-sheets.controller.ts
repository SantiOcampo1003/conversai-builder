import { Body, Controller, Get, Headers, HttpCode, Post, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { DatabaseService } from '../database/database.service';
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
    private readonly db: DatabaseService,
  ) {}

  /** Correo de la cuenta de servicio con el que el cliente comparte su hoja. No es secreto. */
  @Get('info')
  info() {
    return { configured: this.sheets.isConfigured(), serviceAccountEmail: this.sheets.getServiceAccountEmail() };
  }

  @Post('test')
  @HttpCode(200)
  async test(@Headers('authorization') auth: string | undefined, @Body() dto: AgentDto) {
    await this.assertCanManage(auth, dto.agentId);
    const error = await this.sheets.testConnection(dto.agentId);
    return { ok: !error, error };
  }

  @Post('sync-all')
  @HttpCode(200)
  async syncAll(@Headers('authorization') auth: string | undefined, @Body() dto: AgentDto) {
    await this.assertCanManage(auth, dto.agentId);
    const { error, rows } = await this.sheets.syncAll(dto.agentId);
    return { ok: !error, error, rows };
  }

  /** Solo quien administra el agente (o el super admin) puede operar su hoja. Valida el JWT de Supabase. */
  private async assertCanManage(authHeader: string | undefined, agentId: string) {
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new UnauthorizedException('Falta iniciar sesión');

    const admin = this.db.getAdminClient();
    const { data: userData, error } = await admin.auth.getUser(token);
    if (error || !userData?.user) throw new UnauthorizedException('Sesión inválida');
    const userId = userData.user.id;

    const { data: agent } = await admin.from('agents').select('client_id').eq('agent_id', agentId).maybeSingle();
    if (!agent) throw new ForbiddenException('Agente no encontrado');

    const { data: members } = await admin
      .from('client_members')
      .select('client_id, role')
      .eq('auth_user_id', userId)
      .eq('status', 'active');

    const allowed = (members ?? []).some(
      (m: any) =>
        m.role === 'super_admin' || (m.client_id === agent.client_id && ['admin', 'agent-manager'].includes(m.role)),
    );
    if (!allowed) throw new ForbiddenException('No tienes permiso sobre este agente');
  }
}
