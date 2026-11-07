import { describe, expect, it } from 'vitest';
import { buildHttpErrorCalls, errorCallEvents, filterHttpErrorCalls, httpErrorStatus } from '../../src/services/httpErrors';
import { parseLog } from '../../src/services/logParser';
import { serializeEvents } from '../../src/services/logExporter';
import { httpRequest, httpResponse } from '../fixtures/httpLogs';

const calls = (text: string) => buildHttpErrorCalls(parseLog(text).events);
const failure = (id = 'a', time = '14:34:01.000', status = 'BadRequest') => httpResponse(id, '{"promotion":"PROMO-A"}', time, status);
const range = { startDate: '2026-10-26', endDate: '2026-10-26', startTime: '14:34:01', endTime: '14:34:01' };

describe('chamadas HTTP com erro', () => {
  it.each([['400', 400], ['404 Not Found', 404], ['HTTP/1.1 503 Service Unavailable', 503], ['599', 599],
    ['BadRequest', 400], ['NotFound', 404], ['InternalServerError', 500], ['HttpStatusCode.GatewayTimeout', 504],
    ['TooManyRequests', 429], ['UnprocessableEntity', 422]] as const)('identifica %s', (value, code) => {
    expect(httpErrorStatus(value)).toBe(code);
  });
  it.each(['Created', 'OK', '200', '302 Found', '600', '4000', 'erro 404 no body', 'constructor', '', undefined])('não classifica %s como erro HTTP', (value) => {
    expect(httpErrorStatus(value)).toBeUndefined();
  });
  it('usa o horário da response e mantém a request anterior ao intervalo na exportação', () => {
    const request = httpRequest('a', 'application/json', { articleCode: 'ITEM-A' }, '14:33:00.000');
    const response = failure('a', '14:34:01.999');
    const selected = filterHttpErrorCalls(calls(request + response), range, []);
    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({ statusCode: 400, requestOutsideRange: true, request: { raw: request }, response: { raw: response } });
    expect(serializeEvents(errorCallEvents(selected))).toBe(request + response);
    expect(filterHttpErrorCalls(calls(request + failure('a', '14:34:02.000')), range, [])).toHaveLength(0);
  });
  it('associa IDs reutilizados apenas depois de consumir a response anterior, incluindo sucessos', () => {
    const first = httpRequest('a');
    const second = httpRequest('a', 'application/json', { articleCode: 'SECOND' }, '14:34:02.000');
    const result = calls(first + httpResponse('a') + second + failure('a', '14:34:03.000') + failure('a', '14:34:04.000'));
    expect(result).toHaveLength(2);
    expect(result[0]?.request?.raw).toBe(second);
    expect(result[1]?.request).toBeUndefined();
  });
  it('associa chamadas intercaladas por ID e não por proximidade ou thread', () => {
    const requestA = httpRequest('a');
    const requestB = httpRequest('b');
    const result = calls(requestA + requestB + failure('b') + failure('a'));
    expect(result.map((call) => call.request?.raw)).toEqual([requestB, requestA]);
  });
  it('preserva responses com IDs ambíguos ou ausentes sem inventar pares', () => {
    const result = calls(httpRequest('a') + httpRequest('a') + failure('a') + failure('a') + failure('missing') + failure(''));
    expect(result).toHaveLength(4);
    expect(result.every((call) => call.request === undefined)).toBe(true);
    const next = httpRequest('a', 'application/json', { articleCode: 'NEXT' }, '14:34:02.000');
    expect(calls(httpRequest('a') + httpRequest('a') + failure('a') + failure('a') + next + failure('a', '14:34:03.000')).at(-1)?.request?.raw).toBe(next);
  });
  it('não associa uma request com horário posterior nem uma request registada depois da response', () => {
    expect(calls(httpRequest('a', 'application/json', { articleCode: 'A' }, '14:34:05.000') + failure('a'))[0]?.request).toBeUndefined();
    expect(calls(failure('a') + httpRequest('a'))[0]?.request).toBeUndefined();
  });
  it('inclui erros com body não JSON e ignora códigos de erro presentes apenas no body', () => {
    const result = calls(httpRequest('a', 'text/plain') + httpResponse('a', '<html>Error</html>', '14:34:01.000', '500') + httpResponse('b', '{"status":404}'));
    expect(result).toHaveLength(1);
    expect(result[0]?.request).toBeDefined();
  });
  it('filtra os campos na request ou response sem combinar critérios de eventos distintos', () => {
    const result = calls(httpRequest('a') + failure('a'));
    expect(filterHttpErrorCalls(result, range, [{ field: 'articleCode', value: 'ITEM-A' }])).toHaveLength(1);
    expect(filterHttpErrorCalls(result, range, [{ field: 'promotion', value: 'PROMO-A' }])).toHaveLength(1);
    expect(filterHttpErrorCalls(result, range, [{ field: 'articleCode', value: 'ITEM-A' }, { field: 'promotion', value: 'PROMO-A' }])).toHaveLength(0);
    expect(() => filterHttpErrorCalls(result, range, [{ field: 'articleCode', value: '' }])).toThrow();
  });
});
