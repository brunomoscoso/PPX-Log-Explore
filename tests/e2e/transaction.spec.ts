import { test, expect } from '@playwright/test';
import { httpRequest, httpResponse } from '../fixtures/httpLogs';

test('ComServer filters combine, retain applied export, persist across tabs and reset', async ({ page }) => {
  await page.goto('/');
  const matched = httpRequest('a', 'application/json', { articleCode: 'X001' }) + httpResponse('a', '{"nativeId":"125","Quantity":5.83,"subType":"Fatura Simplificada","clientTransactionsMops":[{"externalCode":"9201"}],"ticketNumber":"11401031120261107699"}', '14:34:01.000', 'BadRequest');
  const other = httpRequest('b', 'application/json', { articleCode: 'X002' }) + httpResponse('b', '{}');
  await page.getByLabel('Ficheiro de logs', { exact: true }).setInputFiles({ name: 'synthetic.log', mimeType: 'text/plain', buffer: Buffer.from(matched + other) });
  await expect(page.locator('.event-summary')).toHaveCount(4);
  const textSearch = page.getByRole('searchbox', { name: 'Buscar texto no log' });
  await page.keyboard.press('Control+f');
  await expect(textSearch).toBeFocused();
  await textSearch.fill('x001');
  await expect(page.locator('.event-summary')).toHaveCount(2);
  await textSearch.fill('missing text');
  await expect(page.locator('.event-summary')).toHaveCount(0);
  await textSearch.fill('');
  await expect(page.locator('.event-summary')).toHaveCount(4);
  await page.getByLabel('Adicionar filtro', { exact: true }).selectOption('transaction');
  await page.getByLabel('Número da transação', { exact: true }).fill('125');
  await page.getByLabel('Adicionar filtro', { exact: true }).selectOption('article');
  await page.getByLabel('Número do artigo', { exact: true }).fill('X001');
  for (const [key, label, value] of [
    ['invoiceType', 'Tipo da fatura', 'Fatura Simplificada'],
    ['mop', 'MOP', '9201'],
    ['ticket', 'Número do ticket', '11401031120261107699'],
  ]) {
    await page.getByLabel('Adicionar filtro', { exact: true }).selectOption(key!);
    const input = page.getByLabel(label!, { exact: true });
    await expect(input).toHaveAttribute('placeholder', `Ex.: ${value}`);
    await input.fill(value!);
  }
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
  await expect(page.locator('.event-summary')).toHaveCount(2);
  await page.getByLabel('Número do artigo', { exact: true }).fill('missing');
  await page.getByRole('button', { name: 'Copiar resultados', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Resultados copiados');
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe(matched.replaceAll('\r\n', '\n'));
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
  await expect(page.locator('.event-summary')).toHaveCount(0);
  await page.getByRole('button', { name: 'Remover filtro Número do artigo', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Apenas chamadas com erro', exact: true }).check();
  await expect(page.locator('.result-count')).toContainText('1 chamada');
  await page.getByRole('button', { name: 'PollingV6', exact: true }).click();
  await expect(page.getByLabel('Adicionar filtro', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'ComServer', exact: true }).click();
  await expect(page.getByLabel('Número da transação', { exact: true })).toHaveValue('125');
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await expect(page.getByLabel('Número da transação', { exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Apenas chamadas com erro', exact: true }).uncheck();
  await expect(page.locator('.event-summary')).toHaveCount(4);
});
