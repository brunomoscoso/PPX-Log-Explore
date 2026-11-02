import { describe, expect, it } from 'vitest';
import { EMPTY_RANGE, filterEvents, getSuggestedRange, parseRange } from '../../src/services/logFilter';
import { parseLog } from '../../src/services/logParser';
import { syntheticLog } from '../fixtures/syntheticLogs';

const range = { startDate: '2026-10-26', startTime: '14:34:00', endDate: '2026-10-26', endTime: '14:35:00' };
const event = (timestamp: string, message = 'Synthetic') => `${timestamp}|INFO|[1]|||123|Example - ${message}\r\n`;

describe('filtragem cronológica', () => {
  it('inclui o segundo final completo e exclui os eventos imediatamente exteriores', () => {
    const events = parseLog([
      '2026/10/26 14:33:59.999', '2026/10/26 14:34:00.000',
      '2026/10/26 14:35:00.000', '2026/10/26 14:35:00.999', '2026/10/26 14:35:01.000',
    ].map((time) => event(time)).join('')).events;
    expect(filterEvents(events, range).map((item) => item.timestampText)).toEqual([
      '2026/10/26 14:34:00.000', '2026/10/26 14:35:00.000', '2026/10/26 14:35:00.999',
    ]);
  });

  it('pesquisa entre dias diferentes sem conversões locais de horário', () => {
    const events = parseLog(syntheticLog).events;
    expect(filterEvents(events, { ...range, endDate: '2026-10-27', endTime: '00:00:00' })).toHaveLength(3);
  });

  it('ordena cronologicamente, preserva empates e não altera o array original', () => {
    const events = parseLog(event('2026/10/26 14:35:00.001', 'last') + event('2026/10/26 14:34:00.001', 'first') + event('2026/10/26 14:34:00.001', 'second')).events;
    const before = [...events];
    // Mesmo com o array recebido fora da ordem de origem, o desempate usa a posição.
    expect(filterEvents([...events].reverse(), range).map((item) => item.message)).toEqual(['first\r\n', 'second\r\n', 'last\r\n']);
    expect(events).toEqual(before);
  });

  it('aceita início e fim no mesmo segundo', () => {
    const events = parseLog(event('2026/10/26 14:35:00.000') + event('2026/10/26 14:35:00.999')).events;
    expect(filterEvents(events, { ...range, startTime: '14:35:00' })).toHaveLength(2);
  });

  it('aceita a representação HH:mm de controlos nativos com segundos zero', () => {
    expect(parseRange({ ...range, startTime: '14:34', endTime: '14:35' })).toEqual(parseRange(range));
  });

  it('devolve uma lista vazia quando não há correspondências', () => {
    expect(filterEvents(parseLog(syntheticLog).events, { ...range, startTime: '00:00:00', endTime: '00:01:00' })).toEqual([]);
    expect(filterEvents([], range)).toEqual([]);
  });

  it.each([
    EMPTY_RANGE, { ...range, startDate: '2026-02-30' }, { ...range, endTime: '25:00:00' },
    { ...range, startTime: '14:34:00.001' }, { ...range, startDate: '26/10/2026' },
  ])('rejeita campos inválidos: %j', (input) => {
    expect(() => parseRange(input)).toThrow('valores válidos');
  });

  it('rejeita um fim anterior ao início', () => {
    expect(() => parseRange({ ...range, endTime: '14:33:59' })).toThrow('anteriores');
    expect(() => parseRange({ ...range, endDate: '2026-10-25' })).toThrow('anteriores');
  });

  it('sugere o mínimo e máximo, mesmo que o ficheiro esteja desordenado', () => {
    expect(getSuggestedRange(parseLog(syntheticLog).events.reverse())).toEqual({
      startDate: '2026-10-26', startTime: '14:34:13', endDate: '2026-10-27', endTime: '00:00:00',
    });
    expect(getSuggestedRange([])).toBeNull();
  });
});
