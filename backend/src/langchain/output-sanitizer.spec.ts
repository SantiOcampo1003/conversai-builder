import { EMPTY_REPLY_FALLBACK, hasLeakedToolText, stripLeakedToolText } from './output-sanitizer';

describe('stripLeakedToolText', () => {
  it('quita la llamada filtrada y deja la respuesta', () => {
    const raw =
      'functions.save_customer_info IALOG_SESSION_ID=9a3c4a5f-8c6d-4a4a-8b5a-2f3e5d7b1c2d\nCLAN Atelier está en Bogotá. ¿Quieres una llamada?';
    expect(stripLeakedToolText(raw)).toBe('CLAN Atelier está en Bogotá. ¿Quieres una llamada?');
    expect(hasLeakedToolText(raw)).toBe(true);
  });

  it('funciona cuando todo viene en una sola línea', () => {
    const raw = 'functions.save_customer_info IALOG_SESSION_ID=9a3c4a5f-8c6d  CLAN Atelier está en Bogotá.';
    expect(stripLeakedToolText(raw)).toBe('CLAN Atelier está en Bogotá.');
  });

  it('quita también argumentos JSON pegados', () => {
    expect(stripLeakedToolText('functions.save_customer_info {"ciudad":"Bogotá"}\nPerfecto, gracias.')).toBe('Perfecto, gracias.');
  });

  it('no toca mensajes normales (ni la palabra "functions" suelta)', () => {
    const ok = '¡Hola! 😊 Estas son las functions del programa.\n\n🟢 *CLAN*: info';
    expect(stripLeakedToolText(ok)).toBe(ok);
    expect(hasLeakedToolText(ok)).toBe(false);
  });

  it('si solo había la llamada filtrada, devuelve un mensaje neutro', () => {
    expect(stripLeakedToolText('functions.save_customer_info IALOG_SESSION_ID=abc')).toBe(EMPTY_REPLY_FALLBACK);
  });
});
