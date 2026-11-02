/** Apenas dados fictícios, incluindo texto HTML para validar a renderização inerte. */
export const before = '2026/10/26 14:33:59.999|FATAL|[2]|||test|Example.Service - Antes do intervalo\r\n';
export const first = '2026/10/26 14:34:13.996|INFO|[11]|||test|Example.PumpManager - Atualização sintética\r\n';
export const multi = '2026/10/26 14:34:17.903|DEBUG|[12]|||test|Example.WcfService - Pedido sintético\r\n' +
  'Request Header:{"MessageID":123}\r\n' +
  'Request Body:{"text":"<script>window.injected=true</script>","note":"ação"}\r\n';
export const end = '2026/10/26 14:35:00.999|WARN|[3]|||test|Example.EndService - Segundo final\r\n';
export const tie = '2026/10/26 14:35:00.999|INFO|[4]|||test|Example.EndService - Empate preservado\r\n';
export const after = '2026/10/26 14:35:01.000|ERROR|[5]|||test|Example.OtherService - Fora do intervalo\r\n';
export const nextDay = '2026/10/27 00:00:00.000|INFO|[6]|||test|Example.NextService - Dia seguinte';
export const browserLog = after + before + first + multi + end + tie + nextDay;
export const filteredLog = first + multi + end + tie;
