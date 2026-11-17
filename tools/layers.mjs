/**
 * tools/layers.mjs — hide parts of the scene to find what is misbehaving.
 *   node tools/layers.mjs            → shots/L-all.jpg, L-skin.jpg, L-earth.jpg,
 *                                      L-world.jpg, L-sky.jpg
 */
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
const W = Number(process.env.VW || 900);
const H = Number(process.env.VH || 520);
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => console.log(`[${m.type()}]`, m.text().slice(0, 260)));
await page.goto(`http://localhost:${process.env.PORT || 5173}/?quality=${process.env.QUALITY || 'fast'}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__cutaway && window.__cutaway.ready === true', { timeout: 180000, polling: 400 });
await page.evaluate((cfg) => {
  window.__cutaway.setPhoto(true);
  window.__cutaway.setDolly(false);
  window.__cutaway.setDayAuto(false);
  window.__cutaway.applyPreset(cfg.preset, true);
  window.__cutaway.setTime(cfg.time);
  window.__cutaway.setCut(cfg.cut);
}, { preset: process.env.PRESET || 'hero', time: Number(process.env.TIME || 18.4), cut: Number(process.env.CUT || -1.75) });
await new Promise((r) => setTimeout(r, 2500));

const info = await page.evaluate(() => {
  const a = window.__cutaway.app;
  const rows = [];
  a.scene.traverse((o) => {
    if (o.isMesh || o.isInstancedMesh) {
      const p = new (o.position.constructor)();
      o.getWorldPosition(p);
      rows.push(`${o.name || o.type} visible=${o.visible} pos=${p.toArray().map((v) => v.toFixed(1))} mat=${o.material.type} geo=${o.geometry.type} ${(o.isInstancedMesh ? 'n=' + o.count : '')}`);
    }
  });
  return {
    camera: a.camera.position.toArray().map((v) => v.toFixed(1)),
    cut: a.cut,
    rows: rows.slice(0, 40),
    count: rows.length,
    fog: [a.scene.fog.near.toFixed(0), a.scene.fog.far.toFixed(0), `#${a.scene.fog.color.getHexString()}`],
    exposure: a.renderer.toneMappingExposure,
  };
});
console.log('camera', info.camera, 'cut', info.cut, 'meshCount', info.count);
console.log('fog', info.fog, 'exposure', info.exposure.toFixed(2));
for (const r of info.rows) console.log('  ', r);

const variants = [
  ['all', {}],
  ['skin', { skin: false }],
  ['earth', { earth: false }],
  ['world', { world: false }],
  ['sky', { sky: false }],
];
for (const [name, hide] of variants) {
  await page.evaluate((h) => {
    const a = window.__cutaway.app;
    a.skin.mesh.visible = h.skin !== false;
    a.earth.mesh.visible = h.earth !== false;
    a.world.visible = h.world !== false;
    a.sky.dome.visible = h.sky !== false;
  }, hide);
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: `shots/L-${name}.jpg`, type: 'jpeg', quality: 0.85 });
  console.log('wrote shots/L-' + name + '.jpg');
}
await browser.close();
