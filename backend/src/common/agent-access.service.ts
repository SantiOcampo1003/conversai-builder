import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type Membership = { client_id: string; role: string };

/** Verifica con el JWT de Supabase que quien llama puede administrar un agente o un cliente. */
@Injectable()
export class AgentAccessService {
  constructor(private readonly db: DatabaseService) {}

  /** Solo admin o agent-manager del cliente dueño del agente (o super admin). Lanza 401/403 si no. */
  async assertCanManage(authHeader: string | undefined, agentId: string): Promise<void> {
    const members = await this.resolveMembers(authHeader);

    const { data: agent } = await this.db
      .getAdminClient()
      .from('agents')
      .select('client_id')
      .eq('agent_id', agentId)
      .maybeSingle();
    if (!agent) throw new ForbiddenException('Agente no encontrado');

    const allowed = members.some(
      (m) =>
        m.role === 'super_admin' || (m.client_id === agent.client_id && ['admin', 'agent-manager'].includes(m.role)),
    );
    if (!allowed) throw new ForbiddenException('No tienes permiso sobre este agente');
  }

  /**
   * Mismas reglas que la RLS de whatsapp_lines: `view` = cualquier miembro activo del cliente,
   * `manage` = admin del cliente. El super admin puede todo. Lanza 401/403 si no.
   */
  async assertClientAccess(authHeader: string | undefined, clientId: string, level: 'view' | 'manage'): Promise<void> {
    const granted = await this.clientAccessLevel(authHeader, clientId);
    if (level === 'manage' && granted !== 'manage') throw new ForbiddenException('No tienes permiso sobre este cliente');
  }

  /** Solo el super admin de la plataforma. Lanza 401/403 si no. */
  async assertSuperAdmin(authHeader: string | undefined): Promise<void> {
    const members = await this.resolveMembers(authHeader);
    if (!members.some((m) => m.role === 'super_admin')) throw new ForbiddenException('Solo el super admin puede hacer esto');
  }

  /** Nivel de acceso del usuario sobre el cliente; 403 si no es miembro. */
  async clientAccessLevel(authHeader: string | undefined, clientId: string): Promise<'view' | 'manage'> {
    const members = await this.resolveMembers(authHeader);
    if (members.some((m) => m.role === 'super_admin' || (m.client_id === clientId && m.role === 'admin'))) return 'manage';
    if (members.some((m) => m.client_id === clientId)) return 'view';
    throw new ForbiddenException('No tienes permiso sobre este cliente');
  }

  /** Membresías activas del usuario dueño del JWT. */
  private async resolveMembers(authHeader: string | undefined): Promise<Membership[]> {
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new UnauthorizedException('Falta iniciar sesión');

    const admin = this.db.getAdminClient();
    const { data: userData, error } = await admin.auth.getUser(token);
    if (error || !userData?.user) throw new UnauthorizedException('Sesión inválida');

    const { data: members } = await admin
      .from('client_members')
      .select('client_id, role')
      .eq('auth_user_id', userData.user.id)
      .eq('status', 'active');
    return (members ?? []) as Membership[];
  }
}
