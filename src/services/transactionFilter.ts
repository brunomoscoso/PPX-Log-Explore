import type { LogEvent } from '../types/log.types';

export const TRANSACTION_FIELDS = [
  { key: 'transaction', label: 'Número da transação', placeholder: 'Ex.: 1018225', aliases: ['transactionexternalid', 'origintransactionid', 'nativeid'] },
  { key: 'article', label: 'Número do artigo', placeholder: 'Ex.: P0402830000 ou 0402830000', aliases: ['articlecode'] },
  { key: 'position', label: 'Número da posição', placeholder: 'Ex.: 11401', aliases: ['businessunitexternalcode'] },
  { key: 'family', label: 'Família do artigo', placeholder: 'Ex.: 23', aliases: ['articlecodefamily'] },
  { key: 'quantity', label: 'Litros de combustível', placeholder: 'Ex.: 5,83 ou 5.83 (sem L)', aliases: ['quantity'] },
  { key: 'total', label: 'Total da transação', placeholder: 'Ex.: 10 ou 10,00 (sem €)', aliases: ['totalamount'] },
  { key: 'discountedTotal', label: 'Total com desconto', placeholder: 'Ex.: 10 ou 10,00 (sem €)', aliases: ['amountwithdiscount'] },
  { key: 'card', label: 'Cartão Continente', placeholder: 'Ex.: 1850000000000 (sem espaços)', aliases: ['cardid'] },
  { key: 'phone', label: 'Telemóvel Continente', placeholder: 'Ex.: 900000001 (como no log)', aliases: ['partnerbarcode'] },
  { key: 'voucher', label: 'Cupão Continente', placeholder: 'Ex.: 185000000000000001', aliases: [] },
  { key: 'invoice', label: 'Número da fatura (com tipo)', placeholder: 'Ex.: FS 102010015442FSAA011401/000001832', aliases: ['invoicenumber', 'referenceid'] },
  { key: 'invoiceType', label: 'Tipo da fatura', placeholder: 'Ex.: Fatura Simplificada', aliases: ['subtype'] },
  { key: 'mop', label: 'MOP', placeholder: 'Ex.: 9201', aliases: [] },
  { key: 'ticket', label: 'Número do ticket', placeholder: 'Ex.: 11401031120261107699', aliases: ['ticketnumber'] },
] as const;
export type TransactionField = typeof TRANSACTION_FIELDS[number]['key'];
export type TransactionFilterValues = Partial<Record<TransactionField, string>> & { text?: string };
type Values = Map<TransactionField, string[]>;
const cache = new WeakMap<LogEvent, Values>();

/** Extract complete JSON blocks embedded in messages. Never alters the original log. */
function jsonBlocks(text: string): unknown[] {
  const result: unknown[] = [];
  let start = -1, depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (start < 0) {
      if (char !== '{' && char !== '[') continue;
      start = i; depth = 1; quoted = false; escaped = false;
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') {
      if (--depth === 0) {
        try { result.push(JSON.parse(text.slice(start, i + 1))); } catch { /* Non-JSON text. */ }
        start = -1;
      }
    }
  }
  return result;
}

function eventValues(event: LogEvent): Values {
  const existing = cache.get(event);
  if (existing) return existing;
  const values: Values = new Map();
  const add = (key: TransactionField, value: unknown) => {
    if (typeof value !== 'string' && typeof value !== 'number') return;
    values.set(key, [...(values.get(key) ?? []), String(value)]);
  };
  const visit = (value: unknown, path: string[]) => {
    if (Array.isArray(value)) { value.forEach(item => visit(item, path)); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const lower = key.toLowerCase();
      for (const field of TRANSACTION_FIELDS) {
        if ((field.aliases as readonly string[]).includes(lower)) add(field.key, child);
      }
      if (lower === 'code' && path.at(-1) === 'clientloyalty' && path.at(-2) === 'vouchers') add('voucher', child);
      if (lower === 'externalcode' && path.at(-1) === 'clienttransactionsmops') add('mop', child);
      visit(child, [...path, lower]);
    }
  };
  jsonBlocks(event.message).forEach(value => visit(value, []));
  cache.set(event, values);
  return values;
}

function decimal(value: string): string {
  const normalized = value.trim().replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return normalized;
  const [integer = '', fraction = ''] = normalized.replace(/^[+-]/, '').split('.');
  const whole = integer.replace(/^0+(?=\d)/, '');
  const tail = fraction.replace(/0+$/, '');
  return `${normalized.startsWith('-') && (whole !== '0' || tail) ? '-' : ''}${whole}${tail ? '.' + tail : ''}`;
}

/** AND between fields; aliases and correlated request/response values use OR. */
export function matchesTransactionFilters(events: readonly LogEvent[], filters: TransactionFilterValues = {}): boolean {
  const query = (filters.text ?? '').toLowerCase();
  if (query && !events.some(event => event.raw.toLowerCase().includes(query))) return false;
  return TRANSACTION_FIELDS.every(({ key }) => {
    const query = filters[key]?.trim();
    if (!query) return true;
    const numeric = key === 'quantity' || key === 'total' || key === 'discountedTotal';
    return events.some(event => (eventValues(event).get(key) ?? []).some(value =>
      numeric ? decimal(value) === decimal(query) : value === query));
  });
}
