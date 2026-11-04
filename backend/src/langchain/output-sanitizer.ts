/**
 * El modelo a veces escribe como TEXTO una llamada a herramienta en vez de hacerla de verdad, p. ej.:
 *   "functions.save_customer_info IALOG_SESSION_ID=9a3c4a5f-... CLAN Atelier está en Bogotá..."
 * Esa línea es interna y nunca debe llegar a la persona por WhatsApp.
 */
const LEAKED_TOOL_CALL =
  /(?:^|\s)(?:to=)?functions\.[A-Za-z0-9_]+(?:\s+[A-Z][A-Z0-9_]*=\S+)*(?:\s*\{[^}\n]*\})?/g;

/**
 * Variante 2: solo los argumentos, sin el nombre de la herramienta, p. ej.
 *   ({\n programa_de_interes: "CLAN Atelier"\n})\nCLAN Atelier está en Bogotá...
 * Se reconoce un bloque { ... } (con o sin paréntesis) con pares clave: valor al INICIO del texto.
 */
const LEAKED_ARGS_BLOCK = /^\s*\(?\s*\{[^{}]*?\b[A-Za-z_][A-Za-z0-9_]*["']?\s*:\s*[^{}]*\}\s*\)?[ \t]*/;

export const EMPTY_REPLY_FALLBACK = 'Perdona, ¿me lo puedes repetir, por favor?';

/** Quita llamadas a herramientas filtradas como texto. Devuelve el mensaje listo para enviar. */
export function stripLeakedToolText(text: string): string {
  let body = text ?? '';
  // Quita bloques de argumentos sueltos al inicio (puede haber más de uno)
  for (let i = 0; i < 5 && LEAKED_ARGS_BLOCK.test(body); i++) body = body.replace(LEAKED_ARGS_BLOCK, '');
  const cleaned = body
    .replace(LEAKED_TOOL_CALL, ' ')
    .replace(/^[ \t]+/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return cleaned || EMPTY_REPLY_FALLBACK;
}

export const hasLeakedToolText = (text: string): boolean => {
  LEAKED_TOOL_CALL.lastIndex = 0;
  return LEAKED_TOOL_CALL.test(text ?? '') || LEAKED_ARGS_BLOCK.test(text ?? '');
};

/**
 * Datos que el modelo quiso guardar pero escribió como texto. Solo se aceptan claves permitidas
 * (las del agente) y valores entre comillas; no se evalúa nada. Sirve para guardarlos de verdad.
 */
export function extractLeakedArgs(text: string, allowedKeys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const allowed = new Set(allowedKeys);
  const blocks = (text ?? '').match(/\{[^{}]*\}/g) ?? [];
  for (const block of blocks.slice(0, 5)) {
    for (const m of block.matchAll(/["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g)) {
      const key = m[1];
      const value = (m[2] ?? m[3] ?? '').trim();
      if (allowed.has(key) && value) out[key] = value;
    }
  }
  return out;
}
