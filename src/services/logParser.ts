import type { LogEvent, ParseIssue, ParseResult } from '../types/log.types';
import { parseLogTimestamp } from './logTimestamp';

const EVENT_START = /^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}\.\d{3})(?=\||$)/;
const TIMESTAMP_LIKE = /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/;

interface EventStart {
  offset: number;
  lineNumber: number;
  headerEnd: number;
  timestamp: number;
  timestampText: string;
  header: string;
}

/** Metadata é interpretada de forma tolerante; raw é sempre a fonte original. */
function parseHeader(header: string): Pick<LogEvent, 'level' | 'thread' | 'component' | 'message'> {
  if (!header.startsWith('|')) return { level: '', message: header };

  const fields = header.slice(1);
  const levelEnd = fields.indexOf('|');
  if (levelEnd < 0) return { level: fields, message: '' };

  const level = fields.slice(0, levelEnd);
  let remaining = fields.slice(levelEnd + 1);
  const threadMatch = /^(\[[^\]\r\n]*\])(?:\||$)/.exec(remaining);
  const thread = threadMatch?.[1];
  if (threadMatch) remaining = remaining.slice(threadMatch[0].length);

  // Não assumir uma quantidade fixa de identificadores. O componente é o
  // campo imediatamente anterior a " - ". Pipes dentro da mensagem ficam intactos.
  const componentMatch = /(?:^|\|)([^|]+?) - /.exec(remaining);
  const component = componentMatch?.[1];
  const message = componentMatch
    ? remaining.slice(componentMatch.index + componentMatch[0].length)
    : remaining;

  return {
    level,
    ...(thread !== undefined ? { thread } : {}),
    ...(component !== undefined ? { component } : {}),
    message,
  };
}

/**
 * Parser puro, sem I/O, armazenamento ou logging.
 * Apenas um timestamp válido no início de linha inicia um evento. As restantes
 * linhas pertencem ao anterior, mesmo quando parecem cabeçalhos danificados.
 */
export function parseLog(text: string): ParseResult {
  const events: LogEvent[] = [];
  const issues: ParseIssue[] = [];
  let current: EventStart | undefined;
  let preambleEnd = text.length;
  let lineNumber = 0;

  const finishEvent = (endOffset: number): void => {
    if (!current) return;
    const metadata = parseHeader(current.header);
    events.push({
      ...metadata,
      id: `line-${current.lineNumber}`,
      timestamp: current.timestamp,
      timestampText: current.timestampText,
      message: metadata.message + text.slice(current.headerEnd, endOffset),
      raw: text.slice(current.offset, endOffset),
      lineNumber: current.lineNumber,
      startOffset: current.offset,
      endOffset,
    });
  };

  // Percorrer linhas sem split/join preserva CRLF, LF, CR e o fim do ficheiro.
  const lines = /([^\r\n]*)(\r\n|\r|\n|$)/g;
  let line: RegExpExecArray | null;
  while ((line = lines.exec(text)) !== null && line[0].length > 0) {
    lineNumber += 1;
    const original = line[1]!;
    // Aceitar BOM apenas no início do ficheiro, preservando-o no raw/preamble.
    const content = line.index === 0 && original.startsWith('\uFEFF')
      ? original.slice(1)
      : original;
    const match = EVENT_START.exec(content);
    const timestampText = match?.[1];
    const timestamp = timestampText === undefined ? null : parseLogTimestamp(timestampText);

    if (timestamp !== null && timestampText !== undefined) {
      if (!current) preambleEnd = line.index;
      finishEvent(line.index);
      current = {
        offset: line.index,
        lineNumber,
        headerEnd: line.index + original.length,
        timestamp,
        timestampText,
        header: content.slice(timestampText.length),
      };
    } else if (TIMESTAMP_LIKE.test(content)) {
      issues.push({
        code: 'invalid-timestamp',
        lineNumber,
        message: 'Timestamp inválido ou formato de início de evento não reconhecido; linha preservada.',
      });
    }
  }

  finishEvent(text.length);
  const preamble = text.slice(0, preambleEnd);
  if (preamble.length > 0) {
    issues.unshift({
      code: 'preamble',
      lineNumber: 1,
      message: 'Texto sem evento associado antes do primeiro timestamp válido; preservado no preâmbulo.',
    });
  }
  return { events, preamble, issues };
}
