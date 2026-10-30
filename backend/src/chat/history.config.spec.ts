import { DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT, resolveHistoryLimit } from './history.config';

describe('resolveHistoryLimit', () => {
  it('usa 30 por defecto', () => {
    expect(resolveHistoryLimit()).toBe(DEFAULT_HISTORY_LIMIT);
    expect(resolveHistoryLimit('')).toBe(DEFAULT_HISTORY_LIMIT);
    expect(resolveHistoryLimit(null)).toBe(DEFAULT_HISTORY_LIMIT);
  });

  it('acepta números válidos como texto o número', () => {
    expect(resolveHistoryLimit('50')).toBe(50);
    expect(resolveHistoryLimit(12)).toBe(12);
  });

  it('ignora valores inválidos y limita al máximo', () => {
    expect(resolveHistoryLimit('abc')).toBe(DEFAULT_HISTORY_LIMIT);
    expect(resolveHistoryLimit('0')).toBe(DEFAULT_HISTORY_LIMIT);
    expect(resolveHistoryLimit('-5')).toBe(DEFAULT_HISTORY_LIMIT);
    expect(resolveHistoryLimit('999')).toBe(MAX_HISTORY_LIMIT);
  });
});
