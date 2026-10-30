/**
 * Modelo de OpenAI de respaldo cuando el agente no define `model` ni hay OPENAI_MODEL.
 * Se mantiene en un solo lugar para poder cambiarlo cuando OpenAI retire un modelo.
 */
export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';

/** Prioridad: modelo del agente > variable de entorno OPENAI_MODEL > modelo de respaldo. */
export function resolveModelName(agentModel?: string | null, envModel?: string | null): string {
  return agentModel?.trim() || envModel?.trim() || DEFAULT_OPENAI_MODEL;
}

/** Temperatura por defecto: baja, porque los agentes siguen flujos de pasos fijos y guardan datos. */
export const DEFAULT_TEMPERATURE = 0.3;

/** Prioridad: agents.temperature > variable OPENAI_TEMPERATURE > 0.3. Ignora valores no numéricos o fuera de [0, 2]. */
export function resolveTemperature(agentTemp?: number | null, envTemp?: string | number | null): number {
  const valid = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 2;
  if (valid(agentTemp)) return agentTemp;
  const parsed = typeof envTemp === 'string' ? (envTemp.trim() === '' ? NaN : Number(envTemp)) : envTemp;
  if (valid(parsed)) return parsed;
  return DEFAULT_TEMPERATURE;
}
