// Temporary, for #165: where a language change from the phone sheet stalls in WebKit. Each run
// prints one line to the CI log; a stall does not fail the run, so all runs are counted.
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'parallel' });

const runs = 60;

async function toNextSeason(page: Page) {
  const season = await page.locator('html').getAttribute('data-season');
  await expect(async () => {
    await page.locator('.other-season').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-season', season!, {
      timeout: 500,
    });
  }).toPass();
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
}

for (let run = 0; run < runs; run++)
  test(`diagnose a language change from the sheet, run ${run}`, async ({ page }, { project }) => {
    test.skip(project.name !== 'webkit-phone' && !process.env['DIAG165']);
    await page.setViewportSize({ width: 393, height: 800 });
    await page.addInitScript(() => {
      const t0 = performance.now();
      const log: string[] = [];
      const note = (text: string) => log.push(`${Math.round(performance.now() - t0)} ${text}`);
      Object.assign(window, { log_: log, note_: note });
      const start = document.startViewTransition?.bind(document);
      if (start)
        document.startViewTransition = ((update: () => Promise<void>) => {
          note('vt start');
          const transition = start(() => {
            note('vt update called');
            return update();
          });
          transition.updateCallbackDone.then(
            () => note('vt update done'),
            (e: Error) => note(`vt update failed ${e.name}`),
          );
          transition.ready.then(
            () => note('vt ready'),
            (e: Error) => note(`vt ready failed ${e.name}`),
          );
          transition.finished.then(() => note('vt finished'));
          return transition;
        }) as typeof document.startViewTransition;
      addEventListener('DOMContentLoaded', () =>
        new MutationObserver((records) => {
          for (const r of records)
            note(
              `html ${r.attributeName}=${document.documentElement.getAttribute(r.attributeName!)}`,
            );
        }).observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['lang', 'class'],
        }),
      );
      addEventListener('error', (e) => note(`error ${e.message}`));
      addEventListener('unhandledrejection', (e) => note(`rejection ${String(e.reason)}`));
      document.addEventListener('visibilitychange', () =>
        note(`visibility ${document.visibilityState}`),
      );
    });
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning')
        void page
          .evaluate(
            (t) => (window as unknown as { note_: (t: string) => void }).note_(t),
            `console ${m.text()}`,
          )
          .catch(() => undefined);
    });
    page.on('request', (r) => {
      if (/chunk-|texts/.test(r.url()))
        void page
          .evaluate(
            (t) => (window as unknown as { note_: (t: string) => void }).note_(t),
            `request ${r.url().split('/').pop()}`,
          )
          .catch(() => undefined);
    });
    await page.goto('/en');
    await toNextSeason(page);
    const stays = page.locator('.weeks-body:visible .stay:visible');
    await stays
      .nth(Math.floor((await stays.count()) / 2))
      .locator('.price')
      .click();
    await stays.nth(Math.floor((await stays.count()) / 2)).evaluate((cell) => {
      const edge = document.querySelector('app-header')!.getBoundingClientRect().bottom;
      scrollBy({ top: cell.getBoundingClientRect().top - edge + 10, behavior: 'instant' });
    });
    const menu = page.locator('.header-narrow .icon-button');
    const box = (await menu.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.evaluate(() =>
      (window as unknown as { note_: (t: string) => void }).note_('sheet tapped'),
    );
    await page.getByRole('link', { name: 'Deutsch' }).click();
    await page.evaluate(() =>
      (window as unknown as { note_: (t: string) => void }).note_('Deutsch tapped'),
    );
    const changed = await page
      .waitForFunction(() => document.documentElement.lang === 'de-AT', undefined, {
        timeout: 8000,
      })
      .then(
        () => true,
        () => false,
      );
    await page.waitForTimeout(300);
    const log = await page.evaluate(() => (window as unknown as { log_: string[] }).log_);
    console.log(`DIAG165 run ${run} ${changed ? 'OK' : 'STALL'} | ${log.join(' | ')}`);
  });
