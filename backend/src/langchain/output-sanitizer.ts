/**
 * El modelo a veces escribe como TEXTO una llamada a herramienta en vez de hacerla de verdad, p. ej.:
 *   "functions.save_customer_info IALOG_SESSION_ID=9a3c4a5f-... CLAN Atelier está en Bogotá..."
 * Esa línea es interna y nunca debe llegar a la persona por WhatsApp.
 */
const LEAKED_TOOL_CALL =
  /(?:^|\s)(?:to=)?functions\.[A-Za-z0-9_]+(?:\s+[A-Z][A-Z0-9_]*=\S+)*(?:\s*\{[^}\n]*\})?/g;

export const EMPTY_REPLY_FALLBACK = 'Perdona, ¿me lo puedes repetir, por favor?';

/** Quita llamadas a herramientas filtradas como texto. Devuelve el mensaje listo para enviar. */
export function stripLeakedToolText(text: string): string {
  const cleaned = (text ?? '')
    .replace(LEAKED_TOOL_CALL, ' ')
    .replace(/^[ \t]+/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return cleaned || EMPTY_REPLY_FALLBACK;
}

export const hasLeakedToolText = (text: string): boolean => {
  LEAKED_TOOL_CALL.lastIndex = 0;
  return LEAKED_TOOL_CALL.test(text ?? '');
};
