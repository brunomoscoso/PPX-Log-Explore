import type { LogEvent } from '../types/log.types';

/** Índice bidirecional: cada mensagem aponta apenas para a outra metade da chamada. */
export function buildHttpPairs(events: readonly LogEvent[]): Map<string, LogEvent> {
  const pending = new Map<string, { request: LogEvent; count: number; ambiguous: boolean }>();
  const pairs = new Map<string, LogEvent>();
  for (const event of [...events].sort((a, b) => a.startOffset - b.startOffset)) {
    const id = event.http?.correlationId;
    if (!id) continue;
    if (event.type === 'request') {
      const existing = pending.get(id);
      if (existing) { existing.count += 1; existing.ambiguous = true; }
      else pending.set(id, { request: event, count: 1, ambiguous: false });
    } else if (event.type === 'response') {
      const candidate = pending.get(id);
      if (!candidate) continue;
      if (!candidate.ambiguous && candidate.request.timestamp <= event.timestamp) {
        pairs.set(event.id, candidate.request);
        pairs.set(candidate.request.id, event);
      }
      if (--candidate.count === 0) pending.delete(id);
    }
  }
  return pairs;
}
