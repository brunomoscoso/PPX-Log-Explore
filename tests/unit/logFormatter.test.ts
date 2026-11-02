import { describe, expect, it } from 'vitest';
import { formatEventForDisplay, formatLogMessage } from '../../src/services/logFormatter';
import { parseLog } from '../../src/services/logParser';

describe('formatação visual de JSON nos logs', () => {
  it('indenta objetos e arrays aninhados depois do texto da mensagem', () => {
    expect(formatLogMessage('Received: {"name":"FpStatus_resp","data":{"FpId":"01","states":[1,2]}}')).toBe(
      'Received: \n{\n  "name": "FpStatus_resp",\n  "data": {\n    "FpId": "01",\n    "states": [\n      1,\n      2\n    ]\n  }\n}',
    );
  });

  it('reconhece vários blocos, JSON multiline e estruturas vazias', () => {
    expect(formatLogMessage('Header:{"id":1}\r\nBody:{\n"data":[],"extra":{}\n}\r\n')).toBe(
      'Header:\n{\n  "id": 1\n}\r\nBody:\n{\n  "data": [],\n  "extra": {}\n}\r\n',
    );
  });

  it('preserva números grandes, ordem, chaves duplicadas e escapes', () => {
    const input = '{"id":9007199254740993,"id":1e+30,"text":"a\\\"b } [ \\\\ c","html":"<script>x</script>"}';
    expect(formatLogMessage(input)).toBe(
      '{\n  "id": 9007199254740993,\n  "id": 1e+30,\n  "text": "a\\\"b } [ \\\\ c",\n  "html": "<script>x</script>"\n}',
    );
  });

  it.each(['plain text\r\n', 'invalid: {bad json}', 'partial: {"data":{"ok":true}', 'mismatch: {"data":[1,2}', '[pump] status', ''])('mantém texto sem JSON válido: %j', (input) => {
    expect(formatLogMessage(input)).toBe(input);
  });

  it('preserva o cabeçalho, a thread e o raw original', () => {
    const raw = '2026/10/26 14:34:13.982|DEBUG|[11]|||123|Example - {"ok":true}\r\n';
    const event = parseLog(raw).events[0]!;
    expect(formatEventForDisplay(event)).toBe('2026/10/26 14:34:13.982|DEBUG|[11]|||123|Example - \n{\n  "ok": true\n}\r\n');
    expect(event.raw).toBe(raw);
  });
});
