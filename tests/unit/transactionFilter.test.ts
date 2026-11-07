import { describe, expect, it } from 'vitest';
import { parseLog } from '../../src/services/logParser';
import { filterEvents, getSuggestedRange } from '../../src/services/logFilter';
import { extractTransactionValues, validateTransactionFilters } from '../../src/services/transactionFilter';
import { serializeEvents } from '../../src/services/logExporter';
import type { TransactionFilter } from '../../src/types/transactionFilters.types';
import { matchingTransaction, transactionEvent, transactionLog } from '../fixtures/transactionLogs';

const range = { startDate: '2026-10-26', startTime: '14:34:00', endDate: '2026-10-26', endTime: '14:34:01' };
const criteria: TransactionFilter[] = [
  { field: 'articleCode', value: 'TEST-ARTICLE-01' },
  { field: 'articleCodeFamily', value: '07' },
  { field: 'quantity', value: '12,50' },
  { field: 'totalAmount', value: '25.00' },
  { field: 'vat', value: '23' },
  { field: 'discountCouponsId', value: 'TEST-COUPON-01' },
  { field: 'mopId', value: '0099' },
  { field: 'clientLoyalty.id', value: '9007199254740993001' },
  { field: 'clientLoyalty.cardId', value: '0000001234' },
  { field: 'transactionGuid', value: '11111111-2222-4333-8444-555555555555' },
];

describe('filtros de campos da transação', () => {
  it('pesquisa Continente em pares Key/Value com listas e strings escapadas', () => {
    const encoded = (value: unknown) => JSON.stringify(JSON.stringify(JSON.stringify(value)));
    const input = transactionEvent({ properties: [
      { Key: 'ContinenteBarcode', Value: JSON.stringify('00903400001') },
      { Key: 'Vouchers', Value: encoded(['185001031173934001', '00042']) },
      { Key: { '#text': 'ContinenteCoupons', '@xmlns': '' }, Value: { '#text': encoded(['COUPON-01']) } },
      { Key: 'ContinenteDiscountApplied', Value: '0' },
    ] });
    const filters: TransactionFilter[] = [
      { field: 'ContinenteBarcode', value: '00903400001' },
      { field: 'Vouchers', value: '185001031173934001' },
      { field: 'ContinenteCoupons', value: 'COUPON-01' },
      { field: 'ContinenteDiscountApplied', value: '0,00' },
    ];
    const events = parseLog(input).events;
    expect(filterEvents(events, range, filters)).toHaveLength(1);
    expect(filterEvents(events, range, [{ field: 'Vouchers', value: '00042' }])).toHaveLength(1);
    expect(filterEvents(events, range, [{ field: 'Vouchers', value: '42' }])).toHaveLength(0);
    expect(filterEvents(events, range, [{ field: 'ContinenteBarcode', value: '009034' }])).toHaveLength(0);
  });

  it('suporta campos Continente diretos e números longos dentro de listas codificadas', () => {
    const input = transactionEvent({ ContinenteBarcode: '00001', Vouchers: '[9803100021585485001]', ContinenteCoupons: ['001', '002'], ContinenteDiscountApplied: 0 });
    expect(filterEvents(parseLog(input).events, range, [
      { field: 'ContinenteBarcode', value: '00001' },
      { field: 'Vouchers', value: '9803100021585485001' },
      { field: 'ContinenteCoupons', value: '002' },
      { field: 'ContinenteDiscountApplied', value: '0' },
    ])).toHaveLength(1);
  });

  it('não associa Value de outro objeto nem valores vazios ou incompletos ao Continente', () => {
    const input = transactionEvent({ properties: [
      { Key: 'ContinenteBarcode' }, { Key: 'Other', Value: '9034' },
      { Key: 'Vouchers', Value: '["123"' },
      { Key: 'ContinenteCoupons', Value: '[]' },
    ] });
    const events = parseLog(input).events;
    for (const filter of [
      { field: 'ContinenteBarcode', value: '9034' },
      { field: 'Vouchers', value: '123' },
      { field: 'ContinenteCoupons', value: '[]' },
    ] satisfies TransactionFilter[]) expect(filterEvents(events, range, [filter])).toHaveLength(0);
  });

  it('combina os cinco campos Loyalt sem perder precisão nos identificadores', () => {
    const payload = '{"clientLoyalty":{"code":185001031173934437,"id":9803100021585485775,"cardId":"1859590225275"},"campaign":"1000015588","promotion":"10000195354"}';
    const input = transactionEvent({}).replace('{}', payload);
    const filters: TransactionFilter[] = [
      { field: 'clientLoyalty.code', value: '185001031173934437' },
      { field: 'clientLoyalty.id', value: '9803100021585485775' },
      { field: 'clientLoyalty.cardId', value: '1859590225275' },
      { field: 'campaign', value: '1000015588' },
      { field: 'promotion', value: '10000195354' },
    ];
    const events = parseLog(input).events;
    expect(filterEvents(events, range, filters)).toHaveLength(1);
    for (const filter of filters) {
      expect(filterEvents(events, range, [{ ...filter, value: filter.value.slice(0, -1) }])).toHaveLength(0);
    }
  });

  it('reconhece código Loyalt aninhado e ignora códigos de outros objetos', () => {
    const filter: TransactionFilter = { field: 'clientLoyalty.code', value: '00185' };
    const input = transactionEvent({ nested: [{ clientLoyalty: { code: '00185' } }] });
    expect(filterEvents(parseLog(input).events, range, [filter])).toHaveLength(1);
    const unrelated = transactionEvent({ code: '00185', article: { code: '00185' }, clientLoyalty: { id: '00185' } });
    expect(filterEvents(parseLog(unrelated).events, range, [filter])).toHaveLength(0);
    expect(filterEvents(parseLog(input).events, range, [{ ...filter, value: '185' }])).toHaveLength(0);
  });

  it('inclui pedido inicial na pesquisa pelo LoyaltyId', () => {
    const request = 'Request Header:{"Timestamp":"30/09/2026 14:34:40.580"}\n' +
      'Request Body:{"LoyaltyId":"700000000000000001","BasketLines":[{"ArticleCode":"ITEM-01"}]}\n';
    const next = '2026/09/30 14:34:40.590|INFO|Example - Next';
    const events = parseLog(request + next).events;
    const range = getSuggestedRange(events)!;

    const results = filterEvents(events, range, [
      { field: 'clientLoyalty.id', value: '700000000000000001' },
      { field: 'articleCode', value: 'ITEM-01' },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.raw).toBe(request);
  });

  it.each(criteria)('reconhece $field em objetos e listas aninhadas', (filter) => {
    expect(filterEvents(parseLog(matchingTransaction).events, range, [filter])).toHaveLength(1);
  });

  it('combina todos os campos no mesmo evento e preserva a exportação original', () => {
    const events = parseLog(transactionLog).events;
    const results = filterEvents(events, range, criteria);
    expect(results).toHaveLength(1);
    expect(serializeEvents(results)).toBe(matchingTransaction);
    expect(events).toHaveLength(3);
  });

  it('não reúne campos que só existem em eventos distintos da mesma transação', () => {
    const guid = criteria.at(-1)!.value;
    const input = transactionEvent({ articleCode: 'A', transactionGuid: guid }) + transactionEvent({ clientLoyalty: { cardId: 'B' }, transactionGuid: guid });
    expect(filterEvents(parseLog(input).events, range, [{ field: 'articleCode', value: 'A' }, { field: 'clientLoyalty.cardId', value: 'B' }])).toEqual([]);
  });

  it('reconhece variantes de maiúsculas, sem depender de espaços ou posição', () => {
    const input = transactionEvent({ BasketLines: [{ ArticleCode: 'test-article-01', Quantity: 12.5 }], PartnerInfo: { Transaction: { Id: '123', CardId: '0042' } } });
    expect(filterEvents(parseLog(input).events, range, [criteria[0]!, criteria[2]!, { field: 'clientLoyalty.cardId', value: '0042' }, { field: 'clientLoyalty.id', value: '123' }])).toHaveLength(1);
  });

  it('reconhece POSTransactionID numérico e exige correspondência exata', () => {
    const events = parseLog(transactionEvent({ POSTransactionID: 1018713 })).events;
    expect(filterEvents(events, range, [{ field: 'POSTransactionID', value: '1018713' }])).toHaveLength(1);
    expect(filterEvents(events, range, [{ field: 'POSTransactionID', value: '101871' }])).toHaveLength(0);
  });

  it('preserva IDs numéricos maiores que Number.MAX_SAFE_INTEGER', () => {
    const input = transactionEvent({}).replace('{}', '{"clientLoyalty":{"id":9007199254740993001}}');
    const events = parseLog(input).events;
    expect(filterEvents(events, range, [criteria[7]!])).toHaveLength(1);
    expect(filterEvents(events, range, [{ field: 'clientLoyalty.id', value: '9007199254740993000' }])).toHaveLength(0);
  });

  it('não confunde Id/CardId genéricos, quantityAvg ou valores parciais', () => {
    const events = parseLog(transactionEvent({ id: '123', cardId: '0042', other: { id: '123' }, quantityAvg: 12.5, articleCode: 'TEST-ARTICLE-010' })).events;
    for (const filter of [criteria[0]!, criteria[2]!, { field: 'clientLoyalty.id', value: '123' } as const, { field: 'clientLoyalty.cardId', value: '0042' } as const]) {
      expect(filterEvents(events, range, [filter])).toHaveLength(0);
    }
  });

  it('mantém zeros iniciais nos códigos e aceita zeros/negativos nos montantes', () => {
    const events = parseLog(transactionEvent({ mopId: '0099', quantity: 0, totalAmount: -1.5 })).events;
    expect(filterEvents(events, range, [{ field: 'mopId', value: '99' }])).toHaveLength(0);
    expect(filterEvents(events, range, [{ field: 'quantity', value: '0,00' }, { field: 'totalAmount', value: '-1,50' }])).toHaveLength(1);
  });

  it('compara decimais e notação científica sem perder precisão', () => {
    const input = transactionEvent({}).replace('{}', '{"totalAmount":9007199254740993.25,"quantity":1.25e1}');
    const events = parseLog(input).events;
    expect(filterEvents(events, range, [{ field: 'totalAmount', value: '9007199254740993,250' }, criteria[2]!])).toHaveLength(1);
    expect(filterEvents(events, range, [{ field: 'totalAmount', value: '9007199254740993,26' }])).toHaveLength(0);
  });

  it('respeita o intervalo e o segundo final completo mesmo com filtros adicionais', () => {
    const input = transactionEvent({ articleCode: 'A' }, '14:34:01.999') + transactionEvent({ articleCode: 'A' }, '14:34:02.000');
    const results = filterEvents(parseLog(input).events, range, [{ field: 'articleCode', value: 'A' }]);
    expect(results).toHaveLength(1);
    expect(results[0]?.timestampText).toBe('2026/10/26 14:34:01.999');
  });

  it('reconhece JSON em Request/Response e JSON codificado em strings', () => {
    const input = transactionEvent({ nested: JSON.stringify({ articleCode: 'A' }) }) + 'Response:{"clientLoyalty":{"cardId":"B"}}\r\n';
    expect(filterEvents(parseLog(input).events, range, [{ field: 'articleCode', value: 'A' }, { field: 'clientLoyalty.cardId', value: 'B' }])).toHaveLength(1);
  });

  it('reconhece GUID explícito na URL ou em mensagens, sem pesquisar valores soltos', () => {
    const guid = criteria.at(-1)!;
    for (const prefix of ['Method: POST, URI: https://example.invalid/?transactionGuid=', 'request for transaction guid = ']) {
      const input = transactionEvent({}) + prefix + guid.value;
      expect(filterEvents(parseLog(input).events, range, [guid])).toHaveLength(1);
    }
    expect(filterEvents(parseLog(transactionEvent({}) + guid.value).events, range, [guid])).toHaveLength(0);
  });

  it('ignora JSON inválido e campos em falta sem falhar', () => {
    for (const text of ['texto', '{"articleCode":"A"', '{"articleCode":null}', '{"articleCode":true}', '[pump] {}']) {
      const input = transactionEvent({}).replace('{}', text);
      expect(filterEvents(parseLog(input).events, range, [{ field: 'articleCode', value: 'A' }])).toHaveLength(0);
    }
  });

  it('reutiliza a extração sem modificar mensagens nem eventos', () => {
    const event = parseLog(matchingTransaction).events[0]!;
    const original = { ...event };
    expect(extractTransactionValues(event)).toBe(extractTransactionValues(event));
    expect(event).toEqual(original);
  });

  it.each(['', ' ', 'abc', '1,2,3', 'Infinity', '1e999999'])('valida entradas numéricas inválidas: %j', (value) => {
    expect(() => validateTransactionFilters([{ field: 'quantity', value }])).toThrow();
  });

  it('exige valor em campos adicionados e impede repetições', () => {
    expect(() => validateTransactionFilters([{ field: 'articleCode', value: '' }])).toThrow('Preencha');
    expect(() => validateTransactionFilters([criteria[0]!, criteria[0]!])).toThrow('distintos');
    expect(() => validateTransactionFilters([])).not.toThrow();
  });
});
