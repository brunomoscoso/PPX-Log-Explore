import { matchesTransactionFilters, type TransactionFilterValues } from './transactionFilter';
import type { LogEvent } from '../types/log.types';
import { parseRange, type DateTimeRange } from './logFilter';
import { buildHttpPairs } from './httpPairs';

export interface HttpErrorCall {
  response: LogEvent;
  request?: LogEvent;
  statusCode: number;
  requestOutsideRange?: boolean;
}

const statusNames: Record<string, number> = {
  badrequest: 400, unauthorized: 401, paymentrequired: 402, forbidden: 403, notfound: 404,
  methodnotallowed: 405, notacceptable: 406, proxyauthenticationrequired: 407, requesttimeout: 408,
  conflict: 409, gone: 410, lengthrequired: 411, preconditionfailed: 412,
  requestentitytoolarge: 413, payloadtoolarge: 413, contenttoolarge: 413,
  requesturitoolong: 414, uritoolong: 414, unsupportedmediatype: 415,
  requestedrangenotsatisfiable: 416, rangenotsatisfiable: 416, expectationfailed: 417,
  imateapot: 418, misdirectedrequest: 421, unprocessableentity: 422, unprocessablecontent: 422,
  locked: 423, faileddependency: 424, tooearly: 425, upgraderequired: 426,
  preconditionrequired: 428, toomanyrequests: 429, requestheaderfieldstoolarge: 431,
  unavailableforlegalreasons: 451, internalservererror: 500, notimplemented: 501,
  badgateway: 502, serviceunavailable: 503, gatewaytimeout: 504, httpversionnotsupported: 505,
  variantalsonegotiates: 506, insufficientstorage: 507, loopdetected: 508,
  notextended: 510, networkauthenticationrequired: 511,
};

export function httpErrorStatus(status: string | undefined): number | undefined {
  if (!status) return undefined;
  const numeric = /^(?:HTTP\/\d(?:\.\d)?\s+)?([45]\d{2})(?:\b)/i.exec(status.trim());
  if (numeric) return Number(numeric[1]);
  const name = status.trim().replace(/^HttpStatusCode\./i, '').replace(/[\s_'-]/g, '').toLowerCase();
  return Object.hasOwn(statusNames, name) ? statusNames[name] : undefined;
}

/** Consome também respostas de sucesso, para não reutilizar requests já concluídas. */
export function buildHttpErrorCalls(events: readonly LogEvent[], pairs: ReadonlyMap<string, LogEvent> = buildHttpPairs(events)): HttpErrorCall[] {
  const calls: HttpErrorCall[] = [];
  for (const event of events) {
    if (event.http && event.type === 'response') {
      const request = pairs.get(event.id);
      const statusCode = httpErrorStatus(event.http.status);
      if (statusCode !== undefined) calls.push({ response: event, statusCode, ...(request ? { request } : {}) });
    }
  }
  return calls.sort((a, b) => a.response.timestamp - b.response.timestamp || a.response.startOffset - b.response.startOffset);
}

export function filterHttpErrorCalls(calls: readonly HttpErrorCall[], range: DateTimeRange, filters: TransactionFilterValues = {}): HttpErrorCall[] {
  const { start, end } = parseRange(range);
  return calls.filter(({ request, response }) => response.timestamp >= start && response.timestamp <= end
    && matchesTransactionFilters(request ? [request, response] : [response], filters))
    .map((call) => ({ ...call, requestOutsideRange: !!call.request && (call.request.timestamp < start || call.request.timestamp > end) }));
}

/** Exporta a dupla completa de cada resultado, incluindo a request fora do intervalo. */
export function errorCallEvents(calls: readonly HttpErrorCall[]): LogEvent[] {
  return calls.flatMap(({ request, response }) => request ? [request, response] : [response]);
}
