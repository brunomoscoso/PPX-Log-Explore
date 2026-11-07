import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { browserLog, filteredLog, first, multi, end, tie, after, nextDay } from '../fixtures/browserLogs';
import { httpRequest, httpResponse } from '../fixtures/httpLogs';

async function upload(page: Page, text = browserLog, name = 'ComServer-sintetico.log') {
  await page.getByLabel('Ficheiro de logs', { exact: true }).setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
  await expect(page.getByRole('status')).not.toContainText('A ler');
  await expect(page.locator('.header-file')).toHaveText(name);
}

async function search(page: Page, start = '14:34:00', finish = '14:35:00', startDate = '2026-10-26', endDate = '2026-10-26') {
  await page.getByLabel('Data inicial', { exact: true }).fill(startDate);
  await page.getByLabel('Hora inicial', { exact: true }).fill(start);
  await page.getByLabel('Data final', { exact: true }).fill(endDate);
  await page.getByLabel('Hora final', { exact: true }).fill(finish);
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Pesquisa concluída');
}

async function downloadText(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar .log', exact: true }).click();
  const download = await pending;
  const filePath = await download.path();
  if (!filePath) throw new Error('Download em falta');
  return { text: await readFile(filePath, 'utf8'), name: download.suggestedFilename() };
}

// Os testes de regressão existentes exercitam o comportamento completo anterior.
test.beforeEach(async ({ page }) => { await page.goto('/'); await page.getByRole('checkbox', { name: 'Debug total', exact: true }).check(); });

test('modo padrão mostra apenas HTTP JSON e Debug total recupera todos os eventos', async ({ page }) => {
  await page.goto('/');
  const debug = page.getByRole('checkbox', { name: 'Debug total', exact: true });
  await expect(debug).not.toBeChecked();
  const request = httpRequest();
  const response = httpResponse();
  const orphan = httpResponse('unlinked', '{"promotion":"ORPHAN"}', '14:34:02.000');
  const text = request + first + response + orphan + httpRequest('xml', 'application/xml', { articleCode: 'ITEM-A' }, '14:34:03.000') + httpResponse('xml', '{}', '14:34:04.000');
  await upload(page, text);
  await expect(page.locator('.event-summary')).toHaveCount(3);
  await expect(page.locator('.event-type')).toHaveText(['REQUEST', 'RESPONSE', 'RESPONSE']);
  expect((await downloadText(page)).text).toBe(request + response + orphan);
  await page.locator('.event-summary').nth(1).click();
  const modal = page.getByRole('dialog');
  await expect(modal.locator('pre')).toContainText('StatusCode: Created');
  await modal.getByRole('button', { name: 'Body', exact: true }).click();
  await expect(modal.locator('pre')).toContainText('PROMO-A');
  await modal.getByRole('button', { name: 'Fechar detalhes do evento' }).click();
  await search(page, '14:34:01', '14:34:01');
  await expect(page.locator('.event-summary')).toHaveCount(2);
  expect((await downloadText(page)).text).toBe(request + response);
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await expect(page.locator('.event-summary')).toHaveCount(3);
  await debug.check();
  await expect(page.locator('.event-summary')).toHaveCount(6);
  await debug.uncheck();
  await expect(page.locator('.event-summary')).toHaveCount(3);
  await page.getByRole('button', { name: 'Copiar resultados', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Resultados copiados');
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe((request + response + orphan).replaceAll('\r\n', '\n'));
});

test('ficheiro sem HTTP JSON continua disponível através de Debug total', async ({ page }) => {
  await page.goto('/');
  await upload(page, first);
  await expect(page.locator('.event-summary')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Nenhum evento encontrado para os filtros selecionados.' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Debug total', exact: true }).check();
  await expect(page.locator('.event-summary')).toHaveCount(1);
  await page.getByRole('checkbox', { name: 'Debug total', exact: true }).uncheck();
  await expect(page.locator('.event-summary')).toHaveCount(0);
});

test('pesquisas HTTP e Debug total incluem as duas mensagens pelo correlation-id', async ({ page }) => {
  await page.goto('/');
  const request = httpRequest('pair', 'application/json', { articleCode: 'ITEM-A' }, '14:33:00.000');
  const response = httpResponse('pair', '{"promotion":"PROMO-A"}', '14:34:01.000', 'OK');
  const later = httpRequest('pair', 'application/json', { articleCode: 'OTHER' }, '14:35:00.000') + httpResponse('pair', '{}', '14:35:01.000');
  await upload(page, request + first + response + later);
  await search(page, '14:34:01', '14:34:01');
  await expect(page.locator('.event-type')).toHaveText(['REQUEST', 'RESPONSE']);
  await expect(page.locator('.event-summary').first()).toContainText('Incluída por correlação');
  await expect(page.locator('.event-summary').first()).toContainText('Fora do intervalo');
  expect((await downloadText(page)).text).toBe(request + response);
  await page.getByRole('checkbox', { name: 'Debug total', exact: true }).check();
  await expect(page.locator('.event-summary')).toHaveCount(2);
  expect((await downloadText(page)).text).toBe(request + response);
  await search(page, '14:33:00', '14:33:00');
  await expect(page.locator('.event-type')).toHaveText(['REQUEST', 'RESPONSE']);
  await expect(page.locator('.event-summary').nth(1)).toContainText('Fora do intervalo');
  await page.getByRole('button', { name: 'Copiar resultados', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Resultados copiados');
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe((request + response).replaceAll('\r\n', '\n'));
  await page.locator('.event-summary').nth(1).click();
  await expect(page.getByRole('dialog')).toContainText('x-correlation-id: pair');
  await expect(page.getByRole('dialog')).toContainText('Incluída por correlação');
});


test('mostra erros por horário da response com request fora do intervalo e navegação da dupla', async ({ page }, testInfo) => {
  await page.goto('/');
  const request = httpRequest('failed', 'application/json', { articleCode: 'ITEM-A' }, '14:33:00.000');
  const response = httpResponse('failed', '{"promotion":"PROMO-A"}', '14:34:01.000', 'BadRequest');
  const orphan = httpResponse('missing', 'Not found', '14:34:01.500', '404 Not Found');
  await upload(page, request + httpRequest('ok') + response + orphan + httpResponse('ok', '{}', '14:34:02.000'));
  await search(page, '14:34:01', '14:34:01');
  const errors = page.getByRole('checkbox', { name: 'Apenas chamadas com erro', exact: true });
  await errors.check();
  await expect(page.locator('.result-count')).toHaveText('2 chamadas com erro encontradas');
  await expect(page.locator('.http-error-item')).toHaveCount(2);
  await expect(page.locator('.http-error-item').first()).toContainText('Request fora do intervalo');
  await expect(page.locator('.http-error-item').nth(1)).toContainText('Request não identificada');
  await expect(page.getByRole('checkbox', { name: 'Debug total', exact: true })).toBeDisabled();
  expect((await downloadText(page)).text).toBe(request + response + orphan);
  await page.locator('.http-error-summary').first().click();
  const modal = page.getByRole('dialog', { name: 'Detalhes da chamada com erro' });
  await expect(modal.locator('pre')).toContainText('StatusCode: BadRequest');
  await modal.getByRole('button', { name: 'Body', exact: true }).click();
  await expect(modal.locator('pre')).toContainText('PROMO-A');
  await modal.getByRole('button', { name: 'Request', exact: true }).click();
  await expect(modal.locator('pre')).toContainText('ITEM-A');
  await expect(modal).toContainText('Request fora do intervalo');
  await modal.getByRole('button', { name: 'Copiar chamada', exact: true }).click();
  await expect(modal.getByRole('status')).toContainText('copiado');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('ITEM-A');
  expect(copied).toContain('PROMO-A');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(modal.locator('pre')).toBeVisible();
  const box = await modal.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('error-call-mobile.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await page.locator('.http-error-summary').nth(1).click();
  await expect(modal.getByRole('button', { name: 'Request', exact: true })).toBeDisabled();
  await expect(modal).toContainText('Request não identificada');
  await page.keyboard.press('Escape');
  await errors.uncheck();
  await expect(page.locator('.event-summary')).toHaveCount(2);
  expect((await downloadText(page)).text).toBe(request + response);
});

test('pagina chamadas com erro e exporta todas as duplas mantendo a pesquisa aplicada', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Apenas chamadas com erro', exact: true }).check();
  const text = Array.from({ length: 101 }, (_, index) => httpRequest(`call-${index}`) + httpResponse(`call-${index}`, '{}', '14:34:01.000', 'InternalServerError')).join('');
  await upload(page, text);
  await expect(page.locator('.result-count')).toHaveText('101 chamadas com erro encontradas');
  await expect(page.locator('.http-error-item')).toHaveCount(100);
  await page.getByRole('button', { name: 'Seguinte', exact: true }).click();
  await expect(page.locator('.http-error-item')).toHaveCount(1);
  expect((await downloadText(page)).text).toBe(text);
  await page.getByRole('button', { name: 'Copiar resultados', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Resultados copiados');
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe(text.replaceAll('\r\n', '\n'));
  await page.getByLabel('Data inicial', { exact: true }).fill('');
  await page.getByRole('checkbox', { name: 'Apenas chamadas com erro', exact: true }).uncheck();
  await expect(page.getByRole('alert')).toContainText('Preencha');
  await expect(page.locator('.result-count')).toHaveText('101 chamadas com erro encontradas');
  expect((await downloadText(page)).text).toBe(text);
  await search(page);
  await expect(page.locator('.result-count')).toHaveText('202 eventos encontrados');
});

test('estado inicial acessível, sem ações de pesquisa ou exportação disponíveis', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'PPX Log Explorer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comece por importar um ficheiro' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pesquisar', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Copiar resultados' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Exportar .log' })).toBeDisabled();
  await expect(page.getByLabel('Data inicial', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Adicionar filtro', { exact: true })).toBeDisabled();
  await expect(page.locator('#add-filter option')).toHaveCount(15);
});

test('identifica pedidos como REQUEST e mantém o nível separado', async ({ page }) => {
  const request = 'Request Header:{"Timestamp":"30/09/2026 14:34:40.580"}\n' +
    'Request Body:{"LoyaltyId":"700000000000000001"}\n';
  const next = '2026/09/30 14:34:40.590|INFO|Example - Next';
  await upload(page, request + next);

  await expect(page.locator('.event-summary')).toHaveCount(2);
  await expect(page.locator('.event-type-request')).toHaveText('REQUEST');
  await expect(page.locator('.log-table-heading')).toContainText('Tipo');
  await expect(page.locator('.log-table-heading')).toContainText('Nível');
  await expect(page.locator('.event-summary').first()).toContainText('REQUEST');
  await expect(page.locator('.event-summary').first().locator('.level')).toHaveText('—');
  await page.locator('.event-summary').first().click();
  const modal = page.getByRole('dialog', { name: 'Detalhes do evento' });
  await expect(modal.locator('pre')).toContainText('"Timestamp"');
  await expect(modal.locator('pre')).toContainText('Request Header:');
  await expect(modal.locator('pre')).not.toContainText('"LoyaltyId"');
  await modal.getByRole('button', { name: 'Body', exact: true }).click();
  await expect(modal.locator('pre')).toContainText('"LoyaltyId"');
  await expect(modal.locator('pre')).toContainText('Request Body:');
  await expect(modal.locator('pre')).not.toContainText('"Timestamp"');
});

test('importa, sugere o intervalo, pesquisa com precisão e abre os detalhes no modal', async ({ page }, testInfo) => {
  await upload(page);
  await expect(page.getByLabel('Hora inicial', { exact: true })).toHaveValue('14:33:59');
  await expect(page.getByLabel('Data final', { exact: true })).toHaveValue('2026-10-27');
  await expect(page.locator('.event-summary')).toHaveCount(7);
  await search(page);
  await expect(page.locator('.result-count')).toHaveText('4 eventos encontrados');
  await expect(page.locator('.event-preview')).toHaveText(['Atualização sintética', 'Pedido sintético', 'Segundo final', 'Empate preservado']);
  await page.getByRole('button', { name: /Abrir evento 2026\/10\/26 14:34:17.903/ }).click();
  await expect(page.getByRole('dialog', { name: 'Detalhes do evento' })).toBeVisible();
  expect(await page.locator('pre').textContent()).toContain('Request Header:\n{\n  "MessageID": 123\n}');
  await page.getByRole('button', { name: 'Ver original', exact: true }).click();
  expect(await page.locator('pre').textContent()).toBe(multi);
  await page.getByRole('button', { name: 'Ver indentado', exact: true }).click();
  expect(await page.evaluate(() => 'injected' in window)).toBe(false);
  await expect(page.getByRole('button', { name: 'Copiar evento' })).toBeVisible();
  // Os dados ficam apenas em memória e nenhuma chave de armazenamento é criada.
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
});

test('pesquisa apenas no bloco visível do modal e navega pelas ocorrências', async ({ page }) => {
  const request = 'Request Header:{"Timestamp":"30/09/2026 14:34:40.580","note":"alvo"}\n' +
    'Request Body:' + JSON.stringify({ first: 'Alvo', filler: Array.from({ length: 80 }, (_, i) => `linha ${i}`), last: 'ALVO', literal: '[a.*]' });
  await upload(page, request);
  await page.locator('.event-summary').click();
  const modal = page.getByRole('dialog');
  const input = modal.getByRole('searchbox', { name: 'Pesquisar neste bloco' });
  const count = modal.locator('.modal-search-count');
  const content = modal.locator('pre');
  await page.keyboard.press('Control+f');
  await expect(input).toBeFocused();
  await input.fill('alvo');
  await expect(count).toHaveText('1 de 1');
  await modal.getByRole('button', { name: 'Body', exact: true }).click();
  const originalText = await content.textContent();
  await expect(count).toHaveText('1 de 2');
  await expect(content.locator('mark')).toHaveCount(2);
  await input.press('Enter');
  await expect(count).toHaveText('2 de 2');
  await expect(content.locator('.search-match-active')).toHaveText('ALVO');
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const activeBox = await content.locator('.search-match-active').boundingBox();
  const contentBox = await content.boundingBox();
  expect(activeBox!.y).toBeGreaterThanOrEqual(contentBox!.y);
  expect(activeBox!.y + activeBox!.height).toBeLessThanOrEqual(contentBox!.y + contentBox!.height);
  await input.press('Enter');
  await expect(count).toHaveText('1 de 2');
  await input.press('Shift+Enter');
  await expect(count).toHaveText('2 de 2');
  await modal.getByRole('button', { name: 'Ocorrência anterior', exact: true }).click();
  await expect(count).toHaveText('1 de 2');
  await modal.getByRole('button', { name: 'Próxima ocorrência', exact: true }).click();
  await expect(count).toHaveText('2 de 2');
  expect(await content.textContent()).toBe(originalText);
  await input.fill('[a.*]');
  await expect(count).toHaveText('1 de 1');
  await expect(content.locator('mark')).toHaveText('[a.*]');
  await modal.getByRole('button', { name: 'Ver original', exact: true }).click();
  await expect(count).toHaveText('1 de 1');
  await input.fill('Timestamp');
  await expect(count).toHaveText('Sem resultados');
  await expect(modal.getByRole('button', { name: 'Próxima ocorrência', exact: true })).toBeDisabled();
  await input.fill('Detalhes do evento');
  await expect(count).toHaveText('Sem resultados');
  await modal.getByRole('button', { name: 'Limpar pesquisa', exact: true }).click();
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(content.locator('mark')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
});

test('copia um evento e todos os resultados para a área de transferência', async ({ page }) => {
  await upload(page);
  await search(page);
  await page.getByRole('button', { name: /Abrir evento 2026\/10\/26 14:34:17.903/ }).click();
  await page.getByRole('button', { name: 'Copiar evento', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Evento copiado');
  // O clipboard do sistema operativo pode normalizar CRLF.
  const normalize = (text: string) => text.replaceAll('\r\n', '\n');
  const copiedEvent = normalize(await page.evaluate(() => navigator.clipboard.readText()));
  expect(copiedEvent).toContain('Request Header:\n{\n  "MessageID": 123\n}');
  expect(copiedEvent).toContain('Request Body:\n{\n  "text": "<script>window.injected=true</script>",\n  "note": "ação"\n}');
  expect(copiedEvent).not.toBe(normalize(multi));
  await page.getByRole('button', { name: 'Fechar detalhes do evento' }).click();
  await page.getByRole('button', { name: 'Copiar resultados', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Resultados copiados');
  expect(normalize(await page.evaluate(() => navigator.clipboard.readText()))).toBe(normalize(filteredLog));
});

test('exporta apenas os resultados aplicados, preservando CRLF e multiline', async ({ page }) => {
  await upload(page);
  await search(page);
  // Alterações ainda não aplicadas não podem alterar os resultados nem o nome.
  await page.getByLabel('Hora final', { exact: true }).fill('23:59:59');
  await expect(page.getByText('Alterações por aplicar')).toBeVisible();
  expect(await downloadText(page)).toEqual({ text: filteredLog, name: 'PPX_Logs_2026-10-26_143400_143500.log' });
});

test('pesquisa entre dias, mantém empates e limpa filtros sem remover o ficheiro', async ({ page }) => {
  await upload(page);
  await search(page, '14:35:00', '00:00:00', '2026-10-26', '2026-10-27');
  expect((await downloadText(page)).text).toBe(end + tie + after + nextDay);
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.locator('.event-summary')).toHaveCount(7);
  await expect(page.getByLabel('Hora inicial', { exact: true })).toHaveValue('14:33:59');
  await expect(page.locator('.header-file')).toHaveText('ComServer-sintetico.log');
});

test('valida intervalos invertidos e apresenta pesquisas sem correspondências', async ({ page }) => {
  await upload(page);
  await page.getByLabel('Data final', { exact: true }).fill('2026-10-25');
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('anteriores');
  await expect(page.locator('.event-summary')).toHaveCount(7);
  await search(page, '01:00:00', '01:00:30');
  await expect(page.getByRole('heading', { name: 'Nenhum evento encontrado para os filtros selecionados.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exportar .log' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Copiar resultados' })).toBeDisabled();
});

test('suporta drag-and-drop e substituição por um ficheiro sem eventos', async ({ page }) => {
  const data = await page.evaluateHandle((content) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([content], 'arrastado.txt', { type: 'text/plain' }));
    return transfer;
  }, first);
  await page.locator('.upload-panel').dispatchEvent('drop', { dataTransfer: data });
  await data.dispose();
  await expect(page.locator('.header-file')).toHaveText('arrastado.txt');
  await expect(page.locator('.event-summary')).toHaveCount(1);
  await upload(page, 'sem timestamps\n', 'vazio.txt');
  await expect(page.getByRole('heading', { name: 'Nenhum evento reconhecível' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pesquisar', exact: true })).toBeDisabled();
  await expect(page.locator('.event-summary')).toHaveCount(0);
});

test('paginação não limita cópia ou exportação e suporta mensagens extensas', async ({ page }) => {
  const text = Array.from({ length: 205 }, (_, index) => `2026/10/26 14:34:00.000|INFO|[1]|||test|Example.Service - Evento ${index + 1}\r\n`).join('');
  await upload(page, text);
  await expect(page.locator('.event-summary')).toHaveCount(100);
  await expect(page.locator('.result-count')).toHaveText('205 eventos encontrados');
  await page.getByRole('button', { name: 'Seguinte' }).click();
  await expect(page.getByText('Página 2 de 3', { exact: true })).toBeVisible();
  await expect(page.locator('.event-preview').first()).toHaveText('Evento 101');
  expect((await downloadText(page)).text).toBe(text);
  await page.getByRole('button', { name: 'Seguinte' }).click();
  await expect(page.locator('.event-summary')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Seguinte' })).toBeDisabled();
  await page.getByRole('button', { name: 'Copiar resultados' }).click();
  await expect(page.getByRole('status')).toContainText('Resultados copiados');
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe(text.replaceAll('\r\n', '\n'));
  const longEvent = first + JSON.stringify({ data: 'mensagem extensa '.repeat(5000) });
  await upload(page, longEvent, 'longo.log');
  await page.locator('.event-summary').click();
  expect(await page.locator('pre').textContent()).toContain('\n  "data": "mensagem extensa ');
  await page.getByRole('button', { name: 'Ver original', exact: true }).click();
  expect(await page.locator('pre').textContent()).toBe(longEvent);
});

test('mostra erros de formato, codificação e clipboard sem impedir nova importação', async ({ page }) => {
  await page.getByLabel('Ficheiro de logs', { exact: true }).setInputFiles({ name: 'dados.csv', mimeType: 'text/plain', buffer: Buffer.from(first) });
  await expect(page.getByRole('alert')).toContainText('Formato não suportado');
  await page.getByLabel('Ficheiro de logs', { exact: true }).setInputFiles({ name: 'encoding.log', mimeType: 'text/plain', buffer: Buffer.from([0xff, 0xff]) });
  await expect(page.getByRole('alert')).toContainText('UTF-8');
  await upload(page, first);
  await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.reject(new Error('Denied')) }); });
  await page.getByRole('button', { name: 'Copiar resultados' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível copiar');
  expect((await downloadText(page)).text).toBe(first);
});

test('mantém o modal dentro do ecrã pequeno e permite abertura por teclado', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await upload(page, first);
  const row = page.locator('.event-summary');
  await row.focus();
  await page.keyboard.press('Enter');
  const modal = page.getByRole('dialog', { name: 'Detalhes do evento' });
  await expect(modal).toBeVisible();
  await expect(page.locator('pre')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const box = await modal.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(row).toBeFocused();
});

test('modal centrado fecha por clique exterior, Escape e botão, mantendo foco e scroll', async ({ page }) => {
  await upload(page);
  const row = page.getByRole('button', { name: /Abrir evento 2026\/10\/26 14:34:17.903/ });
  const before = await row.boundingBox();
  await row.click();
  const modal = page.getByRole('dialog', { name: 'Detalhes do evento' });
  await expect(modal).toBeVisible();
  const box = await modal.boundingBox();
  const viewport = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(2);
  const after = await row.boundingBox();
  expect(after!.height).toBe(before!.height);
  await modal.locator('pre').click();
  await expect(modal).toBeVisible();
  // O foco fica dentro do modal, incluindo ao percorrer o último controlo.
  await modal.locator('pre').focus();
  await page.keyboard.press('Tab');
  expect(await modal.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.mouse.click(5, 5);
  await expect(modal).toHaveCount(0);
  await expect(row).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await row.press('Enter');
  await expect(modal).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  await expect(row).toBeFocused();
  await row.click();
  await page.getByRole('button', { name: 'Fechar detalhes do evento' }).click();
  await expect(modal).toHaveCount(0);
  await expect(row).toBeFocused();
});
