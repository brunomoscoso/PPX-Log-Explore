import { parseLog } from '../services/logParser';
import { filterEvents, getSuggestedRange, sortEvents } from '../services/logFilter';
import { serializeEvents } from '../services/logExporter';
import type { LogEvent } from '../types/log.types';
import { PAGE_SIZE } from '../types/worker.types';
import type { ResultPage, WorkerRequest, WorkerResponse, WorkerResult } from '../types/worker.types';

let events: LogEvent[] = [];
let results: LogEvent[] = [];

function pageView(requestedPage = 1): ResultPage {
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.max(1, Math.min(requestedPage, pageCount));
  return { events: results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: results.length, page, pageCount };
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
      results = events;
      return {
        kind: 'loaded', view: pageView(), bounds: getSuggestedRange(events),
        preamble: parsed.preamble.length > 0,
        invalidTimestamps: parsed.issues.filter((issue) => issue.code === 'invalid-timestamp').length,
      };
    }
    case 'search':
      results = filterEvents(events, request.range, request.filters);
      return { kind: 'view', view: pageView() };
    case 'page':
      return { kind: 'view', view: pageView(request.page) };
    case 'export':
      return { kind: 'export', text: serializeEvents(results) };
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
