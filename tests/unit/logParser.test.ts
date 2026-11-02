import { describe, expect, it } from 'vitest';
import { parseLog } from '../../src/services/logParser';
import { filterEvents, getSuggestedRange } from '../../src/services/logFilter';
import { serializeEvents } from '../../src/services/logExporter';
import { firstEvent, lastEvent, multilineEvent, syntheticLog } from '../fixtures/syntheticLogs';

describe('parseLog', () => {
  it.each(['\n', '\r\n', '\r'])('recupera o Timestamp do pedido inicial e preserva pesquisa e exportação (%j)', (newline) => {
    const request = 'Request Header:{"MessageID":1,"Timestamp":"30/09/2026 14:34:40.580"}' + newline +
      'Request Body:{"ServiceName":"Example"}' + newline;
    const next = '2026/09/30 14:34:41.590|INFO|Example - Next';
    const result = parseLog(request + next);
    expect(result.preamble).toBe('');
    expect(result.issues).toEqual([]);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toMatchObject({
      timestamp: Date.UTC(2026, 8, 30, 14, 34, 40, 580),
      timestampText: '2026/09/30 14:34:40.580',
      type: 'request', raw: request, message: request, level: '', lineNumber: 1,
      startOffset: 0, endOffset: request.length,
    });
    const range = getSuggestedRange(result.events)!;
    expect(range.startDate).toBe('2026-09-30');
    expect(serializeEvents(filterEvents(result.events, range))).toBe(request + next);
    expect(serializeEvents(filterEvents(result.events, { ...range, endTime: '14:34:40' }))).toBe(request);
  });

  it('aceita um ficheiro apenas com pedido e BOM', () => {
    const input = '\uFEFFRequest Header:{"Timestamp":"30/09/2026 14:34:40.580"}\nRequest Body:{}';
    const result = parseLog(input);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.raw).toBe(input);
    expect(result.preamble).toBe('');
  });

  it.each(['"31/02/2026 14:34:40.580"', 'null', '123', '"invalid"', '"30/09/2026 14:34:40.580",'])('preserva pedidos com Timestamp inválido: %s', (value) => {
    const header = `Request Header:{"Timestamp":${value}}\n`;
    expect(parseLog(header + firstEvent).preamble).toBe(header);
  });

  it('separa pedidos com Timestamp do próprio bloco dos eventos de log', () => {
    const input = firstEvent + 'Request Header:{"Timestamp":"30/09/2026 14:34:40.580"}\nRequest Body:{}';
    const result = parseLog(input);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toMatchObject({ type: 'log', raw: firstEvent, timestampText: '2026/10/26 14:34:13.996' });
    expect(result.events[1]).toMatchObject({
      type: 'request',
      raw: 'Request Header:{"Timestamp":"30/09/2026 14:34:40.580"}\nRequest Body:{}',
      timestampText: '2026/09/30 14:34:40.580',
    });
  });

  it('extrai timestamps, níveis, threads, componentes e mensagens', () => {
    const result = parseLog(syntheticLog);
    expect(result.issues).toEqual([]);
    expect(result.preamble).toBe('');
    expect(result.events).toHaveLength(3);
    expect(result.events[0]).toEqual({
      id: 'line-1',
      timestamp: Date.UTC(2026, 9, 26, 14, 34, 13, 996),
      timestampText: '2026/10/26 14:34:13.996',
      type: 'log',
      level: 'INFO',
      thread: '[11]',
      component: 'ComServer.DOMS.JPL.JplDomsManager',
      message: '(JPL) updating status for pump: 1, Status: Fueling\r\n',
      raw: firstEvent,
      lineNumber: 1,
      startOffset: 0,
      endOffset: firstEvent.length,
    });
  });

  it('associa JSONs e linhas de continuação ao evento anterior', () => {
    const events = parseLog(syntheticLog).events;
    expect(events[1]?.raw).toBe(multilineEvent);
    expect(events[1]?.message).toBe(
      'Service:AlarmUpdateService\r\n' +
      'Request Header:{"MessageID":20284}\r\n' +
      'Request Body:{"ServiceName":"AlarmUpdateService"}\r\n',
    );
    expect(events[1]?.lineNumber).toBe(2);
    expect(events[2]?.lineNumber).toBe(5);
  });

  it.each(['INFO', 'DEBUG', 'WARN', 'ERROR', 'FATAL', 'TRACE', 'CUSTOM', ''])('preserva eventos de nível %j', (level) => {
    const input = `2026/10/26 14:00:00.000|${level}|[1]|||123|Example - Message`;
    expect(parseLog(input).events[0]?.level).toBe(level);
    expect(parseLog(input).events[0]?.raw).toBe(input);
  });

  it('não ordena, elimina nem combina eventos com timestamps iguais', () => {
    const input = lastEvent + '\n' + firstEvent + firstEvent;
    const events = parseLog(input).events;
    expect(events.map((event) => event.raw)).toEqual([lastEvent + '\n', firstEvent, firstEvent]);
    expect(events.map((event) => event.id)).toEqual(['line-1', 'line-2', 'line-3']);
    expect(events[1]?.timestamp).toBe(events[2]?.timestamp);
  });

  it.each(['\n', '\r\n', '\r'])('preserva linhas vazias, espaços e terminadores %j', (newline) => {
    const input = firstEvent.trimEnd() + newline + '  ' + newline + '\tstack trace' + newline + newline + lastEvent + newline;
    const result = parseLog(input);
    expect(result.events).toHaveLength(2);
    expect(result.events[1]?.lineNumber).toBe(5);
    expect(result.events.map((event) => event.raw).join('')).toBe(input);
    for (const event of result.events) {
      expect(input.slice(event.startOffset, event.endOffset)).toBe(event.raw);
    }
  });

  it('preserva preâmbulo e finais de linha mistos, sem perder caracteres', () => {
    const input = 'Cabeçalho inesperado\r\n\n' + firstEvent + 'continuação\r' + lastEvent;
    const result = parseLog(input);
    expect(result.preamble).toBe('Cabeçalho inesperado\r\n\n');
    expect(result.issues).toEqual([expect.objectContaining({ code: 'preamble', lineNumber: 1 })]);
    expect(result.events[0]?.lineNumber).toBe(3);
    expect(result.preamble + result.events.map((event) => event.raw).join('')).toBe(input);
  });

  it.each(['', '\n\r\n', 'Texto sem timestamps\nJSON: {}', '2026/02/30 00:00:00.000|INFO|inválido'])('trata ficheiros sem eventos: %j', (input) => {
    const result = parseLog(input);
    expect(result.events).toEqual([]);
    expect(result.preamble).toBe(input);
  });

  it('preserva linhas com timestamps inválidos e retoma no próximo evento válido', () => {
    const invalidLines =
      '2026/02/30 14:00:00.000|ERROR|invalid date\n' +
      '2026/10/26 14:00:00.99|INFO|invalid precision\n' +
      '2026/10/26 14:00:00.0000|INFO|extra digit\n';
    const result = parseLog(firstEvent + invalidLines + lastEvent);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]?.raw).toBe(firstEvent + invalidLines);
    expect(result.issues.map((issue) => [issue.code, issue.lineNumber])).toEqual([
      ['invalid-timestamp', 2], ['invalid-timestamp', 3], ['invalid-timestamp', 4],
    ]);
    expect(result.events[1]?.lineNumber).toBe(5);
  });

  it('não interpreta timestamps no meio da mensagem ou indentados como novos eventos', () => {
    const continuation = 'received at 2026/10/26 14:00:00.000|INFO\n  2026/10/26 14:00:00.000|INFO';
    const result = parseLog(firstEvent + continuation);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.raw).toBe(firstEvent + continuation);
  });

  it('aceita e preserva um BOM inicial', () => {
    const input = '\uFEFF' + syntheticLog;
    const result = parseLog(input);
    expect(result.events).toHaveLength(3);
    expect(result.events[0]?.timestampText).toBe('2026/10/26 14:34:13.996');
    expect(result.events[0]?.raw).toBe('\uFEFF' + firstEvent);
    expect(result.events.map((event) => event.raw).join('')).toBe(input);
  });

  it('aceita cabeçalhos incompletos sem perder o texto', () => {
    const input = '2026/10/26 14:00:00.000\n2026/10/26 14:00:01.000|INFO\n2026/10/26 14:00:02.000|DEBUG|[1]|plain message';
    const events = parseLog(input).events;
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ level: '', message: '\n' });
    expect(events[1]).toMatchObject({ level: 'INFO', message: '\n' });
    expect(events[2]).toMatchObject({ level: 'DEBUG', thread: '[1]', message: 'plain message' });
    expect(events[2]?.component).toBeUndefined();
    expect(events.map((event) => event.raw).join('')).toBe(input);
  });

  it('aceita quantidades diferentes de identificadores e threads ausentes', () => {
    const input = '2026/10/26 14:00:00.000|INFO|[8]|id1|id2|Example.Component - A | B - C\n' +
      '2026/10/26 14:00:01.000|DEBUG|Example.Other - Message';
    const events = parseLog(input).events;
    expect(events[0]).toMatchObject({ thread: '[8]', component: 'Example.Component', message: 'A | B - C\n' });
    expect(events[1]).toMatchObject({ component: 'Example.Other', message: 'Message' });
    expect(events[1]?.thread).toBeUndefined();
  });

  it('preserva Unicode, JSON extenso e HTML como texto inerte', () => {
    const payload = JSON.stringify({ text: 'ação € 🚀 | - '.repeat(10_000), html: '<script>alert(1)</script>' });
    const input = firstEvent + payload + '\n';
    const result = parseLog(input);
    expect(result.events[0]?.raw).toBe(input);
    expect(result.events[0]?.message).toContain(payload);
  });

  it('processa milhares de eventos e mantém as posições originais', () => {
    const input = firstEvent.repeat(10_000);
    const events = parseLog(input).events;
    expect(events).toHaveLength(10_000);
    expect(events[9_999]).toMatchObject({ id: 'line-10000', lineNumber: 10_000, endOffset: input.length });
    expect(events.map((event) => event.raw).join('')).toBe(input);
  });
});
