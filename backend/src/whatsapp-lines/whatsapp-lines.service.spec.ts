import { BadRequestException } from '@nestjs/common';
import { EvolutionState } from './line-state';
import { NOT_FOUND_MESSAGE, SYNC_ERROR_MESSAGE, WhatsAppLinesService } from './whatsapp-lines.service';

/** Tabla whatsapp_lines en memoria con el subconjunto del query builder que usa el servicio. */
function makeDb(initial: any[], opts: { insertError?: string } = {}) {
  const rows = initial.map((r) => ({ ...r }));
  const updates: any[] = [];
  const from = () => {
    const filters: [string, any][] = [];
    let op: 'select' | 'update' | 'insert' | 'delete' = 'select';
    let payload: any = null;
    const match = () => rows.filter((r) => filters.every(([k, v]) => r[k] === v));
    const run = () => {
      if (op === 'insert') {
        if (opts.insertError) return { data: null, error: { message: opts.insertError } };
        const row = { id: `id-${rows.length + 1}`, ...payload };
        rows.push(row);
        return { data: row, error: null };
      }
      if (op === 'update') {
        updates.push(payload);
        const hit = match();
        hit.forEach((r) => Object.assign(r, payload));
        return { data: hit[0] ?? null, error: null };
      }
      if (op === 'delete') {
        match().forEach((r) => rows.splice(rows.indexOf(r), 1));
        return { data: null, error: null };
      }
      return { data: match(), error: null };
    };
    const b: any = {
      select: () => b,
      order: () => b,
      eq: (k: string, v: any) => (filters.push([k, v]), b),
      update: (p: any) => ((op = 'update'), (payload = p), b),
      insert: (p: any) => ((op = 'insert'), (payload = p), b),
      delete: () => ((op = 'delete'), b),
      maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
      single: async () => {
        const r = run();
        return { data: Array.isArray(r.data) ? r.data[0] : r.data, error: r.error };
      },
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    };
    return b;
  };
  return { db: { getAdminClient: () => ({ from }) } as any, rows, updates };
}

function makeEvolution(states: Record<string, EvolutionState | Error>, extra: Partial<Record<string, jest.Mock>> = {}) {
  return {
    connectionState: jest.fn(async (name: string) => {
      const s = states[name];
      if (s instanceof Error) throw s;
      return s;
    }),
    ownerJid: jest.fn(async () => '573219385629@s.whatsapp.net'),
    connect: jest.fn(async () => ({ base64: 'NUEVO' })),
    create: jest.fn(async () => ({ qrcode: { base64: 'QR1' } })),
    logout: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
    ...extra,
  } as any;
}

const config = { get: (k: string) => (k === 'WHATSAPP_INCOMING_WEBHOOK_URL' ? 'https://n8n/webhook/x' : undefined) } as any;
const line = (over: any = {}) => ({
  id: 'l1', client_id: 'c1', line_name: 'Ventas', phone_number: '573219385629', agent_id: 'a1',
  status: 'connected', evolution_instance_name: 'inst1', qr_code: null, last_connected_at: null, error_message: null,
  ...over,
});

describe('WhatsAppLinesService.listAndSync', () => {
  it('línea connected y Evolution close → la guarda disconnected', async () => {
    const { db, rows } = makeDb([line()]);
    const svc = new WhatsAppLinesService(db, makeEvolution({ inst1: 'close' }), config);
    const { lines, syncError } = await svc.listAndSync('c1');
    expect(lines[0].status).toBe('disconnected');
    expect(rows[0].status).toBe('disconnected');
    expect(syncError).toBeNull();
  });

  it('línea disconnected y Evolution open → connected, fecha, sin QR y con teléfono', async () => {
    const { db, rows } = makeDb([line({ status: 'disconnected', phone_number: null, qr_code: 'viejo' })]);
    const svc = new WhatsAppLinesService(db, makeEvolution({ inst1: 'open' }), config);
    await svc.listAndSync('c1');
    expect(rows[0]).toMatchObject({ status: 'connected', qr_code: null, phone_number: '573219385629' });
    expect(rows[0].last_connected_at).toEqual(expect.any(String));
  });

  it('instancia inexistente en Evolution → error con mensaje', async () => {
    const { db, rows } = makeDb([line()]);
    const svc = new WhatsAppLinesService(db, makeEvolution({ inst1: 'not_found' }), config);
    await svc.listAndSync('c1');
    expect(rows[0]).toMatchObject({ status: 'error', error_message: NOT_FOUND_MESSAGE });
  });

  it('Evolution caído → no toca la base y devuelve el último estado con aviso', async () => {
    const { db, updates } = makeDb([line()]);
    const svc = new WhatsAppLinesService(db, makeEvolution({ inst1: new Error('timeout') }), config);
    const { lines, syncError } = await svc.listAndSync('c1');
    expect(updates).toHaveLength(0);
    expect(lines[0].status).toBe('connected');
    expect(syncError).toBe(SYNC_ERROR_MESSAGE);
  });

  it('sin cambios de estado → no escribe', async () => {
    const { db, updates } = makeDb([line()]);
    const svc = new WhatsAppLinesService(db, makeEvolution({ inst1: 'open' }), config);
    await svc.listAndSync('c1');
    expect(updates).toHaveLength(0);
  });

  it('al salir de error limpia el mensaje', async () => {
    const { db, rows } = makeDb([line({ status: 'error', error_message: NOT_FOUND_MESSAGE })]);
    const svc = new WhatsAppLinesService(db, makeEvolution({ inst1: 'open' }), config);
    await svc.listAndSync('c1');
    expect(rows[0]).toMatchObject({ status: 'connected', error_message: null });
  });
});

describe('WhatsAppLinesService.refresh', () => {
  it('línea pending todavía sin escanear → guarda el QR nuevo que entrega Evolution', async () => {
    const { db, rows } = makeDb([line({ status: 'pending', phone_number: null, qr_code: 'data:image/png;base64,VIEJO' })]);
    const evo = makeEvolution({ inst1: 'connecting' });
    const svc = new WhatsAppLinesService(db, evo, config);
    const updated = await svc.refresh('l1');
    expect(evo.connect).toHaveBeenCalledWith('inst1');
    expect(updated.qr_code).toBe('data:image/png;base64,NUEVO');
    expect(rows[0].status).toBe('pending');
  });

  it('línea conectada → no pide QR', async () => {
    const { db } = makeDb([line()]);
    const evo = makeEvolution({ inst1: 'open' });
    await new WhatsAppLinesService(db, evo, config).refresh('l1');
    expect(evo.connect).not.toHaveBeenCalled();
  });
});

describe('WhatsAppLinesService acciones', () => {
  it('create: instancia con nombre único y webhook configurado, fila pending con QR', async () => {
    const { db, rows } = makeDb([]);
    const evo = makeEvolution({});
    const created = await new WhatsAppLinesService(db, evo, config).create('c1', '  Ventas  ');
    const [name, webhook] = evo.create.mock.calls[0];
    expect(name).toMatch(/^line_\d+_[a-z0-9]{9}$/);
    expect(webhook).toBe('https://n8n/webhook/x');
    expect(created).toMatchObject({ client_id: 'c1', line_name: 'Ventas', status: 'pending', qr_code: 'data:image/png;base64,QR1' });
    expect(rows).toHaveLength(1);
  });

  it('create: si la base rechaza (límite de líneas) borra la instancia y devuelve el mensaje', async () => {
    const { db } = makeDb([], { insertError: 'Límite de 3 líneas de WhatsApp alcanzado para este cliente' });
    const evo = makeEvolution({});
    const svc = new WhatsAppLinesService(db, evo, config);
    await expect(svc.create('c1', 'Ventas')).rejects.toThrow(
      new BadRequestException('Límite de 3 líneas de WhatsApp alcanzado para este cliente'),
    );
    expect(evo.remove).toHaveBeenCalledWith(evo.create.mock.calls[0][0]);
  });

  it('reconnect: guarda QR nuevo y deja la línea pending', async () => {
    const { db, rows } = makeDb([line({ status: 'disconnected' })]);
    await new WhatsAppLinesService(db, makeEvolution({}), config).reconnect('l1');
    expect(rows[0]).toMatchObject({ status: 'pending', qr_code: 'data:image/png;base64,NUEVO' });
  });

  it('logout: cierra sesión y limpia teléfono y QR', async () => {
    const { db, rows } = makeDb([line()]);
    const evo = makeEvolution({});
    await new WhatsAppLinesService(db, evo, config).logout('l1');
    expect(evo.logout).toHaveBeenCalledWith('inst1');
    expect(rows[0]).toMatchObject({ status: 'disconnected', phone_number: null, qr_code: null });
  });

  it('remove: borra en Evolution y luego la fila', async () => {
    const { db, rows } = makeDb([line()]);
    const evo = makeEvolution({});
    await new WhatsAppLinesService(db, evo, config).remove('l1');
    expect(evo.remove).toHaveBeenCalledWith('inst1');
    expect(rows).toHaveLength(0);
  });

  it('clientIdOf: línea inexistente → 404', async () => {
    const { db } = makeDb([]);
    await expect(new WhatsAppLinesService(db, makeEvolution({}), config).clientIdOf('nope')).rejects.toThrow(
      'Línea no encontrada',
    );
  });
});
