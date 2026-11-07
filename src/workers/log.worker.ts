import { parseLog } from '../services/logParser';
import { filterEvents, getSuggestedRange, sortEvents } from '../services/logFilter';
import { serializeEvents } from '../services/logExporter';
import { selectJsonHttpEvents } from '../services/httpLog';
import { buildHttpPairs } from '../services/httpPairs';
import { buildHttpErrorCalls, filterHttpErrorCalls, errorCallEvents, type HttpErrorCall } from '../services/httpErrors';
import type { LogEvent } from '../types/log.types';
import { PAGE_SIZE } from '../types/worker.types';
import type { ResultPage, WorkerRequest, WorkerResponse, WorkerResult } from '../types/worker.types';

let events: LogEvent[] = [];
let httpEvents: LogEvent[] = [];
let httpPairs = new Map<string, LogEvent>();
let results: LogEvent[] = [];
let errorCalls: HttpErrorCall[] = [];
let errorResults: HttpErrorCall[] = [];
let errorsOnly = false;

function pageView(requestedPage = 1): ResultPage {
  const total = errorsOnly ? errorResults.length : results.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.max(1, Math.min(requestedPage, pageCount));
  return { events: errorsOnly ? [] : results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total, page, pageCount,
    ...(errorsOnly ? { errorCalls: errorResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) } : {}) };
}

async function execute(request: WorkerRequest): Promise<WorkerResult> {
  switch (request.command) {
    case 'load': {
      let buffer: ArrayBuffer;
      try {
        buffer = await request.file.arrayBuffer();
      } catch {
        throw new Error('Não foi possível ler o ficheiro. Volte a selecioná-lo e tente novamente.');
      }
      let text: string;
      try {
        // fatal evita substituir silenciosamente caracteres; ignoreBOM preserva o BOM.
        text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
      } catch {
        throw new Error('A codificação do ficheiro não é UTF-8. Guarde uma cópia em UTF-8 e volte a importar.');
      }
      const parsed = parseLog(text);
      events = sortEvents(parsed.events);
      const http = selectJsonHttpEvents(parsed.events);
      httpEvents = sortEvents(http.events);
      httpPairs = buildHttpPairs(parsed.events);
      errorCalls = buildHttpErrorCalls(parsed.events, httpPairs);
      errorResults = errorCalls;
      errorsOnly = request.errorsOnly;
      results = request.debugTotal ? events : httpEvents;
      return {
        kind: 'loaded', view: pageView(), bounds: getSuggestedRange(events),
        preamble: parsed.preamble.length > 0,
        invalidTimestamps: parsed.issues.filter((issue) => issue.code === 'invalid-timestamp').length,
        httpTotal: httpEvents.length, unlinkedResponses: http.unlinkedResponses,
      };
    }
    case 'search': {
      // Só substituir a vista aplicada depois de validar e concluir a pesquisa.
      if (request.errorsOnly) errorResults = filterHttpErrorCalls(errorCalls, request.range, request.filters);
      else results = filterEvents(request.debugTotal ? events : httpEvents, request.range, request.filters, httpPairs);
      errorsOnly = request.errorsOnly;
      return { kind: 'view', view: pageView() };
    }
    case 'page':
      return { kind: 'view', view: pageView(request.page) };
    case 'export':
      return { kind: 'export', text: serializeEvents(errorsOnly ? errorCallEvents(errorResults) : results) };
  }
}

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  let response: WorkerResponse;
  try {
    response = { id: data.id, ok: true, result: await execute(data) };
  } catch (error) {
    response = { id: data.id, ok: false, error: error instanceof Error ? error.message : 'Não foi possível processar o ficheiro.' };
  }
  self.postMessage(response);
};
