export const TRANSACTION_FIELDS = [
  { id: 'transactionGuid', label: 'GUID da transação', kind: 'text', placeholder: 'GUID completo' },
  { id: 'POSTransactionID', label: 'ID da transação POS', kind: 'text', placeholder: 'Ex.: 1018713' },
  { id: 'ticketNumber', label: 'Número do ticket', kind: 'text', placeholder: 'Número completo do ticket' },
  { id: 'articleCode', label: 'Código do artigo', kind: 'text', placeholder: 'Código completo' },
  { id: 'articleCodeFamily', label: 'Família do artigo', kind: 'text', placeholder: 'Código da família' },
  { id: 'quantity', label: 'Quantidade', kind: 'decimal', placeholder: 'Ex.: 16,45' },
  { id: 'totalAmount', label: 'Montante total', kind: 'decimal', placeholder: 'Ex.: 30,00' },
  { id: 'vat', label: 'IVA', kind: 'decimal', placeholder: 'Ex.: 23' },
  { id: 'discountCouponsId', label: 'ID do cupão', kind: 'text', placeholder: 'Identificador completo' },
  { id: 'mopId', label: 'Método de pagamento (MOP)', kind: 'text', placeholder: 'Código do método' },
  { id: 'clientLoyalty.id', label: 'ID de fidelização', kind: 'text', placeholder: 'clientLoyalty.id' },
  { id: 'clientLoyalty.cardId', label: 'Cartão de fidelização', kind: 'text', placeholder: 'clientLoyalty.cardId' },
  { id: 'clientLoyalty.code', label: 'Código de fidelização', kind: 'text', placeholder: 'Ex.: 185001031173934437' },
  { id: 'campaign', label: 'Campanha', kind: 'text', placeholder: 'Ex.: 1000015588' },
  { id: 'promotion', label: 'Promoção', kind: 'text', placeholder: 'Ex.: 10000195354' },
  { id: 'ContinenteBarcode', label: 'Código de barras Continente', kind: 'text', placeholder: 'Ex.: 903400037' },
  { id: 'Vouchers', label: 'Vouchers', kind: 'text', placeholder: 'Código do voucher' },
  { id: 'ContinenteCoupons', label: 'Cupões Continente', kind: 'text', placeholder: 'Código do cupão' },
  { id: 'ContinenteDiscountApplied', label: 'Desconto Continente aplicado', kind: 'decimal', placeholder: 'Ex.: 0' },
] as const;

export type TransactionField = typeof TRANSACTION_FIELDS[number]['id'];
export const TRANSACTION_FILTER_GROUPS: readonly { label: string; fields: readonly TransactionField[] }[] = [
  { label: 'Loyalt', fields: ['clientLoyalty.code', 'clientLoyalty.id', 'clientLoyalty.cardId', 'campaign', 'promotion'] },
  { label: 'Continente', fields: ['ContinenteBarcode', 'Vouchers', 'ContinenteCoupons', 'ContinenteDiscountApplied'] },
  { label: 'Transação', fields: ['transactionGuid', 'POSTransactionID', 'ticketNumber'] },
  { label: 'Artigos', fields: ['articleCode', 'articleCodeFamily', 'quantity', 'vat'] },
  { label: 'Pagamento', fields: ['totalAmount', 'discountCouponsId', 'mopId'] },
];
export interface TransactionFilter { field: TransactionField; value: string }
export type TransactionValues = Partial<Record<TransactionField, Set<string>>>;
