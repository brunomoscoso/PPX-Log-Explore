/** Identificadores inventados; não copiar dados internos para esta fixture. */
export const transactionPayload = {
  lines: [{ clientLoyalty: { articleCode: 'TEST-ARTICLE-01', articleCodeFamily: '07', quantity: 12.5, totalAmount: 25, vat: 23 } }],
  discountCoupons: [{ clientLoyalty: { discountCouponsId: 'TEST-COUPON-01', mopId: '0099' } }],
  partnerInfoTransaction: { clientLoyalty: { id: '9007199254740993001', cardId: '0000001234' } },
  transactionGuid: '11111111-2222-4333-8444-555555555555',
  POSTransactionID: 1018713,
};

export const transactionEvent = (payload: unknown, time = '14:34:00.000') =>
  `2026/10/26 ${time}|DEBUG|[1]|||test|Example.TransactionService - Request sintético\r\nRequest Body:${JSON.stringify(payload)}\r\n`;

export const matchingTransaction = transactionEvent(transactionPayload);
export const otherTransaction = transactionEvent({ ...transactionPayload, partnerInfoTransaction: { clientLoyalty: { id: '9007199254740993002', cardId: '0000005678' } } }, '14:34:01.000');
export const transactionLog = matchingTransaction + otherTransaction + transactionEvent({ articleCode: 'OTHER', totalAmount: 50 }, '14:34:02.000');
