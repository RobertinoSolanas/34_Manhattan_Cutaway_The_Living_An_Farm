/**
 * tools/peek.mjs — fast single-shot for iteration.
 *   PRESET=hero TIME=18.4 CUT=-1.7 VW=1200 VH=680 QUALITY=std node tools/peek.mjs out.jpg
 */
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
const url = `http://localhost:${process.env.PORT || 5173}/?quality=${process.env.QUALITY || 'std'}`;
const out = process.argv[2] || 'shots/peek.jpg';
const W = Number(process.env.VW || 1200);
const H = Number(process.env.VH || 680);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--window-size=${W},${H}`],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction('window.__cutaway && window.__cutaway.ready === true', { timeout: 180000, polling: 400 });
await page.evaluate((cfg) => {
  const a = window.__cutaway;
  a.setPhoto(true);
  a.setDolly(false);
  a.setDayAuto(false);
  a.applyPreset(cfg.preset, true);
  a.setTime(cfg.time);
  a.setCut(cfg.cut);
  if (cfg.park) a.parkTrain(true, 1);
}, {
  preset: process.env.PRESET || 'hero',
  time: Number(process.env.TIME ?? 18.4),
  cut: Number(process.env.CUT ?? -1.75),
  park: process.env.PARK === '1',
});
await new Promise((r) => setTimeout(r, Number(process.env.WAIT || 4500)));
await page.screenshot({ path: out, type: 'jpeg', quality: Number(process.env.Q || 0.9) });
const stats = await page.evaluate(() => ({ ...window.__cutaway.stats, fps: Math.round(window.__cutaway.fps) }));
console.log(out, JSON.stringify(stats), errs.slice(0, 5));
await browser.close();
