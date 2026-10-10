import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';

// Not an assertion, a look: this writes the screenshots that a visual change is checked against.
// Run with: npx playwright test screens

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, '../fixtures/km-two-arms.png');
const OUT = resolve(HERE, '../../.tmp/screens');
const TRUTH = JSON.parse(readFileSync(resolve(HERE, '../fixtures/km-two-arms.json'), 'utf8')) as {
  arms: Array<{ name: string; hex: string }>;
};

test('screenshots of the whole walk', async ({ page }, info) => {
  const name = info.project.name;
  await page.goto('/');
  await page.setInputFiles('input[type=file]', FIXTURE);
  await page.getByText('760 by 520 pixels.').waitFor();
  await page.getByLabel('Time at the left edge').fill('0');
  await page.getByLabel('Time at the right edge').fill('60');
  await page.getByLabel('Survival at the bottom').fill('0');
  await page.getByLabel('Survival at the top').fill('1');
  const first = TRUTH.arms[0];
  const second = TRUTH.arms[1];
  if (first === undefined || second === undefined) throw new Error('fixture has two arms');
  await page.getByLabel('Name').first().fill(first.name);
  await page.getByLabel('Colour').first().fill(first.hex);
  await page.getByRole('button', { name: 'Add an arm' }).click();
  await page.getByLabel('Name').nth(1).fill(second.name);
  await page.getByLabel('Colour').nth(1).fill(second.hex);
  await page.getByRole('button', { name: 'Read the curves' }).click();
  await page.getByText(/^\d+ points/).first().waitFor();

  await page.locator('#axes').screenshot({ path: `${OUT}/${name}-axes.png` });
  await page.locator('#arms').screenshot({ path: `${OUT}/${name}-arms.png` });
  await page.locator('#extract').screenshot({ path: `${OUT}/${name}-extract.png` });
  await page.screenshot({ path: `${OUT}/${name}-page.png`, fullPage: true });
});
