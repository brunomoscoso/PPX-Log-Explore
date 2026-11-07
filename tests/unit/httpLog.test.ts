import { describe, expect, it } from 'vitest';
import { parseLog } from '../../src/services/logParser';
import { selectJsonHttpEvents, splitHttpSections } from '../../src/services/httpLog';
import { filterEvents, getSuggestedRange } from '../../src/services/logFilter';
import { httpRequest, httpResponse } from '../fixtures/httpLogs';

const select = (text: string) => selectJsonHttpEvents(parseLog(text).events);

describe('modo HTTP JSON', () => {
  it.each(['\r\n', '\n', '\r'])('separa cabeçalho e body e preserva o evento original (%j)', (newline) => {
    const text = (httpRequest() + httpResponse()).replaceAll('\r\n', newline);
    const events = parseLog(text).events;
    expect(events.map((event) => event.type)).toEqual(['request', 'response']);
    expect(events[0]).toMatchObject({ level: 'DEBUG', thread: '[347]', http: { acceptsJson: true, method: 'POST' } });
    expect(events[1]).toMatchObject({ level: 'DEBUG', thread: '[29]', http: { jsonBody: true, status: 'Created' } });
    expect(events.map((event) => event.raw).join('')).toBe(text);
    const sections = splitHttpSections(events[0]!.message);
    expect(sections.header).toContain('Accept: application/json');
    expect(sections.header).not.toContain('ITEM-A');
    expect(JSON.parse(sections.body)).toEqual({ articleCode: 'ITEM-A' });
    expect(select(text).events).toHaveLength(2);
  });

  it('mantém respostas correlacionadas sem Accept, mesmo com erro ou JSON truncado', () => {
    const result = select(httpRequest() + httpResponse('synthetic-a', 'upstream error'));
    expect(result.events).toHaveLength(2);
    expect(result.unlinkedResponses).toBe(0);
  });

  it('recupera respostas JSON sem correlação, sem inventar uma associação', () => {
    const result = select(httpRequest('original') + httpResponse('different'));
    expect(result.events).toHaveLength(2);
    expect(result.unlinkedResponses).toBe(1);
    expect(select(httpResponse('orphan')).events).toHaveLength(1);
    expect(select(httpResponse('orphan', '<html>Error</html>')).events).toHaveLength(0);
  });

  it('exclui logs comuns, pedidos internos e requests que não aceitam JSON', () => {
    const text = 'Request Header:{"Timestamp":"26/10/2026 14:34:00.000"}\nRequest Body:{}\n' +
      '2026/10/26 14:34:00.100|INFO|Example - Accept: application/json\n' +
      httpRequest('xml', 'application/xml') + httpResponse('xml');
    expect(select(text).events).toHaveLength(0);
    expect(select(httpRequest().replace('ComServer.Utils.LoggingHandler', 'Other.Component')).events).toHaveLength(0);
  });

  it('interpreta a lista Accept, parâmetros e q=0 sem procurar cabeçalhos no body', () => {
    expect(select(httpRequest('a', 'text/plain, Application/JSON; charset=utf-8')).events).toHaveLength(1);
    for (const accept of ['application/json;q=0', 'application/jsonp', 'application/xml']) {
      expect(select(httpRequest('a', accept)).events).toHaveLength(0);
    }
    expect(select(httpRequest('a', 'application/xml').replace('{"articleCode":"ITEM-A"}', 'Accept: application/json')).events).toHaveLength(0);
  });

  it('usa a request mais recente quando o ID é reutilizado, sem misturar os modos', () => {
    const first = httpRequest() + httpResponse();
    const second = httpRequest('synthetic-a', 'text/plain', { articleCode: 'OTHER' }, '14:34:02.000') + httpResponse('synthetic-a', '{}', '14:34:03.000');
    expect(select(first + second).events.map((event) => event.raw).join('')).toBe(first);
    const events = parseLog(first + second).events;
    expect(filterEvents(events, getSuggestedRange(events)!)).toHaveLength(4);
  });

  it('inclui o par depois de aplicar datas a qualquer uma das mensagens', () => {
    const events = parseLog(httpRequest() + httpResponse()).events;
    const http = selectJsonHttpEvents(events).events;
    const range = getSuggestedRange(events)!;
    expect(filterEvents(http, { ...range, startTime: '14:34:01' })).toHaveLength(2);
  });
});
