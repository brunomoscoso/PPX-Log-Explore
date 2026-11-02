import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { browserLog, filteredLog, first, multi, end, tie, after, nextDay } from '../fixtures/browserLogs';
import { matchingTransaction, transactionEvent, transactionLog, transactionPayload } from '../fixtures/transactionLogs';

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

test.beforeEach(async ({ page }) => { await page.goto('/'); });

async function addFilter(page: Page, field: string, label: string, value: string) {
  await page.getByLabel('Adicionar filtro', { exact: true }).selectOption(field);
  await page.getByLabel(label, { exact: true }).fill(value);
}

test('estado inicial acessível, sem ações de pesquisa ou exportação disponíveis', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'PPX Log Explorer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comece por importar um ficheiro' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pesquisar', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Copiar resultados' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Exportar .log' })).toBeDisabled();
  await expect(page.getByLabel('Data inicial', { exact: true })).toBeDisabled();
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

test('copia um evento e todos os resultados para a área de transferência', async ({ page }) => {
  await upload(page);
  await search(page);
  await page.getByRole('button', { name: /Abrir evento 2026\/10\/26 14:34:17.903/ }).click();
  await page.getByRole('button', { name: 'Copiar evento', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Evento copiado');
  // O clipboard do sistema operativo pode normalizar CRLF; a aplicação passa raw.
  const normalize = (text: string) => text.replaceAll('\r\n', '\n');
  expect(normalize(await page.evaluate(() => navigator.clipboard.readText()))).toBe(normalize(multi));
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

test('constrói filtros opcionais, combina campos e exporta apenas a pesquisa aplicada', async ({ page }, testInfo) => {
  await expect(page.getByLabel('Adicionar filtro', { exact: true })).toBeDisabled();
  await upload(page, transactionLog);
  await expect(page.getByLabel('Código do artigo', { exact: true })).toHaveCount(0);
  await addFilter(page, 'articleCode', 'Código do artigo', 'TEST-ARTICLE-01');
  await addFilter(page, 'clientLoyalty.cardId', 'Cartão de fidelização', '0000001234');
  await addFilter(page, 'quantity', 'Quantidade', '12,50');
  await expect(page.locator('#add-filter option[value="articleCode"]')).toHaveCount(0);
  await search(page);
  await expect(page.locator('.result-count')).toHaveText('1 evento encontrado');
  expect((await downloadText(page)).text).toBe(matchingTransaction);
  await page.getByRole('button', { name: 'Copiar resultados', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Resultados copiados');
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe(matchingTransaction.replaceAll('\r\n', '\n'));
  await page.screenshot({ path: testInfo.outputPath('transaction-filters.png'), fullPage: true });
  // Remover um campo altera apenas a pesquisa preparada, até clicar em Pesquisar.
  await page.getByRole('button', { name: 'Remover filtro Cartão de fidelização' }).click();
  await expect(page.getByText('Alterações por aplicar')).toBeVisible();
  expect((await downloadText(page)).text).toBe(matchingTransaction);
  await search(page);
  await expect(page.locator('.result-count')).toHaveText('2 eventos encontrados');
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.locator('.transaction-filter-field')).toHaveCount(0);
  await expect(page.locator('.event-summary')).toHaveCount(3);
  await expect(page.locator('.header-file')).toHaveText('ComServer-sintetico.log');
});

test('valida filtros vazios e decimais, permite recuperar e não junta eventos distintos', async ({ page }) => {
  const text = transactionEvent({ articleCode: 'A' }) + transactionEvent({ clientLoyalty: { cardId: 'B' } });
  await upload(page, text);
  await page.getByLabel('Adicionar filtro', { exact: true }).selectOption('quantity');
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Preencha o filtro');
  await page.getByLabel('Quantidade', { exact: true }).fill('abc');
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('número válido');
  await page.getByRole('button', { name: 'Remover filtro Quantidade' }).click();
  await addFilter(page, 'articleCode', 'Código do artigo', 'A');
  await addFilter(page, 'clientLoyalty.cardId', 'Cartão de fidelização', 'B');
  await search(page);
  await expect(page.getByRole('heading', { name: 'Nenhum evento encontrado para os filtros selecionados.' })).toBeVisible();
  await upload(page, matchingTransaction, 'novo.log');
  await expect(page.locator('.transaction-filter-field')).toHaveCount(0);
  await expect(page.locator('.event-summary')).toHaveCount(1);
});

test('filtros opcionais respeitam a paginação e ficam utilizáveis no telemóvel', async ({ page }, testInfo) => {
  const matching = matchingTransaction.repeat(105);
  await upload(page, matching + transactionEvent({ articleCode: 'OTHER' }));
  await addFilter(page, 'transactionGuid', 'GUID da transação', transactionPayload.transactionGuid);
  await search(page);
  await expect(page.locator('.result-count')).toHaveText('105 eventos encontrados');
  await page.getByRole('button', { name: 'Seguinte' }).click();
  await expect(page.locator('.event-summary')).toHaveCount(5);
  expect((await downloadText(page)).text).toBe(matching);
  await page.setViewportSize({ width: 390, height: 844 });
  await addFilter(page, 'totalAmount', 'Montante total', '25,00');
  await expect(page.getByLabel('Montante total', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await search(page);
  await expect(page.locator('.result-count')).toHaveText('105 eventos encontrados');
  await page.screenshot({ path: testInfo.outputPath('transaction-filters-mobile.png'), fullPage: true });
});
