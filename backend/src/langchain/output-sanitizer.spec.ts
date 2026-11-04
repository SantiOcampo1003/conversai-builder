import { EMPTY_REPLY_FALLBACK, extractLeakedArgs, hasLeakedToolText, stripLeakedToolText } from './output-sanitizer';

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

describe('argumentos filtrados sin nombre de herramienta', () => {
  const raw = '({\nprograma_de_interes: "CLAN Atelier"\n})\nCLAN Atelier está en Bogotá, en la Calle 195 #53-15. ¿Tienes alguna duda?';

  it('quita el bloque ({ ... }) del inicio', () => {
    expect(hasLeakedToolText(raw)).toBe(true);
    expect(stripLeakedToolText(raw)).toBe('CLAN Atelier está en Bogotá, en la Calle 195 #53-15. ¿Tienes alguna duda?');
  });

  it('quita también el bloque JSON con comillas y varios campos', () => {
    const t = '{"nombre_talento": "Andrés Gómez", "ciudad": "Bogotá"}\n¡Perfecto, gracias!';
    expect(stripLeakedToolText(t)).toBe('¡Perfecto, gracias!');
  });

  it('extrae solo las claves permitidas', () => {
    const t = '({ programa_de_interes: "CLAN Atelier", otra_cosa: "x", ciudad: \'Bogotá\' })\nHola';
    expect(extractLeakedArgs(t, ['programa_de_interes', 'ciudad'])).toEqual({ programa_de_interes: 'CLAN Atelier', ciudad: 'Bogotá' });
  });

  it('no extrae nada de un mensaje normal', () => {
    expect(extractLeakedArgs('Hola, ¿cómo estás? Nota: llámame mañana.', ['ciudad'])).toEqual({});
    expect(hasLeakedToolText('Hola, nota: algo importante {entre llaves}')).toBe(false);
  });
});

describe('restos y formatos adicionales', () => {
  const body = 'CLAN Atelier está en Bogotá, en la Calle 195 #53-15. ¿Tienes alguna duda?';
  const ok = (raw: string) => expect(stripLeakedToolText(raw)).toBe(body);

  it('resto de argumentos en la primera línea (caso real: Atelier"})', () => {
    ok(`Atelier"}\n${body}`);
    ok(`"}\n${body}`);
    ok(`})\n${body}`);
  });
  it('JSON en varias líneas y con nombre de herramienta', () => {
    ok(`functions.save_customer_info {\n"programa_de_interes": "CLAN Atelier"\n}\n${body}`);
  });
  it('bloque de código ```json', () => {
    ok('```json\n{"programa_de_interes": "CLAN Atelier"}\n```\n' + body);
  });
  it('tool_uses anidado', () => {
    ok(`{"tool_uses":[{"recipient_name":"functions.save_customer_info","parameters":{"programa_de_interes":"CLAN Atelier"}}]}\n${body}`);
  });
  it('sin llave inicial', () => {
    ok(`programa_de_interes": "CLAN Atelier"}\n${body}`);
  });
  it('no toca mensajes normales con corchetes, paréntesis o llaves', () => {
    const t = 'Te llama [Laura] (líder de admisiones).\nSi tienes dudas, escríbeme {sin problema}.';
    expect(stripLeakedToolText(t)).toBe(t);
    expect(hasLeakedToolText(t)).toBe(false);
  });
  it('hasLeakedToolText detecta los formatos nuevos', () => {
    expect(hasLeakedToolText(`Atelier"}\n${body}`)).toBe(true);
    expect(hasLeakedToolText(body)).toBe(false);
  });
});
