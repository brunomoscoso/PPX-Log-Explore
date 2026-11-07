import { describe, expect, it } from 'vitest';
import { parseLog } from '../../src/services/logParser';
import { filterEvents, getSuggestedRange } from '../../src/services/logFilter';
import { buildHttpPairs } from '../../src/services/httpPairs';
import { buildHttpErrorCalls, filterHttpErrorCalls } from '../../src/services/httpErrors';
import { matchesTransactionFilters } from '../../src/services/transactionFilter';
import { httpRequest, httpResponse } from '../fixtures/httpLogs';

const event = (body: unknown) => parseLog(`2026/10/26 14:34:00.000|INFO|Example - payload ${JSON.stringify(body)}\n`).events[0]!;

describe('ComServer transaction filters', () => {
  it('matches invoice type, full ticket and MOP within its specific collection', () => {
    const item = event({ subType: 'Fatura Simplificada', ticketNumber: '11401031120261107699', clientTransactionsMops: [{ externalCode: '9201' }, { externalCode: '0012' }] });
    expect(matchesTransactionFilters([item], { invoiceType: 'Fatura Simplificada', ticket: '11401031120261107699', mop: '9201' })).toBe(true);
    expect(matchesTransactionFilters([item], { ticket: '11401031120261107698' })).toBe(false);
    expect(matchesTransactionFilters([item], { invoiceType: 'Fatura' })).toBe(false);
    expect(matchesTransactionFilters([item], { mop: '0012' })).toBe(true);
    expect(matchesTransactionFilters([item], { mop: '12' })).toBe(false);
    expect(matchesTransactionFilters([event({ externalCode: '9201', other: [{ externalCode: '9201' }], clientTransactionsMops: [{ nested: { externalCode: '9201' } }] })], { mop: '9201' })).toBe(false);
  });
  it.each(['TransactionExternalId', 'originTransactionId', 'nativeId'])('matches transaction alias %s exactly', key => {
    expect(matchesTransactionFilters([event({ [key]: '00125' })], { transaction: '00125' })).toBe(true);
    expect(matchesTransactionFilters([event({ [key]: '00125' })], { transaction: '125' })).toBe(false);
  });
  it.each(['invoiceNumber', 'referenceId'])('matches invoice alias %s including type', key => {
    expect(matchesTransactionFilters([event({ [key]: 'FS DEMO/001' })], { invoice: 'FS DEMO/001' })).toBe(true);
    expect(matchesTransactionFilters([event({ [key]: 'FS DEMO/001' })], { invoice: 'DEMO/001' })).toBe(false);
  });
  it('combines all fields, supports nested arrays, arbitrary article prefixes and decimal commas', () => {
    const item = event({ TransactionExternalId: '125', lines: [{ ArticleCode: 'X001', BusinessUnitExternalCode: '011', ArticleCodeFamily: '23', Quantity: 5.83, TotalAmount: 10, AmountWithDiscount: 9.5 }], cardId: '000123', partnerBarcode: '900000001', vouchers: [{ clientLoyalty: { code: '000456' } }], invoiceNumber: 'FS DEMO/001' });
    const filters = { transaction: '125', article: 'X001', position: '011', family: '23', quantity: '5,830', total: '10.00', discountedTotal: '9,5', card: '000123', phone: '900000001', voucher: '000456', invoice: 'FS DEMO/001' };
    expect(matchesTransactionFilters([item], filters)).toBe(true);
    expect(matchesTransactionFilters([item], { ...filters, family: '2' })).toBe(false);
    expect(matchesTransactionFilters([item], { quantity: '5.8' })).toBe(false);
  });
  it('does not confuse unrelated code fields or property names in message strings', () => {
    expect(matchesTransactionFilters([event({ code: '123', clientLoyalty: { code: '123' }, vouchers: [{ code: '123' }] })], { voucher: '123' })).toBe(false);
    expect(matchesTransactionFilters([event({ message: '\"ArticleCode\":\"X001\"' })], { article: 'X001' })).toBe(false);
    expect(matchesTransactionFilters([event({ articleCode: 'X001' })], { article: 'X001' })).toBe(true);
  });
  it('keeps complete correlated pairs and filters error calls by response time', () => {
    const request = httpRequest('a', 'application/json', { articleCode: 'X001' }, '14:33:00.000');
    const response = httpResponse('a', '{"nativeId":"125"}', '14:34:01.000', 'BadRequest');
    const events = parseLog(request + response + httpResponse('orphan', '{}', '14:34:02.000', 'BadRequest')).events;
    const range = { ...getSuggestedRange(events)!, startTime: '14:34:00' };
    const pairs = buildHttpPairs(events);
    const filters = { article: 'X001', transaction: '125' };
    expect(filterEvents(events, range, pairs, filters).map(e => e.raw)).toEqual([request, response]);
    expect(filterEvents(events, range, pairs, { ...filters, text: 'x001' }).map(e => e.raw)).toEqual([request, response]);
    expect(filterEvents(events, range, pairs, { ...filters, text: '.*' })).toEqual([]);
    expect(filterHttpErrorCalls(buildHttpErrorCalls(events, pairs), range, { text: 'X001' })).toHaveLength(1);
    expect(filterHttpErrorCalls(buildHttpErrorCalls(events, pairs), range, { text: 'absent' })).toEqual([]);
    const calls = filterHttpErrorCalls(buildHttpErrorCalls(events, pairs), range, filters);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.requestOutsideRange).toBe(true);
    expect(filterEvents(events, range, pairs, { article: 'absent' })).toEqual([]);
  });
  it('ignores empty fields, preserves zero and handles multiple JSON blocks', () => {
    const item = event({ Quantity: 0 });
    expect(matchesTransactionFilters([item], { quantity: '0,00' })).toBe(true);
    expect(matchesTransactionFilters([item], { article: ' ' })).toBe(true);
    const multiple = { ...item, message: 'Request {"nativeId":"125"}\nResponse {"ArticleCode":"X001"}' };
    expect(matchesTransactionFilters([multiple], { transaction: '125', article: 'X001' })).toBe(true);
  });
});
