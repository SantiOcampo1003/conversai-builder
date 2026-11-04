import { buildDataFieldsPrompt, hasExplicitDataFields, resolveDataFields, slugifyKey } from './data-fields';
import { buildBusinessInfo, buildLeadState } from './prompt.builder';

describe('slugifyKey', () => {
  it('quita tildes, espacios y símbolos', () => {
    expect(slugifyKey('Nombre del talento')).toBe('nombre_del_talento');
    expect(slugifyKey('  ¿Dónde estudia?  ')).toBe('donde_estudia');
    expect(slugifyKey('Edad/Año')).toBe('edad_ano');
  });
});

describe('resolveDataFields', () => {
  it('usa data_fields cuando existe, sin repetidos ni claves vacías', () => {
    const fields = resolveDataFields({
      required_info: ['viejo'],
      data_fields: [
        { key: 'ciudad', label: 'Ciudad', required: true },
        { key: 'Ciudad', label: 'Ciudad repetida' },
        { key: '', label: '' },
        { key: 'edad', label: 'Edad', description: 'solo la edad', required: false },
      ],
    });
    expect(fields.map((f) => f.key)).toEqual(['ciudad', 'edad']);
    expect(fields[1]).toMatchObject({ label: 'Edad', description: 'solo la edad', required: false });
  });

  it('deriva de required_info en agentes antiguos', () => {
    const fields = resolveDataFields({ required_info: ['nombre', 'donde_estudia'], data_fields: null });
    expect(fields).toEqual([
      { key: 'nombre', label: 'Nombre', description: undefined, required: true },
      { key: 'donde_estudia', label: 'Donde estudia', description: undefined, required: true },
    ]);
  });

  it('sin datos devuelve lista vacía', () => {
    expect(resolveDataFields({ required_info: null, data_fields: null })).toEqual([]);
    expect(hasExplicitDataFields({ data_fields: [] })).toBe(false);
  });
});

describe('prompt con data_fields', () => {
  const agent: any = {
    agent_id: 'a', business_name: 'X', business_type: 't', business_category: 'c',
    required_info: ['nombre', 'edad'],
    data_fields: [
      { key: 'nombre', label: 'Nombre del talento', description: 'nombre y apellidos', required: true },
      { key: 'edad', label: 'Edad', description: 'solo la edad, nunca el grado', required: false },
    ],
  };

  it('incluye la sección DATOS A RECOGER con clave, encabezado y descripción', () => {
    const txt = buildBusinessInfo(agent, {});
    expect(txt).toContain('=== DATOS A RECOGER');
    expect(txt).toContain('1. nombre — Nombre del talento: nombre y apellidos');
    expect(txt).toContain('2. edad — Edad (opcional): solo la edad, nunca el grado');
  });

  it('un agente antiguo (solo required_info) no recibe la sección nueva', () => {
    const txt = buildBusinessInfo({ ...agent, data_fields: null }, {});
    expect(txt).not.toContain('=== DATOS A RECOGER');
    expect(txt).toContain('Pendientes: nombre, edad');
  });

  it('los opcionales no bloquean el cierre', () => {
    const txt = buildLeadState(resolveDataFields(agent), { nombre: 'Ana' });
    expect(txt).toContain('Pendientes: ninguno');
    expect(txt).toContain('Opcionales sin dato (no bloquean el cierre): edad');
  });

  it('buildDataFieldsPrompt vacío no genera sección', () => {
    expect(buildDataFieldsPrompt([])).toBe('');
  });
});
