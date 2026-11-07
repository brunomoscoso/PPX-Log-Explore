import type { LogEvent } from '../types/log.types';

/** Apenas o cabeçalho HTTP é inspecionado; texto semelhante no body não conta. */
export function splitHttpSections(message: string): { header: string; body: string } {
  const separator = /(?:\r\n|\r(?!\n)|\n)[ \t]*(?:\r\n|\r(?!\n)|\n)/.exec(message);
  return separator
    ? { header: message.slice(0, separator.index), body: message.slice(separator.index + separator[0].length) }
    : { header: message, body: '' };
}

export function httpMetadata(component: string | undefined, message: string): Pick<LogEvent, 'type' | 'http'> | undefined {
  if (!/(?:^|\.)LoggingHandler$/i.test(component ?? '')) return undefined;
  const marker = /^(Request|Response):[ \t]*(?:\r\n|\r|\n)/i.exec(message);
  if (!marker) return undefined;
  const type = marker[1]!.toLowerCase() as 'request' | 'response';
  const { header, body } = splitHttpSections(message);
  const lines = header.split(/\r\n|\r|\n/);
  const values = (name: string) => lines.flatMap((line) => {
    const colon = line.indexOf(':');
    return colon >= 0 && line.slice(0, colon).trim().toLowerCase() === name ? [line.slice(colon + 1).trim()] : [];
  });
  const method = /^Method:\s*([A-Z]+),\s*URI:\s*(.+)$/im.exec(header);
  const status = values('statuscode')[0];
  if (type === 'request' ? !method : !status) return undefined;
  const acceptsJson = values('accept').some((value) => value.split(',').some((media) => {
    const [mime, ...parameters] = media.trim().toLowerCase().split(';');
    return mime?.trim() === 'application/json' && !parameters.some((parameter) => /^\s*q\s*=\s*0(?:\.0*)?\s*$/.test(parameter));
  }));
  let jsonBody = false;
  if (type === 'response' && /^[\s]*[\[{]/.test(body)) {
    try { JSON.parse(body); jsonBody = true; } catch { /* Uma resposta truncada ainda pode ser reconhecida pela request. */ }
  }
  const correlationId = values('x-correlation-id')[0]?.toLowerCase();
  return { type, http: {
    acceptsJson, jsonBody,
    ...(correlationId ? { correlationId } : {}),
    ...(method ? { method: method[1]!, uri: method[2]! } : {}),
    ...(status ? { status } : {}),
  } };
}

/** Calculado uma vez por importação, antes de aplicar datas ou filtros de campos. */
export function selectJsonHttpEvents(events: readonly LogEvent[]): { events: LogEvent[]; unlinkedResponses: number } {
  const requests = new Map<string, boolean>();
  const selected: LogEvent[] = [];
  let unlinkedResponses = 0;
  // A posição original evita associar uma resposta à reutilização posterior do ID.
  for (const event of [...events].sort((a, b) => a.startOffset - b.startOffset)) {
    const http = event.http;
    if (!http) continue;
    if (event.type === 'request') {
      if (http.correlationId) requests.set(http.correlationId, http.acceptsJson);
      if (http.acceptsJson) selected.push(event);
    } else if (event.type === 'response') {
      const acceptsJson = http.correlationId ? requests.get(http.correlationId) : undefined;
      if (acceptsJson === true || (acceptsJson === undefined && http.jsonBody)) {
        selected.push(event);
        if (acceptsJson === undefined) unlinkedResponses += 1;
      }
    }
  }
  return { events: selected, unlinkedResponses };
}
