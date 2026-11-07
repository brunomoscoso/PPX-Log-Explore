import { test, expect } from '@playwright/test';
import { httpRequest, httpResponse } from '../fixtures/httpLogs';

for (const tab of ['ComServer', 'PollingV6']) {
  test(`${tab}: highlights literal search and replaces it inside the modal`, async ({ page }) => {
    await page.goto('/');
    if (tab === 'ComServer') await page.getByRole('checkbox', { name: 'Debug total', exact: true }).check();
    else await page.getByRole('button', { name: tab, exact: true }).click();
    const text = tab === 'ComServer'
      ? '2026/11/03 13:31:29.000|INFO|Example - A.B beta a.b axb\n'
      : '2026-11-03 13:31:29.0000|0|[12]|INFO|Example|A.B beta a.b axb\n';
    await page.getByLabel('Ficheiro de logs', { exact: true }).setInputFiles({ name: 'synthetic.log', mimeType: 'text/plain', buffer: Buffer.from(text) });
    const search = page.getByRole('searchbox', { name: 'Buscar texto no log' });
    await search.fill('a.b');
    const marks = page.locator('.event-summary mark');
    await expect(marks).toHaveText(['A.B', 'a.b']);
    await expect(marks.first()).toHaveCSS('background-color', 'rgb(255, 243, 163)');
    await page.locator('.event-summary').click();
    const modal = page.getByRole('dialog');
    await expect(modal.locator('pre mark')).toHaveText(['A.B', 'a.b']);
    await modal.getByRole('searchbox', { name: 'Pesquisar neste bloco' }).fill('beta');
    await expect(modal.locator('pre mark')).toHaveText(['beta']);
    await modal.getByRole('button', { name: 'Limpar pesquisa', exact: true }).click();
    await expect(modal.locator('pre mark')).toHaveCount(0);
    await modal.getByRole('button', { name: 'Fechar detalhes do evento' }).click();
    await expect(search).toHaveValue('a.b');
    await expect(marks).toHaveText(['A.B', 'a.b']);
    await search.fill('');
    await expect(marks).toHaveCount(0);
  });
}

test('HTTP body matches are visible in summaries and inherited by error call details', async ({ page }) => {
  await page.goto('/');
  const text = httpRequest('a', 'application/json', { articleCode: 'MATCH-ITEM' }) + httpResponse('a', '{}', '14:34:01.000', 'BadRequest');
  await page.getByLabel('Ficheiro de logs', { exact: true }).setInputFiles({ name: 'synthetic.log', mimeType: 'text/plain', buffer: Buffer.from(text) });
  await page.getByRole('searchbox', { name: 'Buscar texto no log' }).fill('match-item');
  await expect(page.locator('.event-summary mark')).toHaveText(['MATCH-ITEM']);
  await page.locator('.event-summary').first().click();
  let modal = page.getByRole('dialog');
  await expect(modal.getByRole('button', { name: 'Body', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(modal.locator('pre mark')).toHaveText(['MATCH-ITEM']);
  await modal.getByRole('button', { name: 'Fechar detalhes do evento' }).click();
  await page.getByRole('checkbox', { name: 'Apenas chamadas com erro', exact: true }).check();
  await expect(page.locator('.http-error-summary mark')).toHaveText(['MATCH-ITEM']);
  await page.locator('.http-error-summary').click();
  modal = page.getByRole('dialog');
  await expect(modal.getByRole('button', { name: 'Request', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(modal.locator('pre mark')).toHaveText(['MATCH-ITEM']);
  await modal.getByRole('searchbox', { name: 'Pesquisar neste bloco' }).fill('articleCode');
  await expect(modal.locator('pre mark')).toHaveText(['articleCode']);
});
