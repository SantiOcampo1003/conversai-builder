import { DEFAULT_OPENAI_MODEL, resolveModelName } from './model.config';

describe('resolveModelName', () => {
  it('usa el modelo del agente si existe', () => {
    expect(resolveModelName('gpt-4.1', 'gpt-4o-mini')).toBe('gpt-4.1');
  });

  it('usa OPENAI_MODEL cuando el agente no define modelo', () => {
    expect(resolveModelName(undefined, 'modelo-env')).toBe('modelo-env');
    expect(resolveModelName(null, 'modelo-env')).toBe('modelo-env');
  });

  it('ignora valores vacíos y cae al modelo de respaldo', () => {
    expect(resolveModelName('  ', '')).toBe(DEFAULT_OPENAI_MODEL);
    expect(resolveModelName(undefined, undefined)).toBe(DEFAULT_OPENAI_MODEL);
  });

  it('el respaldo ya no es gpt-4-turbo (retirado por OpenAI)', () => {
    expect(DEFAULT_OPENAI_MODEL).not.toBe('gpt-4-turbo');
  });
});
