import { DataField } from '../common/types/agent.types';
import { computeStage, phoneFromContactId } from '../langchain/lead-stage';

export const FIXED_HEADERS = ['Fecha de creación', 'Última actualización', 'Contacto', 'Teléfono', 'Etapa'] as const;
/** Columna (0-based) donde va el contacto: es la clave para encontrar la fila de cada persona. */
export const CONTACT_COLUMN_INDEX = 2;

export interface LeadForSheet {
  customer_id: string;
  status: string | null;
  created_at: string;
  updated_at: string;
  additional_fields: Record<string, unknown> | null;
}

/** Acepta el enlace completo de Google Sheets o el id solo, y devuelve el id (o null). */
export function parseSpreadsheetId(input: string): string | null {
  const text = (input ?? '').trim();
  const fromUrl = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
  if (fromUrl) return fromUrl[1];
  return /^[a-zA-Z0-9-_]{20,}$/.test(text) ? text : null;
}

export function buildHeaderRow(fields: DataField[]): string[] {
  return [...FIXED_HEADERS, ...fields.map((f) => f.label)];
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' });

/** Texto seguro para Sheets: evita que "=..." o "+..." se interprete como fórmula. */
export function safeCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function buildLeadRow(lead: LeadForSheet, fields: DataField[]): string[] {
  const data = lead.additional_fields ?? {};
  return [
    fmtDate(lead.created_at),
    fmtDate(lead.updated_at),
    safeCell(lead.customer_id),
    safeCell(phoneFromContactId(lead.customer_id) ?? ''),
    computeStage(fields, data).label,
    ...fields.map((f) => safeCell(data[f.key])),
  ];
}

/** Letra de columna A1 a partir de un número de columnas: 1 -> A, 27 -> AA. */
export function columnLetter(n: number): string {
  let s = '';
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

/** Nombre de pestaña entre comillas simples, para usarlo dentro de un rango A1. */
export function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}
