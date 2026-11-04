import { Agent, DataField } from '../common/types/agent.types';

/** Clave técnica estable a partir de un texto libre: "Nombre del talento" -> "nombre_del_talento". */
export function slugifyKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

/** "nombre_talento" -> "Nombre talento" (encabezado por defecto para agentes antiguos). */
export function humanizeKey(key: string): string {
  const text = key.replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : key;
}

/**
 * Lista de datos que recoge el agente: única fuente de verdad para la herramienta de guardado,
 * el estado del cliente, el prompt y las columnas de Excel / Google Sheets.
 *
 * - Si el agente tiene `data_fields`, se usa (se limpian claves vacías o repetidas).
 * - Si no, se derivan de `required_info` (agentes antiguos) con el encabezado a partir de la clave.
 */
export function resolveDataFields(
  agent: Pick<Agent, 'data_fields' | 'required_info'>,
): DataField[] {
  const seen = new Set<string>();
  const out: DataField[] = [];

  const push = (field: Partial<DataField>) => {
    const key = slugifyKey(String(field.key ?? field.label ?? ''));
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({
      key,
      label: String(field.label ?? '').trim() || humanizeKey(key),
      description: String(field.description ?? '').trim() || undefined,
      required: field.required !== false,
    });
  };

  if (Array.isArray(agent.data_fields) && agent.data_fields.length > 0) {
    agent.data_fields.forEach((f) => f && typeof f === 'object' && push(f));
  } else if (Array.isArray(agent.required_info)) {
    agent.required_info.forEach((k) => typeof k === 'string' && push({ key: k }));
  }
  return out;
}

/** El agente definió sus datos con el formato nuevo (hay descripciones que mostrarle al modelo). */
export function hasExplicitDataFields(agent: Pick<Agent, 'data_fields'>): boolean {
  return Array.isArray(agent.data_fields) && agent.data_fields.length > 0;
}

/** Sección del prompt con los datos a recoger, en orden y con lo que va en cada uno. */
export function buildDataFieldsPrompt(fields: DataField[]): string {
  if (fields.length === 0) return '';
  const lines = fields.map((f, i) => {
    const detail = f.description ? `: ${f.description}` : '';
    const req = f.required ? '' : ' (opcional)';
    return `${i + 1}. ${f.key} — ${f.label}${req}${detail}`;
  });
  return `\n=== DATOS A RECOGER (guárdalos con la herramienta, usando exactamente la clave indicada) ===
${lines.join('\n')}
• Guarda solo lo que la persona dijo, tal como lo dijo. Nunca inventes ni completes un dato.
• Los datos marcados como opcionales no se insisten: si la persona no quiere darlos, sigue adelante.
`;
}
