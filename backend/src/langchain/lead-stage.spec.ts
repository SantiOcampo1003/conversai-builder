import { computeStage, phoneFromContactId, STAGE_IN_PROGRESS, STAGE_READY } from './lead-stage';

const fields = [
  { key: 'nombre', label: 'Nombre', required: true },
  { key: 'ciudad', label: 'Ciudad', required: true },
  { key: 'colegio', label: 'Colegio', required: false },
];

describe('computeStage', () => {
  it('queda en conversación mientras falte un dato obligatorio', () => {
    const s = computeStage(fields, { nombre: 'Ana' });
    expect(s).toEqual({ complete: false, label: STAGE_IN_PROGRESS, missing: ['ciudad'] });
  });

  it('queda listo para closer sin necesitar los opcionales', () => {
    const s = computeStage(fields, { nombre: 'Ana', ciudad: 'Bogotá' });
    expect(s).toEqual({ complete: true, label: STAGE_READY, missing: [] });
  });

  it('los valores vacíos no cuentan como guardados', () => {
    expect(computeStage(fields, { nombre: 'Ana', ciudad: '  ' }).complete).toBe(false);
    expect(computeStage(fields, null).missing).toEqual(['nombre', 'ciudad']);
  });

  it('sin datos obligatorios definidos nunca queda listo', () => {
    expect(computeStage([], { a: 'x' }).complete).toBe(false);
  });
});

describe('phoneFromContactId', () => {
  it('devuelve el número cuando el identificador es un teléfono', () => {
    expect(phoneFromContactId('573059357319')).toBe('573059357319');
    expect(phoneFromContactId('573059357319@s.whatsapp.net')).toBe('573059357319');
    expect(phoneFromContactId('447710173736')).toBe('447710173736');
  });

  it('no inventa un teléfono para los @lid ni para identificadores de prueba', () => {
    expect(phoneFromContactId('158621866397825@lid')).toBeNull();
    expect(phoneFromContactId('test_claude_diag')).toBeNull();
    expect(phoneFromContactId('')).toBeNull();
    expect(phoneFromContactId(null)).toBeNull();
  });
});

import { isApplicable } from './lead-stage';

describe('datos condicionales por programa', () => {
  const fields = [
    { key: 'programa', label: 'Programa', required: true },
    { key: 'ciudad', label: 'Ciudad', required: true },
    { key: 'posicion', label: 'Posición y club', required: true, only_when: { field: 'programa', in: ['CLAN Football Academy', 'Cantera CLAN'] } },
  ];

  it('un dato condicional no aplica si el programa es otro, ni mientras el programa se desconoce', () => {
    expect(isApplicable(fields[2], { programa: 'CLAN Atelier' })).toBe(false);
    expect(isApplicable(fields[2], {})).toBe(false);
    expect(isApplicable(fields[2], { programa: '  cantera clan ' })).toBe(true);
    expect(isApplicable(fields[0], {})).toBe(true);
  });

  it('Atelier queda "Listo para closer" sin el dato de fútbol', () => {
    expect(computeStage(fields, { programa: 'CLAN Atelier', ciudad: 'Bogotá' }).complete).toBe(true);
  });

  it('fútbol sí exige el dato de fútbol', () => {
    const s = computeStage(fields, { programa: 'Cantera CLAN', ciudad: 'Bogotá' });
    expect(s.complete).toBe(false);
    expect(s.missing).toEqual(['posicion']);
    expect(computeStage(fields, { programa: 'Cantera CLAN', ciudad: 'Bogotá', posicion: 'Delantero, Millonarios' }).complete).toBe(true);
  });
});
