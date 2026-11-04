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

/**
 * Si el texto empieza por un bloque { ... } con llaves balanceadas (con o sin paréntesis o ```json), lo devuelve
 * sin ese bloque. Soporta anidación, p. ej. {"tool_uses":[{"parameters":{...}}]}. Solo cuenta si parece
 * argumentos (hay pares clave: valor); si no, no toca nada.
 */
function stripLeadingBlock(input: string): string | null {
  let s = input.replace(/^\s+/, '');
  let fenced = false;
  const fence = s.match(/^```[A-Za-z]*[ \t]*\n?/);
  if (fence) { s = s.slice(fence[0].length); fenced = true; }
  let paren = false;
  if (s.startsWith('(')) { paren = true; s = s.slice(1).replace(/^\s+/, ''); }
  if (!s.startsWith('{')) return null;

  let depth = 0;
  let inStr: string | null = null;
  let end = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"') inStr = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { end = i; break; }
  }
  if (end < 0) return null;
  const block = s.slice(0, end + 1);
  if (!/[A-Za-z_]["']?\s*:/.test(block)) return null;

  let rest = s.slice(end + 1);
  if (paren) rest = rest.replace(/^\s*\)/, '');
  if (fenced) rest = rest.replace(/^\s*```/, '');
  return rest.replace(/^[ \t]+/, '');
}

/** Una línea de restos de argumentos: termina en "}" y no tiene aspecto de frase (p. ej. `Atelier"}`). */
const isResidueLine = (line: string) => /\}\)?\s*$/.test(line) && line.length <= 200 && !/[¿?¡!.]/.test(line);

function strip(text: string): { out: string; removed: boolean } {
  let body = text ?? '';
  let removed = false;
  // 1) Nombre de herramienta escrito como texto ("functions.save_customer_info ...")
  LEAKED_TOOL_CALL.lastIndex = 0;
  if (LEAKED_TOOL_CALL.test(body)) removed = true;
  body = body.replace(LEAKED_TOOL_CALL, ' ').replace(/^\s+/, '');
  // 2) Bloques de argumentos al inicio (puede haber más de uno)
  for (let i = 0; i < 5; i++) {
    const rest = stripLeadingBlock(body);
    if (rest === null) break;
    body = rest; removed = true;
  }
  // 3) Bloque { ... } simple al inicio (formato anterior)
  for (let i = 0; i < 5 && LEAKED_ARGS_BLOCK.test(body); i++) { body = body.replace(LEAKED_ARGS_BLOCK, ''); removed = true; }
  // 4) Primeras líneas que son solo restos de argumentos
  for (let i = 0; i < 3; i++) {
    const nl = body.indexOf('\n');
    const first = (nl < 0 ? body : body.slice(0, nl)).trim();
    if (first && nl >= 0 && isResidueLine(first)) { body = body.slice(nl + 1); removed = true; } else break;
  }
  const out = body
    .replace(/^[ \t]+/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return { out, removed };
}

/** Quita llamadas a herramientas filtradas como texto. Devuelve el mensaje listo para enviar. */
export function stripLeakedToolText(text: string): string {
  return strip(text).out || EMPTY_REPLY_FALLBACK;
}

export const hasLeakedToolText = (text: string): boolean => strip(text).removed;

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
