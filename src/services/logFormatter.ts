import type { LogEvent } from '../types/log.types';

/** Formata os tokens, sem converter números ou reordenar/eliminar propriedades. */
function indentJson(json: string): string {
  const tokens = json.match(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\],:]|[^\s{}\[\],:]+/g) ?? [];
  const output: string[] = [];
  let depth = 0;
  const newline = () => output.push('\n', '  '.repeat(depth));
  tokens.forEach((token, index) => {
    const previous = tokens[index - 1];
    const next = tokens[index + 1];
    if (token === '{' || token === '[') {
      output.push(token);
      depth += 1;
      if (next !== '}' && next !== ']') newline();
    } else if (token === '}' || token === ']') {
      depth -= 1;
      if (previous !== '{' && previous !== '[') newline();
      output.push(token);
    } else if (token === ',') {
      output.push(token);
      newline();
    } else if (token === ':') {
      output.push(': ');
    } else {
      output.push(token);
    }
  });
  return output.join('');
}

/** Localiza JSONs completos, incluindo os que surgem após texto/labels. */
export function formatLogMessage(message: string): string {
  const output: string[] = [];
  let cursor = 0;
  let index = 0;
  while (index < message.length) {
    const opening = message[index];
    if (opening !== '{' && opening !== '[') { index += 1; continue; }
    const start = index;
    const stack: string[] = [];
    let quoted = false;
    let escaped = false;
    do {
      const char = message[index]!;
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === '{' || char === '[') stack.push(char);
      else if (char === '}' || char === ']') {
        const expected = char === '}' ? '{' : '[';
        if (stack.pop() !== expected) break;
      }
      index += 1;
    } while (index < message.length && (stack.length > 0 || quoted));

    const candidate = message.slice(start, index);
    try {
      // Validar apenas. JSON.stringify(JSON.parse(...)) alteraria inteiros grandes,
      // a representação de números e propriedades duplicadas nos logs.
      JSON.parse(candidate);
    } catch {
      index = Math.max(index, start + 1);
      continue;
    }
    const prefix = message.slice(cursor, start);
    output.push(prefix);
    if (start > 0 && message[start - 1] !== '\n' && message[start - 1] !== '\r') output.push('\n');
    output.push(indentJson(candidate));
    cursor = index;
  }
  output.push(message.slice(cursor));
  return output.join('');
}

/** Só altera a apresentação da mensagem; o cabeçalho e event.raw ficam intactos. */
export function formatEventForDisplay(event: Pick<LogEvent, 'raw' | 'message'>): string {
  if (!event.message || !event.raw.endsWith(event.message)) return event.raw;
  const prefix = event.raw.slice(0, event.raw.length - event.message.length);
  const formatted = formatLogMessage(event.message);
  const separator = /^[{\[]/.test(event.message) && prefix && formatted !== event.message ? '\n' : '';
  return prefix + separator + formatted;
}
