/**
 * src/main.js — entry point.
 *
 * Builds the whole block synchronously (no reveals — the city is complete on
 * the first frame) and publishes window.__cutaway for the test harness.
 */

import { App } from './app.js';
import { PRESETS } from './camera.js';

const app = new App();
app.init();
app.build();

const loader = document.getElementById('loader');
if (loader) {
  loader.classList.add('gone');
  setTimeout(() => loader.remove(), 900);
}

app.start();

window.__cutaway = {
  get ready() { return app.ready; },
  get fps() { return app.fps; },
  get stats() { return app.stats; },
  get scene() { return app.scene; },
  get renderer() { return app.renderer; },
  get dial() { return app.dial; },
  app,
  presets: PRESETS,
  census: () => app.census(),
  applyPreset: (id, instant = false) => app.applyPreset(id, instant),
  setTime: (h) => app.setTime(h),
  setCut: (z) => app.setCut(z),
  setCutAuto: (v) => app.setCutAuto(v),
  setDensity: (v) => app.setDensity(v),
  setQuality: (q) => app.setQuality(q),
  setPhoto: (v) => app.setPhoto(v),
  setDolly: (v) => app.setDolly(v),
  setDayAuto: (v) => app.setDayAuto(v),
  setDayRate: (r) => app.setDayRate(r),
  parkTrain: (on = true, door = 1) => app.trains?.park(on, door),
};

console.log(`[cutaway] block built in ${Math.round(app.buildMs)} ms · ${app.census().cutFaces} cut faces`);
