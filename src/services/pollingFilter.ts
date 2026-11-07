import type { LogEvent } from '../types/log.types';
import { parseRange, type DateTimeRange } from './logFilter';

export const POLLING_QUICK_FILTERS = [
  { key: 'requests', label: 'Somente requests', symbol: '↗', description: 'Pedidos do Hub, frames REQUEST e início de espera por uma resposta.' },
  { key: 'responses', label: 'Somente responses', symbol: '↙', description: 'Respostas do Hub, frames RESPONSE e confirmações de resposta recebida.' },
  { key: 'failures', label: 'Operações com falha', symbol: '⊗', description: 'Falhas explícitas, Success=false, ResultType=FAILURE, abortos e eventos da transação identificada.' },
  { key: 'missing', label: 'Sem response identificada', symbol: '◷', description: 'Pedidos do Hub ou esperas de transação sem resposta associada no ficheiro completo. Não confirma uma falha.' },
  { key: 'communication', label: 'Erros de comunicação', symbol: '⌁', description: 'Timeouts, desconexões, falhas de ligação, NACK e frames inválidos.' },
  { key: 'complete', label: 'Transações completas', symbol: '✓', description: 'Eventos com o mesmo ID de uma transação com início e conclusão correta explícitos, sem aborto.' },
] as const;
export type PollingQuickFilter = typeof POLLING_QUICK_FILTERS[number]['key'];
export interface PollingFilters { quick: PollingQuickFilter[]; text?: string }
export const EMPTY_POLLING_FILTERS: PollingFilters = { quick: [], text: '' };

type Index = Record<PollingQuickFilter, Set<string>>;
const cache = new WeakMap<readonly LogEvent[], Index>();
const transactionId = /\btransaction with id\s+['"]?([a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})\b/i;
const communicationError = /\b(?:timed[ -]?out|timeout|disconnected|connection refused|could not connect|reconnect failed|unexpected frame|malformed message|invalid frame|socket exception)\b|<NACK>/i;
const failure = /"Success"\s*:\s*false\b|"ResultType"\s*:\s*"(?:FAILURE|ERROR)"|\b(?:was aborted|aborting transaction|ended with error|result type received is:\s*FAILURE)\b/i;

/** Classify using the whole file before applying dates. Never pair by proximity alone. */
function buildIndex(events: readonly LogEvent[]): Index {
  const cached = cache.get(events);
  if (cached) return cached;
  const index: Index = { requests: new Set(), responses: new Set(), failures: new Set(), missing: new Set(), communication: new Set(), complete: new Set() };
  const transactions = new Map<string, { events: LogEvent[]; started: boolean; completed: boolean; aborted: boolean; failed: boolean }>();
  const pending = new Map<string, LogEvent[]>();
  const pairs: [LogEvent, LogEvent][] = [];
  const open = (key: string, event: LogEvent) => {
    pending.set(key, [...(pending.get(key) ?? []), event]);
    index.missing.add(event.id);
  };
  const close = (key: string, event: LogEvent) => {
    const candidates = pending.get(key);
    // Concurrent operations sharing the same key are ambiguous; do not guess.
    if (candidates?.length === 1) {
      index.missing.delete(candidates[0]!.id);
      pairs.push([candidates[0]!, event]);
      pending.delete(key);
    }
  };
  for (const event of [...events].sort((a, b) => a.startOffset - b.startOffset)) {
    const message = event.message.trim();
    const hubRequest = /^Starting (\w+) with request\b/i.exec(message);
    const hubResponse = /^Ended (\w+)\.\s*Response\s*:/i.exec(message);
    const listening = /^Starting listening for transaction with id\b/i.test(message);
    const received = /^(?:ACK|EOT|Last) response received\b/i.test(message);
    if (hubRequest || /^REQUEST IP:/i.test(message) || listening) index.requests.add(event.id);
    if (hubResponse || /^RESPONSE IP:/i.test(message) || received) index.responses.add(event.id);
    if (/^(ERROR|FATAL)$/i.test(event.level) || failure.test(message)) index.failures.add(event.id);
    // Ignore JSON configuration names such as ResponseTimeout and successful status prose.
    if (communicationError.test(message.split('{', 1)[0]!)) index.communication.add(event.id);
    if (event.thread && event.component) {
      const key = `${event.component}|${event.thread}|${hubRequest?.[1] ?? hubResponse?.[1]}`;
      if (hubRequest) open(key, event);
      if (hubResponse) close(key, event);
    }
    const id = transactionId.exec(message)?.[1]?.toLowerCase();
    if (!id) continue;
    const group = transactions.get(id) ?? { events: [], started: false, completed: false, aborted: false, failed: false };
    group.events.push(event);
    group.started ||= /^Started new transaction with id\b/i.test(message);
    group.completed ||= /\bwas completed correctly\b/i.test(message);
    group.aborted ||= /\b(?:was aborted|aborting transaction)\b/i.test(message);
    group.failed ||= index.failures.has(event.id);
    transactions.set(id, group);
    const requestType = /\brequest type\s+['"]?(\w+)/i.exec(message)?.[1]?.toUpperCase();
    if (requestType) {
      const key = `transaction|${id}|${requestType}`;
      if (listening) open(key, event);
      if (received) close(key, event);
    }
  }
  for (const group of transactions.values()) {
    if (group.failed) group.events.forEach(event => index.failures.add(event.id));
    if (group.started && group.completed && !group.aborted) group.events.forEach(event => index.complete.add(event.id));
  }
  for (const [request, response] of pairs) {
    if (index.failures.has(response.id)) index.failures.add(request.id);
  }
  cache.set(events, index);
  return index;
}

export function filterPollingEvents(events: readonly LogEvent[], range: DateTimeRange, filters: PollingFilters): LogEvent[] {
  const { start, end } = parseRange(range);
  const index = filters.quick.length ? buildIndex(events) : undefined;
  const directions = filters.quick.filter(key => key === 'requests' || key === 'responses');
  const states = filters.quick.filter(key => key !== 'requests' && key !== 'responses');
  const query = (filters.text ?? '').toLowerCase();
  return events.filter((event) => event.timestamp >= start && event.timestamp < end + 1
    && (!query || event.raw.toLowerCase().includes(query))
    && (!directions.length || directions.some(key => index![key].has(event.id)))
    && (!states.length || states.some(key => index![key].has(event.id))));
}
