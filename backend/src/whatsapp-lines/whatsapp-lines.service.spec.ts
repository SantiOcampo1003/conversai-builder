import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { decryptToken } from '../whatsapp-cloud/token-crypto';
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
    const svc = new WhatsAppLinesService(db, makeEvolution({ inst1: 'close' }), config, {} as any);
    const { lines, syncError } = await svc.listAndSync('c1');
    expect(lines[0].status).toBe('disconnected');
    expect(rows[0].status).toBe('disconnected');
    expect(syncError).toBeNull();
  });

  it('línea disconnected y Evolution open → connected, fecha, sin QR y con teléfono', async () => {
    const { db, rows } = makeDb([line({ status: 'disconnected', phone_number: null, qr_code: 'viejo' })]);
    const svc = new WhatsAppLinesService(db, makeEvolution({ inst1: 'open' }), config, {} as any);
    await svc.listAndSync('c1');
    expect(rows[0]).toMatchObject({ status: 'connected', qr_code: null, phone_number: '573219385629' });
    expect(rows[0].last_connected_at).toEqual(expect.any(String));
  });

  it('instancia inexistente en Evolution → error con mensaje', async () => {
    const { db, rows } = makeDb([line()]);
    const svc = new WhatsAppLinesService(db, makeEvolution({ inst1: 'not_found' }), config, {} as any);
    await svc.listAndSync('c1');
    expect(rows[0]).toMatchObject({ status: 'error', error_message: NOT_FOUND_MESSAGE });
  });

  it('Evolution caído → no toca la base y devuelve el último estado con aviso', async () => {
    const { db, updates } = makeDb([line()]);
    const svc = new WhatsAppLinesService(db, makeEvolution({ inst1: new Error('timeout') }), config, {} as any);
    const { lines, syncError } = await svc.listAndSync('c1');
    expect(updates).toHaveLength(0);
    expect(lines[0].status).toBe('connected');
    expect(syncError).toBe(SYNC_ERROR_MESSAGE);
  });

  it('sin cambios de estado → no escribe', async () => {
    const { db, updates } = makeDb([line()]);
    const svc = new WhatsAppLinesService(db, makeEvolution({ inst1: 'open' }), config, {} as any);
    await svc.listAndSync('c1');
    expect(updates).toHaveLength(0);
  });

  it('al salir de error limpia el mensaje', async () => {
    const { db, rows } = makeDb([line({ status: 'error', error_message: NOT_FOUND_MESSAGE })]);
    const svc = new WhatsAppLinesService(db, makeEvolution({ inst1: 'open' }), config, {} as any);
    await svc.listAndSync('c1');
    expect(rows[0]).toMatchObject({ status: 'connected', error_message: null });
  });
});

describe('WhatsAppLinesService.refresh', () => {
  it('línea pending todavía sin escanear → guarda el QR nuevo que entrega Evolution', async () => {
    const { db, rows } = makeDb([line({ status: 'pending', phone_number: null, qr_code: 'data:image/png;base64,VIEJO' })]);
    const evo = makeEvolution({ inst1: 'connecting' });
    const svc = new WhatsAppLinesService(db, evo, config, {} as any);
    const updated = await svc.refresh('l1', true);
    expect(evo.connect).toHaveBeenCalledWith('inst1');
    expect(updated.qr_code).toBe('data:image/png;base64,NUEVO');
    expect(rows[0].status).toBe('pending');
  });

  it('línea conectada → no pide QR', async () => {
    const { db } = makeDb([line()]);
    const evo = makeEvolution({ inst1: 'open' });
    await new WhatsAppLinesService(db, evo, config, {} as any).refresh('l1', true);
    expect(evo.connect).not.toHaveBeenCalled();
  });
});

describe('WhatsAppLinesService.refresh sin permiso de gestión', () => {
  it('no pide QR nuevo a Evolution', async () => {
    const { db } = makeDb([line({ status: 'pending', qr_code: 'data:image/png;base64,VIEJO' })]);
    const evo = makeEvolution({ inst1: 'connecting' });
    await new WhatsAppLinesService(db, evo, config, {} as any).refresh('l1', false);
    expect(evo.connect).not.toHaveBeenCalled();
  });
});

describe('WhatsAppLinesService acciones', () => {
  it('create: instancia con nombre único y webhook configurado, fila pending con QR', async () => {
    const { db, rows } = makeDb([]);
    const evo = makeEvolution({});
    const created = await new WhatsAppLinesService(db, evo, config, {} as any).create('c1', '  Ventas  ');
    const [name, webhook] = evo.create.mock.calls[0];
    expect(name).toMatch(/^line_\d+_[a-z0-9]{9}$/);
    expect(webhook).toBe('https://n8n/webhook/x');
    expect(created).toMatchObject({ client_id: 'c1', line_name: 'Ventas', status: 'pending', qr_code: 'data:image/png;base64,QR1' });
    expect(rows).toHaveLength(1);
  });

  it('create: si la base rechaza (límite de líneas) borra la instancia y devuelve el mensaje', async () => {
    const { db } = makeDb([], { insertError: 'Límite de 3 líneas de WhatsApp alcanzado para este cliente' });
    const evo = makeEvolution({});
    const svc = new WhatsAppLinesService(db, evo, config, {} as any);
    await expect(svc.create('c1', 'Ventas')).rejects.toThrow(
      new BadRequestException('Límite de 3 líneas de WhatsApp alcanzado para este cliente'),
    );
    expect(evo.remove).toHaveBeenCalledWith(evo.create.mock.calls[0][0]);
  });

  it('reconnect: guarda QR nuevo y deja la línea pending', async () => {
    const { db, rows } = makeDb([line({ status: 'disconnected' })]);
    await new WhatsAppLinesService(db, makeEvolution({}), config, {} as any).reconnect('l1');
    expect(rows[0]).toMatchObject({ status: 'pending', qr_code: 'data:image/png;base64,NUEVO' });
  });

  it('logout: cierra sesión y limpia teléfono y QR', async () => {
    const { db, rows } = makeDb([line()]);
    const evo = makeEvolution({});
    await new WhatsAppLinesService(db, evo, config, {} as any).logout('l1');
    expect(evo.logout).toHaveBeenCalledWith('inst1');
    expect(rows[0]).toMatchObject({ status: 'disconnected', phone_number: null, qr_code: null });
  });

  it('remove: borra en Evolution y luego la fila', async () => {
    const { db, rows } = makeDb([line()]);
    const evo = makeEvolution({});
    await new WhatsAppLinesService(db, evo, config, {} as any).remove('l1');
    expect(evo.remove).toHaveBeenCalledWith('inst1');
    expect(rows).toHaveLength(0);
  });

  it('clientIdOf: línea inexistente → 404', async () => {
    const { db } = makeDb([]);
    await expect(new WhatsAppLinesService(db, makeEvolution({}), config, {} as any).clientIdOf('nope')).rejects.toThrow(
      'Línea no encontrada',
    );
  });
});

describe('WhatsAppLinesService con líneas de la API oficial (meta_cloud)', () => {
  const metaLine = (over: any = {}) =>
    line({ provider: 'meta_cloud', evolution_instance_name: null, meta_phone_number_id: 'pn1', ...over });

  it('listAndSync no consulta Evolution para líneas meta_cloud', async () => {
    const { db } = makeDb([metaLine()]);
    const evo = makeEvolution({});
    const { lines, syncError } = await new WhatsAppLinesService(db, evo, config, {} as any).listAndSync('c1');
    expect(evo.connectionState).not.toHaveBeenCalled();
    expect(lines[0].status).toBe('connected');
    expect(syncError).toBeNull();
  });

  it('refresh devuelve la línea sin tocar Evolution', async () => {
    const { db } = makeDb([metaLine()]);
    const evo = makeEvolution({});
    await new WhatsAppLinesService(db, evo, config, {} as any).refresh('l1', true);
    expect(evo.connectionState).not.toHaveBeenCalled();
    expect(evo.connect).not.toHaveBeenCalled();
  });

  it('reconnect y logout no aplican: se gestionan desde Meta', async () => {
    const { db } = makeDb([metaLine()]);
    const svc = new WhatsAppLinesService(db, makeEvolution({}), config, {} as any);
    await expect(svc.reconnect('l1')).rejects.toThrow(BadRequestException);
    await expect(svc.logout('l1')).rejects.toThrow(BadRequestException);
  });

  it('remove borra la fila sin llamar a Evolution', async () => {
    const { db, rows } = makeDb([metaLine()]);
    const evo = makeEvolution({});
    await new WhatsAppLinesService(db, evo, config, {} as any).remove('l1');
    expect(evo.remove).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });
});

describe('WhatsAppLinesService.createMetaLine', () => {
  const cloud = (over: any = {}) => ({
    getPhoneNumber: jest.fn(async () => ({ displayPhoneNumber: '+1 555-157-1956', verifiedName: 'Test Number' })),
    subscribeApp: jest.fn(async () => undefined),
    ...over,
  });

  it('valida el número con Meta, suscribe la app a la WABA y crea la línea conectada', async () => {
    const { db, rows } = makeDb([]);
    const c = cloud();
    const created = await new WhatsAppLinesService(db, makeEvolution({}), config, c as any).createMetaLine('c1', ' Prueba Meta ', 'PN9', 'WABA9');
    expect(c.getPhoneNumber).toHaveBeenCalledWith('PN9');
    expect(c.subscribeApp).toHaveBeenCalledWith('WABA9');
    expect(created).toMatchObject({
      client_id: 'c1', line_name: 'Prueba Meta', provider: 'meta_cloud', meta_phone_number_id: 'PN9',
      meta_waba_id: 'WABA9', phone_number: '15551571956', status: 'connected', evolution_instance_name: null,
    });
    expect(rows).toHaveLength(1);
  });

  it('sin WABA ID crea la línea sin suscribir', async () => {
    const { db } = makeDb([]);
    const c = cloud();
    await new WhatsAppLinesService(db, makeEvolution({}), config, c as any).createMetaLine('c1', 'X', 'PN9', null);
    expect(c.subscribeApp).not.toHaveBeenCalled();
  });

  it('si Meta no reconoce el número (o el token no tiene acceso) no crea nada', async () => {
    const { db, rows } = makeDb([]);
    const c = cloud({ getPhoneNumber: jest.fn(async () => { throw new Error('WhatsApp (Meta) respondió 400: Unsupported get request'); }) });
    await expect(new WhatsAppLinesService(db, makeEvolution({}), config, c as any).createMetaLine('c1', 'X', 'BAD', null)).rejects.toThrow(
      BadRequestException,
    );
    expect(rows).toHaveLength(0);
  });

  it('si el número ya está conectado devuelve un mensaje claro', async () => {
    const { db } = makeDb([], { insertError: 'duplicate key value violates unique constraint "whatsapp_lines_meta_phone_number_id_key"' });
    await expect(new WhatsAppLinesService(db, makeEvolution({}), config, cloud() as any).createMetaLine('c1', 'X', 'PN9', null)).rejects.toThrow(
      'Ese número ya está conectado a una línea.',
    );
  });
});

describe('WhatsAppLinesService.connectWithEmbeddedSignup', () => {
  const KEY = randomBytes(32).toString('base64');
  const esConfig = { get: (k: string) => ({ WHATSAPP_TOKEN_ENCRYPTION_KEY: KEY } as Record<string, string>)[k] } as any;

  /** whatsapp_lines y clients en memoria, con el conteo (head) que usa el límite de líneas. */
  function makeTables(lines: any[], maxLines: number | null = 3) {
    const tables: Record<string, any[]> = { whatsapp_lines: lines.map((r) => ({ ...r })), clients: [{ id: 'c1', max_whatsapp_lines: maxLines }] };
    const from = (name: string) => {
      const rows = tables[name];
      const filters: [string, any][] = [];
      let payload: any = null;
      let head = false;
      const match = () => rows.filter((r) => filters.every(([k, v]) => r[k] === v));
      const b: any = {
        select: (_c?: string, o?: { head?: boolean }) => ((head = !!o?.head), b),
        eq: (k: string, v: any) => (filters.push([k, v]), b),
        insert: (p: any) => ((payload = p), b),
        maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
        single: async () => {
          const row = { id: `id-${rows.length + 1}`, ...payload };
          rows.push(row);
          return { data: row, error: null };
        },
        then: (res: any, rej: any) => Promise.resolve(head ? { count: match().length, data: null, error: null } : { data: match(), error: null }).then(res, rej),
      };
      return b;
    };
    return { db: { getAdminClient: () => ({ from }) } as any, tables };
  }

  const cloud = (over: any = {}) => ({
    exchangeCode: jest.fn(async () => 'EAAG-token-cliente'),
    subscribeApp: jest.fn(async () => undefined),
    registerPhoneNumber: jest.fn(async () => undefined),
    getPhoneNumber: jest.fn(async () => ({ displayPhoneNumber: '+57 300 111 2233', verifiedName: 'Tienda' })),
    ...over,
  });
  const connect = (db: any, c: any, cfg = esConfig) =>
    new WhatsAppLinesService(db, makeEvolution({}), cfg, c).connectWithEmbeddedSignup('c1', ' Ventas ', 'CODE', '1234567', '7654321');

  it('cambia el code por el token, suscribe la WABA, registra el número y guarda la línea con el token cifrado', async () => {
    const { db, tables } = makeTables([]);
    const c = cloud();
    const line = await connect(db, c);
    expect(c.exchangeCode).toHaveBeenCalledWith('CODE');
    expect(c.subscribeApp).toHaveBeenCalledWith('7654321', 'EAAG-token-cliente');
    expect(c.registerPhoneNumber).toHaveBeenCalledWith('1234567', expect.stringMatching(/^\d{6}$/), 'EAAG-token-cliente');
    expect(c.getPhoneNumber).toHaveBeenCalledWith('1234567', 'EAAG-token-cliente');
    expect(line).toMatchObject({
      client_id: 'c1', line_name: 'Ventas', provider: 'meta_cloud', meta_phone_number_id: '1234567',
      meta_waba_id: '7654321', phone_number: '573001112233', status: 'connected',
    });
    const saved = tables.whatsapp_lines[0].meta_access_token_encrypted;
    expect(saved).toMatch(/^v1:/);
    expect(saved).not.toContain('EAAG');
    expect(decryptToken(saved, KEY)).toBe('EAAG-token-cliente');
  });

  it('si el número ya estaba registrado en la Cloud API sigue adelante', async () => {
    const { db, tables } = makeTables([]);
    const c = cloud({ registerPhoneNumber: jest.fn(async () => { throw new Error('WhatsApp (Meta) respondió 400: Phone number is already registered'); }) });
    await connect(db, c);
    expect(tables.whatsapp_lines).toHaveLength(1);
  });

  it('otro error al registrar (p. ej. PIN de dos pasos) no crea la línea y lo explica', async () => {
    const { db, tables } = makeTables([]);
    const c = cloud({ registerPhoneNumber: jest.fn(async () => { throw new Error('(#133005) Two step verification PIN Mismatch'); }) });
    await expect(connect(db, c)).rejects.toThrow(/verificación en dos pasos/);
    expect(tables.whatsapp_lines).toHaveLength(0);
  });

  it('con el cupo de líneas lleno no gasta el code', async () => {
    const { db } = makeTables([{ client_id: 'c1' }, { client_id: 'c1' }], 2);
    const c = cloud();
    await expect(connect(db, c)).rejects.toThrow(/límite de 2 líneas/);
    expect(c.exchangeCode).not.toHaveBeenCalled();
  });

  it('si el número ya está conectado lo dice antes de llamar a Meta', async () => {
    const { db } = makeTables([{ client_id: 'otro', meta_phone_number_id: '1234567' }]);
    const c = cloud();
    await expect(connect(db, c)).rejects.toThrow('Ese número ya está conectado a una línea.');
    expect(c.exchangeCode).not.toHaveBeenCalled();
  });

  it('si Facebook no acepta el code no crea nada', async () => {
    const { db, tables } = makeTables([]);
    const c = cloud({ exchangeCode: jest.fn(async () => { throw new Error('(#100) This authorization code has expired'); }) });
    await expect(connect(db, c)).rejects.toThrow(/Facebook no confirmó la conexión/);
    expect(c.subscribeApp).not.toHaveBeenCalled();
    expect(tables.whatsapp_lines).toHaveLength(0);
  });

  it('sin llave de cifrado configurada no llama a Meta', async () => {
    const { db } = makeTables([]);
    const c = cloud();
    await expect(connect(db, c, { get: () => undefined } as any)).rejects.toThrow(/WHATSAPP_TOKEN_ENCRYPTION_KEY/);
    expect(c.exchangeCode).not.toHaveBeenCalled();
  });
});
