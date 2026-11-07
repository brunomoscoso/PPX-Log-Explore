import type { DateTimeRange } from '../services/logFilter';
import type { LogEvent } from './log.types';
import type { TransactionFilter } from './transactionFilters.types';
import type { HttpErrorCall } from '../services/httpErrors';

export const PAGE_SIZE = 100;

export interface ResultPage {
  events: LogEvent[];
  total: number;
  page: number;
  pageCount: number;
  errorCalls?: HttpErrorCall[];
}

export type WorkerCommand =
  | { command: 'load'; file: File; debugTotal: boolean; errorsOnly: boolean }
  | { command: 'search'; range: DateTimeRange; filters: TransactionFilter[]; debugTotal: boolean; errorsOnly: boolean }
  | { command: 'page'; page: number }
  | { command: 'export' };

export type WorkerRequest = WorkerCommand & { id: number };
export type WorkerResult =
  | { kind: 'loaded'; view: ResultPage; bounds: DateTimeRange | null; preamble: boolean; invalidTimestamps: number; httpTotal: number; unlinkedResponses: number }
  | { kind: 'view'; view: ResultPage }
  | { kind: 'export'; text: string };

export type WorkerResponse = { id: number } & (
  | { ok: true; result: WorkerResult }
  | { ok: false; error: string }
);
