/** Mensajes de historial que se le pasan al modelo en cada respuesta. */
export const DEFAULT_HISTORY_LIMIT = 30;
export const MAX_HISTORY_LIMIT = 100;

/**
 * Prioridad: variable CHAT_HISTORY_LIMIT > 30. Valores no numéricos o menores a 1 se ignoran; se limita a 100.
 * Con 10 mensajes, un flujo de ~15 pasos olvidaba el programa elegido al llegar al cierre.
 */
export function resolveHistoryLimit(env?: string | number | null): number {
  const n = typeof env === 'string' ? (env.trim() === '' ? NaN : Number(env)) : env;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 1) return DEFAULT_HISTORY_LIMIT;
  return Math.min(Math.floor(n), MAX_HISTORY_LIMIT);
}
