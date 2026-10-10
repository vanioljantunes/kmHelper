import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, '../fixtures/km-two-arms.png');
const TRUTH = JSON.parse(readFileSync(resolve(HERE, '../fixtures/km-two-arms.json'), 'utf8')) as {
  arms: Array<{ name: string; hex: string }>;
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
    await expect(page.getByRole('heading', { name: arm.name, level: 3 })).toBeVisible();
  }
  await expect(page.getByText(/censoring marks found/).first()).toBeVisible();
  await expect(page.getByText(/^\d+ points/).first()).toBeVisible();
});

test('has no accessibility violations on any section', async ({ page }) => {
  await page.goto('/');
  await loadFigure(page);
  await calibrate(page);
  await nameArms(page);
  await page.getByRole('button', { name: 'Read the curves' }).click();
  await expect(page.getByText(/^\d+ points/).first()).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
