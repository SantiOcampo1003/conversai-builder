import { buildHeaderRow, buildLeadRow, columnLetter, parseSpreadsheetId, quoteSheetName, safeCell } from './sheet-format';

const fields = [
  { key: 'nombre', label: 'Nombre del talento', required: true },
  { key: 'edad', label: 'Edad', required: true },
];

describe('sheet-format', () => {
  it('parseSpreadsheetId acepta enlace completo o id', () => {
    const id = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abc';
    expect(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`)).toBe(id);
    expect(parseSpreadsheetId(id)).toBe(id);
    expect(parseSpreadsheetId('hola')).toBeNull();
    expect(parseSpreadsheetId('')).toBeNull();
  });

  it('el encabezado son 4 columnas fijas + una por dato, en orden', () => {
    expect(buildHeaderRow(fields)).toEqual(['Fecha de creación', 'Última actualización', 'Contacto', 'Teléfono', 'Etapa', 'Nombre del talento', 'Edad']);
  });

  it('la fila sigue el orden de las columnas y deja vacío lo que falta', () => {
    const row = buildLeadRow(
      { customer_id: '573001@lid', status: 'contacted', created_at: '2026-11-04T12:00:00Z', updated_at: '2026-11-04T12:05:00Z', additional_fields: { nombre: 'Ana Pérez' } },
      fields,
    );
    expect(row).toHaveLength(7);
    expect(row.slice(2)).toEqual(['573001@lid', '', 'En conversación', 'Ana Pérez', '']);
  });

  it('con teléfono real lo muestra, y marca "Listo para closer" cuando no falta nada', () => {
    const row = buildLeadRow(
      { customer_id: '573059357319', status: 'contacted', created_at: '2026-11-04T12:00:00Z', updated_at: '2026-11-04T12:05:00Z', additional_fields: { nombre: 'Ana Pérez', edad: '12 años' } },
      fields,
    );
    expect(row.slice(2)).toEqual(['573059357319', '573059357319', 'Listo para closer', 'Ana Pérez', '12 años']);
  });

  it('safeCell neutraliza fórmulas', () => {
    expect(safeCell('=IMPORTXML("x")')).toBe(`'=IMPORTXML("x")`);
    expect(safeCell('+57 300')).toBe(`'+57 300`);
    expect(safeCell('normal')).toBe('normal');
    expect(safeCell(null)).toBe('');
  });

  it('columnLetter y quoteSheetName', () => {
    expect([1, 26, 27, 52, 53].map(columnLetter)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA']);
    expect(quoteSheetName("Leads d'CLAN")).toBe("'Leads d''CLAN'");
  });
});
