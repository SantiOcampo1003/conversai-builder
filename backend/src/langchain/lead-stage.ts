import { DataField } from '../common/types/agent.types';

/** Etapas de un contacto, iguales para todos los agentes. */
export const STAGE_IN_PROGRESS = 'En conversación';
export const STAGE_READY = 'Listo para closer';

export interface LeadStage {
  /** true cuando todos los datos obligatorios del agente están guardados. */
  complete: boolean;
  label: string;
  /** Claves de los datos obligatorios que aún faltan. */
  missing: string[];
}

const hasValue = (v: unknown) => (typeof v === 'string' ? v.trim() !== '' : v != null && String(v).trim() !== '');

/** Etapa según los datos guardados: "Listo para closer" solo cuando no falta ningún dato obligatorio. */
export function computeStage(fields: DataField[], additional: Record<string, unknown> | null | undefined): LeadStage {
  const data = additional ?? {};
  const required = fields.filter((f) => f.required !== false);
  const missing = required.filter((f) => !hasValue(data[f.key])).map((f) => f.key);
  const complete = required.length > 0 && missing.length === 0;
  return { complete, label: complete ? STAGE_READY : STAGE_IN_PROGRESS, missing };
}

/**
 * Teléfono real a partir del identificador de WhatsApp.
 * "573059357319" o "573059357319@s.whatsapp.net" -> "573059357319". Los "@lid" NO son teléfonos -> null.
 */
export function phoneFromContactId(contactId: string | null | undefined): string | null {
  const id = (contactId ?? '').trim();
  if (id.includes('@lid')) return null;
  const digits = id.replace(/@.*$/, '');
  return /^\d{8,15}$/.test(digits) ? digits : null;
}
