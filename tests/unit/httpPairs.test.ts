import { describe, expect, it } from 'vitest';
import { parseLog } from '../../src/services/logParser';
import { buildHttpPairs } from '../../src/services/httpPairs';
import { filterEvents } from '../../src/services/logFilter';
import { serializeEvents } from '../../src/services/logExporter';
import { httpRequest, httpResponse } from '../fixtures/httpLogs';

const range = { startDate: '2026-10-26', endDate: '2026-10-26', startTime: '14:34:00', endTime: '14:34:01' };

describe('pesquisa com request e response correlacionadas', () => {
  it('encontra pelo campo da request e inclui response fora do intervalo, preservando os originais', () => {
    const request = httpRequest();
    const response = httpResponse('synthetic-a', '{}', '14:35:00.000', 'OK');
    const events = parseLog(request + response).events;
    const before = structuredClone(events);
    const results = filterEvents(events, range, [{ field: 'articleCode', value: 'ITEM-A' }]);
    expect(results).toHaveLength(2);
    expect(results[1]?.searchContext).toMatchObject({ includedByCorrelation: true, outsideRange: true, relatedLineNumber: 1 });
    expect(serializeEvents(results)).toBe(request + response);
    expect(events).toEqual(before);
  });
  it('encontra pelo campo da response e inclui apenas a request dessa chamada, mesmo com ID reutilizado', () => {
    const request = httpRequest('same', 'application/json', { articleCode: 'FIRST' }, '14:33:00.000');
    const response = httpResponse('same');
    const second = httpRequest('same', 'application/json', { articleCode: 'SECOND' }, '14:34:02.000') + httpResponse('same', '{}', '14:34:03.000');
    const events = parseLog(request + response + second).events;
    const results = filterEvents(events, range, [{ field: 'promotion', value: 'PROMO-A' }]);
    expect(serializeEvents(results)).toBe(request + response);
    expect(results[0]?.searchContext).toMatchObject({ includedByCorrelation: true, outsideRange: true });
  });
  it('deduplica quando ambas correspondem e suporta pares intercalados', () => {
    const events = parseLog(httpRequest('a') + httpRequest('b') + httpResponse('b') + httpResponse('a')).events;
    const results = filterEvents(events, range);
    expect(results).toHaveLength(4);
    expect(new Set(results.map((event) => event.id)).size).toBe(4);
    expect(results.every((event) => !event.searchContext?.includedByCorrelation)).toBe(true);
    const pairs = buildHttpPairs(events);
    expect(pairs.get(events[0]!.id)?.id).toBe(events[3]!.id);
    expect(pairs.get(events[2]!.id)?.id).toBe(events[1]!.id);
  });
  it('não acrescenta mensagens com outro ID, ID ausente ou associação ambígua', () => {
    for (const input of [httpRequest('a') + httpResponse('b'), httpRequest('') + httpResponse(''), httpRequest('a') + httpRequest('a') + httpResponse('a')]) {
      const results = filterEvents(parseLog(input).events, range, [{ field: 'promotion', value: 'PROMO-A' }]);
      expect(results.map((event) => event.type)).toEqual(['response']);
    }
  });
  it('usa o índice completo mesmo que a outra mensagem não pertença ao conjunto inicial', () => {
    const events = parseLog(httpRequest() + httpResponse()).events;
    const results = filterEvents([events[1]!], range, [{ field: 'promotion', value: 'PROMO-A' }], buildHttpPairs(events));
    expect(results.map((event) => event.type)).toEqual(['request', 'response']);
  });
});
