import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/** Verifica con el JWT de Supabase que quien llama puede administrar un agente. */
@Injectable()
export class AgentAccessService {
  constructor(private readonly db: DatabaseService) {}

  /** Solo admin o agent-manager del cliente dueño del agente (o super admin). Lanza 401/403 si no. */
  async assertCanManage(authHeader: string | undefined, agentId: string): Promise<void> {
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
