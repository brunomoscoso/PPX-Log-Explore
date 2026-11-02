/** Dados inventados. Nunca substituir estas fixtures por logs internos. */
export const firstEvent =
  '2026/10/26 14:34:13.996|INFO|[11]|||123|ComServer.DOMS.JPL.JplDomsManager - (JPL) updating status for pump: 1, Status: Fueling\r\n';

export const multilineEvent =
  '2026/10/26 14:34:17.903|DEBUG|[12]|||123|ComServer.WcfService.WcfCommunicationService - Service:AlarmUpdateService\r\n' +
  'Request Header:{"MessageID":20284}\r\n' +
  'Request Body:{"ServiceName":"AlarmUpdateService"}\r\n';

export const lastEvent =
  '2026/10/27 00:00:00.000|WARN|[7]|||456|ComServer.SyntheticService - Synthetic warning';

export const syntheticLog = firstEvent + multilineEvent + lastEvent;
