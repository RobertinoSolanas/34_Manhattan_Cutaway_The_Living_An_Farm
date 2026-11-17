/**
 * tools/probe.mjs — geometry + instance probe.
 */
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 460 });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => console.log(`[${m.type()}]`, m.text().slice(0, 300)));
await page.goto(`http://localhost:5173/?quality=fast`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__cutaway && window.__cutaway.ready === true', { timeout: 180000, polling: 400 });
await new Promise((r) => setTimeout(r, 1500));
const out = await page.evaluate(() => {
  const a = window.__cutaway.app;
  const rows = [];
  a.world.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    rows.push(`${o.name} tris=${(o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 | 0} x[${b.min.x.toFixed(1)},${b.max.x.toFixed(1)}] y[${b.min.y.toFixed(1)},${b.max.y.toFixed(1)}] z[${b.min.z.toFixed(1)},${b.max.z.toFixed(1)}] clip=${o.material.clippingPlanes ? o.material.clippingPlanes.map((p) => `${p.normal.toArray()}@${p.constant.toFixed(2)}`) : 'none'}`);
  });
  /* sample some cut instances */
  const s = a.skin;
  const inst = [];
  for (let i = 0; i < 12; i += 1) {
    inst.push(`#${i} c=(${s.rect[i * 4].toFixed(1)},${s.rect[i * 4 + 1].toFixed(1)}) h=(${s.rect[i * 4 + 2].toFixed(2)},${s.rect[i * 4 + 3].toFixed(2)}) shape=${s.shape[i * 4]} mat=${s.shape[i * 4 + 1]} z=[${s.range[i * 2].toFixed(2)},${s.range[i * 2 + 1].toFixed(2)}] tint=${s.tint[i * 3].toFixed(2)},${s.tint[i * 3 + 1].toFixed(2)},${s.tint[i * 3 + 2].toFixed(2)}`);
  }
  /* distribution of instance y */
  let minY = 1e9;
  let maxY = -1e9;
  let alive = 0;
  for (let i = 0; i < s.count; i += 1) {
    minY = Math.min(minY, s.rect[i * 4 + 1]);
    maxY = Math.max(maxY, s.rect[i * 4 + 1]);
    if (s.range[i * 2] <= a.cut && s.range[i * 2 + 1] >= a.cut) alive += 1;
  }
  const e = a.earth;
  const hl = [];
  for (let i = 0; i < e.uniforms.uHoleCount.value; i += 1) {
    const A = e.uniforms.uHoleA.value[i];
    const B = e.uniforms.uHoleB.value[i];
    hl.push(`#${i} c=${A.x.toFixed(1)},${A.y.toFixed(1)} h=${A.z.toFixed(1)},${A.w.toFixed(1)} t=${B.x} col=${B.y.toFixed(2)}`);
  }
  return { rows, inst, used: s.count, alive, minY: minY.toFixed(1), maxY: maxY.toFixed(1), capacity: s.capacity, instanceCount: s.mesh.geometry.instanceCount,
    holes: { n: e.uniforms.uHoleCount.value, list: hl },
    backdrops: a.backdrops.map((b) => ({ z: b.uniforms.uZ.value, dim: b.uniforms.uDim.value, top: b.uniforms.uTop.value })),
  };
});
console.log('EARTH holes live', out.holes.n);
console.log(out.holes.list.join(' | '));
console.log('backdrops', out.backdrops);
console.log(out.rows.join('\n'));
console.log('skin used', out.used, 'alive@cut', out.alive, 'yRange', out.minY, out.maxY, 'instanceCount', out.instanceCount);
console.log(out.inst.join('\n'));
await browser.close();
