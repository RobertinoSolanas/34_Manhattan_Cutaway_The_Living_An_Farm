/**
 * src/ui.js — the control desk. Compact, paper-and-ink, and it fades away
 * until you move the mouse, because the drawing is the point.
 */

import { PRESETS } from './camera.js';
import { fmtHour } from './util.js';
import { CUT_MIN, CUT_MAX } from './layout.js';

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};

export function buildUI(app) {
  const desk = document.getElementById('desk');
  const readout = document.getElementById('readout');
  const hint = document.getElementById('hint');
  const uiNodes = [desk, readout, hint];

  /* ── presets ─────────────────────────────────────────────────────────── */
  const cap = el('div', 'cap', '<span>Viewpoints</span><b id="presetName">Full section</b>');
  desk.appendChild(cap);
  const presetRow = el('div', 'row');
  desk.appendChild(presetRow);
  const chips = new Map();
  for (const p of PRESETS) {
    const b = el('button', 'chip', p.label);
    b.onclick = () => {
      app.applyPreset(p.id);
      for (const [, c] of chips) c.classList.remove('on');
      b.classList.add('on');
      document.getElementById('presetName').textContent = p.label;
    };
    chips.set(p.id, b);
    presetRow.appendChild(b);
  }
  chips.get('hero').classList.add('on');

  /* ── sliders ─────────────────────────────────────────────────────────── */
  const sliderBlock = (label, min, max, step, value, fmt, onInput) => {
    const wrap = el('div');
    const head = el('div', 'cap', `<span>${label}</span><b></b>`);
    const input = el('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    const out = head.querySelector('b');
    const sync = (v) => { out.textContent = fmt(v); };
    input.oninput = () => {
      const v = parseFloat(input.value);
      onInput(v);
      sync(v);
    };
    sync(parseFloat(value));
    wrap.appendChild(head);
    wrap.appendChild(input);
    return { wrap, input, sync };
  };

  const timeS = sliderBlock('Time of day', 0, 24, 0.05, app.dial.hour, (v) => fmtHour(v), (v) => {
    app.dial.hour = v;
    app.dial.auto = false;
    dayBtn.classList.remove('on');
  });
  const cutS = sliderBlock('Section depth', CUT_MAX, CUT_MIN, 0.01, app.cut, (v) => `${Math.abs(v).toFixed(2)} m`, (v) => {
    app.setCut(v);
    cutAutoBtn.classList.remove('on');
  });
  const densS = sliderBlock('Activity', 0.05, 1.6, 0.01, app.density, (v) => `${Math.round(v * 100)}%`, (v) => app.setDensity(v));
  desk.appendChild(timeS.wrap);
  desk.appendChild(cutS.wrap);
  desk.appendChild(densS.wrap);

  /* ── toggles ─────────────────────────────────────────────────────────── */
  const row = el('div', 'row');
  desk.appendChild(row);
  const mk = (label, on, fn, title) => {
    const b = el('button', `chip wide${on ? ' on' : ''}`, label);
    if (title) b.title = title;
    b.onclick = () => {
      const next = !b.classList.contains('on');
      b.classList.toggle('on', next);
      fn(next);
    };
    row.appendChild(b);
    return b;
  };
  const dayBtn = mk('Day cycle', app.dial.auto, (v) => { app.dial.auto = v; }, 'run the 24 h clock');
  const cutAutoBtn = mk('Cut sweep', false, (v) => app.setCutAuto(v), 'slide the cutting plane back and forth');
  const dollyBtn = mk('Dolly', true, (v) => app.setDolly(v), 'automatic lateral dolly');
  const bloomBtn = mk('Bloom', app.bloomOn, (v) => app.setBloom(v), 'glow on lit interiors');

  const qrow = el('div', 'row');
  desk.appendChild(el('div', 'cap', '<span>Quality</span><b id="qName"></b>'));
  desk.appendChild(qrow);
  for (const q of ['high', 'std', 'fast']) {
    const b = el('button', `chip wide${app.quality === q ? ' on' : ''}`, q === 'high' ? 'High' : q === 'std' ? 'Standard' : 'Fast');
    b.onclick = () => {
      app.setQuality(q);
      for (const n of qrow.children) n.classList.remove('on');
      b.classList.add('on');
      document.getElementById('qName').textContent = b.textContent;
    };
    qrow.appendChild(b);
  }
  document.getElementById('qName').textContent = app.quality === 'high' ? 'High' : app.quality === 'std' ? 'Standard' : 'Fast';

  const photoBtn = el('button', 'chip wide', 'Photo mode');
  photoBtn.style.marginTop = '2px';
  photoBtn.onclick = () => app.setPhoto(true);
  desk.appendChild(photoBtn);

  /* ── readout ─────────────────────────────────────────────────────────── */
  readout.innerHTML = `
    <div class="big" id="rTime">18:24</div>
    <div class="mid" id="rState">evening return</div>
    <div class="sep"></div>
    <div class="k"><span>cut</span><b id="rCut">1.75 m</b></div>
    <div class="k"><span>trains</span><b id="rTrain">—</b></div>
    <div class="k"><span>people</span><b id="rPeople">—</b></div>
    <div class="k"><span>elevators</span><b id="rLift">—</b></div>
    <div class="sep"></div>
    <div class="k"><span>draw calls</span><b id="rCalls">—</b></div>
    <div class="k"><span>fps</span><b id="rFps">—</b></div>
  `;

  /* ── idle fade ───────────────────────────────────────────────────────── */
  let idle = 0;
  let photo = false;
  const wake = () => {
    idle = 0;
    if (!photo) for (const n of uiNodes) n.classList.remove('hidden');
  };
  window.addEventListener('pointermove', wake);
  window.addEventListener('keydown', (e) => {
    wake();
    if (e.key === 'p' || e.key === 'P') app.setPhoto(!photo);
    if (e.key === 'h' || e.key === 'H') { photo = false; wake(); }
    const idx = parseInt(e.key, 10);
    if (!Number.isNaN(idx) && PRESETS[idx - 1]) {
      app.applyPreset(PRESETS[idx - 1].id);
      for (const [, c] of chips) c.classList.remove('on');
      chips.get(PRESETS[idx - 1].id)?.classList.add('on');
      document.getElementById('presetName').textContent = PRESETS[idx - 1].label;
    }
  });

  return {
    nodes: uiNodes,
    setPhoto(v) {
      photo = v;
      for (const n of uiNodes) n.classList.toggle('hidden', v);
    },
    tick(dt, app) {
      idle += dt;
      if (!photo && idle > 6.5) for (const n of uiNodes) n.classList.add('hidden');
      const r = (id, v) => {
        const n = document.getElementById(id);
        if (n && n.textContent !== v) n.textContent = v;
      };
      r('rTime', fmtHour(app.dial.hour));
      r('rState', app.stateLabel());
      r('rCut', `${Math.abs(app.cut).toFixed(2)} m`);
      r('rTrain', app.trainLabel());
      r('rPeople', String(app.peopleCount()));
      r('rLift', app.liftLabel());
      r('rCalls', String(app.stats.calls));
      r('rFps', String(Math.round(app.fps)));
      const cv = parseFloat(cutS.input.value);
      if (Math.abs(cv - app.cut) > 0.02) {
        cutS.input.value = app.cut;
        cutS.sync(app.cut);
      }
      const tv = parseFloat(timeS.input.value);
      if (Math.abs(tv - app.dial.hour) > 0.06) {
        timeS.input.value = app.dial.hour;
        timeS.sync(app.dial.hour);
      }
    },
  };
}
