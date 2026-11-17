/**
 * src/street.js — the layer that stitches the worlds together.
 *
 * Sidewalk build-up in section (setts, concrete, bedding), curb, asphalt with
 * its strata, grate frames breathing subway air, scaffold, a traffic light that
 * actually phases, parked cars, and the moving lane of taxis, a bus, a cyclist
 * and a delivery van stopping at the freight entrance.
 */

import * as THREE from 'three';
import { M } from './section.js';
import { KEYS } from './mat.js';
import { Shell } from './mat.js';
import { STREET, LEVEL } from './layout.js';
import { P } from './palette.js';
import { rng, clamp, lerp, damp } from './util.js';
import { deep } from './build.js';
import { POSE } from './people.js';

const FRONT = -1.1;

/* ── static geometry ────────────────────────────────────────────────────── */

export function buildStreet(ctx) {
  const R = rng(1776);
  const X0 = -46;
  const X1 = 46;
  const sw = STREET.sidewalk;
  const curb = STREET.curb;
  const road = STREET.road;

  /* sidewalk: setts / concrete / bedding, cut in the section */
  ctx.solid(KEYS.body, X0, X1, 0.14, 0.155, sw.z0, sw.z1, '#8f8c86', M.GRANITE, { ink: 0.85 });
  ctx.solid(KEYS.body, X0, X1, 0.0, 0.14, sw.z0, sw.z1, '#9c9a92', M.CONCRETE, { ink: 0.8 });
  ctx.onlyCut(X0, X1, -0.07, 0.0, sw.z0, sw.z1, M.SAND, '#b6a077', { z0: sw.z0, z1: sw.z1, ink: 0.6 });
  /* curb */
  ctx.solid(KEYS.metal, X0, X1, -0.05, 0.16, curb.z0, curb.z1, '#8b8880', M.GRANITE, { ink: 0.9 });
  /* roadway build-up */
  ctx.solid(KEYS.body, X0, X1, -0.06, 0.0, curb.z1, road.z1, '#3b3c40', M.ASPHALT, { ink: 0.85 });
  ctx.solid(KEYS.body, X0, X1, -0.24, -0.06, curb.z1, road.z1, '#4a4b4d', M.ASPHALT, { ink: 0.7 });
  ctx.solid(KEYS.body, X0, X1, -0.5, -0.24, curb.z1, road.z1, '#7d7466', M.GRAVEL, { ink: 0.7 });
  /* the front edge of the road plate, where the excavation takes it off */
  ctx.only3d(KEYS.body, X0, X1, -0.5, 0.0, road.z1 - 0.06, road.z1, deep('#3a3b3f'));

  /* lane markings, crosswalks, stop bars, manholes */
  for (let x = X0; x < X1; x += 6.2) {
    ctx.only3d(KEYS.body, x, x + 3.0, 0.002, 0.012, 8.55, 8.75, '#d8d4c4');
    ctx.only3d(KEYS.body, x + 0.6, x + 2.4, 0.002, 0.012, 11.05, 11.2, '#d8d4c4');
  }
  for (const cx of [-13.2, 9.4]) {
    for (let x = cx - 2.4; x < cx + 2.4; x += 0.62) {
      ctx.only3d(KEYS.body, x, x + 0.4, 0.002, 0.012, 4.1, 12.6, '#cfcbbb');
    }
    ctx.only3d(KEYS.body, cx + 2.9, cx + 3.3, 0.002, 0.012, 4.1, 8.4, '#cfcbbb');
  }
  for (let i = 0; i < 14; i += 1) {
    const x = X0 + 3 + R() * (X1 - X0 - 6);
    const z = 4.4 + R() * 8.4;
    ctx.shell(KEYS.metal).tubeY('metal', x, z, -0.02, 0.01, 0.28, 0.34, 10, col('#4e5054'), {});
    if (R.chance(0.4)) {
      ctx.shell(KEYS.metal).tubeY('metal', x + 1.4, z + 0.4, -0.02, 0.01, 0.2, 0.24, 8, col('#4e5054'), {});
    }
  }

  /* sidewalk grates — steam holes that breathe when a train passes below */
  ctx.grates = [];
  for (const g of STREET.grate) {
    ctx.only3d(KEYS.metal, g.x - g.w / 2 - 0.09, g.x + g.w / 2 + 0.09, 0.1, 0.19, 1.5, 2.4, '#6e7176');
    ctx.onlyCut(g.x - g.w / 2, g.x + g.w / 2, 0.16, 0.2, M.GRATE, '#7d848b', { z0: 1.5, z1: 2.4, ink: 0.9 });
    ctx.only3d(KEYS.body, g.x - g.w / 2, g.x + g.w / 2, 0.02, 0.09, 1.55, 2.35, '#1e242b');
    ctx.only3d(KEYS.beacon, g.x - g.w / 2 + 0.05, g.x + g.w / 2 - 0.05, 0.03, 0.05, 1.6, 2.3, col('#5b6c7a'));
    ctx.grates.push({ x: g.x, z: 1.95, w: g.w });
  }

  /* lamps, signals, hydrant, bins, benches, a bus shelter */
  for (const lx of STREET.lamps) {
    ctx.shell(KEYS.metal).tubeY('metal', lx, 4.05, 0.1, 4.6, 0.075, 0.1, 8, col('#4f5a63'), {});
    ctx.shell(KEYS.metal).tubeX('metal', 4.62, 4.05, lx - 0.02, lx + 1.15, 0.045, 0.07, 8, col('#4f5a63'), {});
    ctx.only3d(KEYS.metal, lx + 1.0, lx + 1.5, 4.44, 4.56, 4.62, 5.02, '#5a636b');
    ctx.lampGlow = ctx.pool('lampHead', lampHeadGeo(), KEYS.beacon, 40);
    ctx.lampGlow.add(lx + 1.25, 4.42, 4.82, { color: col(P.sodium) });
    ctx.only3d(KEYS.body, lx - 0.18, lx + 0.18, -0.4, 0.14, 3.88, 4.22, '#5d666e');
  }
  /* traffic light with real phases — the lamps themselves are animated */
  const tl = -13.2;
  ctx.shell(KEYS.metal).tubeY('metal', tl + 3.6, 3.9, 0.1, 3.5, 0.07, 0.09, 8, col('#3f4a52'), {});
  ctx.only3d(KEYS.body, tl + 3.36, tl + 3.86, 2.5, 3.44, 3.72, 4.1, '#22282e');
  ctx.trafficLight = { x: tl + 3.61, y: 3.18, z: 3.66 };
  /* sign blades */
  ctx.only3d(KEYS.body, tl + 3.5, tl + 5.2, 3.5, 3.72, 3.86, 3.94, '#2f6f4f');
  ctx.only3d(KEYS.body, tl + 3.5, tl + 5.0, 3.74, 3.96, 4.0, 4.08, '#2f5f8f');

  ctx.hydrant = STREET.hydrant;
  ctx.shell(KEYS.metal).tubeY('metal', STREET.hydrant, 2.6, 0.15, 0.78, 0.1, 0.14, 9, col('#c8452f'), {});
  ctx.only3d(KEYS.metal, STREET.hydrant - 0.22, STREET.hydrant + 0.22, 0.56, 0.66, 2.42, 2.78, '#b8452f');
  ctx.shell(KEYS.metal).tubeY('metal', STREET.hydrant, 2.6, 0.78, 0.9, 0.06, 0.09, 8, col('#e0603f'), {});

  for (const bx of [-21.4, -4.2, 14.6, 29.2]) {
    ctx.only3d(KEYS.body, bx - 0.32, bx + 0.32, 0.15, 0.94, 1.9, 2.5, '#4d565e');
    ctx.only3d(KEYS.metal, bx - 0.36, bx + 0.36, 0.94, 1.02, 1.86, 2.54, '#5d666e');
  }
  for (const bx of [-27.4, 2.2, 20.4]) {
    ctx.pool('bench', benchGeo(), KEYS.body, 40).add(bx, 0.155, 2.0, { color: col('#7d5a3c') });
  }

  /* bus shelter */
  const bsx = 16.2;
  ctx.only3d(KEYS.metal, bsx - 2.4, bsx + 2.4, 0.15, 2.7, 2.0, 2.12, '#6d757d');
  ctx.only3d(KEYS.metal, bsx - 2.4, bsx + 2.4, 2.7, 2.82, 2.0, 3.5, '#5d666e');
  ctx.only3d(KEYS.glass, bsx - 2.36, bsx + 2.36, 0.3, 2.66, 3.4, 3.48, col('#9dc0cf'));
  ctx.only3d(KEYS.beacon, bsx - 1.1, bsx + 1.1, 1.6, 2.3, 2.06, 2.1, col('#dfe9f2'));
  ctx.only3d(KEYS.body, bsx - 1.9, bsx + 1.9, 0.55, 0.62, 2.4, 3.0, '#4d565e');

  /* scaffold on the loft frontage — the honest Manhattan sidewalk obstruction */
  const sx0 = 23.4;
  const sx1 = 33.0;
  for (let x = sx0; x < sx1 + 0.1; x += 1.9) {
    for (const z of [0.2, 2.0]) {
      ctx.shell(KEYS.metal).tubeY('metal', x, z, 0.1, 9.2, 0.045, 0.06, 6, col('#3f6b52'), {});
    }
  }
  for (let y = 2.0; y < 9.3; y += 2.3) {
    for (const z of [0.2, 2.0]) {
      ctx.shell(KEYS.metal).tubeX('metal', y, z, sx0, sx1, 0.035, 0.05, 6, col('#3f6b52'), {});
    }
    ctx.only3d(KEYS.body, sx0, sx1, y - 0.06, y, 0.2, 2.05, '#8a7248');
  }
  for (let x = sx0; x < sx1; x += 3.8) {
    for (const z of [0.2, 2.0]) {
      ctx.shell(KEYS.metal).tubeZ('metal', x + 1.9, 3.0, z - 0.02, z + 0.02, 0.028, 0.042, 6, col('#3f6b52'), {});
    }
  }

  /* two trees, so the street is not entirely mineral */
  for (const tx of [-30.4, 35.6]) {
    ctx.shell(KEYS.body).tubeY('body', tx, 0.9, 0.1, 3.6, 0.14, 0.2, 8, col('#5d4a38'), {});
    ctx.shell('body').blob('body', tx, 4.5, 0.9, 1.7, col('#3f6b45'), 9, 6, 0.85);
    ctx.shell('body').blob('body', tx + 0.9, 3.9, 1.4, 1.15, col('#4a7a4a'), 8, 5, 0.85);
    ctx.only3d(KEYS.body, tx - 0.7, tx + 0.7, 0.14, 0.2, 0.2, 1.6, '#5b4a3a');
  }

  /* parked cars in the parking lane */
  const parked = [-25.6, -18.2, -6.4, 3.2, 24.8, 38.4];
  ctx.parked = parked;
  for (const px of parked) {
    ctx.pool('car', carGeo(), KEYS.body, 60).add(px, 0.0, STREET.parkingZ, { ry: Math.PI / 2, color: col(rng(Math.abs(px) * 1000 | 0)(1) < 0.4 ? P.taxiLight : rng(Math.abs(px) * 991 | 0)(1) < 0.5 ? P.carA : P.carB) });
  }
}

function col(h) {
  return new THREE.Color(h);
}

let _carGeo = null;
function carGeo() {
  if (_carGeo) return _carGeo;
  const sh = new Shell();
  sh.box('body', -2.2, 2.2, 0.32, 0.92, -0.85, 0.85, col('#ffffff'));
  sh.box('body', -1.25, 1.15, 0.92, 1.44, -0.76, 0.76, col('#e8e8e8'));
  sh.box('body', -1.18, 1.08, 0.96, 1.38, -0.79, -0.75, col('#2f3a44'));
  sh.box('body', -1.18, 1.08, 0.96, 1.38, 0.75, 0.79, col('#2f3a44'));
  sh.box('body', -1.14, 0.1, 1.4, 1.46, -0.72, 0.72, col('#d0d0d0'));
  for (const wx of [-1.42, 1.4]) {
    for (const wz of [-0.82, 0.82]) sh.tubeX('body', 0.34, wz, wx - 0.17, wx + 0.17, 0, 0.33, 10, col('#22262b'), { caps: false });
  }
  sh.box('body', -2.24, -2.16, 0.42, 0.62, -0.68, 0.68, col('#fff6d8'));
  sh.box('body', 2.16, 2.24, 0.42, 0.58, -0.68, 0.68, col('#8f2a22'));
  sh.box('body', -2.22, 2.22, 0.16, 0.34, -0.9, 0.9, col('#3a3f45'));
  _carGeo = sh.geometry('body');
  return _carGeo;
}

let _taxiSign = null;
function taxiSignGeo() {
  if (_taxiSign) return _taxiSign;
  const sh = new Shell();
  sh.box('glow', -0.26, 0.26, 0, 0.14, -0.16, 0.16, col('#ffffff'));
  _taxiSign = sh.geometry('glow');
  return _taxiSign;
}

let _lampHead = null;
function lampHeadGeo() {
  if (_lampHead) return _lampHead;
  const sh = new Shell();
  sh.box('glow', -0.3, 0.3, -0.08, 0.08, -0.18, 0.18, col('#ffffff'));
  _lampHead = sh.geometry('glow');
  return _lampHead;
}

let _busGeo = null;
function busGeo() {
  if (_busGeo) return _busGeo;
  const sh = new Shell();
  sh.box('body', -5.9, 5.9, 0.42, 2.9, -1.25, 1.25, col('#ffffff'));
  sh.box('body', -5.5, 5.5, 1.3, 2.42, -1.28, -1.22, col('#39424a'));
  sh.box('body', -5.5, 5.5, 1.3, 2.42, 1.22, 1.28, col('#39424a'));
  sh.box('body', -5.94, -5.82, 1.2, 2.5, -1.2, 1.2, col('#cfd4d8'));
  sh.box('body', 5.82, 5.94, 0.9, 2.5, -1.2, 1.2, col('#3a3f45'));
  for (const wx of [-4.1, -1.2, 3.4]) {
    for (const wz of [-1.2, 1.2]) sh.tubeX('body', 0.44, wz, wx - 0.32, wx + 0.32, 0, 0.44, 10, col('#22262b'), { caps: false });
  }
  _busGeo = sh.geometry('body');
  return _busGeo;
}

let _benchGeo = null;
function benchGeo() {
  if (_benchGeo) return _benchGeo;
  const sh = new Shell();
  sh.box('body', -0.85, 0.85, 0.42, 0.5, -0.2, 0.2, col('#ffffff'));
  sh.box('body', -0.85, 0.85, 0.5, 0.86, -0.24, -0.18, col('#e0e0e0'));
  for (const x of [-0.72, 0.72]) sh.box('body', x - 0.05, x + 0.05, 0, 0.42, -0.16, 0.16, col('#9a9a9a'));
  _benchGeo = sh.geometry('body');
  return _benchGeo;
}

/* ── traffic ────────────────────────────────────────────────────────────── */

export class Traffic {
  constructor(app) {
    this.app = app;
    this.R = rng(5252);
    const scene = app.scene;
    const mkPool = (geo, mat, n) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.frustumCulled = false;
      m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      scene.add(m);
      return m;
    };
    this.carMesh = mkPool(carGeo(), app.ctx.mats.body, 40);
    this.busMesh = mkPool(busGeo(), app.ctx.mats.body, 6);
    this.signMesh = mkPool(taxiSignGeo(), app.ctx.mats.beacon, 24);
    this.headMesh = mkPool(headGlowGeo(), app.ctx.mats.soft('trafficHead', { color: '#fff2c8', opacity: 0.5 }), 60);
    this.tailMesh = mkPool(tailGlowGeo(), app.ctx.mats.soft('trafficTail', { color: '#ff4a2f', opacity: 0.42 }), 60);
    const lampGeo = new THREE.BoxGeometry(0.15, 0.11, 0.1);
    const mkLamp = (hex, y) => {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), clippingPlanes: [app.cutPlane] });
      const mesh = new THREE.Mesh(lampGeo, mat);
      const t = app.ctx.trafficLight;
      mesh.position.set(t.x, t.y - y, t.z);
      mesh.renderOrder = 2;
      app.scene.add(mesh);
      return mesh;
    };
    this.sigRed = mkLamp('#c8452f', 0);
    this.sigAmber = mkLamp('#e0a72c', 0.3);
    this.sigGreen = mkLamp('#3f9e5f', 0.6);
    this.vehicles = [];
    this.spawnT = 0;
    this.busT = 6;
    this.phaseT = 0;
    this.phase = 'green';
    this.van = null;
    this.labelV = '';
  }

  get name() { return 'traffic'; }
  count() { return this.vehicles.length; }

  spawn(kind) {
    const R = this.R;
    const dir = R.chance(0.5) ? 1 : -1;
    const laneSet = dir > 0 ? [5.4, 7.5] : [9.6, 11.9];
    const z = R.pick(laneSet) + (R() - 0.5) * 0.24;
    const v = {
      kind,
      x: dir > 0 ? -48 : 48,
      z,
      dir,
      v: kind === 'bus' ? 9.2 : 10.5 + R() * 5.5,
      stopAt: null,
      dwell: 0,
      color: new THREE.Color(kind === 'taxi' ? P.cab : kind === 'bus' ? P.bus : R.pick([P.carA, P.carB, P.carC, '#6f8f7f', '#43505c', '#c8bfae'])),
    };
    if (kind === 'bus') v.stopAt = (dir > 0 ? 16.4 : 16.9);
    this.vehicles.push(v);
    return v;
  }

  update(ctx) {
    const { dt, dial, density } = ctx;
    const R = this.R;
    const want = Math.round((9 + 17 * clamp(dial.profile.crowd, 0, 1.3)) * (0.45 + 0.55 * (this.app.q.crowd ?? 1)) * clamp(density, 0.1, 1.5));

    /* the light cycles; cross traffic waits, this street goes */
    this.phaseT += dt;
    if (this.phase === 'green' && this.phaseT > 26) {
      this.phase = 'amber';
      this.phaseT = 0;
    } else if (this.phase === 'amber' && this.phaseT > 3.4) {
      this.phase = 'red';
      this.phaseT = 0;
    } else if (this.phase === 'red' && this.phaseT > 17) {
      this.phase = 'green';
      this.phaseT = 0;
    }
    const on = { red: this.phase === 'red' ? 1 : 0.12, amber: this.phase === 'amber' ? 1 : 0.12, green: this.phase === 'green' ? 1 : 0.12 };
    this.sigRed.material.color.setRGB(0.78 * on.red, 0.27 * on.red, 0.18 * on.red);
    this.sigAmber.material.color.setRGB(0.88 * on.amber, 0.66 * on.amber, 0.17 * on.amber);
    this.sigGreen.material.color.setRGB(0.24 * on.green, 0.62 * on.green, 0.37 * on.green);

    /* keep the street populated */
    this.spawnT -= dt;
    if (this.vehicles.length < want && this.spawnT <= 0) {
      this.spawn(R.chance(0.42) ? 'taxi' : 'car');
      this.spawnT = (0.4 + R() * 1.3) / clamp(dial.profile.crowd, 0.2, 1.4);
    }
    this.busT -= dt;
    if (this.busT <= 0) {
      this.spawn('bus');
      this.busT = 22 + R() * 26;
    }

    for (let i = this.vehicles.length - 1; i >= 0; i -= 1) {
      const v = this.vehicles[i];
      let target = v.kind === 'bus' ? v.v : v.v;
      /* buses stop at the stop; everyone respects a red at the crosswalk */
      const crossX = v.dir > 0 ? -10.0 : 12.6;
      const mustStop = (this.phase === 'red' && Math.abs(v.x - crossX) < 4.2 && v.x * v.dir < crossX * v.dir);
      if (v.stopAt !== null && Math.abs(v.x - v.stopAt) < 3.2 && v.dir * (v.stopAt - v.x) > 0) {
        if (v.dwell <= 0 && Math.abs(v.x - v.stopAt) < 0.4) v.dwell = 4.5;
      }
      if (v.dwell > 0) {
        v.dwell -= dt;
        target = 0;
      } else if (mustStop) {
        target = 0;
      } else if (v.stopAt !== null && Math.abs(v.x - v.stopAt) < 3.2) {
        target = v.v * clamp(Math.abs(v.x - v.stopAt) / 3.2, 0.1, 1);
      }
      v.vPrev = v.v;
      v.v = damp(v.v, target, 2.2, dt);
      v.x += v.dir * v.v * dt;
      if (v.x > 50 || v.x < -50) this.vehicles.splice(i, 1);
    }

    /* write instances */
    const night = 1 - dial.day;
    let nc = 0;
    let nb = 0;
    let ns = 0;
    let nh = 0;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v3 = new THREE.Vector3();
    const s3 = new THREE.Vector3();
    for (const v of this.vehicles) {
      const isBus = v.kind === 'bus';
      const mesh = isBus ? this.busMesh : this.carMesh;
      const slot = isBus ? nb++ : nc++;
      const cap = isBus ? this.busMesh.instanceMatrix.count : this.carMesh.instanceMatrix.count;
      if (slot >= cap) continue;
      e.set(0, v.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      q.setFromEuler(e);
      v3.set(v.x, 0, v.z);
      s3.set(1, 1, 1);
      m.compose(v3, q, s3);
      mesh.setMatrixAt(slot, m);
      mesh.instanceColor.setXYZ(slot, v.color.r, v.color.g, v.color.b);
      if (!isBus) {
        if (ns < this.signMesh.instanceMatrix.count) {
          e.set(0, v.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
          q.setFromEuler(e);
          v3.set(v.x, 1.5, v.z);
          m.compose(v3, q, s3);
          this.signMesh.setMatrixAt(ns, m);
          const hot = 0.8 + 0.6 * night;
          this.signMesh.instanceColor.setXYZ(ns, hot, hot * 0.86, hot * 0.5);
          ns += 1;
        }
      }
      /* head and tail glow */
      if (nh < this.headMesh.instanceMatrix.count) {
        const fx = v.x + v.dir * (isBus ? 6.1 : 2.35);
        e.set(0, 0, 0);
        q.setFromEuler(e);
        v3.set(fx, isBus ? 0.9 : 0.52, v.z);
        s3.set(1 + 5 * night * (isBus ? 1.4 : 1), 1, 1);
        m.compose(v3, q, s3);
        this.headMesh.setMatrixAt(nh, m);
        this.headMesh.instanceColor.setXYZ(nh, 1, 1, 1);
        const tx = v.x - v.dir * (isBus ? 6.1 : 2.35);
        v3.set(tx, isBus ? 0.9 : 0.52, v.z);
        s3.set(1, 1, 1);
        m.compose(v3, q, s3);
        if (nh < this.tailMesh.instanceMatrix.count) {
          this.tailMesh.setMatrixAt(nh, m);
          this.tailMesh.instanceColor.setXYZ(nh, 1, 1, 1);
        }
        nh += 1;
      }
    }
    this.finishMesh(this.carMesh, nc);
    this.finishMesh(this.busMesh, nb);
    this.finishMesh(this.signMesh, ns);
    this.finishMesh(this.headMesh, nh);
    this.finishMesh(this.tailMesh, nh);
    this.headMesh.material.opacity = 0.12 + 0.55 * night;
    this.tailMesh.material.opacity = 0.1 + 0.4 * night;
    this.labelV = `${this.vehicles.length} on the street`;
  }

  finishMesh(mesh, n) {
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

function headGlowGeo() {
  const sh = new Shell();
  sh.box('glow', -0.4, 0.4, -0.1, 0.1, -0.16, 0.16, col('#ffffff'));
  return sh.geometry('glow');
}
function tailGlowGeo() {
  const sh = new Shell();
  sh.box('glow', -0.12, 0.12, -0.08, 0.08, -0.3, 0.3, col('#ffffff'));
  return sh.geometry('glow');
}
