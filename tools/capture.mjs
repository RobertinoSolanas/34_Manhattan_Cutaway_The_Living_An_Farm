/**
 * tools/capture.mjs — headless harness for the cutaway.
 *
 *   node tools/capture.mjs smoke    console errors + scene census + fps
 *   node tools/capture.mjs shots    hero jpeg set (presets × time of day)
 *   node tools/capture.mjs views    every preset + every section depth
 *   node tools/capture.mjs video    ~20 s film (mp4 via ffmpeg)
 *   node tools/capture.mjs perf     fps / draw-call samples per preset
 *
 * env: APP_URL, VW, VH, SECONDS, QUALITY
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const CHROME = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  .filter(Boolean)
  .find((p) => existsSync(p));
if (!CHROME) {
  console.error('no chrome found — set CHROME_PATH');
  process.exit(1);
}

const url = process.env.APP_URL || 'http://localhost:5173/';
const mode = process.argv[2] || 'shots';
const W = Number(process.env.VW || 1600);
const H = Number(process.env.VH || 900);
const quality = process.env.QUALITY || 'high';
const outDir = 'shots';
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader',
    '--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu-sandbox',
    `--window-size=${W},${H}`, '--hide-scrollbars',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));

const appUrl = `${url}${url.includes('?') ? '&' : '?'}quality=${quality}`;
await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
try {
  await page.waitForFunction('window.__cutaway && window.__cutaway.ready === true', { timeout: 180000, polling: 500 });
} catch (err) {
  console.error('APP NEVER BECAME READY');
  console.error(logs.slice(0, 40).join('\n'));
  await page.screenshot({ path: `${outDir}/failure.jpg`, type: 'jpeg', quality: 0.8 }).catch(() => {});
  await browser.close();
  process.exit(1);
}
await sleep(3000);

const api = async (fn, ...args) => page.evaluate(fn, ...args);

if (mode === 'smoke') {
  const census = await api(() => window.__cutaway.census());
  console.log('── scene census ──');
  console.log(JSON.stringify(census, null, 2));
  const rows = [];
  for (let i = 0; i < 5; i += 1) {
    await sleep(1500);
    rows.push(await api(() => ({
      fps: Math.round(window.__cutaway.fps),
      calls: window.__cutaway.stats.calls,
      tris: window.__cutaway.stats.triangles,
      geoms: window.__cutaway.stats.geometries,
      progs: window.__cutaway.stats.programs,
      ms: Number(window.__cutaway.stats.frameMs.toFixed(1)),
    })));
  }
  console.table(rows);
} else if (mode === 'perf') {
  const presets = await api(() => window.__cutaway.presets.map((p) => p.id));
  const rows = [];
  for (const id of presets) {
    await api((presetId) => {
      window.__cutaway.setDolly(false);
      window.__cutaway.applyPreset(presetId, true);
      window.__cutaway.parkTrain(true, 1);
    }, id);
    await sleep(2500);
    rows.push({ preset: id, ...(await api(() => ({
      fps: Math.round(window.__cutaway.fps),
      calls: window.__cutaway.stats.calls,
      tris: Math.round(window.__cutaway.stats.triangles / 1000),
    }))) });
  }
  console.table(rows);
} else if (mode === 'video') {
  const framesDir = `${outDir}/frames`;
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  await api(() => {
    window.__cutaway.setPhoto(true);
    window.__cutaway.applyPreset('hero', true);
    window.__cutaway.setDolly(true);
    window.__cutaway.setDayAuto(true);
    window.__cutaway.setDayRate(1.6);
    window.__cutaway.setCutAuto(true);
  });
  const client = await page.createCDPSession();
  await client.send('Page.enable');
  let n = 0;
  const seconds = Number(process.env.SECONDS || 20);
  const done = new Promise((resolve) => {
    client.on('Page.screencastFrame', async (ev) => {
      writeFileSync(`${framesDir}/frame_${String(n).padStart(4, '0')}.jpg`, Buffer.from(ev.data, 'base64'));
      n += 1;
      await client.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
    });
    setTimeout(resolve, seconds * 1000);
  });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  await done;
  await client.send('Page.stopScreencast');
  console.log(`captured ${n} frames`);
  if (n > 8) {
    const fps = Math.max(12, Math.round(n / seconds));
    try {
      execSync(`ffmpeg -y -framerate ${fps} -i ${framesDir}/frame_%04d.jpg -c:v libx264 -pix_fmt yuv420p -crf 19 ${outDir}/cutaway.mp4`, { stdio: 'inherit' });
      console.log('wrote shots/cutaway.mp4');
    } catch {
      console.log('ffmpeg failed, frames kept in shots/frames');
    }
  }
} else if (mode === 'views') {
  const jobs = [];
  for (const p of await api(() => window.__cutaway.presets.map((x) => x.id))) jobs.push({ kind: 'preset', id: p });
  for (const depth of [0, -2, -4, -6, -8]) jobs.push({ kind: 'cut', depth });
  for (const hour of [6.5, 9, 13, 17.5, 20, 23.5]) jobs.push({ kind: 'time', hour });
  const dir = `${outDir}/views`;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  for (const job of jobs) {
    await api((cfg) => {
      window.__cutaway.setPhoto(true);
      window.__cutaway.setDolly(false);
      window.__cutaway.setDayAuto(false);
      window.__cutaway.setCutAuto(false);
      if (cfg.kind === 'preset') {
        window.__cutaway.applyPreset(cfg.id, true);
        window.__cutaway.setCut(-1.75);
        window.__cutaway.setTime(18.4);
        window.__cutaway.parkTrain(cfg.id === 'platform' || cfg.id === 'hero', 1);
      } else if (cfg.kind === 'cut') {
        window.__cutaway.applyPreset('hero', true);
        window.__cutaway.setCut(cfg.depth);
      } else {
        window.__cutaway.applyPreset('hero', true);
        window.__cutaway.setTime(cfg.hour);
      }
    }, job);
    await sleep(2200);
    const name = job.kind === 'preset' ? `preset-${job.id}` : job.kind === 'cut' ? `cut-${String(job.depth).replace('-', 'm')}` : `time-${String(job.hour).replace('.', '_')}`;
    await page.screenshot({ path: `${dir}/${name}.jpg`, type: 'jpeg', quality: 0.9 });
    console.log('view', name);
  }
} else {
  const shotList = [
    { name: '01-hero-first-frame', preset: 'hero', time: 17.9, cut: -1.75, park: true },
    { name: '02-hero-blue-hour', preset: 'hero', time: 18.9, cut: -1.75 },
    { name: '03-platform-arrival', preset: 'platform', time: 18.4, cut: -1.75, park: true },
    { name: '04-utility-stratum', preset: 'utility', time: 12.5, cut: -2.4 },
    { name: '05-express-tube', preset: 'express', time: 22.6, cut: -1.75 },
    { name: '06-apartment-stack', preset: 'stack', time: 20.6, cut: -2.2 },
    { name: '07-rooftop-water-tower', preset: 'roof', time: 17.2, cut: -1.75 },
    { name: '08-street-edge', preset: 'street', time: 8.6, cut: -1.75 },
    { name: '09-foundations-rock', preset: 'footing', time: 13.5, cut: -3.4 },
    { name: '10-service-gallery', preset: 'gallery', time: 2.6, cut: -2.2 },
    { name: '11-section-deep-6m', preset: 'hero', time: 15.2, cut: -6.2 },
    { name: '12-morning-outflow', preset: 'heroWide', time: 8.1, cut: -1.75 },
    { name: '13-late-night', preset: 'hero', time: 2.6, cut: -1.75, park: true },
    { name: '14-cut-at-facade', preset: 'hero', time: 12.8, cut: -1.2 },
  ];
  for (const shot of shotList) {
    await api((cfg) => {
      window.__cutaway.setPhoto(true);
      window.__cutaway.setDolly(false);
      window.__cutaway.setDayAuto(false);
      window.__cutaway.setCutAuto(false);
      window.__cutaway.applyPreset(cfg.preset, true);
      window.__cutaway.setTime(cfg.time);
      window.__cutaway.setCut(cfg.cut);
      window.__cutaway.parkTrain(false);
      if (cfg.park) window.__cutaway.parkTrain(true, 1);
    }, shot);
    await sleep(shot.park ? 3600 : 5400);
    await page.screenshot({ path: `${outDir}/${shot.name}.jpg`, type: 'jpeg', quality: 0.92 });
    console.log('shot', shot.name);
  }
  await api(() => {
    window.__cutaway.setPhoto(false);
    window.__cutaway.applyPreset('hero', true);
    window.__cutaway.setTime(18.4);
    window.__cutaway.setDolly(true);
  });
}

console.log(`\n── console noise (${logs.length}) ──`);
for (const line of logs.slice(0, 25)) console.log(line);
await browser.close();
