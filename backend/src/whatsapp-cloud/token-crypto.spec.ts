import { randomBytes } from 'crypto';
import { decryptToken, encryptToken } from './token-crypto';

const KEY = randomBytes(32).toString('base64');

describe('token-crypto', () => {
  it('cifra y descifra el token', () => {
    const enc = encryptToken('EAAG-token-del-cliente', KEY);
    expect(enc).toMatch(/^v1:[^:]+:[^:]+:[^:]+$/);
    expect(enc).not.toContain('EAAG');
    expect(decryptToken(enc, KEY)).toBe('EAAG-token-del-cliente');
  });

  it('cada cifrado usa un IV distinto', () => {
    expect(encryptToken('t', KEY)).not.toBe(encryptToken('t', KEY));
  });

  it('falla con otra llave o si el valor fue alterado', () => {
    const enc = encryptToken('t', KEY);
    expect(() => decryptToken(enc, randomBytes(32).toString('base64'))).toThrow();
    const [v, iv, tag, data] = enc.split(':');
    const otro = Buffer.from(data, 'base64');
    otro[0] ^= 1;
    expect(() => decryptToken([v, iv, tag, otro.toString('base64')].join(':'), KEY)).toThrow();
  });

  it('exige una llave de 32 bytes', () => {
    expect(() => encryptToken('t', undefined)).toThrow(/WHATSAPP_TOKEN_ENCRYPTION_KEY/);
    expect(() => encryptToken('t', Buffer.from('corta').toString('base64'))).toThrow(/32 bytes/);
  });

  it('rechaza formatos desconocidos', () => {
    expect(() => decryptToken('texto-plano', KEY)).toThrow(/formato/);
  });
});
