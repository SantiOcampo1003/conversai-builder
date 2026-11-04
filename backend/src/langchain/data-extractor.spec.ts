import { buildExtractorPrompt, cleanExtraction, extractData, pendingFields } from './data-extractor';

const fields = [
  { key: 'programa_de_interes', label: 'Programa', description: 'uno de: CLAN Atelier o Cantera CLAN', required: true },
  { key: 'nombre', label: 'Nombre', required: true },
  { key: 'ingles', label: 'Nivel de inglés', required: true },
];

describe('pendingFields', () => {
  it('solo los datos sin valor', () => {
    expect(pendingFields(fields, { nombre: 'Ana', ingles: '  ' }).map((f) => f.key)).toEqual(['programa_de_interes', 'ingles']);
    expect(pendingFields(fields, null)).toHaveLength(3);
  });
});

describe('cleanExtraction', () => {
  it('descarta claves no permitidas, vacíos y valores tipo "null"', () => {
    const out = cleanExtraction(
      { nombre: ' Ana Pérez ', ingles: 'no especificado', programa_de_interes: null, otra: 'x', extra: 5 },
      ['nombre', 'ingles', 'programa_de_interes'],
    );
    expect(out).toEqual({ nombre: 'Ana Pérez' });
  });
  it('descarta valores larguísimos (probables alucinaciones)', () => {
    expect(cleanExtraction({ nombre: 'a'.repeat(300) }, ['nombre'])).toEqual({});
  });
});

describe('buildExtractorPrompt', () => {
  it('incluye los campos, el contexto y lo ya guardado', () => {
    const { system, user } = buildExtractorPrompt({
      fields, userMessage: 'b1', lastAssistant: '¿Qué nivel de inglés tiene?', saved: { nombre: 'Ana' },
    });
    expect(system).toContain('- programa_de_interes: Programa (uno de: CLAN Atelier o Cantera CLAN)');
    expect(system).toContain('NO inventes');
    expect(user).toContain('¿Qué nivel de inglés tiene?');
    expect(user).toContain('Último mensaje de la persona:\nb1');
    expect(user).toContain('- nombre: Ana');
  });
});

describe('extractData', () => {
  it('pide al modelo solo los campos pendientes y devuelve lo limpio', async () => {
    let asked: string[] = [];
    const out = await extractData(
      { fields, userMessage: 'Quiero info de CLAN Atelier', saved: { nombre: 'Ana' } },
      async (_s, _u, keys) => { asked = keys; return { programa_de_interes: 'CLAN Atelier', ingles: null }; },
    );
    expect(asked).toEqual(['programa_de_interes', 'ingles']);
    expect(out).toEqual({ programa_de_interes: 'CLAN Atelier' });
  });
  it('no llama al modelo si no falta nada o el mensaje es vacío', async () => {
    const run = jest.fn();
    expect(await extractData({ fields, userMessage: 'hola', saved: { programa_de_interes: 'x', nombre: 'y', ingles: 'z' } }, run)).toEqual({});
    expect(await extractData({ fields, userMessage: ' ' }, run)).toEqual({});
    expect(run).not.toHaveBeenCalled();
  });
});

describe('acuses, rechazos y datos condicionales', () => {
  it('"ok", "gracias" y similares no son datos', () => {
    expect(cleanExtraction({ a: 'ok', b: 'Gracias', c: 'dale', d: 'Bogotá' }, ['a', 'b', 'c', 'd'])).toEqual({ d: 'Bogotá' });
  });
  it('el rechazo explícito se guarda como "No quiso decirlo"', () => {
    expect(cleanExtraction({ colegio: 'No quiso decirlo' }, ['colegio'])).toEqual({ colegio: 'No quiso decirlo' });
  });
  it('el prompt enseña a marcar los rechazos', () => {
    expect(buildExtractorPrompt({ fields, userMessage: 'prefiero no decirlo' }).system).toContain('"No quiso decirlo"');
  });
  it('no pide al extractor los datos que no aplican', () => {
    const f = [
      { key: 'programa', label: 'Programa', required: true },
      { key: 'club', label: 'Club', required: true, only_when: { field: 'programa', in: ['Fútbol'] } },
    ];
    expect(pendingFields(f, { programa: 'Atelier' }).map((x) => x.key)).toEqual([]);
    expect(pendingFields(f, { programa: 'Fútbol' }).map((x) => x.key)).toEqual(['club']);
  });
});
