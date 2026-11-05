import { extractQr, LineStatus, mapEvolutionState, EvolutionState, phoneFromOwnerJid } from './line-state';

describe('mapEvolutionState', () => {
  const table: [EvolutionState, LineStatus, LineStatus][] = [
    ['open', 'pending', 'connected'],
    ['open', 'connected', 'connected'],
    ['open', 'disconnected', 'connected'],
    ['open', 'error', 'connected'],
    ['connecting', 'pending', 'pending'],
    ['connecting', 'connected', 'disconnected'],
    ['connecting', 'disconnected', 'disconnected'],
    ['connecting', 'error', 'disconnected'],
    ['close', 'pending', 'pending'],
    ['close', 'connected', 'disconnected'],
    ['close', 'disconnected', 'disconnected'],
    ['close', 'error', 'disconnected'],
    ['not_found', 'pending', 'error'],
    ['not_found', 'connected', 'error'],
    ['not_found', 'disconnected', 'error'],
    ['not_found', 'error', 'error'],
  ];

  it.each(table)('Evolution %s con línea %s → %s', (state, current, expected) => {
    expect(mapEvolutionState(state, current)).toBe(expected);
  });
});

describe('extractQr', () => {
  it('agrega el prefijo de imagen al base64 que no lo trae', () => {
    expect(extractQr({ qrcode: { base64: 'abc' } })).toBe('data:image/png;base64,abc');
  });
  it('deja igual el base64 que ya es data URL', () => {
    expect(extractQr({ base64: 'data:image/png;base64,x' })).toBe('data:image/png;base64,x');
  });
  it('prefiere la imagen sobre el código', () => {
    expect(extractQr({ base64: 'img', code: '2@abc' })).toBe('data:image/png;base64,img');
  });
  it('usa el pairing code si no hay imagen', () => {
    expect(extractQr({ pairingCode: 'ABCD' })).toBe('ABCD');
  });
  it('devuelve null si no hay nada', () => {
    expect(extractQr({})).toBeNull();
    expect(extractQr(null)).toBeNull();
  });
});

describe('phoneFromOwnerJid', () => {
  it('quita el sufijo de WhatsApp', () => {
    expect(phoneFromOwnerJid('573219385629@s.whatsapp.net')).toBe('573219385629');
  });
  it('null si no hay jid', () => {
    expect(phoneFromOwnerJid(null)).toBeNull();
    expect(phoneFromOwnerJid(undefined)).toBeNull();
  });
});
