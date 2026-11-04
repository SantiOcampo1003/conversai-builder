import { buildSummary, normalizePhone, pickRecipients, renderTemplate } from './notification-format';

const fields = [
  { key: 'programa_de_interes', label: 'Programa', required: true },
  { key: 'nombre_talento', label: 'Nombre del talento', required: true },
  { key: 'ciudad', label: 'Ciudad', required: true },
];

describe('normalizePhone', () => {
  it('acepta formatos comunes y agrega 57 a celulares colombianos', () => {
    expect(normalizePhone('300 123 4567')).toBe('573001234567');
    expect(normalizePhone('+57 300-123-4567')).toBe('573001234567');
    expect(normalizePhone('573001234567')).toBe('573001234567');
    expect(normalizePhone('+44 7710 173736')).toBe('447710173736');
  });
  it('rechaza lo que no parece un teléfono', () => {
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});

describe('pickRecipients', () => {
  const rs = [
    { match_value: 'CLAN Atelier', phone: '3001111111', label: 'Laura' },
    { match_value: 'CLAN Football Academy', phone: '3002222222', label: 'Nicolás' },
    { match_value: 'Cantera CLAN', phone: '3002222222', label: 'Nicolás' },
    { match_value: '*', phone: '3009999999', label: 'Respaldo' },
    { match_value: 'CLAN Atelier', phone: '3003333333', label: 'Inactivo', enabled: false },
  ];

  it('elige a quien corresponde al valor del campo, sin importar mayúsculas', () => {
    const r = pickRecipients(rs, 'programa_de_interes', { programa_de_interes: ' clan atelier ' });
    expect(r.map((x) => x.label)).toEqual(['Laura']);
  });
  it('si ninguno coincide, usa los de "todos"', () => {
    const r = pickRecipients(rs, 'programa_de_interes', { programa_de_interes: 'CLAN Academy Internacional' });
    expect(r.map((x) => x.label)).toEqual(['Respaldo']);
  });
  it('sin campo de enrutamiento, avisa a todos los activos', () => {
    expect(pickRecipients(rs, null, {}).map((x) => x.label)).toEqual(['Laura', 'Nicolás', 'Nicolás', 'Respaldo']);
  });
  it('ignora teléfonos inválidos', () => {
    expect(pickRecipients([{ match_value: '*', phone: 'x' }], null, {})).toEqual([]);
  });
});

describe('renderTemplate', () => {
  const ctx = {
    fields,
    data: { programa_de_interes: 'CLAN Atelier', nombre_talento: 'Valentina Rojas' },
    contactId: '573059357319',
  };

  it('reemplaza claves, resumen, teléfono y enlace', () => {
    const out = renderTemplate('Lead de {{programa_de_interes}}: {{nombre_talento}}\n{{resumen}}\n{{whatsapp_link}} {{telefono}}', ctx);
    expect(out).toContain('Lead de CLAN Atelier: Valentina Rojas');
    expect(out).toContain('• Nombre del talento: Valentina Rojas');
    expect(out).not.toContain('Ciudad'); // sin dato no aparece en el resumen
    expect(out).toContain('https://wa.me/573059357319 +573059357319');
  });
  it('con @lid no inventa teléfono ni enlace', () => {
    const out = renderTemplate('Tel: {{telefono}} Link: {{whatsapp_link}}', { ...ctx, contactId: '158621866397825@lid' });
    expect(out).toBe('Tel:  Link:');
  });
  it('una variable desconocida queda en blanco', () => {
    expect(renderTemplate('Hola {{no_existe}}!', ctx)).toBe('Hola !');
  });
  it('buildSummary respeta el orden de las columnas', () => {
    expect(buildSummary(fields, { ciudad: 'Bogotá', nombre_talento: 'Ana' })).toBe('• Nombre del talento: Ana\n• Ciudad: Bogotá');
  });
});
