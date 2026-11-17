/**
 * src/interiors.js — the stacked lives.
 *
 * Every sliced room is fitted out from a prop library of instanced, merged
 * geometry: kitchens with sinks and fridge magnets, bookshelves with spines,
 * booths at the corner diner, desks with monitors, a dance studio with a mirror
 * wall and barres, a boiler room, a vault, parking, a super's workshop. Each
 * room also reports anchors where the crowd system parks its inhabitants, and a
 * warm light pool so the section glows from inside after sundown.
 */

import * as THREE from 'three';
import { Shell, KEYS } from './mat.js';
import { M } from './section.js';
import { BUILDINGS, LEVEL, LIGHT_TINT } from './layout.js';
import { rng, lerp, clamp } from './util.js';
import { P } from './palette.js';

export const INTERIOR = { anchors: [], rooms: [] };

/** prop tints are *multipliers* on the instance colour: a number is grey, a string is a hex */
function col(v) {
  return typeof v === 'number' ? new THREE.Color(v, v, v) : new THREE.Color(v);
}

/* ───────────────────────── prop geometry library ───────────────────────── */

const G = (fn, key = 'body') => {
  const sh = new Shell();
  fn(sh, key);
  return sh.geometry(key);
};
const W = 1;

function legs(sh, x0, x1, z0, z1, y, t = 0.045, tone = 0.72) {
  for (const x of [x0 + t, x1 - t]) {
    for (const z of [z0 + t, z1 - t]) {
      sh.box('body', x - t / 2, x + t / 2, 0, y, z - t / 2, z + t / 2, col(1).multiplyScalar(tone));
    }
  }
}

const PROPS = {
  chair: () => G((sh) => {
    sh.box('body', -0.22, 0.22, 0.42, 0.48, -0.21, 0.21, col(W));
    sh.box('body', -0.22, 0.22, 0.48, 0.94, -0.24, -0.18, col(W).multiplyScalar(0.9));
    legs(sh, -0.22, 0.22, -0.21, 0.21, 0.42, 0.04, 0.6);
  }),
  stool: () => G((sh) => {
    sh.tubeY('body', 0, 0, 0.6, 0.68, 0, 0.19, 9, col(W), {});
    sh.tubeY('body', 0, 0, 0, 0.6, 0, 0.05, 7, col(W).multiplyScalar(0.62), {});
    sh.tubeY('body', 0, 0, 0.06, 0.1, 0.13, 0.16, 9, col(W).multiplyScalar(0.55), {});
  }),
  desk: () => G((sh) => {
    sh.box('body', -0.75, 0.75, 0.71, 0.76, -0.38, 0.38, col(W));
    sh.box('body', -0.72, -0.64, 0, 0.71, -0.34, 0.34, col(W).multiplyScalar(0.74));
    sh.box('body', 0.64, 0.72, 0, 0.71, -0.34, 0.34, col(W).multiplyScalar(0.74));
    sh.box('body', -0.72, 0.72, 0.3, 0.66, -0.36, -0.3, col(W).multiplyScalar(0.55));
    /* monitor, keyboard, mug, papers */
    sh.box('body', -0.03, 0.03, 0.76, 0.9, -0.2, -0.14, col(0.5));
    sh.box('body', -0.29, 0.29, 0.76, 1.05, -0.26, -0.21, col(0.34));
    sh.box('body', -0.22, 0.22, 0.755, 0.775, 0.0, 0.14, col(0.72));
    sh.tubeY('body', 0.44, 0.1, 0.76, 0.85, 0.03, 0.045, 7, col(0.92), {});
    sh.box('body', -0.6, -0.36, 0.762, 0.79, -0.02, 0.2, col(1.05));
  }),
  sofa: () => G((sh) => {
    sh.box('body', -0.9, 0.9, 0.24, 0.52, -0.38, 0.38, col(W));
    sh.box('body', -0.9, 0.9, 0.52, 0.88, -0.42, -0.26, col(W).multiplyScalar(1.06));
    sh.box('body', -1.02, -0.86, 0.24, 0.66, -0.4, 0.36, col(W).multiplyScalar(0.86));
    sh.box('body', 0.86, 1.02, 0.24, 0.66, -0.4, 0.36, col(W).multiplyScalar(0.86));
    sh.box('body', -0.84, -0.04, 0.5, 0.62, -0.3, 0.3, col(W).multiplyScalar(1.12));
    sh.box('body', 0.04, 0.88, 0.5, 0.62, -0.3, 0.3, col(W).multiplyScalar(1.12));
    legs(sh, -0.9, 0.9, -0.36, 0.36, 0.24, 0.05, 0.5);
  }),
  bed: () => G((sh) => {
    sh.box('body', -0.78, 0.78, 0.18, 0.34, -1.02, 1.02, col(W).multiplyScalar(0.8));
    sh.box('body', -0.74, 0.74, 0.34, 0.52, -0.98, 0.98, col(1.15));
    sh.box('body', -0.74, 0.74, 0.5, 0.56, -0.2, 0.98, col(W));
    sh.box('body', -0.66, -0.1, 0.52, 0.66, -0.94, -0.6, col(1.25));
    sh.box('body', 0.1, 0.66, 0.52, 0.66, -0.94, -0.6, col(1.25));
    sh.box('body', -0.8, 0.8, 0.3, 1.12, -1.12, -1.02, col(W).multiplyScalar(0.7));
  }),
  wardrobe: () => G((sh) => {
    sh.box('body', -0.6, 0.6, 0, 2.1, -0.3, 0.3, col(W));
    sh.box('body', -0.02, 0.02, 0.06, 2.04, 0.3, 0.32, col(0.6));
    sh.box('body', -0.16, -0.1, 1.0, 1.16, 0.3, 0.34, col(1.3));
    sh.box('body', 0.1, 0.16, 1.0, 1.16, 0.3, 0.34, col(1.3));
  }),
  shelf: () => G((sh) => {
    sh.box('body', -0.5, 0.5, 0, 1.9, -0.16, 0.16, col(W).multiplyScalar(0.95));
    for (let i = 0; i < 4; i += 1) {
      const y = 0.36 + i * 0.44;
      sh.box('body', -0.48, 0.48, y, y + 0.03, -0.15, 0.15, col(1.1));
      for (let x = -0.44; x < 0.4; x += 0.052) {
        const h = 0.2 + ((Math.abs(Math.sin(x * 91.7)) * 0.12));
        sh.box('body', x, x + 0.04, y + 0.03, y + 0.03 + h, -0.1, 0.08, col(0.86 + Math.abs(Math.sin(x * 12.9)) * 0.62));
      }
    }
  }),
  kitchenRun: () => G((sh) => {
    sh.box('body', -1.1, 1.1, 0, 0.86, -0.32, 0.3, col(W));
    sh.box('body', -1.14, 1.14, 0.86, 0.92, -0.34, 0.34, col(1.2));
    for (let x = -1.02; x < 1.0; x += 0.5) {
      sh.box('body', x, x + 0.44, 0.1, 0.8, -0.33, -0.3, col(0.82));
      sh.box('body', x + 0.18, x + 0.26, 0.62, 0.66, -0.345, -0.33, col(1.35));
    }
    sh.box('body', -0.3, 0.28, 0.8, 0.88, -0.28, 0.22, col(0.42));
    sh.tubeY('body', -0.02, -0.16, 0.92, 1.16, 0.02, 0.032, 7, col(1.4), {});
    sh.box('body', -1.1, 1.1, 1.5, 2.1, -0.2, 0.02, col(W).multiplyScalar(0.94));
    for (let x = -1.04; x < 1.0; x += 0.52) sh.box('body', x, x + 0.46, 1.54, 2.06, -0.22, -0.2, col(0.8));
    sh.box('body', -1.1, 1.1, 0.92, 1.06, -0.34, -0.2, col(1.05));
  }),
  fridge: () => G((sh) => {
    sh.box('body', -0.36, 0.36, 0, 1.86, -0.34, 0.34, col(W));
    sh.box('body', -0.34, 0.34, 0.62, 0.66, 0.34, 0.36, col(0.55));
    sh.box('body', -0.02, 0.02, 0.02, 1.84, 0.34, 0.355, col(0.6));
  }),
  stove: () => G((sh) => {
    sh.box('body', -0.32, 0.32, 0, 0.88, -0.3, 0.3, col(W).multiplyScalar(0.9));
    sh.box('body', -0.34, 0.34, 0.88, 0.93, -0.32, 0.32, col(1.3));
    for (const [hx, hz] of [[-0.15, -0.12], [0.15, -0.12], [-0.15, 0.12], [0.15, 0.12]]) {
      sh.tubeY('body', hx, hz, 0.93, 0.96, 0.06, 0.08, 8, col(0.35), {});
    }
    sh.box('body', -0.26, 0.26, 0.4, 0.78, -0.31, -0.29, col(0.42));
    sh.box('body', -0.3, 0.3, 1.5, 1.62, -0.3, 0.24, col(1.15));
  }),
  plant: () => G((sh) => {
    sh.tubeY('body', 0, 0, 0, 0.3, 0.12, 0.17, 9, col(W), {});
    sh.blob('body', 0, 0.48, 0, 0.28, col(1.1), 8, 5, 0.9);
    sh.blob('body', 0.14, 0.66, -0.06, 0.19, col(1.25), 7, 4, 0.9);
    sh.blob('body', -0.12, 0.62, 0.08, 0.16, col(0.9), 7, 4, 0.9);
  }),
  floorLamp: () => G((sh) => {
    sh.tubeY('body', 0, 0, 0, 1.5, 0.02, 0.03, 7, col(0.7), {});
    sh.tubeY('body', 0, 0, 0, 0.03, 0.14, 0.17, 9, col(0.6), {});
    sh.tubeY('body', 0, 0, 1.5, 1.82, 0.14, 0.22, 10, col(1.25), {});
  }),
  tv: () => G((sh) => {
    sh.box('body', -0.62, 0.62, 0.34, 0.42, -0.16, 0.16, col(0.6));
    sh.box('body', -0.6, 0.6, 0.44, 1.06, -0.09, -0.05, col(0.28));
  }),
  table: () => G((sh) => {
    sh.box('body', -0.6, 0.6, 0.7, 0.75, -0.42, 0.42, col(W));
    legs(sh, -0.55, 0.55, -0.38, 0.38, 0.7, 0.05, 0.66);
  }),
  coffeeTable: () => G((sh) => {
    sh.box('body', -0.5, 0.5, 0.32, 0.37, -0.3, 0.3, col(W));
    sh.box('body', -0.44, 0.44, 0.06, 0.32, -0.05, 0.05, col(0.7));
  }),
  washer: () => G((sh) => {
    sh.box('body', -0.34, 0.34, 0, 0.86, -0.32, 0.32, col(W));
    sh.tubeZ('body', 0, 0.44, 0.32, 0.35, 0.14, 0.2, 12, col(0.3), {});
    sh.box('body', -0.3, 0.3, 0.7, 0.78, 0.33, 0.34, col(1.3));
  }),
  workbench: () => G((sh) => {
    sh.box('body', -0.95, 0.95, 0.82, 0.9, -0.34, 0.34, col(W));
    legs(sh, -0.9, 0.9, -0.3, 0.3, 0.82, 0.07, 0.62);
    sh.box('body', -0.95, 0.95, 0.9, 1.6, -0.4, -0.34, col(0.82));
    for (let x = -0.8; x < 0.8; x += 0.17) sh.box('body', x, x + 0.04, 1.1, 1.16, -0.42, -0.4, col(1.3));
    sh.box('body', 0.5, 0.78, 0.9, 1.02, -0.1, 0.16, col(0.5));
  }),
  boiler: () => G((sh) => {
    sh.box('body', -0.62, 0.62, 0.18, 1.5, -0.5, 0.5, col(W));
    sh.box('body', -0.5, 0.5, 1.5, 1.66, -0.4, 0.4, col(0.86));
    sh.tubeY('body', 0.22, 0, 1.66, 2.7, 0.11, 0.14, 9, col(1.05), {});
    sh.box('body', -0.4, -0.06, 0.7, 1.0, 0.5, 0.53, col(0.4));
    sh.tubeX('body', 1.1, 0.5, -0.62, 0.62, 0.06, 0.08, 8, col(1.2), { caps: false });
  }),
  tank: () => G((sh) => {
    sh.tubeY('body', 0, 0, 0, 1.6, 0.4, 0.48, 12, col(W), {});
    sh.tubeY('body', 0, 0, 1.6, 1.74, 0.36, 0.48, 12, col(0.86), {});
  }),
  racking: () => G((sh) => {
    for (const x of [-0.9, 0, 0.9]) sh.box('body', x - 0.05, x + 0.05, 0, 2.2, -0.3, 0.3, col(0.7));
    for (let i = 0; i < 4; i += 1) {
      const y = 0.42 + i * 0.5;
      sh.box('body', -0.95, 0.95, y, y + 0.05, -0.32, 0.32, col(1.1));
      for (let x = -0.82; x < 0.7; x += 0.42) {
        const h = 0.2 + Math.abs(Math.sin(x * 40 + i)) * 0.14;
        sh.box('body', x, x + 0.36, y + 0.05, y + 0.05 + h, -0.26, 0.26, col(0.6 + Math.abs(Math.sin(x * 7 + i * 3)) * 0.6));
      }
    }
  }),
  car: () => G((sh) => {
    sh.box('body', -2.1, 2.1, 0.34, 0.94, -0.86, 0.86, col(W));
    sh.box('body', -1.2, 1.15, 0.94, 1.42, -0.78, 0.78, col(0.94));
    sh.box('body', -1.14, 1.1, 0.98, 1.36, -0.8, -0.76, col(0.42));
    sh.box('body', -1.14, 1.1, 0.98, 1.36, 0.76, 0.8, col(0.42));
    for (const [wx, wz] of [[-1.4, -0.86], [-1.4, 0.86], [1.4, -0.86], [1.4, 0.86]]) {
      sh.tubeX('body', 0.34, wz, wx - 0.18, wx + 0.18, 0, 0.33, 10, col(0.26), {});
    }
    sh.box('body', -2.14, -2.06, 0.42, 0.6, -0.7, 0.7, col(1.3));
    sh.box('body', 2.06, 2.14, 0.42, 0.56, -0.7, 0.7, col(0.55));
  }),
  vaultDoor: () => G((sh) => {
    sh.tubeZ('body', 0, 0, -0.16, 0.16, 0.62, 0.78, 20, col(W), {});
    sh.tubeZ('body', 0, 0, 0.16, 0.24, 0.5, 0.62, 18, col(0.86), {});
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      sh.tubeZ('body', Math.cos(a) * 0.68, Math.sin(a) * 0.68, 0.16, 0.3, 0, 0.05, 6, col(1.25), {});
    }
    sh.tubeZ('body', 0, 0, 0.24, 0.34, 0.06, 0.1, 8, col(1.2), {});
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI;
      sh.box('body', -0.02 + Math.cos(a) * 0.34, 0.02 + Math.cos(a) * 0.34, -0.42 + Math.sin(a) * 0.34, 0.42 + Math.sin(a) * 0.34, 0.3, 0.36, col(1.1));
    }
  }),
  depositWall: () => G((sh) => {
    for (let i = 0; i < 7; i += 1) {
      for (let j = 0; j < 5; j += 1) {
        sh.box('body', -0.84 + i * 0.24, -0.68 + i * 0.24, 0.3 + j * 0.32, 0.56 + j * 0.32, -0.1, 0.02, col(0.72 + ((i * 5 + j) % 3) * 0.16));
        sh.box('body', -0.8 + i * 0.24, -0.74 + i * 0.24, 0.42 + j * 0.32, 0.45 + j * 0.32, 0.02, 0.05, col(1.3));
      }
    }
  }),
  reception: () => G((sh) => {
    sh.box('body', -1.3, 1.3, 0, 1.05, -0.4, 0.4, col(W));
    sh.box('body', -1.36, 1.36, 1.05, 1.13, -0.46, 0.46, col(1.2));
    sh.box('body', -1.28, 1.28, 0.16, 0.98, 0.4, 0.42, col(0.78));
  }),
  bench: () => G((sh) => {
    sh.box('body', -0.9, 0.9, 0.42, 0.48, -0.2, 0.2, col(W));
    sh.box('body', -0.9, 0.9, 0.5, 0.86, -0.24, -0.18, col(0.92));
    for (const x of [-0.78, 0.78]) sh.box('body', x - 0.05, x + 0.05, 0, 0.42, -0.16, 0.16, col(0.6));
  }),
  rowChair: () => G((sh) => {
    sh.box('body', -0.26, 0.26, 0.42, 0.48, -0.22, 0.22, col(W));
    sh.box('body', -0.26, 0.26, 0.48, 0.86, -0.26, -0.2, col(0.92));
    sh.box('body', -0.04, 0.04, 0, 0.42, -0.04, 0.04, col(0.55));
  }),
  barre: () => G((sh) => {
    for (const x of [-1.4, 0, 1.4]) sh.box('body', x - 0.04, x + 0.04, 0, 1.02, -0.04, 0.04, col(0.66));
    sh.tubeX('body', 1.02, 0, -1.6, 1.6, 0.028, 0.042, 8, col(W), {});
  }),
  counter: () => G((sh) => {
    sh.box('body', -2.4, 2.4, 0, 1.02, -0.42, 0.36, col(W));
    sh.box('body', -2.46, 2.46, 1.02, 1.09, -0.48, 0.44, col(1.22));
    sh.box('body', -2.38, 2.38, 0.12, 0.9, -0.44, -0.41, col(0.8));
    sh.box('body', -2.3, -2.28, 1.09, 1.7, -0.44, 0.4, col(0.9));
  }),
  hood: () => G((sh) => {
    sh.box('body', -1.2, 1.2, 2.0, 2.24, -0.5, 0.36, col(1.06));
    sh.box('body', -0.4, 0.4, 2.24, 2.9, -0.24, 0.24, col(0.86));
  }),
  toilet: () => G((sh) => {
    sh.box('body', -0.22, 0.22, 0, 0.42, -0.3, 0.24, col(W));
    sh.tubeY('body', 0, 0.06, 0.42, 0.5, 0.18, 0.22, 10, col(1.1), {});
    sh.box('body', -0.2, 0.2, 0.5, 0.86, -0.3, -0.16, col(0.96));
  }),
  lavatory: () => G((sh) => {
    sh.box('body', -0.28, 0.28, 0.72, 0.82, -0.24, 0.24, col(W));
    sh.tubeY('body', 0, 0, 0.58, 0.72, 0.03, 0.05, 7, col(1.3), {});
  }),
  crate: () => G((sh) => {
    sh.box('body', -0.34, 0.34, 0, 0.56, -0.28, 0.28, col(W));
    sh.box('body', -0.36, 0.36, 0.04, 0.1, -0.3, 0.3, col(0.7));
  }),
  pallet: () => G((sh) => {
    sh.box('body', -0.6, 0.6, 0, 0.09, -0.44, 0.44, col(W));
    for (const x of [-0.5, 0, 0.5]) sh.box('body', x - 0.07, x + 0.07, 0.09, 0.2, -0.44, 0.44, col(0.72));
  }),
  handTruck: () => G((sh) => {
    sh.box('body', -0.22, 0.22, 0, 1.1, -0.06, 0.06, col(1.1));
    sh.box('body', -0.26, 0.26, 0.02, 0.1, -0.3, 0.06, col(0.8));
    sh.tubeX('body', 0.08, 0.02, -0.2, 0.2, 0, 0.09, 8, col(0.4), {});
    sh.box('body', -0.24, 0.24, 0.1, 0.62, -0.28, 0.02, col(0.9));
  }),
  dog: () => G((sh) => {
    sh.box('body', -0.24, 0.24, 0.26, 0.44, -0.13, 0.13, col(W));
    sh.box('body', 0.16, 0.34, 0.34, 0.5, -0.1, 0.1, col(1.1));
    for (const [lx, lz] of [[-0.17, -0.09], [-0.17, 0.09], [0.15, -0.09], [0.15, 0.09]]) {
      sh.box('body', lx - 0.035, lx + 0.035, 0, 0.26, lz - 0.035, lz + 0.035, col(0.8));
    }
    sh.box('body', -0.34, -0.24, 0.4, 0.5, -0.02, 0.02, col(1.15));
  }),
  bike: () => G((sh) => {
    for (const x of [-0.34, 0.34]) sh.tubeX('body', 0.33, 0, x - 0.03, x + 0.03, 0.28, 0.33, 12, col(0.35), {});
    sh.box('body', -0.34, 0.34, 0.5, 0.56, -0.02, 0.02, col(0.9));
    sh.box('body', -0.02, 0.02, 0.56, 0.9, -0.16, 0.16, col(0.75));
    sh.box('body', -0.2, 0.2, 0.86, 0.92, -0.02, 0.14, col(0.6));
  }),
  medicalCart: () => G((sh) => {
    sh.box('body', -0.3, 0.3, 0.3, 0.92, -0.22, 0.22, col(0.95));
    sh.box('body', -0.32, 0.32, 0.6, 0.64, -0.24, 0.24, col(1.2));
    sh.box('body', -0.28, 0.28, 0.92, 0.96, -0.22, 0.22, col(1.1));
  }),
  printer: () => G((sh) => {
    sh.box('body', -0.34, 0.34, 0, 1.0, -0.3, 0.3, col(0.72));
    sh.box('body', -0.3, 0.3, 1.0, 1.24, -0.26, 0.26, col(1.05));
  }),
  cello: () => G((sh) => {
    sh.box('body', -0.16, 0.16, 0.34, 0.86, -0.1, 0.1, col(W));
    sh.box('body', -0.2, 0.2, 0.1, 0.42, -0.13, 0.13, col(1.1));
    sh.box('body', -0.02, 0.02, 0.86, 1.24, -0.06, 0.02, col(0.8));
  }),
  radiator: () => G((sh) => {
    sh.box('body', -0.42, 0.42, 0, 0.56, -0.09, 0.09, col(W).multiplyScalar(1.05));
    for (let x = -0.38; x < 0.4; x += 0.075) sh.box('body', x, x + 0.03, -0.02, 0.58, 0.09, 0.12, col(0.88));
    sh.box('body', -0.44, 0.44, 0.54, 0.6, -0.1, 0.1, col(1.2));
  }),
  frame: () => G((sh) => {
    sh.box('body', -0.26, 0.26, 0, 0.36, -0.02, 0.02, col(1.25));
    sh.box('body', -0.22, 0.22, 0.04, 0.32, 0.02, 0.035, col(0.7));
  }),
  clutter: () => G((sh) => {
    for (let i = 0; i < 5; i += 1) {
      const x = -0.3 + (i % 3) * 0.28;
      const h = 0.1 + (i % 4) * 0.055;
      sh.box('body', x, x + 0.13, 0, h, -0.08, 0.08, col(0.7 + (i % 3) * 0.25));
    }
  }),
  doorLeaf: () => G((sh) => {
    sh.box('body', -0.44, 0.44, 0, 2.06, -0.035, 0.035, col(0.86));
    sh.box('body', -0.36, 0.36, 0.12, 0.94, 0.035, 0.05, col(0.72));
    sh.box('body', -0.36, 0.36, 1.06, 1.9, 0.035, 0.05, col(0.72));
    sh.box('body', 0.28, 0.36, 0.96, 1.04, 0.05, 0.075, col(1.4));
  }),
  gymMat: () => G((sh) => {
    sh.box('body', -1.0, 1.0, 0, 0.06, -0.6, 0.6, col(W));
  }),
};

/* one-off geometry for lights (kept in the beacon / glow shells) */
const GEOM_LAMP = G((sh, key) => {
  sh.box(key, -0.44, 0.44, -0.05, 0.05, -0.14, 0.14, col(1));
}, 'glow');
const GEOM_DOWN = G((sh, key) => {
  sh.tubeY(key, 0, 0, -0.04, 0.03, 0.06, 0.09, 8, col(1), {});
}, 'glow');

/* ─────────────────────────── room fit-out ──────────────────────────────── */

function room(ctx, b, lv, room, R) {
  const inner0 = Math.max(b.x0 + b.party, room.x0);
  const inner1 = Math.min(b.x1 - b.party, room.x1);
  const w = inner1 - inner0;
  if (w < 1.1) return;
  const cx = (inner0 + inner1) / 2;
  const floorY = lv.y0 + 0.035;
  const ceilY = lv.y0 + lv.h - 0.23 - 0.16;
  const zF = b.frontWallZ0 + 0.02;
  const zB = b.backZ + 0.4;
  const dens = ctx.q?.props ?? 1;
  const scale = lv.kind === 'cellar' ? 1 : 1;

  /* the room's own lining: skirting, a ceiling, and a lit back wall */
  const floorHex = ['office', 'meeting', 'lobby', 'bankLobby', 'clinic', 'clinicExam', 'retail', 'diner', 'parking', 'storage', 'mechanical', 'laundry', 'boiler', 'workshop', 'vault', 'strongroom'].includes(room.type) ? '#c2bcb0' : '#a87f4e';
  ctx.only3d(KEYS.body, inner0, inner1, floorY - 0.02, floorY + 0.006, zF, zB, jitter(ctx, floorHex, R, 0.07).multiplyScalar(0.86));
  ctx.only3d(KEYS.body, inner0, inner1, ceilY, ceilY + 0.03, zF + 0.05, zB, deep('#a9a49a', 0.6));
  /* a cross partition with a doorway so the deep bay reads as another room */
  const zx = -6.15;
  if (room.band !== 'deep') {
    ctx.only3d(KEYS.body, inner0, inner1, floorY, ceilY, zx - 0.06, zx, deep('#aca69a', 0.4));
    const dx = inner0 + 0.7 + R() * Math.max(0.2, w - 2.0);
    ctx.only3d(KEYS.body, dx, dx + 0.98, floorY, ceilY, zx - 0.1, zx + 0.02, deep('#8e9aa2', 0.1));
    /* the far bay: dimmer, simpler, but never empty */
    const far = (type) => deep(type, 0.45);
    /* the deep bay: service runs, a couple of crates, never another living room */
    const residential = ['kitchen', 'living', 'bedroom', 'bath', 'diner', 'clinic', 'clinicExam', 'dance', 'small'].includes(room.type);
    const pick = residential ? R() * 0.55 : R();
    if (pick < 0.42) {
      ctx.shell(KEYS.metal).tubeX('metal', floorY + 2.35, -7.4, inner0, inner1, 0.05, 0.075, 7, col('#7f878f'), {});
      ctx.shell(KEYS.metal).tubeX('metal', floorY + 2.12, -7.9, inner0, inner1, 0.04, 0.06, 7, col('#8d7f66'), {});
    } else if (pick < 0.72) {
      ctx.pool('crate', prop('crate'), KEYS.body, 400).add(inner0 + 0.6 + R() * Math.max(0.3, w - 1.4), floorY, -8.2 - R() * 3, { ry: R() * 0.5, color: far('#9b8b6c') });
    } else if (pick < 0.88) {
      ctx.pool('racking', prop('racking'), KEYS.body, 400).add(cx + (R() - 0.5) * Math.max(0.2, w - 2.4), floorY, -9.6 - R() * 2, { ry: R.pick([0, Math.PI]), color: far('#8d8b84') });
    }
    /* a column on the grid keeps the structure honest */
    if (R.chance(0.4)) ctx.shell(KEYS.metal).tubeY('metal', cx, -7.6, floorY, ceilY, 0.11, 0.15, 8, col('#8b9298'), {});
  }

  /* wet rooms get tiled walls with a real thickness in the cut */
  if (room.wet) {
    const t = 0.035;
    ctx.onlyCut(inner0, inner1, floorY, floorY + 0.02, M.TILE, '#dfe4e2', { z0: zx, z1: zF, ink: 0.5 });
    ctx.only3d(KEYS.body, inner0, inner1, floorY, ceilY, zF - 0.02, zF - 0.02 - t, deep('#dfe4e2', 0.3));
  }

  /* warm light pooling in the room, so the section glows from the inside out */
  const warmHex = room.type === 'office' || room.type === 'meeting' || room.type === 'mechanical'
    || room.type === 'laundry' || room.type === 'parking' || room.type === 'clinic' ? '#dceaf6' : '#ffcf96';
  /* unlit warm washes on the surfaces a lamp would actually hit: the floor,
     the back wall, the ceiling. Cheap, additive-free, and they bloom sweetly. */
  const litK = (lv.kind === 'cellar' ? 1.25 : 1) * (0.72 + R() * 0.5);
  ctx.shell(KEYS.glow).box('glow', inner0 + 0.04, inner1 - 0.04, floorY + 0.007, floorY + 0.02, zF + 0.05, -4.85, col(warmHex).multiplyScalar(0.24 * litK));
  ctx.shell(KEYS.glow).box('glow', inner0 + 0.04, inner1 - 0.04, floorY + 0.007, floorY + 0.02, -5.0, -9.0, col(warmHex).multiplyScalar(0.11 * litK));
  ctx.shell(KEYS.glow).face('glow', inner0, inner1, floorY + 0.02, ceilY - 0.05, zx - 0.07, col(warmHex).multiplyScalar(0.3 * litK), true);
  ctx.shell(KEYS.glow).face('glow', inner0, inner1, ceilY - 0.06, ceilY - 0.04, zF + 0.4, col(warmHex).multiplyScalar(0.24 * litK), true);
  ctx.shell(KEYS.glow).face('glow', inner0, inner1, ceilY - 0.06, ceilY - 0.04, -8.6, col(warmHex).multiplyScalar(0.09 * litK), true);

  /* ceiling lighting: a fixture per bay + a soft warm pool */
  const litW = clamp(w / 4.2, 0.4, 2.4);
  const nLamp = Math.max(1, Math.round(w / 3.4));
  for (let i = 0; i < nLamp; i += 1) {
    const x = inner0 + ((i + 0.5) * w) / nLamp;
    const kind = ['office', 'meeting', 'retail', 'diner', 'lobby', 'bankLobby', 'clinic', 'parking', 'mechanical', 'laundry', 'boiler', 'garage', 'freight'].includes(room.type) ? 'beacon' : 'glow';
    ctx.pool(`lamp${kind}`, kind === 'beacon' ? GEOM_LAMP : GEOM_LAMP, kind === 'beacon' ? KEYS.beacon : KEYS.glow, 900)
      .add(x, ceilY - 0.02, -2.4 - R() * 1.6, { sx: litW, sy: 1, sz: 1, color: col(room.type === 'office' || room.type === 'mechanical' ? '#e6f0fa' : '#ffdca6').multiplyScalar(1.7) });
    if (R.chance(0.5)) ctx.pool('downlight', GEOM_DOWN, KEYS.beacon, 900).add(x + (R() - 0.5) * 1.6, ceilY - 0.02, -4.2 - R() * 2, { color: col('#ffe9c8').multiplyScalar(1.5) });
  }
  INTERIOR.rooms.push({ x: cx, y: floorY + 1.4, z: -3, type: room.type, w, lit: R() });

  /* ── the programme of each room type ─────────────────────────────────── */
  const anchor = (x, y, z, pose, extra = {}) => INTERIOR.anchors.push({ x, y, z, pose, room: room.type, ...extra });
  const T = room.type;

  if (T === 'kitchen') {
    ctx.pool('kitchenRun', prop('kitchenRun'), KEYS.body, 120).add(inner0 + Math.min(1.2, w / 2), floorY, -2.1, { ry: 0, color: jitter(ctx, '#c8c2b4', R, 0.08) });
    ctx.pool('fridge', prop('fridge'), KEYS.body, 60).add(inner1 - 0.5, floorY, -2.0, { ry: 0, color: jitter(ctx, '#e2e4e2', R, 0.05) });
    ctx.pool('stove', prop('stove'), KEYS.body, 60).add(inner0 + 1.9, floorY, -2.1, { ry: 0, color: jitter(ctx, '#d2d4d4', R, 0.05) });
    if (w > 3.4) {
      ctx.pool('table', prop('table'), KEYS.body, 120).add(cx + 0.4, floorY, -3.5, { color: jitter(ctx, '#a8825a', R, 0.1) });
      ctx.pool('chair', prop('chair'), KEYS.body, 300).add(cx - 0.3, floorY, -3.5, { ry: -Math.PI / 2, color: jitter(ctx, R.pick(P.coats), R, 0.1) });
      ctx.pool('chair', prop('chair'), KEYS.body, 300).add(cx + 1.1, floorY, -3.5, { ry: Math.PI / 2, color: jitter(ctx, R.pick(P.coats), R, 0.1) });
      anchor(cx - 0.3, floorY, -3.5, 'sit', { ry: -Math.PI / 2 });
    }
    ctx.pool('plant', prop('plant'), KEYS.body, 200).add(inner1 - 0.4, floorY, -3.9, { color: col(R.pick(P.plant)) });
    anchor(inner0 + 1.0, floorY, -3.0, 'work', { ry: Math.PI });
  } else if (T === 'living') {
    ctx.pool('sofa', prop('sofa'), KEYS.body, 120).add(cx - w * 0.18, floorY, -3.2, { ry: Math.PI / 2, color: jitter(ctx, R.pick(P.coats), R, 0.12) });
    ctx.pool('coffeeTable', prop('coffeeTable'), KEYS.body, 100).add(cx - w * 0.18 + 1.3, floorY, -3.2, { color: jitter(ctx, '#9b7a52', R, 0.1) });
    if (w > 3.6) ctx.pool('shelf', prop('shelf'), KEYS.body, 200).add(inner0 + 0.4, floorY, -1.9, { ry: 0, color: jitter(ctx, '#8a6a4a', R, 0.12) });
    if (w > 6.4) ctx.pool('shelf', prop('shelf'), KEYS.body, 200).add(inner1 - 0.4, floorY, -2.0, { ry: 0, color: jitter(ctx, '#7d5f43', R, 0.12) });
    ctx.pool('floorLamp', prop('floorLamp'), KEYS.body, 120).add(inner1 - 0.6, floorY, -3.0, { color: col('#e0d8c4') });
    ctx.pool('tv', prop('tv'), KEYS.body, 100).add(cx + 0.6, floorY, -3.3, { ry: -Math.PI / 2, color: col('#3c4046') });
    ctx.pool('plant', prop('plant'), KEYS.body, 200).add(inner0 + 0.45, floorY, -4.4, { color: col(R.pick(P.plant)) });
    ctx.only3d(KEYS.body, inner0, inner1, floorY, floorY + 0.015, -2.6, -4.6, deep('#8d6a58', 0.25));
    anchor(cx - w * 0.18 + 0.5, floorY, -3.2, 'sit', { ry: -Math.PI / 2 });
    if (room.cello) {
      ctx.pool('cello', prop('cello'), KEYS.body, 8).add(inner1 - 1.2, floorY, -2.6, { ry: -0.4, color: col('#8a5a30') });
      anchor(inner1 - 1.05, floorY, -2.5, 'cello', { ry: -0.5 });
    }
    if (room.dog) anchor(inner0 + 1.4, floorY, -2.6, 'dog', { ry: 1.2 });
  } else if (T === 'bedroom') {
    ctx.pool('bed', prop('bed'), KEYS.body, 100).add(cx - w * 0.2, floorY, -2.9, { ry: Math.PI / 2, color: jitter(ctx, '#c9c2b4', R, 0.1) });
    ctx.pool('wardrobe', prop('wardrobe'), KEYS.body, 80).add(inner1 - 0.5, floorY, -2.1, { ry: 0, color: jitter(ctx, '#8f7351', R, 0.1) });
    ctx.pool('coffeeTable', prop('coffeeTable'), KEYS.body, 100).add(cx - w * 0.2 + 1.0, floorY, -3.9, { color: jitter(ctx, '#9b7a52', R, 0.1) });
    anchor(cx - w * 0.2 + 1.5, floorY, -3.4, 'stand', { ry: -1.2 });
  } else if (T === 'bath') {
    ctx.pool('toilet', prop('toilet'), KEYS.body, 40).add(inner0 + 0.4, floorY, -2.4, { color: col('#e8eae8') });
    ctx.pool('lavatory', prop('lavatory'), KEYS.body, 40).add(inner1 - 0.4, floorY, -2.4, { color: col('#e8eae8') });
    ctx.only3d(KEYS.glass, inner1 - 0.1, inner1, floorY, floorY + 1.9, -2.9, -4.1, col('#bcd6de'));
  } else if (T === 'office' || T === 'study' || T === 'exec') {
    const cols = Math.max(1, Math.floor(w / 2.4));
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < 2; r += 1) {
        if (R.chance(1 - dens * 0.9)) continue;
        const x = inner0 + 1.3 + c * 2.4;
        const z = -2.3 - r * 2.5;
        ctx.pool('desk', prop('desk'), KEYS.body, 600).add(x, floorY, z, { ry: r ? Math.PI : 0, color: jitter(ctx, '#c4bcae', R, 0.07) });
        ctx.pool('chair', prop('chair'), KEYS.body, 300).add(x, floorY, z + (r ? -0.75 : 0.75), { ry: r ? Math.PI : 0, color: col('#3a4048') });
        if (R.chance(0.55)) anchor(x, floorY, z + (r ? -0.75 : 0.75), 'sit', { ry: r ? Math.PI : 0 });
      }
    }
    ctx.pool('printer', prop('printer'), KEYS.body, 60).add(inner1 - 0.5, floorY, -4.4, { ry: -Math.PI / 2, color: col('#b9bcbf') });
    ctx.pool('plant', prop('plant'), KEYS.body, 200).add(inner0 + 0.4, floorY, -4.6, { color: col(R.pick(P.plant)) });
    if (room.study) ctx.pool('shelf', prop('shelf'), KEYS.body, 200).add(inner1 - 0.4, floorY, -2.0, { color: col('#7d5f43') });
  } else if (T === 'meeting') {
    ctx.pool('table', prop('table'), KEYS.body, 120).add(cx, floorY, -3.0, { sx: 1.6, sz: 1.4, color: jitter(ctx, '#c9b79a', R, 0.06) });
    for (let i = 0; i < 6; i += 1) {
      const ang = (i / 6) * Math.PI * 2;
      ctx.pool('chair', prop('chair'), KEYS.body, 300).add(cx + Math.cos(ang) * 1.5, floorY, -3.0 + Math.sin(ang) * 1.15, { ry: -ang + Math.PI / 2, color: col('#3f4650') });
      if (i < 4) anchor(cx + Math.cos(ang) * 1.5, floorY, -3.0 + Math.sin(ang) * 1.15, 'sit', { ry: -ang + Math.PI / 2 });
    }
    ctx.only3d(KEYS.beacon, inner1 - 0.14, inner1, floorY + 1.1, floorY + 2.1, -2.2, -3.9, col('#4a7fb0'));
    ctx.only3d(KEYS.glass, inner0, inner1, floorY, ceilY, -5.3, -5.24, col('#a9c8d4'));
  } else if (T === 'lunch') {
    for (let i = 0; i < 3; i += 1) {
      const x = inner0 + 1.4 + i * 2.6;
      ctx.pool('table', prop('table'), KEYS.body, 120).add(x, floorY, -2.8, { sx: 0.9, color: col('#b9a98d') });
      for (const dz of [-0.85, 0.85]) ctx.pool('chair', prop('chair'), KEYS.body, 300).add(x, floorY, -2.8 + dz, { ry: dz < 0 ? 0 : Math.PI, color: col(R.pick(P.coats)) });
    }
    ctx.pool('counter', prop('counter'), KEYS.body, 40).add(cx, floorY, -4.6, { color: col('#8f8a80') });
  } else if (T === 'diner') {
    /* counter with stools, booths along the window, a cook line with a hood */
    ctx.pool('counter', prop('counter'), KEYS.body, 40).add(cx + 0.4, floorY, -2.9, { sx: Math.min(1, w / 5.2), color: col('#b5563f') });
    for (let i = 0; i < 6; i += 1) {
      const x = cx + 0.4 - 1.9 + i * 0.78;
      ctx.pool('stool', prop('stool'), KEYS.body, 120).add(x, floorY, -2.05, { color: col('#d8c9a8') });
      if (i < 4) anchor(x, floorY, -2.05, 'sit', { ry: Math.PI });
    }
    ctx.pool('hood', prop('hood'), KEYS.body, 20).add(cx - 1.0, floorY, -4.5, { color: col('#a9b0b5') });
    ctx.pool('kitchenRun', prop('kitchenRun'), KEYS.body, 120).add(cx - 1.0, floorY, -5.0, { color: col('#c3c8cb') });
    for (let i = 0; i < 2; i += 1) {
      ctx.pool('bench', prop('bench'), KEYS.body, 60).add(inner0 + 0.6, floorY, -2.0 - i * 1.9, { ry: Math.PI / 2, color: col('#7d4034') });
    }
    ctx.only3d(KEYS.beacon, inner0 + 0.1, inner0 + 0.16, floorY + 2.5, floorY + 3.1, -1.9, -4.4, col('#ffb347'));
    anchor(cx - 1.4, floorY, -4.2, 'work', { ry: 0 });
    anchor(cx + 1.6, floorY, -4.4, 'work', { ry: -0.6 });
  } else if (T === 'lobby' || T === 'bankLobby') {
    ctx.pool('reception', prop('reception'), KEYS.body, 40).add(cx + w * 0.22, floorY, -2.6, { color: col('#8f8677') });
    for (let i = 0; i < 3; i += 1) {
      ctx.pool('bench', prop('bench'), KEYS.body, 60).add(inner0 + 1.0 + i * 1.1, floorY, -4.2, { color: col('#5d6570') });
    }
    ctx.pool('plant', prop('plant'), KEYS.body, 200).add(inner0 + 0.5, floorY, -2.2, { color: col(R.pick(P.plant)) });
    /* mail cubbies / a bank of doors */
    ctx.only3d(KEYS.body, inner0, inner0 + 0.16, floorY + 0.9, floorY + 2.2, -5.0, -6.0, deep('#7d6a52', 0.2));
    for (let i = 0; i < 8; i += 1) {
      ctx.only3d(KEYS.body, inner0 + 0.16, inner0 + 0.2, floorY + 1.0 + (i % 4) * 0.3, floorY + 1.24 + (i % 4) * 0.3, -5.0 - Math.floor(i / 4) * 0.5, -5.0 - Math.floor(i / 4) * 0.5 - 0.44, deep('#9c8a6c', 0.1));
    }
    anchor(cx + w * 0.22, floorY, -3.3, 'stand', { ry: Math.PI });
    anchor(inner0 + 1.4, floorY, -3.0, 'stand', { ry: 0.6 });
  } else if (T === 'retail' || T === 'studio2') {
    ctx.pool('counter', prop('counter'), KEYS.body, 40).add(cx + 1.2, floorY, -3.6, { sx: 0.7, color: col('#6f7a86') });
    for (let i = 0; i < Math.max(2, Math.floor(w / 2.2)); i += 1) {
      ctx.pool('racking', prop('racking'), KEYS.body, 400).add(inner0 + 1.0 + i * 2.1, floorY, -2.1, { color: jitter(ctx, '#a39a8a', R, 0.1) });
    }
    anchor(cx + 0.4, floorY, -2.6, 'stand', { ry: -0.4 });
  } else if (T === 'clinic' || T === 'clinicExam') {
    for (let i = 0; i < Math.max(2, Math.floor(w / 1.3)); i += 1) {
      ctx.pool('rowChair', prop('rowChair'), KEYS.body, 200).add(inner0 + 0.5 + i * 1.16, floorY, -2.1, { color: col('#4d5b6b') });
      if (R.chance(0.55)) anchor(inner0 + 0.5 + i * 1.16, floorY, -2.1, 'sit', { ry: 0 });
    }
    ctx.pool('medicalCart', prop('medicalCart'), KEYS.body, 40).add(inner1 - 0.6, floorY, -3.2, { color: col('#d7dadd') });
    ctx.pool('reception', prop('reception'), KEYS.body, 40).add(cx, floorY, -4.4, { sx: 0.8, color: col('#c8ccd0') });
    ctx.only3d(KEYS.beacon, inner0 + 0.1, inner0 + 0.15, floorY + 1.9, floorY + 2.3, -2.0, -3.0, col('#c8dbe8'));
    anchor(cx + 1.2, floorY, -4.9, 'stand', { ry: Math.PI });
  } else if (T === 'dance' || T === 'small') {
    ctx.only3d(KEYS.glass, inner0, inner1, floorY + 0.2, floorY + 2.5, -1.9, -1.85, col('#b7ccd4'));
    ctx.pool('barre', prop('barre'), KEYS.body, 30).add(cx, floorY, -2.3, { sx: Math.min(1.4, w / 3.2), color: col('#b0a185') });
    for (let i = 0; i < 4; i += 1) ctx.pool('gymMat', prop('gymMat'), KEYS.body, 40).add(inner0 + 1.1 + i * 1.6, floorY, -4.0, { color: col(R.pick(['#4d6f8a', '#7a5578', '#3f6b57'])) });
    anchor(cx - 0.8, floorY, -3.1, 'dance', { ry: 0.4 });
    anchor(cx + 0.9, floorY, -3.4, 'dance', { ry: -0.3 });
  } else if (T === 'boiler') {
    for (let i = 0; i < 2; i += 1) {
      ctx.pool('boiler', prop('boiler'), KEYS.body, 20).add(inner0 + 1.1 + i * 2.4, floorY, -2.6, { color: col('#8f8a7c') });
    }
    ctx.pool('tank', prop('tank'), KEYS.body, 30).add(inner1 - 0.8, floorY, -3.4, { color: col('#8a7f6a') });
    for (let z = -1.6; z > -9; z -= 0.9) {
      ctx.shell(KEYS.metal).tubeX('metal', floorY + 2.4, z, inner0, inner1, 0.05, 0.075, 7, col('#8d7f66'), {});
    }
    anchor(inner0 + 1.6, floorY, -3.8, 'work', { ry: 0.4 });
  } else if (T === 'laundry') {
    for (let i = 0; i < Math.max(2, Math.floor(w / 0.85)); i += 1) {
      ctx.pool('washer', prop('washer'), KEYS.body, 60).add(inner0 + 0.45 + i * 0.86, floorY, -2.0, { color: col('#dfe1e0') });
    }
    for (let i = 0; i < 3; i += 1) ctx.pool('table', prop('table'), KEYS.body, 120).add(inner0 + 1.0 + i * 1.9, floorY, -3.8, { sx: 1.1, color: col('#a9a49a') });
    anchor(inner0 + 2.2, floorY, -2.9, 'work', { ry: Math.PI });
  } else if (T === 'workshop' || T === 'woodShop') {
    ctx.pool('workbench', prop('workbench'), KEYS.body, 40).add(cx, floorY, -2.3, { sx: Math.min(1.2, w / 2.2), color: col('#9c7f58') });
    ctx.pool('racking', prop('racking'), KEYS.body, 400).add(inner1 - 0.6, floorY, -3.6, { ry: 0, color: col('#8b8781') });
    ctx.pool('crate', prop('crate'), KEYS.body, 400).add(inner0 + 0.6, floorY, -3.9, { color: col('#9b8b6c') });
    anchor(cx - 0.4, floorY, -3.1, 'work', { ry: Math.PI });
  } else if (T === 'vault' || T === 'strongroom') {
    ctx.pool('vaultDoor', prop('vaultDoor'), KEYS.metal, 10).add(cx, floorY + 1.2, -2.4, { color: col('#9aa2aa') });
    ctx.pool('depositWall', prop('depositWall'), KEYS.body, 20).add(inner1 - 0.5, floorY, -3.4, { ry: -Math.PI / 2, color: col('#8d8778') });
    ctx.pool('crate', prop('crate'), KEYS.body, 400).add(inner0 + 0.7, floorY, -3.0, { color: col('#8a7c60') });
    anchor(inner0 + 1.6, floorY, -2.8, 'stand', { ry: 0.2 });
  } else if (T === 'parking') {
    const n = Math.max(2, Math.floor(w / 2.7));
    for (let i = 0; i < n; i += 1) {
      ctx.pool('car', prop('car'), KEYS.body, 60).add(inner0 + 1.4 + i * 2.7, floorY, -2.9, { ry: Math.PI / 2, color: jitter(ctx, R.pick([P.carA, P.carB, P.carC, '#5f7a6a']), R, 0.1) });
    }
    for (let z = -1.4; z > -9; z -= 2.6) {
      ctx.shell(KEYS.metal).tubeX('metal', floorY + 2.5, z, inner0, inner1, 0.06, 0.09, 8, col('#7f878f'), {});
    }
    ctx.only3d(KEYS.beacon, inner0, inner1, floorY + 2.9, floorY + 2.98, -2.2, -2.0, col('#8fd06f'));
  } else if (T === 'garage' || T === 'freight') {
    for (let i = 0; i < 3; i += 1) {
      ctx.pool('pallet', prop('pallet'), KEYS.body, 40).add(inner0 + 0.9 + i * 1.7, floorY, -2.4, { color: col('#9c8459') });
      ctx.pool('crate', prop('crate'), KEYS.body, 400).add(inner0 + 0.9 + i * 1.7, floorY + 0.2, -2.4, { color: jitter(ctx, '#a08b64', R, 0.12) });
    }
    ctx.pool('handTruck', prop('handTruck'), KEYS.body, 20).add(inner1 - 0.8, floorY, -1.9, { ry: -0.4, color: col('#c8642f') });
    ctx.pool('racking', prop('racking'), KEYS.body, 400).add(cx, floorY, -4.6, { color: col('#7f8288') });
  } else if (T === 'storage' || T === 'coal' || T === 'sump' || T === 'electrical' || T === 'bikeStore' || T === 'backstage') {
    const n = Math.max(2, Math.round(w / 1.8 * dens));
    for (let i = 0; i < n; i += 1) {
      const x = inner0 + 0.7 + R() * Math.max(0.4, w - 1.5);
      const z = -1.9 - R() * 4.6;
      if (T === 'bikeStore') ctx.pool('bike', prop('bike'), KEYS.body, 40).add(x, floorY, z, { ry: R.pick([0, Math.PI]), color: col(R.pick(['#c8452f', '#2f6f9e', '#4a5058'])) });
      else if (T === 'electrical') ctx.pool('printer', prop('printer'), KEYS.body, 60).add(x, floorY, z, { color: col('#6f7c86') });
      else ctx.pool('crate', prop('crate'), KEYS.body, 400).add(x, floorY, z, { ry: R() * 0.6, color: jitter(ctx, '#8f8574', R, 0.16) });
    }
    if (T === 'sump') ctx.pool('tank', prop('tank'), KEYS.body, 30).add(cx, floorY, -2.6, { color: col('#7d848a') });
  } else if (T === 'mechanical') {
    for (let i = 0; i < Math.max(2, Math.round(w / 2.6)); i += 1) {
      ctx.pool('boiler', prop('boiler'), KEYS.body, 20).add(inner0 + 1.2 + i * 2.6, floorY, -2.6, { color: col('#9aa1a6') });
    }
    for (let z = -1.6; z > -8; z -= 1.5) {
      ctx.hollow(KEYS.metal, inner0, inner1, floorY + 2.6, floorY + 3.1, z - 0.26, z, '#98a2a8', M.STEEL, 0.02, { ink: 0.6 });
    }
    anchor(inner0 + 1.4, floorY, -3.9, 'work', { ry: 0.2 });
  } else if (T === 'ruins') {
    for (let i = 0; i < 14; i += 1) {
      const x = inner0 + R() * w;
      const z = -1.6 - R() * 6;
      const s = 0.14 + R() * 0.4;
      ctx.pool('crate', prop('crate'), KEYS.body, 400).add(x, floorY, z, { sx: s * 2, sy: s * 1.6, sz: s * 1.8, ry: R() * 2, color: jitter(ctx, '#8d8478', R, 0.3) });
    }
  } else {
    for (let i = 0; i < 3; i += 1) {
      ctx.pool('crate', prop('crate'), KEYS.body, 400).add(inner0 + 0.6 + R() * (w - 1.2), floorY, -2 - R() * 4, { ry: R(), color: jitter(ctx, '#8f8574', R, 0.2) });
    }
  }

  /* ── the density pass: radiators, doors, pictures, small clutter ──────── */
  const wet = ['bath', 'laundry', 'vault', 'parking', 'boiler', 'storage', 'mechanical', 'sump', 'coal', 'electrical', 'strongroom'].includes(T);
  if (!wet && w > 1.6) {
    const bays = Math.max(1, Math.round(w / 2.6));
    for (let i = 0; i < bays; i += 1) {
      const x = inner0 + ((i + 0.5) * w) / bays;
      ctx.pool('radiator', prop('radiator'), KEYS.body, 400).add(x, floorY + 0.14, zF + 0.34, { sx: 0.8 + R() * 0.5, color: jitter(ctx, '#e6e2d8', R, 0.05) });
      if (R.chance(0.75)) ctx.pool('frame', prop('frame'), KEYS.body, 400).add(x + 0.9, floorY + 1.75 + R() * 0.5, zx - 0.14, { color: jitter(ctx, R.pick(['#b8925a', '#7d8fa0', '#a86a5a', '#cbbfa6']), R, 0.2) });
      if (R.chance(0.55)) ctx.pool('clutter', prop('clutter'), KEYS.body, 400).add(inner0 + 0.4 + R() * (w - 0.8), floorY + 0.9, -2.0 - R() * 2.4, { ry: R.pick([0, 1.6, 3.1]), color: jitter(ctx, R.pick(['#c69a6a', '#8fa3a8', '#b4756a']), R, 0.2) });
    }
    /* the door into the hall */
    const dxp = R.chance(0.5) ? inner0 + 0.55 : inner1 - 0.55;
    ctx.pool('doorLeaf', prop('doorLeaf'), KEYS.body, 300).add(dxp, floorY, zx + 0.06, { ry: Math.PI / 2 + (R() - 0.5) * 0.2, color: jitter(ctx, '#8a6c4c', R, 0.14) });
  }
}

const propGeoCache = {};
function prop(name) {
  if (!propGeoCache[name]) propGeoCache[name] = PROPS[name]();
  return propGeoCache[name];
}

function jitter(ctx, hex, R, amt) {
  return col(hex).multiplyScalar(1 - amt + R() * amt * 2);
}
function deep(hex, t) {
  return col(hex).lerp(col('#1b2f42'), t);
}

export function buildInteriors(ctx) {
  for (const b of BUILDINGS) {
    if (!b.levels) continue;
    const R = b.R || rng(3);
    for (const lv of [...b.cellars, ...b.levels]) {
      for (const roomDef of lv.rooms) room(ctx, b, lv, roomDef, R);
    }
  }
}
