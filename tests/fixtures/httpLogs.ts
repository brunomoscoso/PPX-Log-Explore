/** Tráfego inteiramente sintético; nenhum payload ou identificador real. */
export function httpRequest(id = 'synthetic-a', accept = 'application/json', body = { articleCode: 'ITEM-A' }, time = '14:34:00.000') {
  return `2026/10/26 ${time}|DEBUG[347]|synthetic|105|ComServer.Utils.LoggingHandler - Request:\r\n` +
    `Method: POST, URI: https://example.invalid/discounts\r\nx-correlation-id: ${id}\r\nAccept: ${accept}\r\n\r\n${JSON.stringify(body)}\r\n`;
}

export function httpResponse(id = 'synthetic-a', body = '{"promotion":"PROMO-A"}', time = '14:34:01.000', status = 'Created') {
  return `2026/10/26 ${time}|DEBUG[29]|synthetic|105|ComServer.Utils.LoggingHandler - Response:\r\n` +
    `StatusCode: ${status}\r\nx-correlation-id: ${id}\r\n\r\n${body}\r\n`;
}
