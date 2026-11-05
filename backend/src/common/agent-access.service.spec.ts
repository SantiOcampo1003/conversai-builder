import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AgentAccessService } from './agent-access.service';

/** Base falsa: `auth.getUser` según el token y filas fijas por tabla. */
function makeDb(opts: { userId?: string; members?: any[]; agent?: any }) {
  const from = (table: string) => {
    const b: any = {
      select: () => b, eq: () => b,
      maybeSingle: async () => ({ data: table === 'agents' ? opts.agent ?? null : null, error: null }),
      then: (res: any, rej: any) =>
        Promise.resolve({ data: table === 'client_members' ? opts.members ?? [] : [], error: null }).then(res, rej),
    };
    return b;
  };
  const auth = {
    getUser: async (token: string) =>
      token === 'valid' && opts.userId
        ? { data: { user: { id: opts.userId } }, error: null }
        : { data: { user: null }, error: new Error('bad token') },
  };
  return { getAdminClient: () => ({ from, auth }) } as any;
}

const CLIENT = 'c-1';
const OTHER = 'c-2';

describe('AgentAccessService.assertClientAccess', () => {
  it('sin token → 401 "Falta iniciar sesión"', async () => {
    const svc = new AgentAccessService(makeDb({ userId: 'u' }));
    await expect(svc.assertClientAccess(undefined, CLIENT, 'view')).rejects.toThrow(
      new UnauthorizedException('Falta iniciar sesión'),
    );
  });

  it('token inválido → 401 "Sesión inválida"', async () => {
    const svc = new AgentAccessService(makeDb({ userId: 'u' }));
    await expect(svc.assertClientAccess('Bearer nope', CLIENT, 'view')).rejects.toThrow(
      new UnauthorizedException('Sesión inválida'),
    );
  });

  it('view: miembro activo con role agent del mismo cliente → ok', async () => {
    const svc = new AgentAccessService(makeDb({ userId: 'u', members: [{ client_id: CLIENT, role: 'agent' }] }));
    await expect(svc.assertClientAccess('Bearer valid', CLIENT, 'view')).resolves.toBeUndefined();
  });

  it('view: miembro de otro cliente → 403', async () => {
    const svc = new AgentAccessService(makeDb({ userId: 'u', members: [{ client_id: OTHER, role: 'admin' }] }));
    await expect(svc.assertClientAccess('Bearer valid', CLIENT, 'view')).rejects.toThrow(ForbiddenException);
  });

  it('manage: role agent del mismo cliente → 403', async () => {
    const svc = new AgentAccessService(makeDb({ userId: 'u', members: [{ client_id: CLIENT, role: 'agent' }] }));
    await expect(svc.assertClientAccess('Bearer valid', CLIENT, 'manage')).rejects.toThrow(
      new ForbiddenException('No tienes permiso sobre este cliente'),
    );
  });

  it('manage: role admin del mismo cliente → ok', async () => {
    const svc = new AgentAccessService(makeDb({ userId: 'u', members: [{ client_id: CLIENT, role: 'admin' }] }));
    await expect(svc.assertClientAccess('Bearer valid', CLIENT, 'manage')).resolves.toBeUndefined();
  });

  it('manage: role admin de OTRO cliente → 403', async () => {
    const svc = new AgentAccessService(makeDb({ userId: 'u', members: [{ client_id: OTHER, role: 'admin' }] }));
    await expect(svc.assertClientAccess('Bearer valid', CLIENT, 'manage')).rejects.toThrow(ForbiddenException);
  });

  it('manage: super_admin de cualquier cliente → ok', async () => {
    const svc = new AgentAccessService(
      makeDb({ userId: 'u', members: [{ client_id: '00000000-0000-0000-0000-000000000000', role: 'super_admin' }] }),
    );
    await expect(svc.assertClientAccess('Bearer valid', CLIENT, 'manage')).resolves.toBeUndefined();
  });
});

describe('AgentAccessService.assertCanManage (sin cambios)', () => {
  it('agent-manager del cliente dueño del agente → ok', async () => {
    const svc = new AgentAccessService(
      makeDb({ userId: 'u', agent: { client_id: CLIENT }, members: [{ client_id: CLIENT, role: 'agent-manager' }] }),
    );
    await expect(svc.assertCanManage('Bearer valid', 'agent-1')).resolves.toBeUndefined();
  });
});

describe('AgentAccessService.clientAccessLevel', () => {
  it('admin del cliente → manage; otro rol del cliente → view', async () => {
    const admin = new AgentAccessService(makeDb({ userId: 'u', members: [{ client_id: CLIENT, role: 'admin' }] }));
    const viewer = new AgentAccessService(makeDb({ userId: 'u', members: [{ client_id: CLIENT, role: 'viewer' }] }));
    await expect(admin.clientAccessLevel('Bearer valid', CLIENT)).resolves.toBe('manage');
    await expect(viewer.clientAccessLevel('Bearer valid', CLIENT)).resolves.toBe('view');
  });

  it('sin membresía en el cliente → 403', async () => {
    const svc = new AgentAccessService(makeDb({ userId: 'u', members: [{ client_id: OTHER, role: 'admin' }] }));
    await expect(svc.clientAccessLevel('Bearer valid', CLIENT)).rejects.toThrow(ForbiddenException);
  });
});
