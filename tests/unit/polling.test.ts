import { describe, expect, it } from 'vitest';
import { parseLog } from '../../src/services/logParser';
import { getSuggestedRange, sortEvents } from '../../src/services/logFilter';
import { EMPTY_POLLING_FILTERS, filterPollingEvents } from '../../src/services/pollingFilter';

const first = '2026-11-03 13:31:29.9999|0|[12]|DEBUG|PollingV6Bridge.Hub.PollingV6Hub|Starting request {"TouchPointId":11}|extra\r\n  continuation\r\n';
const second = '2026-11-03 13:31:30.0000|0|[18]|INFO|PollingV6Bridge.Communication.DeviceListener|PINPAD: connecting\r\n';

describe('PollingV6', () => {
  it('searches literal text case-insensitively across the full event and combines it with quick filters', () => {
    const events = parseLog(first + second, 'polling').events;
    const range = getSuggestedRange(events)!;
    expect(filterPollingEvents(events, range, { quick: [], text: 'CONTINUATION' })).toEqual([events[0]]);
    expect(filterPollingEvents(events, range, { quick: [], text: '[18]' })).toEqual([events[1]]);
    expect(filterPollingEvents(events, range, { quick: ['responses'], text: 'PINPAD' })).toEqual([]);
    expect(filterPollingEvents(events, range, { quick: [], text: '.*' })).toEqual([]);
    expect(filterPollingEvents(events, range, { quick: [], text: '' })).toEqual(events);
  });
  const line = (message: string, second = '30', thread = '12') => `2026-11-03 13:31:${second}.0000|0|[${thread}]|INFO|PollingV6Bridge.Hub|${message}\n`;
  it('classifies Hub requests and responses without treating JSON names as directions', () => {
    const events = parseLog(line('Starting Pay with request {}') + line('Ended Pay. Response : {"Success":false}', '31') + line('Starting Pending with request {"ResponseTimeout":100}', '32') + line('Building RequestType and ResponseType', '33'), 'polling').events;
    const range = getSuggestedRange(events)!;
    const ids = (quick: 'requests' | 'responses' | 'failures' | 'missing' | 'communication') => filterPollingEvents(events, range, { quick: [quick] }).map(e => e.lineNumber);
    expect(ids('requests')).toEqual([1, 3]);
    expect(ids('responses')).toEqual([2]);
    expect(ids('failures')).toEqual([1, 2]);
    expect(ids('missing')).toEqual([3]);
    expect(ids('communication')).toEqual([]);
    expect(filterPollingEvents(events, range, { quick: ['requests', 'failures'] }).map(e => e.lineNumber)).toEqual([1]);
    expect(filterPollingEvents(events, range, { quick: ['requests', 'responses'] }).map(e => e.lineNumber)).toEqual([1, 2, 3]);
    expect(filterPollingEvents(events, range, { quick: ['requests', 'responses', 'failures'] }).map(e => e.lineNumber)).toEqual([1, 2]);
    expect(filterPollingEvents(events, range, { quick: ['failures', 'missing'] }).map(e => e.lineNumber)).toEqual([1, 2, 3]);
    expect(filterPollingEvents(events, { ...range, endTime: '13:31:30' }, { quick: ['missing'] })).toEqual([]);
  });
  it('does not pair overlapping Hub calls or calls on different threads', () => {
    const events = parseLog(line('Starting Pay with request {}') + line('Starting Pay with request {}') + line('Ended Pay. Response : {}') + line('Starting Other with request {}') + line('Ended Other. Response : {}', '31', '99'), 'polling').events;
    expect(filterPollingEvents(events, getSuggestedRange(events)!, { quick: ['missing'] }).map(e => e.lineNumber)).toEqual([1, 2, 4]);
  });
  it('requires transaction start and explicit completion, and excludes aborted transactions', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    const other = '22222222-2222-2222-2222-222222222222';
    const text = line(`Started new transaction with id ${id}`)
      + line(`Starting listening for transaction with id '${id}' and request type 'A1'`)
      + line(`ACK response received correctly in the transaction with id ${id}, the request type A1 is considered correctly been handled by the PED`, '31', '98')
      + line(`Transaction with id ${id} was completed correctly due to reason: ProductSaleFlow ended`, '32')
      + line(`Started new transaction with id ${other}`)
      + line(`Transaction with id ${other} was aborted due to reason: FAILURE`)
      + line(`Transaction with id ${other} completed.`);
    const events = parseLog(text, 'polling').events;
    const range = getSuggestedRange(events)!;
    expect(filterPollingEvents(events, range, { quick: ['complete'] }).map(e => e.lineNumber)).toEqual([1, 2, 3, 4]);
    expect(filterPollingEvents(events, range, { quick: ['failures'] }).map(e => e.lineNumber)).toEqual([5, 6, 7]);
    expect(filterPollingEvents(events, range, { quick: ['missing'] })).toEqual([]);
    const ackOnly = events.slice(0, 3);
    expect(filterPollingEvents(ackOnly, range, { quick: ['complete'] })).toEqual([]);
  });
  it('recognizes wire directions, communication errors and avoids successful status messages', () => {
    const events = parseLog(line('REQUEST IP:example:DeviceID:a:<STX><NACK><ETX>') + line('RESPONSE IP:example:DeviceID:a:<STX><ACK>0<ETX>') + line('Host connection timeout') + line('Socket disconnected') + line('The message was received properly and has no structural errors.') + line('Host connection established.'), 'polling').events;
    const range = getSuggestedRange(events)!;
    expect(filterPollingEvents(events, range, { quick: ['requests'] }).map(e => e.lineNumber)).toEqual([1]);
    expect(filterPollingEvents(events, range, { quick: ['responses'] }).map(e => e.lineNumber)).toEqual([2]);
    expect(filterPollingEvents(events, range, { quick: ['communication'] }).map(e => e.lineNumber)).toEqual([1, 3, 4]);
    expect(filterPollingEvents(events, range, { quick: ['failures'] })).toEqual([]);
  });
  it('preserves raw text, multiline messages, pipes and metadata', () => {
    const result = parseLog('\uFEFF' + first + second, 'polling');
    expect(result.issues).toEqual([]);
    expect(result.events).toHaveLength(2);
    expect(result.events.map(e => e.raw).join('')).toBe('\uFEFF' + first + second);
    expect(result.events[0]).toMatchObject({ level: 'DEBUG', thread: '[12]', component: 'PollingV6Bridge.Hub.PollingV6Hub', timestampText: '2026-11-03 13:31:29.9999' });
    expect(result.events[0]!.message).toContain('|extra\r\n  continuation');
  });
  it('includes the entire last second and applies quick filters', () => {
    const events = parseLog(first + second, 'polling').events;
    const range = { startDate: '2026-11-03', endDate: '2026-11-03', startTime: '13:31:29', endTime: '13:31:29' };
    expect(filterPollingEvents(events, range, EMPTY_POLLING_FILTERS)).toEqual([events[0]]);
    const full = getSuggestedRange(events)!;
    expect(filterPollingEvents(events, full, { quick: [] })).toEqual(events);
    expect(filterPollingEvents(events, full, { quick: ['complete'] })).toEqual([]);
  });
  it('orders four-digit fractions and rejects invalid dates', () => {
    const events = parseLog(first + first.replace('.9999', '.9991'), 'polling').events;
    expect(sortEvents(events).map(e => e.lineNumber)).toEqual([3, 1]);
    expect(parseLog(first.replace('11-03', '02-30'), 'polling').events).toEqual([]);
    expect(parseLog(first).events).toEqual([]);
  });
});
