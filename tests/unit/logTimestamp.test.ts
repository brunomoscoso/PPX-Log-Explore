import { describe, expect, it } from 'vitest';
import { parseLogTimestamp } from '../../src/services/logTimestamp';

describe('parseLogTimestamp', () => {
  it('interpreta todos os campos, incluindo milissegundos', () => {
    expect(parseLogTimestamp('2026/10/26 14:34:13.996')).toBe(Date.UTC(2026, 9, 26, 14, 34, 13, 996));
  });

  it('distingue milissegundos consecutivos', () => {
    const start = parseLogTimestamp('2026/10/26 14:35:00.999')!;
    const end = parseLogTimestamp('2026/10/26 14:35:01.000')!;
    expect(end - start).toBe(1);
  });

  it('compara horários de dias diferentes', () => {
    expect(parseLogTimestamp('2026/10/27 00:00:00.000')! - parseLogTimestamp('2026/10/26 23:59:59.999')!).toBe(1);
  });

  it('não aplica transições de horário de verão ao calendário escrito', () => {
    // Em Lisboa, o relógio muda neste dia. A escala do parser permanece contínua.
    expect(parseLogTimestamp('2026/03/29 02:30:00.000')! - parseLogTimestamp('2026/03/29 00:30:00.000')!).toBe(7_200_000);
    expect(parseLogTimestamp('2026/10/25 02:30:00.000')! - parseLogTimestamp('2026/10/25 00:30:00.000')!).toBe(7_200_000);
  });

  it('aceita dias bissextos válidos e anos inferiores a 100 sem os remapear', () => {
    expect(parseLogTimestamp('2024/02/29 12:00:00.000')).not.toBeNull();
    expect(parseLogTimestamp('2000/02/29 12:00:00.000')).not.toBeNull();
    const ancient = new Date(parseLogTimestamp('0099/01/01 00:00:00.000')!);
    expect(ancient.getUTCFullYear()).toBe(99);
  });

  it.each([
    '', '2026-10-26 14:34:13.996', '2026/10/26T14:34:13.996',
    '2026/10/26 14:34:13', '2026/10/26 14:34:13.99',
    '2026/10/26 14:34:13.9999', '2026/1/26 14:34:13.996',
    '2026/10/26 14:34:13.996Z', ' 2026/10/26 14:34:13.996',
    '2026/10/26 14:34:13.996\n', '0000/01/01 00:00:00.000',
    '2026/00/26 14:34:13.996', '2026/13/26 14:34:13.996',
    '2026/10/00 14:34:13.996', '2026/10/32 14:34:13.996',
    '2026/04/31 14:34:13.996', '2026/02/29 14:34:13.996',
    '1900/02/29 14:34:13.996', '2026/10/26 24:00:00.000',
    '2026/10/26 14:60:00.000', '2026/10/26 14:34:60.000',
  ])('rejeita timestamps inválidos: %j', (text) => {
    expect(parseLogTimestamp(text)).toBeNull();
  });
});
