import { describe, expect, it } from 'vitest';
import { exportFilename, serializeEvents } from '../../src/services/logExporter';
import { filterEvents, sortEvents } from '../../src/services/logFilter';
import { parseLog } from '../../src/services/logParser';
import { firstEvent, lastEvent, multilineEvent, syntheticLog } from '../fixtures/syntheticLogs';

const range = { startDate: '2026-10-26', startTime: '14:34:00', endDate: '2026-10-26', endTime: '14:35:00' };

describe('exportação de logs', () => {
  it('preserva integralmente multiline, JSONs, CRLF e o EOF sem newline', () => {
    expect(serializeEvents(parseLog(syntheticLog).events)).toBe(syntheticLog);
  });

  it('exporta apenas os eventos filtrados na ordem apresentada', () => {
    const results = filterEvents(parseLog(lastEvent + '\n' + multilineEvent + firstEvent).events, range);
    expect(serializeEvents(results)).toBe(firstEvent + multilineEvent);
  });

  it('não exporta o preâmbulo que não pertence a um evento', () => {
    expect(serializeEvents(parseLog('Texto sem data\n' + firstEvent).events)).toBe(firstEvent);
  });

  it('preserva o BOM, Unicode, espaços e finais de linha mistos', () => {
    const text = '\uFEFF' + firstEvent + '  ação 🚀  \n' + lastEvent + '\r';
    expect(serializeEvents(parseLog(text).events)).toBe(text);
  });

  it('separa o antigo último evento quando a ordenação o coloca antes de outro', () => {
    const withoutTerminator = firstEvent.slice(0, -2);
    const events = parseLog(lastEvent + '\r\n' + withoutTerminator).events;
    expect(serializeEvents(sortEvents(events))).toBe(withoutTerminator + '\n' + lastEvent + '\r\n');
    expect(events[1]?.raw).toBe(withoutTerminator);
  });

  it('não introduz linhas vazias artificiais entre eventos já terminados', () => {
    expect(serializeEvents(parseLog(firstEvent + firstEvent).events)).toBe(firstEvent + firstEvent);
    expect(serializeEvents([])).toBe('');
  });

  it('usa nomes distintos para pesquisas no mesmo dia e entre dias', () => {
    expect(exportFilename(range)).toBe('PPX_Logs_2026-10-26_143400_143500.log');
    expect(exportFilename({ ...range, endDate: '2026-10-27', endTime: '00:00' })).toBe('PPX_Logs_2026-10-26_143400_2026-10-27_000000.log');
  });
});
