import { DEFAULT_OPENAI_MODEL, DEFAULT_TEMPERATURE, resolveModelName, resolveTemperature } from './model.config';

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

describe('resolveTemperature', () => {
  it('usa la del agente, luego la variable de entorno, luego 0.3', () => {
    expect(resolveTemperature(0.9, '0.5')).toBe(0.9);
    expect(resolveTemperature(undefined, '0.5')).toBe(0.5);
    expect(resolveTemperature(null, undefined)).toBe(DEFAULT_TEMPERATURE);
  });

  it('acepta 0 como valor válido', () => {
    expect(resolveTemperature(0, '0.5')).toBe(0);
    expect(resolveTemperature(undefined, '0')).toBe(0);
  });

  it('ignora valores inválidos o fuera de rango', () => {
    expect(resolveTemperature(undefined, 'abc')).toBe(DEFAULT_TEMPERATURE);
    expect(resolveTemperature(undefined, '')).toBe(DEFAULT_TEMPERATURE);
    expect(resolveTemperature(5, '9')).toBe(DEFAULT_TEMPERATURE);
  });
});
