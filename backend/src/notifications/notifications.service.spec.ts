import { NotificationsService } from './notifications.service';

/** Base falsa: cada tabla devuelve lo que se le indica; guarda las actualizaciones de `leads`. */
function makeDb(state: Record<string, { single?: any; list?: any[] }>, claimOk = true) {
  const updates: any[] = [];
  const from = (table: string) => {
    let op = 'select';
    const b: any = {
      select: () => b, eq: () => b, is: () => b, not: () => b, limit: () => b, order: () => b,
      update: (payload: any) => { op = 'update'; if (table === 'leads') updates.push(payload); return b; },
      insert: () => { op = 'insert'; return b; },
      maybeSingle: async () => ({ data: state[table]?.single ?? null, error: null }),
      then: (res: any, rej: any) =>
        Promise.resolve(
          op === 'update' && table === 'leads' ? { data: claimOk ? [{ customer_id: 'c1' }] : [], error: null } : { data: state[table]?.list ?? [], error: null },
        ).then(res, rej),
    };
    return b;
  };
  return { db: { getAdminClient: () => ({ from }) } as any, updates };
}

const baseState = {
  agent_notifications: { single: { id: 'n1', agent_id: 'a', enabled: true, message_template: 'Hola {{nombre}}', route_field: null } },
  agent_notification_recipients: { list: [{ match_value: null, phone: '3001234567', label: 'Laura', enabled: true }] },
  agents: { single: { data_fields: [{ key: 'nombre', label: 'Nombre', required: true }], required_info: null } },
  leads: { single: { additional_fields: { nombre: 'Ana' }, notified_at: null } },
  whatsapp_lines: { list: [{ evolution_instance_name: 'inst', status: 'connected' }] },
};

describe('NotificationsService', () => {
  it('los contactos de prueba (test_) nunca avisan ni consultan la base', async () => {
    const db: any = { getAdminClient: () => { throw new Error('no debe tocar la base'); } };
    const svc = new NotificationsService(db, {} as any);
    await expect(svc.notifyIfComplete('agente', 'test_claude_x')).resolves.toBe('skipped');
  });

  it('un contacto completo avisa una vez y queda marcado', async () => {
    const { db, updates } = makeDb(baseState);
    const evo: any = { sendText: jest.fn().mockResolvedValue(null) };
    const r = await new NotificationsService(db, evo).notifyIfComplete('a', 'c1');
    expect(r).toBe('sent');
    expect(evo.sendText).toHaveBeenCalledWith('inst', '573001234567', 'Hola Ana');
    expect(updates.filter((u) => u.notified_at === null)).toHaveLength(0);
  });

  it('si el envío falla en todos, libera el contacto para reintentar', async () => {
    const { db, updates } = makeDb(baseState);
    const evo: any = { sendText: jest.fn().mockResolvedValue('WhatsApp respondió 500') };
    expect(await new NotificationsService(db, evo).notifyIfComplete('a', 'c1')).toBe('failed');
    expect(updates[updates.length - 1]).toEqual({ notified_at: null });
  });

  it('si algo lanza un error DESPUÉS de reclamar, el contacto no queda "avisado" sin avisar', async () => {
    const { db, updates } = makeDb(baseState);
    const evo: any = { sendText: jest.fn().mockRejectedValue(new Error('red caída')) };
    expect(await new NotificationsService(db, evo).notifyIfComplete('a', 'c1')).toBe('failed');
    expect(updates[updates.length - 1]).toEqual({ notified_at: null });
  });

  it('si otro proceso ya reclamó el aviso, no envía nada', async () => {
    const { db } = makeDb(baseState, false);
    const evo: any = { sendText: jest.fn() };
    expect(await new NotificationsService(db, evo).notifyIfComplete('a', 'c1')).toBe('skipped');
    expect(evo.sendText).not.toHaveBeenCalled();
  });
});
