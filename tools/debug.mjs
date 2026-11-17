/**
 * tools/debug.mjs — load the app and print the first page error with a stack.
 */
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
const url = process.env.APP_URL || 'http://localhost:5173/?quality=fast';
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
page.on('console', (m) => console.log(`[${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message, '\n', e.stack));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await new Promise((r) => setTimeout(r, Number(process.env.WAIT || 20000)));
const ready = await page.evaluate(() => !!window.__cutaway?.ready).catch(() => false);
console.log('ready:', ready);
await browser.close();
