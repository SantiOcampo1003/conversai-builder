import { DataField } from '../common/types/agent.types';
import { phoneFromContactId } from '../langchain/lead-stage';

export interface Recipient {
  /** Valor del campo de enrutamiento para el que aplica este destinatario; vacío o "*" = todos. */
  match_value: string | null;
  phone: string;
  label?: string | null;
  enabled?: boolean;
}

/** Deja solo dígitos; un celular colombiano de 10 dígitos (empieza por 3) recibe el prefijo 57. */
export function normalizePhone(input: string): string | null {
  let d = (input ?? '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('3')) d = `57${d}`;
  return d.length >= 8 && d.length <= 15 ? d : null;
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
const isWildcard = (m: string | null | undefined) => !m || m.trim() === '' || m.trim() === '*';

/**
 * A quién avisar. Con campo de enrutamiento: primero los destinatarios cuyo valor coincide con el del contacto;
 * si ninguno coincide, los de "todos". Sin campo de enrutamiento: todos los activos.
 */
export function pickRecipients(
  recipients: Recipient[],
  routeField: string | null | undefined,
  leadData: Record<string, unknown> | null | undefined,
): Recipient[] {
  const active = recipients.filter((r) => r.enabled !== false && normalizePhone(r.phone));
  if (!routeField) return active;
  const value = norm((leadData ?? {})[routeField]);
  const exact = active.filter((r) => !isWildcard(r.match_value) && norm(r.match_value) === value);
  return exact.length > 0 ? exact : active.filter((r) => isWildcard(r.match_value));
}

/** Lista "Etiqueta: valor" con los datos guardados, en el orden de las columnas del agente. */
export function buildSummary(fields: DataField[], data: Record<string, unknown>): string {
  return fields
    .filter((f) => String(data[f.key] ?? '').trim() !== '')
    .map((f) => `• ${f.label}: ${String(data[f.key]).trim()}`)
    .join('\n');
}

export interface TemplateContext {
  fields: DataField[];
  data: Record<string, unknown>;
  /** Identificador de WhatsApp del contacto (número real o @lid). */
  contactId: string;
}

/**
 * Reemplaza {{variable}}. Variables: cualquier clave de "Datos a recoger", más
 * {{resumen}} (todos los datos), {{telefono}} (número real de WhatsApp si se conoce) y
 * {{whatsapp_link}} (enlace wa.me al chat). Una variable desconocida o vacía queda en blanco.
 */
export function renderTemplate(template: string, ctx: TemplateContext): string {
  const phone = phoneFromContactId(ctx.contactId);
  const vars: Record<string, string> = {
    resumen: buildSummary(ctx.fields, ctx.data),
    telefono: phone ? `+${phone}` : '',
    whatsapp_link: phone ? `https://wa.me/${phone}` : '',
  };
  for (const f of ctx.fields) vars[f.key] = String(ctx.data[f.key] ?? '').trim();
  return (template ?? '')
    .replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_m, key: string) => vars[key] ?? '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const DEFAULT_TEMPLATE = `Hola 👋 Se cerró un nuevo contacto y ya puedes gestionarlo.

{{resumen}}

WhatsApp del contacto: {{whatsapp_link}}`;
