import { randomBytes } from 'crypto';
import { decryptToken, encryptToken } from '../whatsapp-cloud/token-crypto';
import { EXPIRING_MESSAGE, MetaTokenRenewalService, RENEW_WINDOW_DAYS, REVOKED_MESSAGE } from './meta-token-renewal.service';

const KEY = randomBytes(32).toString('base64');
const appConfig = {
  get: (k: string) => ({ WHATSAPP_TOKEN_ENCRYPTION_KEY: KEY, META_APP_ID: 'APP1', META_APP_SECRET: 'secret' } as Record<string, string>)[k],
} as any;
const config = appConfig;
const NOW = new Date('2026-11-06T13:00:00Z');
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000);

/** whatsapp_lines en memoria: select con eq/not y update con eq (registra los filtros de cada update). */
function makeDb(initial: any[]) {
  const rows = initial.map((r) => ({ provider: 'meta_cloud', meta_token_refresh_error: null, ...r }));
  const updates: { payload: any; filters: [string, any][] }[] = [];
  const from = () => {
    const filters: [string, any][] = [];
    const notNull: string[] = [];
    let payload: any = null;
    const match = () => rows.filter((r) => filters.every(([k, v]) => r[k] === v) && notNull.every((k) => r[k] != null));
    const b: any = {
      select: () => b,
      eq: (k: string, v: any) => (filters.push([k, v]), b),
      not: (k: string, op: string, v: any) => (op === 'is' && v === null && notNull.push(k), b),
      update: (p: any) => ((payload = p), b),
      then: (res: any, rej: any) => {
        if (payload) {
          updates.push({ payload, filters: [...filters] });
          match().forEach((r) => Object.assign(r, payload));
          return Promise.resolve({ data: null, error: null }).then(res, rej);
        }
        return Promise.resolve({ data: match().map((r) => ({ ...r })), error: null }).then(res, rej);
      },
    };
    return b;
  };
  return { db: { getAdminClient: () => ({ from }) } as any, rows, updates };
}

const cloud = (over: any = {}) => ({
  refreshToken: jest.fn(async () => ({ accessToken: 'EAAG-nuevo', expiresAt: inDays(60) })),
  debugToken: jest.fn(async () => ({ expiresAt: inDays(40), wabaIds: [] })),
  ...over,
});
const line = (id: string, token: string | null, expires: Date | null) => ({
  id,
  meta_access_token_encrypted: token && encryptToken(token, KEY),
  meta_token_expires_at: expires?.toISOString() ?? null,
});

describe('MetaTokenRenewalService.renewDueTokens', () => {
  it(`renueva el token que vence en ≤ ${RENEW_WINDOW_DAYS} días y guarda el nuevo cifrado`, async () => {
    const { db, rows } = makeDb([line('l1', 'EAAG-viejo', inDays(10))]);
    const c = cloud();
    const before = rows[0].meta_access_token_encrypted;
    await expect(new MetaTokenRenewalService(db, c as any, config).renewDueTokens(NOW)).resolves.toEqual({ renewed: 1, failed: 0, filled: 0 });
    expect(c.refreshToken).toHaveBeenCalledWith('EAAG-viejo');
    expect(rows[0].meta_access_token_encrypted).not.toBe(before);
    expect(decryptToken(rows[0].meta_access_token_encrypted, KEY)).toBe('EAAG-nuevo');
    expect(rows[0].meta_token_expires_at).toBe(inDays(60).toISOString());
    expect(rows[0].meta_token_refresh_error).toBeNull();
  });

  it('no toca un token que vence en más de la ventana', async () => {
    const { db, updates } = makeDb([line('l1', 'EAAG', inDays(30))]);
    const c = cloud();
    await expect(new MetaTokenRenewalService(db, c as any, config).renewDueTokens(NOW)).resolves.toEqual({ renewed: 0, failed: 0, filled: 0 });
    expect(c.refreshToken).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it('sin fecha guardada la consulta a Meta y la llena', async () => {
    const { db, rows } = makeDb([line('l1', 'EAAG', null)]);
    const c = cloud();
    await expect(new MetaTokenRenewalService(db, c as any, config).renewDueTokens(NOW)).resolves.toEqual({ renewed: 0, failed: 0, filled: 1 });
    expect(c.debugToken).toHaveBeenCalledWith('EAAG');
    expect(rows[0].meta_token_expires_at).toBe(inDays(40).toISOString());
    expect(c.refreshToken).not.toHaveBeenCalled();
  });

  it('sin fecha guardada y vence pronto: la llena y además renueva', async () => {
    const { db } = makeDb([line('l1', 'EAAG', null)]);
    const c = cloud({ debugToken: jest.fn(async () => ({ expiresAt: inDays(3), wabaIds: [] })) });
    await expect(new MetaTokenRenewalService(db, c as any, config).renewDueTokens(NOW)).resolves.toEqual({ renewed: 1, failed: 0, filled: 1 });
  });

  it('un token que no vence (expires_at 0) no se renueva', async () => {
    const { db, updates } = makeDb([line('l1', 'EAAG', null)]);
    const c = cloud({ debugToken: jest.fn(async () => ({ expiresAt: null, wabaIds: [] })) });
    await expect(new MetaTokenRenewalService(db, c as any, config).renewDueTokens(NOW)).resolves.toEqual({ renewed: 0, failed: 0, filled: 0 });
    expect(c.refreshToken).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it('ignora las líneas con el token de la plataforma y las de Evolution', async () => {
    const { db } = makeDb([line('l1', null, null), { ...line('l2', 'EAAG', inDays(1)), provider: 'evolution' }]);
    const c = cloud();
    await expect(new MetaTokenRenewalService(db, c as any, config).renewDueTokens(NOW)).resolves.toEqual({ renewed: 0, failed: 0, filled: 0 });
    expect(c.refreshToken).not.toHaveBeenCalled();
    expect(c.debugToken).not.toHaveBeenCalled();
  });

  it('si Meta rechaza la renovación marca la línea y sigue con las demás', async () => {
    const { db, rows } = makeDb([line('l1', 'EAAG-revocado', inDays(5)), line('l2', 'EAAG-ok', inDays(5))]);
    const c = cloud({
      refreshToken: jest.fn(async (t: string) => {
        if (t === 'EAAG-revocado') throw new Error('(#190) Error validating access token: The session has been invalidated');
        return { accessToken: 'EAAG-nuevo', expiresAt: inDays(60) };
      }),
    });
    await expect(new MetaTokenRenewalService(db, c as any, config).renewDueTokens(NOW)).resolves.toEqual({ renewed: 1, failed: 1, filled: 0 });
    expect(rows[0].meta_token_refresh_error).toBe(REVOKED_MESSAGE);
    expect(decryptToken(rows[0].meta_access_token_encrypted, KEY)).toBe('EAAG-revocado');
    expect(decryptToken(rows[1].meta_access_token_encrypted, KEY)).toBe('EAAG-nuevo');
  });

  it('un token que no se puede descifrar cuenta como fallo sin detener el lote', async () => {
    const { db, rows } = makeDb([{ id: 'l1', meta_access_token_encrypted: 'v1:roto', meta_token_expires_at: inDays(1).toISOString() }, line('l2', 'EAAG', inDays(1))]);
    const c = cloud();
    await expect(new MetaTokenRenewalService(db, c as any, config).renewDueTokens(NOW)).resolves.toEqual({ renewed: 1, failed: 1, filled: 0 });
    expect(rows[0].meta_token_refresh_error).toBe(REVOKED_MESSAGE);
  });

  it('actualiza solo si el token sigue siendo el que leyó (dos renovaciones a la vez no se pisan)', async () => {
    const { db, rows, updates } = makeDb([line('l1', 'EAAG-viejo', inDays(2))]);
    const previous = rows[0].meta_access_token_encrypted;
    await new MetaTokenRenewalService(db, cloud() as any, config).renewDueTokens(NOW);
    expect(updates[0].filters).toEqual([
      ['id', 'l1'],
      ['meta_access_token_encrypted', previous],
    ]);
  });

  it('sin llave de cifrado o credenciales de la app no marca ninguna línea (es un problema del servidor)', async () => {
    const { db, updates } = makeDb([line('l1', 'EAAG', inDays(2))]);
    const c = cloud({ refreshToken: jest.fn(async () => { throw new Error('Falta configurar META_APP_ID o META_APP_SECRET en el servidor'); }) });
    const noKey = { get: () => undefined } as any;
    await expect(new MetaTokenRenewalService(db, c as any, noKey).renewDueTokens(NOW)).rejects.toThrow(/WHATSAPP_TOKEN_ENCRYPTION_KEY/);
    const noApp = { get: (k: string) => (k === 'WHATSAPP_TOKEN_ENCRYPTION_KEY' ? KEY : undefined) } as any;
    await expect(new MetaTokenRenewalService(db, c as any, noApp).renewDueTokens(NOW)).rejects.toThrow(/META_APP_ID/);
    expect(c.refreshToken).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it('un error pasajero de Meta con margen no marca la línea (se reintenta mañana)', async () => {
    const { db, rows } = makeDb([line('l1', 'EAAG', inDays(10))]);
    const c = cloud({ refreshToken: jest.fn(async () => { throw new Error('WhatsApp (Meta) respondió 503: Service temporarily unavailable'); }) });
    await expect(new MetaTokenRenewalService(db, c as any, appConfig).renewDueTokens(NOW)).resolves.toEqual({ renewed: 0, failed: 1, filled: 0 });
    expect(rows[0].meta_token_refresh_error).toBeNull();
  });

  it('un error pasajero cuando faltan menos de 3 días sí avisa', async () => {
    const { db, rows } = makeDb([line('l1', 'EAAG', inDays(2))]);
    const c = cloud({ refreshToken: jest.fn(async () => { throw new Error('This operation was aborted'); }) });
    await new MetaTokenRenewalService(db, c as any, appConfig).renewDueTokens(NOW);
    expect(rows[0].meta_token_refresh_error).toBe(EXPIRING_MESSAGE);
  });
});
