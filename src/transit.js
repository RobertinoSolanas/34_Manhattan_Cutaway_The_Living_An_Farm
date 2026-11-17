/**
 * src/transit.js — the machinery that moves.
 *
 * Trains: a local that decelerates honestly into the platform, cycles its
 * doors, exchanges passengers and clears out; a second local that runs through
 * the far track; a maintenance car standing in the service gallery; and the
 * deep express that goes past in a rush of light, timed with the steam being
 * blown out of the sidewalk grates.
 *
 * Elevators: cabs with counterweights on real ropes, dispatched against calls
 * that follow the hour, with shaft doors that open only when a car is level.
 */

import * as THREE from 'three';
import { Shell, KEYS } from './mat.js';
import { M } from './section.js';
import { UPPER, EXPRESS, BUILDINGS } from './layout.js';
import { P } from './palette.js';
import { rng, clamp, damp, lerp, smoothstep } from './util.js';

const CAR_L = 12.2;
const CAR_W = 2.72;
const CAR_H = 3.42;

function carGeo() {
  const sh = new Shell();
  const w = 1.24;
  /* stainless body with a rolled roof and a skirt */
  sh.box('body', -CAR_L / 2, CAR_L / 2, 0.42, CAR_H - 0.34, -w, w, new THREE.Color('#ffffff'));
  sh.box('body', -CAR_L / 2, CAR_L / 2, CAR_H - 0.34, CAR_H - 0.12, -w + 0.1, w - 0.1, new THREE.Color('#e2e6e8'));
  sh.box('body', -CAR_L / 2, CAR_L / 2, CAR_H - 0.14, CAR_H - 0.02, -w + 0.3, w - 0.3, new THREE.Color('#c8ced2'));
  sh.box('body', -CAR_L / 2, CAR_L / 2, 0.14, 0.44, -w + 0.05, w - 0.05, new THREE.Color('#8f979d'));
  /* sill and header bands, then the glazing itself baked dark into the stock so
     a train always reads as a train — the emissive pass lights it at night */
  const WIN = [[-5.5, -4.0], [-3.3, -1.8], [-1.1, 0.4], [1.5, 3.0], [3.7, 5.4]];
  for (const side of [-1, 1]) {
    sh.box('body', -CAR_L / 2, CAR_L / 2, 1.02, 1.14, side * (w - 0.02), side * (w + 0.07), new THREE.Color('#d6dbdf'));
    sh.box('body', -CAR_L / 2, CAR_L / 2, 2.06, 2.2, side * (w - 0.02), side * (w + 0.07), new THREE.Color('#cfd5d9'));
    for (const seg of WIN) {
      sh.box('body', seg[0], seg[1], 1.14, 2.06, side * (w + 0.025), side * (w + 0.05), new THREE.Color('#1a222a'));
    }
    /* a route stripe along the flank */
    sh.box('body', -CAR_L / 2, CAR_L / 2, 0.74, 0.86, side * (w + 0.02), side * (w + 0.045), new THREE.Color('#c9d2d8'));
  }
  /* corrugation below the sill and above the header, so the flank is not a sheet */
  for (let x = -CAR_L / 2 + 0.3; x < CAR_L / 2 - 0.2; x += 0.42) {
    sh.box('body', x, x + 0.06, 0.6, 1.02, w, w + 0.03, new THREE.Color('#dfe4e7'));
    sh.box('body', x, x + 0.06, 0.6, 1.02, -w - 0.03, -w + 0.02, new THREE.Color('#b9c0c5'));
    sh.box('body', x, x + 0.06, 2.2, CAR_H - 0.4, w, w + 0.03, new THREE.Color('#dfe4e7'));
    sh.box('body', x, x + 0.06, 2.2, CAR_H - 0.4, -w - 0.03, -w + 0.02, new THREE.Color('#b9c0c5'));
  }
  /* roof machinery */
  sh.box('body', -3.4, -1.2, CAR_H, CAR_H + 0.34, -0.72, 0.72, new THREE.Color('#9aa2a8'));
  sh.box('body', 1.1, 3.4, CAR_H, CAR_H + 0.28, -0.6, 0.6, new THREE.Color('#8f979d'));
  sh.box('body', -0.4, 0.4, CAR_H, CAR_H + 0.5, -0.16, 0.16, new THREE.Color('#7f878d'));
  /* trucks */
  for (const bx of [-CAR_L / 2 + 2.0, CAR_L / 2 - 2.0]) {
    sh.box('body', bx - 1.0, bx + 1.0, 0.06, 0.44, -1.2, 1.2, new THREE.Color('#3d4349'));
    for (const wx of [-0.62, 0.62]) {
      sh.tubeX('body', 0.3, 0, wx - 0.1 + bx, wx + 0.1 + bx, 0, 0.42, 10, new THREE.Color('#4a5057'), { caps: false });
    }
  }
  /* coupler pocket */
  sh.box('body', CAR_L / 2 - 0.1, CAR_L / 2 + 0.28, 0.5, 0.9, -0.24, 0.24, new THREE.Color('#5d646b'));
  return sh.geometry('body');
}

function windowGeo() {
  const sh = new Shell();
  const ys = 1.6;
  const w = 1.24;
  for (const seg of [[-5.5, -4.0], [-3.3, -1.8], [-1.1, 0.4], [1.5, 3.0], [3.7, 5.4]]) {
    sh.box('glow', seg[0], seg[1], ys - 0.46, ys + 0.44, w + 0.02, w + 0.05, new THREE.Color('#ffffff'));
    sh.box('glow', seg[0], seg[1], ys - 0.46, ys + 0.44, -w - 0.05, -w - 0.02, new THREE.Color('#e0e0e0'));
  }
  /* the route ball, and light spilling out of the car ends */
  sh.box('glow', -CAR_L / 2 + 0.12, -CAR_L / 2 + 0.62, CAR_H - 0.95, CAR_H - 0.6, w + 0.02, w + 0.05, new THREE.Color('#ffcf7a'));
  sh.box('glow', CAR_L / 2 - 0.62, CAR_L / 2 - 0.12, CAR_H - 0.95, CAR_H - 0.6, w + 0.02, w + 0.05, new THREE.Color('#ffcf7a'));
  return sh.geometry('glow');
}

function doorGeo() {
  const sh = new Shell();
  sh.box('body', -0.62, 0.62, 0.42, CAR_H - 0.5, -0.045, 0.045, new THREE.Color('#dfe3e6'));
  sh.box('body', -0.6, 0.6, 0.5, CAR_H - 0.7, -0.055, -0.045, new THREE.Color('#b6bcc1'));
  sh.box('body', -0.55, 0.55, 1.28, 2.02, -0.06, -0.05, new THREE.Color('#39424a'));
  return sh.geometry('body');
}

const DOOR_X = [-4.6, -2.2, 0.2, 2.6, 4.9];

export class Trains {
  constructor(app) {
    this.app = app;
    this.R = rng(31415);
    const mats = app.ctx.mats;
    const mk = (geo, mat, n, name) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.frustumCulled = false;
      m.count = 0;
      m.name = name;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      app.scene.add(m);
      return m;
    };
    this.body = mk(carGeo(), mats.body, 40, 'trainBody');
    this.win = mk(windowGeo(), mats.glow('trainWin', 1, 1), 40, 'trainWin');
    this.door = mk(doorGeo(), mats.body, 220, 'trainDoor');
    this.head = mk(headGeo(), mats.soft('trainHead', { color: '#fff3cc', opacity: 0.6 }), 12, 'trainHead');
    this.tail = mk(tailGeo(), mats.beacon, 12, 'trainTail');

    this.expressBody = mk(carGeo(), mats.body, 30, 'expressBody');
    this.expressWin = mk(windowGeo(), mats.glow('expressWin', 1, 1), 30, 'expressWin');

    /* three consists on the local box, one express rake */
    /* the stopping train rides the far track so the platform and its crowd stay
       legible from the section; the through train passes in front of it */
    this.local = [
      { track: UPPER.trackB, dir: 1, cars: 4, stops: true, state: 'run', x: -60, v: 0, target: 15.4, dwell: 0, label: 'local' },
      { track: UPPER.trackA, dir: -1, cars: 4, stops: false, state: 'run', x: 40, v: 13, target: -70, dwell: 0, label: 'through' },
    ];
    this.express = { x: -80, v: 22, dir: 1, cars: 8, carLen: 15.6, next: 6 };
    this.maintenance = { x: 26.5, z: GALLERY_Z() };
    this.event = 0;          /* spikes when the express goes past a point */
    this.eventX = -999;
    this.arrived = 0;        /* set for one frame when a local opens its doors */
    this.doorOpen = 0;
    this.label = '';
    this.platformZ = (UPPER.platformZ0 + UPPER.platformZ1) / 2;
  }

  get name() { return 'trains'; }

  /** park (or release) the local at the platform, for photography */
  park(on, doorOpen = 1) {
    const t = this.local[0];
    if (on) {
      t.state = 'dwell';
      t.x = t.target;
      t.v = 0;
      t.dwell = 1e6;
      this.doorOpen = doorOpen;
      this.parked = true;
    } else {
      this.parked = false;
      t.dwell = 0.4;
      t.state = 'dwell';
    }
  }

  onDensity() {}

  /* ── the local line ────────────────────────────────────────────────────── */
  updateLocals(dt, time) {
    const U = UPPER;
    for (const t of this.local) {
      const floorY = U.floorY + 0.56;
      if (t.stops) {
        const stopX = t.target;
        const d = (stopX - t.x) * t.dir;
        if (t.state === 'run' || t.state === 'approach') {
          if (d < 60 && d > 0) {
            t.state = 'approach';
            const vmax = Math.sqrt(Math.max(0, 2 * 0.85 * d));
            t.v = damp(t.v, Math.min(14, vmax), 4, dt);
          }
          if (d <= 0.25 && t.state === 'approach') {
            t.state = 'dwell';
            t.v = 0;
            t.x = stopX;
            t.dwell = 13.5;
            this.arrived = 1;
            t.boarded = false;
          } else {
            t.v = damp(t.v, 14, 1.2, dt);
          }
        } else if (t.state === 'dwell') {
          if (!this.parked) t.dwell -= dt;
          const k = t.dwell;
          this.doorOpen = k > 10.5 ? smoothstep(11.5, 10.2, k) : smoothstep(1.4, 2.6, k);
          if (t.dwell <= 0) {
            t.state = 'depart';
            t.target = t.dir > 0 ? 110 : -110;
          }
          t.v = 0;
        } else if (t.state === 'depart') {
          this.doorOpen = 0;
          t.v = damp(t.v, 15, 0.85, dt);
          if ((t.dir > 0 && t.x > 70) || (t.dir < 0 && t.x < -70)) {
            t.state = 'run';
            t.x = t.dir > 0 ? -75 - this.R() * 40 : 75 + this.R() * 40;
            t.v = 0;
            t.target = t.dir > 0 ? 15.4 : -70;
            t.nextGap = 16 + this.R() * 26;
          }
        }
        if (t.nextGap !== undefined && t.state === 'run' && t.v < 0.2) {
          t.nextGap -= dt;
          if (t.nextGap > 0) continue;
          t.nextGap = undefined;
        }
      } else {
        t.v = damp(t.v, 15.5, 1.1, dt);
      }
      t.x += t.dir * t.v * dt;
      if (!t.stops && ((t.dir > 0 && t.x > 80) || (t.dir < 0 && t.x < -80))) {
        t.x = t.dir > 0 ? -85 - this.R() * 30 : 85 + this.R() * 30;
        t.v = 6;
      }
      t.floorY = floorY;
    }
  }

  update(ctx) {
    const { dt, time, dial } = ctx;
    this.arrived = Math.max(0, this.arrived - dt * 3);
    this.updateLocals(dt, time);

    /* the express: a scheduled rush through the deep tube */
    const E = EXPRESS;
    this.express.next -= dt;
    if (this.express.next <= 0 && Math.abs(this.express.x) > 70) {
      this.express.dir *= -1;
      this.express.x = this.express.dir > 0 ? -80 : 80;
      this.express.next = 24 + this.R() * 30;
    }
    if (Math.abs(this.express.x) < 90) {
      this.express.v = damp(this.express.v, 23, 1.5, dt);
      const prev = this.express.x;
      this.express.x += this.express.dir * this.express.v * dt;
      /* the pressure wave reaches the street a couple of seconds later */
      if (prev < -2 && this.express.x >= -2) {
        this.event = 1;
        this.eventX = 0;
      }
    } else this.express.v = damp(this.express.v, 0, 0.6, dt);
    this.event = Math.max(0, this.event - dt * 0.55);

    /* ── write the instances ─────────────────────────────────────────────── */
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    let n = 0;
    let nd = 0;
    let nhead = 0;
    const night = 1 - dial.day;
    const winC = lerp(0.06, 1.9, Math.pow(night, 0.8));
    for (const t of this.local) {
      const baseZ = t.track;
      for (let c = 0; c < t.cars; c += 1) {
        if (n >= this.body.instanceMatrix.count) break;
        const cx = t.x - t.dir * (c + 0.5) * (CAR_L + 0.35) + t.dir * CAR_L / 2;
        e.set(0, t.dir > 0 ? 0 : Math.PI, 0);
        q.setFromEuler(e);
        v.set(cx, t.floorY, baseZ);
        m.compose(v, q, s);
        this.body.setMatrixAt(n, m);
        const steel = c % 3 === 0 ? 1.05 : 1;
        this.body.instanceColor.setXYZ(n, 0.5 * steel, 0.53 * steel, 0.57 * steel);
        this.win.setMatrixAt(n, m);
        /* glazed by day, warm and glowing by night */
        this.win.instanceColor.setXYZ(n, winC * 1.02, winC * 0.9, winC * 0.72);
        n += 1;
        /* doors on the platform-facing side, sliding open */
        const open = t.stops ? this.doorOpen : 0;
        for (const dx of DOOR_X) {
          if (nd + 1 >= this.door.instanceMatrix.count) break;
          const lxo = dx * (t.dir > 0 ? 1 : -1);
          const world = cx + lxo;
          const zDoor = baseZ + CAR_W / 2 + 0.03;
          for (const side of [-1, 1]) {
            const shift = side * open * 0.66;
            e.set(0, t.dir > 0 ? 0 : Math.PI, 0);
            q.setFromEuler(e);
            v.set(world + (t.dir > 0 ? shift : -shift) * 1, t.floorY, zDoor + side * 0.015);
            m.compose(v, q, s);
            this.door.setMatrixAt(nd, m);
            this.door.instanceColor.setXYZ(nd, 0.87, 0.9, 0.93);
            nd += 1;
          }
        }
      }
      /* headlight */
      if (nhead < this.head.instanceMatrix.count && t.v > 0.4) {
        const hx = t.x + t.dir * (0.4);
        e.set(0, 0, 0);
        q.setFromEuler(e);
        v.set(t.x + t.dir * 5.2, t.floorY + 0.75, t.track + t.dir * 0.2);
        s.set(2.6 + t.v * 0.4, 1, 1);
        m.compose(v, q, s);
        this.head.setMatrixAt(nhead, m);
        this.head.instanceColor.setXYZ(nhead, 1, 1, 1);
        nhead += 1;
        s.set(1, 1, 1);
      }
    }
    /* maintenance car standing in the gallery */
    {
      const g = this.maintenance;
      e.set(0, 0, 0);
      q.setFromEuler(e);
      v.set(g.x, -16.9, g.z);
      m.compose(v, q, s);
      if (n < this.body.instanceMatrix.count) {
        this.body.setMatrixAt(n, m);
        this.body.instanceColor.setXYZ(n, 0.52, 0.46, 0.3);
        this.win.setMatrixAt(n, m);
        this.win.instanceColor.setXYZ(n, 0.35, 0.34, 0.3);
        n += 1;
      }
    }
    this.finish(this.body, n);
    this.finish(this.win, n);
    this.finish(this.door, nd);
    this.finish(this.head, nhead);

    /* express consist */
    let ne = 0;
    if (Math.abs(this.express.x) < 96) {
      for (let c = 0; c < this.express.cars; c += 1) {
        if (ne >= this.expressBody.instanceMatrix.count) break;
        const cx = this.express.x - this.express.dir * (c + 0.5) * (this.express.carLen + 0.3) + this.express.dir * this.express.carLen / 2;
        e.set(0, this.express.dir > 0 ? 0 : Math.PI, 0);
        q.setFromEuler(e);
        v.set(cx, EXPRESS.invertY + 0.3, EXPRESS.cz);
        m.compose(v, q, s);
        this.expressBody.setMatrixAt(ne, m);
        this.expressBody.instanceColor.setXYZ(ne, 0.5, 0.53, 0.56);
        this.expressWin.setMatrixAt(ne, m);
        const blur = clamp(this.express.v / 24, 0, 1);
        this.expressWin.instanceColor.setXYZ(ne, (0.3 + 1.6 * night) * (0.7 + 0.5 * blur), (0.26 + 1.35 * night) * (0.7 + 0.5 * blur), (0.2 + 0.95 * night) * (0.7 + 0.5 * blur));
        ne += 1;
      }
    }
    this.finish(this.expressBody, ne);
    this.finish(this.expressWin, ne);

    const t0 = this.local[0];
    this.label = t0.state === 'dwell' ? 'local at platform' : t0.state === 'approach' ? 'local entering' : t0.state === 'depart' ? 'local clearing' : 'line clear';
  }

  finish(mesh, n) {
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

function headGeo() {
  const sh = new Shell();
  sh.box('glow', -0.5, 0.5, -0.16, 0.16, -0.3, 0.3, new THREE.Color('#ffffff'));
  return sh.geometry('glow');
}
function tailGeo() {
  const sh = new Shell();
  sh.box('glow', -0.08, 0.08, -0.08, 0.08, -0.2, 0.2, new THREE.Color('#ffffff'));
  return sh.geometry('glow');
}
function GALLERY_Z() {
  return -4.4;
}

/* ───────────────────────────── elevators ───────────────────────────────── */

function cabGeo() {
  const sh = new Shell();
  /* an open-fronted cab so the section shows who is riding */
  sh.box('body', -0.8, 0.8, 0, 0.1, -0.6, 0.6, new THREE.Color('#c9a05a'));
  sh.box('body', -0.8, 0.8, 0.1, 2.3, -0.62, -0.56, new THREE.Color('#d8d2c4'));
  sh.box('body', -0.8, -0.74, 0.1, 2.3, -0.6, 0.6, new THREE.Color('#cfc9bb'));
  sh.box('body', 0.74, 0.8, 0.1, 2.3, -0.6, 0.6, new THREE.Color('#cfc9bb'));
  sh.box('body', -0.8, 0.8, 2.3, 2.42, -0.62, 0.62, new THREE.Color('#e8e4d8'));
  sh.box('glow', -0.5, 0.5, 2.28, 2.34, -0.4, 0.4, new THREE.Color('#ffe6bc'));
  /* a handrail and the mirror */
  sh.box('body', -0.74, 0.74, 0.94, 0.99, -0.5, -0.44, new THREE.Color('#9aa1a8'));
  return sh.geometry('body');
}

function cwGeo() {
  const sh = new Shell();
  sh.box('body', -0.3, 0.3, 0, 1.1, -0.2, 0.2, new THREE.Color('#5f666d'));
  for (let y = 0.12; y < 1.05; y += 0.19) sh.box('body', -0.32, 0.32, y, y + 0.03, -0.22, 0.22, new THREE.Color('#4a5057'));
  return sh.geometry('body');
}

function ropeGeo() {
  const sh = new Shell();
  sh.box('body', -0.014, 0.014, 0, 1, -0.014, 0.014, new THREE.Color('#8b9298'));
  return sh.geometry('body');
}

function leafGeo() {
  const sh = new Shell();
  sh.box('body', -0.5, 0.5, 0, 2.28, -0.03, 0.03, new THREE.Color('#c9c3b6'));
  sh.box('body', -0.46, 0.46, 0.06, 2.2, -0.04, -0.03, new THREE.Color('#b3ada1'));
  sh.box('beacon', -0.42, 0.42, 2.3, 2.36, -0.02, 0.02, new THREE.Color('#ffd9a0'));
  return sh.geometry('body');
}

export class Lifts {
  constructor(app) {
    this.app = app;
    this.R = rng(2718);
    const mats = app.ctx.mats;
    const mk = (geo, mat, n, name) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.frustumCulled = false;
      m.count = 0;
      m.name = name;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      app.scene.add(m);
      return m;
    };
    this.cabs = mk(cabGeo(), mats.body, 24, 'liftCab');
    this.cws = mk(cwGeo(), mats.body, 24, 'liftCW');
    this.ropes = mk(ropeGeo(), mats.body, 60, 'liftRope');
    this.leaves = mk(leafGeo(), mats.body, 200, 'liftLeaf');

    this.shafts = [];
    for (const b of BUILDINGS) {
      if (!b.elevators || !b.shaftDoors || !b.levels) continue;
      for (const sh of b.elevators) {
        const floors = [...b.cellars].reverse().concat(b.levels).map((lv) => lv.y0 + 0.06);
        const top = b.top + 1.4;
        for (let c = 0; c < sh.cars; c += 1) {
          this.shafts.push({
            x: sh.x + (c - (sh.cars - 1) * 0.5) * 0.0,
            geo: sh.geo,
            floors,
            top,
            i: c,
            y: floors[Math.floor(this.R() * floors.length)],
            target: null,
            v: 0,
            door: 0,
            state: 'idle',
            wait: 1 + this.R() * 6,
            riders: [],
          });
        }
      }
      this.doorData = b.shaftDoors;
    }
    this.doors = [];
    for (const b of BUILDINGS) {
      for (const d of b.shaftDoors || []) this.doors.push({ ...d, open: 0, shaftKey: `${d.shaft.toFixed(2)}` });
    }
    this.labelTxt = '';
  }

  get name() { return 'lifts'; }

  update(ctx) {
    const { dt, dial } = ctx;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    let nc = 0;
    let nr = 0;
    let nl = 0;

    for (const sh of this.shafts) {
      /* dispatch: a call arrives, weighted toward the lobby in the morning */
      if (sh.target === null) {
        sh.wait -= dt;
        if (sh.wait <= 0) {
          const r = this.R();
          const lobbyBias = dial.profile.outflow * 0.55;
          let idx;
          if (r < lobbyBias) idx = Math.max(0, sh.floors.length - 1 - Math.floor(this.R() * 2));
          else idx = Math.floor(this.R() * sh.floors.length);
          if (Math.abs(sh.floors[idx] - sh.y) < 0.6) idx = (idx + 1 + Math.floor(this.R() * 3)) % sh.floors.length;
          sh.target = sh.floors[idx];
          sh.state = 'move';
        }
      }
      if (sh.state === 'move') {
        const d = sh.target - sh.y;
        const dist = Math.abs(d);
        const vmax = clamp(Math.sqrt(2 * 1.1 * dist), 0, 3.4);
        sh.v = damp(sh.v, vmax * Math.sign(d), 5, dt);
        sh.y += sh.v * dt;
        if (dist < 0.06 || Math.abs(sh.v) < 0.02) {
          sh.y = sh.target;
          sh.v = 0;
          sh.state = 'doors';
          sh.wait = 1.6 + this.R() * 2.4;
        }
      } else if (sh.state === 'doors') {
        sh.door = damp(sh.door, 1, 6, dt);
        if (sh.door > 0.94) {
          sh.wait -= dt;
          if (sh.wait <= 0) sh.state = 'closing';
        }
      } else if (sh.state === 'closing') {
        sh.door = damp(sh.door, 0, 5, dt);
        if (sh.door < 0.04) {
          sh.door = 0;
          sh.state = 'idle';
          sh.target = null;
          sh.wait = 2 + this.R() * 9;
        }
      }

      /* cab */
      if (nc < this.cabs.instanceMatrix.count) {
        v.set(sh.x, sh.y, sh.geo.z0 + 0.75);
        m.compose(v, q, s);
        this.cabs.setMatrixAt(nc, m);
        const warm = 0.9 + 0.25 * (1 - dial.day);
        this.cabs.instanceColor.setXYZ(nc, warm, warm * 0.97, warm * 0.9);
        nc += 1;
      }
      /* counterweight runs the opposite way inside the pocket */
      const travel = sh.top - sh.floors[0];
      const cwY = sh.floors[0] + (sh.top - sh.y - 2.4);
      if (nc <= this.cabs.instanceMatrix.count) {
        v.set(sh.geo.x1 - 0.36, clamp(cwY, sh.floors[0] - 0.5, sh.top), sh.geo.z1 - 0.34);
        m.compose(v, q, s);
        this.cws.setMatrixAt(nc - 1 < 0 ? 0 : nc - 1, m);
        this.cws.instanceColor.setXYZ(nc - 1, 0.6, 0.63, 0.66);
      }
      /* two ropes from the cab to the sheave */
      for (const rx of [sh.x - 0.4, sh.x + 0.4]) {
        if (nr >= this.ropes.instanceMatrix.count) break;
        v.set(rx, sh.y + 2.42, sh.geo.z0 + 0.75);
        s.set(1, Math.max(0.1, sh.top - sh.y - 2.4), 1);
        m.compose(v, q, s);
        this.ropes.setMatrixAt(nr, m);
        this.ropes.instanceColor.setXYZ(nr, 0.55, 0.58, 0.62);
        nr += 1;
        s.set(1, 1, 1);
      }
      /* the cw rope */
      if (nr < this.ropes.instanceMatrix.count) {
        v.set(sh.geo.x1 - 0.36, clamp(cwY, sh.floors[0], sh.top) + 1.1, sh.geo.z1 - 0.34);
        s.set(1, Math.max(0.1, sh.top - clamp(cwY, sh.floors[0], sh.top) - 1.1), 1);
        m.compose(v, q, s);
        this.ropes.setMatrixAt(nr, m);
        this.ropes.instanceColor.setXYZ(nr, 0.55, 0.58, 0.62);
        nr += 1;
        s.set(1, 1, 1);
      }
    }

    /* shaft doors: open only where a car is level */
    for (const d of this.doors) {
      let want = 0;
      for (const sh of this.shafts) {
        if (Math.abs(sh.geo.x0 + sh.geo.x1 - 2 * (d.shaft)) > 0.01) continue;
        if (Math.abs(sh.y - d.y) < 0.22) want = Math.max(want, sh.door);
      }
      d.open = damp(d.open, want, 8, dt);
      for (const side of [-1, 1]) {
        if (nl >= this.leaves.instanceMatrix.count) break;
        v.set(d.x + side * d.w * 0.5 * (1 - d.open * 0.92) + side * 0.0, d.y, d.z);
        m.compose(v, q, s);
        this.leaves.setMatrixAt(nl, m);
        const tone = 0.82 + 0.1 * (1 - dial.day);
        this.leaves.instanceColor.setXYZ(nl, tone, tone * 0.98, tone * 0.94);
        nl += 1;
      }
    }

    this.finish(this.cabs, nc);
    this.finish(this.cws, Math.max(0, nc - 1));
    this.finish(this.ropes, nr);
    this.finish(this.leaves, nl);
    const moving = this.shafts.filter((x) => x.state === 'move').length;
    this.liftLabel = `${moving}/${this.shafts.length} moving`;
  }

  finish(mesh, n) {
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
