export const TRANSACTION_FIELDS = [
  { id: 'transactionGuid', label: 'GUID da transação', kind: 'text', placeholder: 'GUID completo' },
  { id: 'POSTransactionID', label: 'ID da transação POS', kind: 'text', placeholder: 'Ex.: 1018713' },
  { id: 'articleCode', label: 'Código do artigo', kind: 'text', placeholder: 'Código completo' },
  { id: 'articleCodeFamily', label: 'Família do artigo', kind: 'text', placeholder: 'Código da família' },
  { id: 'quantity', label: 'Quantidade', kind: 'decimal', placeholder: 'Ex.: 16,45' },
  { id: 'totalAmount', label: 'Montante total', kind: 'decimal', placeholder: 'Ex.: 30,00' },
  { id: 'vat', label: 'IVA', kind: 'decimal', placeholder: 'Ex.: 23' },
  { id: 'discountCouponsId', label: 'ID do cupão', kind: 'text', placeholder: 'Identificador completo' },
  { id: 'mopId', label: 'Método de pagamento (MOP)', kind: 'text', placeholder: 'Código do método' },
  { id: 'clientLoyalty.id', label: 'ID de fidelização', kind: 'text', placeholder: 'clientLoyalty.id' },
  { id: 'clientLoyalty.cardId', label: 'Cartão de fidelização', kind: 'text', placeholder: 'clientLoyalty.cardId' },
] as const;

export type TransactionField = typeof TRANSACTION_FIELDS[number]['id'];
export interface TransactionFilter { field: TransactionField; value: string }
export type TransactionValues = Partial<Record<TransactionField, Set<string>>>;
