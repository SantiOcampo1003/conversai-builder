import { DataField } from '../common/types/agent.types';
import { isApplicable } from './lead-stage';

/**
 * Extractor de datos: lee el mensaje de la persona y saca los datos que contiene, ANTES de que el agente
 * conversador responda. Así el guardado no depende de que el modelo grande decida llamar la herramienta
 * (con gpt-4.1-mini lo hacía en ~2 de cada 10 primeros mensajes) y el agente ya ve el estado actualizado.
 */

/** Valores que no son datos reales aunque el modelo los devuelva. */
const EMPTY_LIKE = /^(null|none|n\/a|na|ninguno|ninguna|desconocido|undefined|no especificado|no especifica|no indica|no sé|no se|sin dato|-|ok|okey|okay|vale|dale|listo|gracias|muchas gracias|claro|bueno|perfecto|hola|buenas)$/i;

/** Valor interno cuando la persona se niega explícitamente a dar un dato que se le acaba de preguntar. */
export const REFUSED_VALUE = 'No quiso decirlo';

const hasValue = (v: unknown) => v != null && String(v).trim() !== '';

/** Datos del agente que todavía no tienen valor guardado (solo estos se piden al extractor). */
export function pendingFields(fields: DataField[], saved: Record<string, unknown> | null | undefined): DataField[] {
  const data = saved ?? {};
  return fields.filter((f) => isApplicable(f, data) && !hasValue(data[f.key]));
}

export interface ExtractorInput {
  fields: DataField[];
  userMessage: string;
  /** Último mensaje del agente: da contexto a respuestas cortas ("b1", "tarde", "sí"). */
  lastAssistant?: string | null;
  saved?: Record<string, unknown> | null;
}

export function buildExtractorPrompt(input: ExtractorInput): { system: string; user: string } {
  const list = input.fields
    .map((f) => `- ${f.key}: ${f.label}${f.description ? ` (${f.description})` : ''}`)
    .join('\n');
  const saved = Object.entries(input.saved ?? {})
    .filter(([, v]) => hasValue(v))
    .map(([k, v]) => `- ${k}: ${String(v).slice(0, 120)}`)
    .join('\n');

  const system = `Eres un extractor de datos para un chat de WhatsApp. Lees el ÚLTIMO mensaje de la persona y devuelves SOLO los datos que contiene.

Reglas:
- Usa únicamente lo que la persona dijo en ese mensaje, o lo que responde directamente a la última pregunta del asistente (ej. el asistente preguntó el nivel de inglés y la persona dice "b1").
- NO inventes, NO completes y NO deduzcas. Si un dato no aparece de forma clara, devuélvelo como null.
- Copia el valor como lo dijo la persona (nombres completos con todos sus apellidos). Nada de explicaciones.
- Si el valor depende de una lista cerrada (la descripción dice "uno de: …"), devuelve exactamente uno de esos valores solo si la persona lo nombra de forma explícita; si no, null.
- Un saludo, una pregunta, un agradecimiento o un "ok" sin dato NO es un dato: devuelve todo en null.
- Si la persona se niega de forma explícita a dar el dato que el asistente acaba de preguntar ("prefiero no decirlo", "no quiero dar eso"), devuelve exactamente "No quiso decirlo" para ESE dato y null para los demás.

Datos que puedes extraer:
${list}`;

  const user = `${saved ? `Ya guardado (no lo repitas):\n${saved}\n\n` : ''}Último mensaje del asistente:\n${(input.lastAssistant ?? '(ninguno todavía)').slice(0, 600)}\n\nÚltimo mensaje de la persona:\n${input.userMessage.slice(0, 800)}`;
  return { system, user };
}

/** Deja solo claves permitidas con valores reales (texto no vacío, razonable, sin "null"/"no especificado"). */
export function cleanExtraction(raw: Record<string, unknown> | null | undefined, allowedKeys: string[]): Record<string, string> {
  const allowed = new Set(allowedKeys);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (!allowed.has(key) || typeof value !== 'string') continue;
    const v = value.trim();
    if (!v || v.length > 200 || EMPTY_LIKE.test(v)) continue;
    out[key] = v;
  }
  return out;
}

/** Función que ejecuta la extracción (con el modelo). Se inyecta para poder probar sin llamar a OpenAI. */
export type ExtractorRunner = (system: string, user: string, keys: string[]) => Promise<Record<string, unknown>>;

/** Datos extraídos del mensaje, ya limpios. Si no hay nada que extraer o falla, devuelve {}. */
export async function extractData(input: ExtractorInput, run: ExtractorRunner): Promise<Record<string, string>> {
  const pending = pendingFields(input.fields, input.saved);
  if (pending.length === 0 || input.userMessage.trim().length < 2) return {};
  const { system, user } = buildExtractorPrompt({ ...input, fields: pending });
  const raw = await run(system, user, pending.map((f) => f.key));
  return cleanExtraction(raw, pending.map((f) => f.key));
}
