import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, '../fixtures/km-two-arms.png');
const TRUTH = JSON.parse(readFileSync(resolve(HERE, '../fixtures/km-two-arms.json'), 'utf8')) as {
  riskTimes: number[];
  arms: Array<{
    name: string;
    hex: string;
    total: number;
    events: number;
    risk: Array<{ time: number; atRisk: number }>;
  }>;
};

/** Drop the fixture onto the page the way a researcher drops a screenshot. */
async function loadFigure(page: Page): Promise<void> {
  await page.setInputFiles('input[type=file]', FIXTURE);
  await expect(page.getByText('760 by 520 pixels.')).toBeVisible();
}

async function calibrate(page: Page): Promise<void> {
  await page.getByLabel('Time at the left edge').fill('0');
  await page.getByLabel('Time at the right edge').fill('60');
  await page.getByLabel('Survival at the bottom').fill('0');
  await page.getByLabel('Survival at the top').fill('1');
}

async function nameArms(page: Page): Promise<void> {
  const first = TRUTH.arms[0];
  const second = TRUTH.arms[1];
  if (first === undefined || second === undefined) throw new Error('fixture has two arms');
  await page.getByLabel('Name').first().fill(first.name);
  await page.getByLabel('Colour').first().fill(first.hex);
  await page.getByRole('button', { name: 'Add an arm' }).click();
  await page.getByLabel('Name').nth(1).fill(second.name);
  await page.getByLabel('Colour').nth(1).fill(second.hex);
}

test('reads a figure from a dropped screenshot', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'kmHelper', level: 1 })).toBeVisible();
  await loadFigure(page);
  await calibrate(page);
  await nameArms(page);

  // The colour pick alone should match the two lines.
  await expect(page.getByText(/pixels match\./).first()).toBeVisible();

  await page.getByRole('button', { name: 'Read the curves' }).click();
  for (const arm of TRUTH.arms) {
    await expect(
      page.locator('#extract').getByRole('heading', { name: arm.name, level: 3 }),
    ).toBeVisible();
  }
  await expect(page.getByText(/censoring marks found/).first()).toBeVisible();
  await expect(page.getByText(/^\d+ points/).first()).toBeVisible();
});

async function fillRiskTable(page: Page): Promise<void> {
  await page.getByLabel('Times, as printed under the axis').fill(TRUTH.riskTimes.join(' '));
  for (const arm of TRUTH.arms) {
    await page
      .getByLabel(`Numbers at risk for ${arm.name}`)
      .fill(arm.risk.map((row) => String(row.atRisk)).join(' '));
    await page.getByLabel(`Patients in ${arm.name}`).fill(String(arm.total));
  }
}

test('reconstructs the patients and compares the arms', async ({ page }) => {
  await page.goto('/');
  await loadFigure(page);
  await calibrate(page);
  await nameArms(page);
  await page.getByRole('button', { name: 'Read the curves' }).click();
  await expect(page.getByText(/^\d+ points/).first()).toBeVisible();
  await fillRiskTable(page);
  await page.getByRole('button', { name: 'Reconstruct', exact: true }).click();

  // The figure was drawn from 120 patients per arm, so that is what must come back.
  await expect(page.getByText('120 patients, 51 events, 69 censored')).toBeVisible();
  await expect(page.getByText('120 patients, 77 events, 43 censored')).toBeVisible();
  // One arm never reaches a median, the other does; both are stated rather than left blank.
  await expect(page.getByText('not reached')).toBeVisible();
  await expect(page.getByText(/Hazard ratio, Control against Treatment/)).toBeVisible();
  await expect(page.getByText(/Log-rank test/)).toBeVisible();
  await expect(page.getByRole('img', { name: /Kaplan-Meier curves/ })).toBeVisible();

  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Patients (CSV)' }).click(),
  ]).then(([event]) => event);
  expect(download.suggestedFilename()).toBe('kmhelper-ipd.csv');
});

test('says the reconstruction is weak when there is no risk table', async ({ page }) => {
  await page.goto('/');
  await loadFigure(page);
  await calibrate(page);
  await nameArms(page);
  await page.getByRole('button', { name: 'Read the curves' }).click();
  await expect(page.getByText(/^\d+ points/).first()).toBeVisible();
  for (const arm of TRUTH.arms) {
    await page.getByLabel(`Patients in ${arm.name}`).fill(String(arm.total));
  }
  await page.getByRole('button', { name: 'Reconstruct', exact: true }).click();
  await expect(page.getByText(/Reconstructed from the arm total alone/).first()).toBeVisible();
});

test('has no accessibility violations on any section', async ({ page }) => {
  await page.goto('/');
  await loadFigure(page);
  await calibrate(page);
  await nameArms(page);
  await page.getByRole('button', { name: 'Read the curves' }).click();
  await expect(page.getByText(/^\d+ points/).first()).toBeVisible();
  await fillRiskTable(page);
  await page.getByRole('button', { name: 'Reconstruct', exact: true }).click();
  await expect(page.getByText(/Hazard ratio/)).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
