import type { LogEvent } from '../types/log.types';
import { TRANSACTION_FIELDS } from '../types/transactionFilters.types';
import type { TransactionField, TransactionFilter, TransactionValues } from '../types/transactionFilters.types';

const fieldByKey = new Map(TRANSACTION_FIELDS.filter((field) => !field.id.includes('.')).map((field) => [field.id.toLowerCase(), field.id]));
const cache = new WeakMap<LogEvent, TransactionValues>();

/** Comparação decimal exata, sem arredondamentos de floating point. */
function normalizeDecimal(value: string): string | null {
  const match = /^([+-]?)(\d+)(?:[.,](\d+))?(?:e([+-]?\d+))?$/i.exec(value.trim());
  if (!match) return null;
  const exponent = Number(match[4] ?? 0);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 1000) return null;
  const fraction = match[3] ?? '';
  let digits = match[2]! + fraction;
  const position = match[2]!.length + exponent;
  if (position <= 0) digits = '0.' + '0'.repeat(-position) + digits;
  else if (position >= digits.length) digits += '0'.repeat(position - digits.length);
  else digits = digits.slice(0, position) + '.' + digits.slice(position);
  let [integer = '', decimals = ''] = digits.split('.');
  integer = integer.replace(/^0+(?=\d)/, '');
  decimals = decimals.replace(/0+$/, '');
  const normalized = integer + (decimals ? '.' + decimals : '');
  return (match[1] === '-' && normalized !== '0' ? '-' : '') + normalized;
}

function normalize(field: TransactionField, value: string): string | null {
  const definition = TRANSACTION_FIELDS.find((item) => item.id === field);
  return definition?.kind === 'decimal' ? normalizeDecimal(value) : value.trim().toLowerCase();
}

export function validateTransactionFilters(filters: readonly TransactionFilter[]): void {
  const used = new Set<string>();
  for (const filter of filters) {
    const definition = TRANSACTION_FIELDS.find((item) => item.id === filter.field);
    if (!definition || used.has(filter.field)) throw new Error('Selecione campos distintos e válidos para os filtros adicionais.');
    used.add(filter.field);
    if (!filter.value.trim()) throw new Error(`Preencha o filtro «${definition.label}» ou remova-o.`);
    if (normalize(filter.field, filter.value) === null) throw new Error(`Introduza um número válido em «${definition.label}» (por exemplo, 16,45).`);
  }
}

/** Extrai blocos JSON completos sem confundir colchetes/chavetas dentro de strings. */
function jsonDocuments(text: string): unknown[] {
  const documents: unknown[] = [];
  let index = 0;
  while (index < text.length) {
    if (text[index] !== '{' && text[index] !== '[') { index += 1; continue; }
    const start = index;
    const stack: string[] = [];
    let quoted = false;
    let escaped = false;
    do {
      const char = text[index++]!;
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === '{' || char === '[') stack.push(char);
      else if (char === '}' || char === ']') {
        if (stack.pop() !== (char === '}' ? '{' : '[')) break;
      }
    } while (index < text.length && (quoted || stack.length));
    const json = text.slice(start, index);
    try {
      JSON.parse(json); // Validar antes de transformar tokens numéricos em texto.
      const lossless = json.replace(/"(?:\\[\s\S]|[^"\\])*"|(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi,
        (token: string, number: string | undefined) => number === undefined ? token : JSON.stringify(number));
      documents.push(JSON.parse(lossless) as unknown);
    } catch { /* Texto não JSON ou incompleto não constitui uma correspondência. */ }
  }
  return documents;
}

export function extractTransactionValues(event: LogEvent): TransactionValues {
  const cached = cache.get(event);
  if (cached) return cached;
  const values: TransactionValues = {};
  const add = (field: TransactionField, value: unknown) => {
    if (typeof value !== 'string') return;
    const normalized = normalize(field, value);
    if (normalized === null || normalized === '') return;
    (values[field] ??= new Set()).add(normalized);
  };
  const pending = jsonDocuments(event.message).map((value) => ({ value, path: [] as string[], encodedDepth: 0 }));
  while (pending.length) {
    const { value, path, encodedDepth } = pending.pop()!;
    if (Array.isArray(value)) {
      value.forEach((item: unknown) => pending.push({ value: item, path, encodedDepth }));
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        const lower = key.toLowerCase();
        const field = fieldByKey.get(lower);
        if (field) add(field, child);
        if (lower === 'loyaltyid') add('clientLoyalty.id', child);
        const parent = path.at(-1);
        // O Id genérico nunca corresponde ao ID de fidelização de outros objetos.
        const loyalty = parent === 'clientloyalty' || (parent === 'transaction' && path.at(-2) === 'partnerinfo');
        if (loyalty && lower === 'id') add('clientLoyalty.id', child);
        if (loyalty && lower === 'cardid') add('clientLoyalty.cardId', child);
        pending.push({ value: child, path: [...path, lower], encodedDepth });
      }
    } else if (typeof value === 'string' && encodedDepth < 3 && /^[\s]*[\[{]/.test(value)) {
      for (const nested of jsonDocuments(value)) pending.push({ value: nested, path, encodedDepth: encodedDepth + 1 });
    }
  }
  // Os requests também registam o GUID na query string e em mensagens textuais.
  const guid = /\btransaction\s*guid\s*(?:=|:)\s*([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})(?![\da-f-])/gi;
  for (const match of event.message.matchAll(guid)) add('transactionGuid', match[1]);
  cache.set(event, values);
  return values;
}

export function createTransactionMatcher(filters: readonly TransactionFilter[]): (event: LogEvent) => boolean {
  validateTransactionFilters(filters);
  if (!filters.length) return () => true;
  const criteria = filters.map(({ field, value }) => ({ field, value: normalize(field, value)! }));
  return (event) => {
    const values = extractTransactionValues(event);
    return criteria.every(({ field, value }) => values[field]?.has(value) === true);
  };
}
