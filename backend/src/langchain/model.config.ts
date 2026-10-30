/**
 * Modelo de OpenAI de respaldo cuando el agente no define `model` ni hay OPENAI_MODEL.
 * Se mantiene en un solo lugar para poder cambiarlo cuando OpenAI retire un modelo.
 */
export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';

/** Prioridad: modelo del agente > variable de entorno OPENAI_MODEL > modelo de respaldo. */
export function resolveModelName(agentModel?: string | null, envModel?: string | null): string {
  return agentModel?.trim() || envModel?.trim() || DEFAULT_OPENAI_MODEL;
}
