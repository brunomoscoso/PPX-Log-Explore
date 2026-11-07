import type { LogEvent } from '../types/log.types';
import { parseLogTimestamp } from './logTimestamp';
import type { TransactionFilter } from '../types/transactionFilters.types';
import { createTransactionMatcher } from './transactionFilter';
import { buildHttpPairs } from './httpPairs';

export interface DateTimeRange {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

export const EMPTY_RANGE: DateTimeRange = {
  startDate: '', startTime: '', endDate: '', endTime: '',
};

function fromInput(date: string, time: string, milliseconds: '000' | '999'): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return null;
  const seconds = time.length === 5 ? `${time}:00` : time;
  return parseLogTimestamp(`${date.replaceAll('-', '/')} ${seconds}.${milliseconds}`);
}

export function parseRange(range: DateTimeRange): { start: number; end: number } {
  const start = fromInput(range.startDate, range.startTime, '000');
  const end = fromInput(range.endDate, range.endTime, '999');
  if (start === null || end === null) throw new Error('Preencha as datas e horas inicial e final com valores válidos.');
  if (end < start) throw new Error('A data e hora final não podem ser anteriores à data e hora inicial.');
  return { start, end };
}

export function sortEvents(events: readonly LogEvent[]): LogEvent[] {
  return [...events].sort((a, b) => a.timestamp - b.timestamp || a.startOffset - b.startOffset);
}

export function filterEvents(events: readonly LogEvent[], range: DateTimeRange, filters: readonly TransactionFilter[] = [], pairs: ReadonlyMap<string, LogEvent> = buildHttpPairs(events)): LogEvent[] {
  const { start, end } = parseRange(range);
  const matches = createTransactionMatcher(filters);
  const matched = events.filter((event) => event.timestamp >= start && event.timestamp <= end && matches(event));
  const matchedIds = new Set(matched.map((event) => event.id));
  const results = new Map(matched.map((event) => [event.id, event]));
  for (const event of matched) {
    const related = pairs.get(event.id);
    if (related) results.set(related.id, related);
  }
  return sortEvents([...results.values()].map((event) => {
    const related = pairs.get(event.id);
    return related ? { ...event, searchContext: {
      relatedLineNumber: related.lineNumber,
      includedByCorrelation: !matchedIds.has(event.id),
      outsideRange: event.timestamp < start || event.timestamp > end,
    } } : event;
  }));
}

export function getSuggestedRange(events: readonly LogEvent[]): DateTimeRange | null {
  let minimum: LogEvent | undefined;
  let maximum: LogEvent | undefined;
  for (const event of events) {
    if (!minimum || event.timestamp < minimum.timestamp) minimum = event;
    if (!maximum || event.timestamp > maximum.timestamp) maximum = event;
  }
  if (!minimum || !maximum) return null;
  return {
    startDate: minimum.timestampText.slice(0, 10).replaceAll('/', '-'),
    startTime: minimum.timestampText.slice(11, 19),
    endDate: maximum.timestampText.slice(0, 10).replaceAll('/', '-'),
    endTime: maximum.timestampText.slice(11, 19),
  };
}
