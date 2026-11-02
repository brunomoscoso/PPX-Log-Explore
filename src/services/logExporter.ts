import type { LogEvent } from '../types/log.types';
import type { DateTimeRange } from './logFilter';
import { parseRange } from './logFilter';

/** Não normalizar os segmentos raw. Separar apenas eventos que ficariam colados. */
export function serializeEvents(events: readonly LogEvent[]): string {
  const segments: string[] = [];
  events.forEach((event, index) => {
    segments.push(event.raw);
    if (index < events.length - 1 && !/[\r\n]$/.test(event.raw)) {
      segments.push(event.raw.match(/\r\n|\r|\n/)?.[0] ?? '\n');
    }
  });
  return segments.join('');
}

export function exportFilename(range: DateTimeRange): string {
  parseRange(range);
  const time = (value: string): string => (value.length === 5 ? `${value}:00` : value).replaceAll(':', '');
  const endDate = range.startDate === range.endDate ? '' : `${range.endDate}_`;
  return `PPX_Logs_${range.startDate}_${time(range.startTime)}_${endDate}${time(range.endTime)}.log`;
}

export function downloadLog(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Dar ao navegador tempo para iniciar o download antes de libertar o URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error('A cópia não está disponível neste navegador. Utilize Exportar .log.');
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    throw new Error('Não foi possível copiar. Verifique a permissão da área de transferência ou utilize Exportar .log.');
  }
}
