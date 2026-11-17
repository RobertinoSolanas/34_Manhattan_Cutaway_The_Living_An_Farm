/**
 * src/util.js — math, rng, easing, tiny helpers.
 */

import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const wrap = (v, m) => ((v % m) + m) % m;
export const TAU = Math.PI * 2;

/** deterministic rng so every reload is the same hand-built block */
export function rng(seed = 1) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  const R = (a = 1, b) => (b === undefined ? next() * a : a + next() * (b - a));
  R.int = (a, b) => Math.floor(R(a, b + 1 - 1e-9));
  R.pick = (arr) => arr[Math.floor(next() * arr.length)];
  R.chance = (p) => next() < p;
  R.sign = () => (next() < 0.5 ? -1 : 1);
  R.state = () => s;
  R.setState = (v) => { s = v >>> 0; };
  return R;
}

/** hash-based value noise, world-space stable (no textures) */
export function hash2(x, y) {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

export const tmpM = new THREE.Matrix4();
export const tmpV = new THREE.Vector3();
export const tmpQ = new THREE.Quaternion();
export const tmpE = new THREE.Euler();
export const tmpC = new THREE.Color();

export function matrixAt(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
  tmpE.set(0, ry, 0);
  tmpQ.setFromEuler(tmpE);
  tmpV.set(sx, sy, sz);
  return new THREE.Matrix4().compose(tmpV.set(x, y, z), tmpQ, new THREE.Vector3(sx, sy, sz));
}

/** colour helpers – everything is defined once, in a warm architectural palette */
export const col = (hex) => new THREE.Color(hex);
export function shade(hex, mul, mixHex = null, mixT = 0) {
  const c = new THREE.Color(hex).multiplyScalar(mul);
  if (mixHex) c.lerp(new THREE.Color(mixHex), mixT);
  return c;
}

export function fmtHour(t) {
  const hh = Math.floor(wrap(t, 24));
  const mm = Math.floor((wrap(t, 24) - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** ramp helper: stops = [[t, value], ...] with smooth interpolation */
export function ramp(stops, x) {
  if (x <= stops[0][0]) return stops[0][1];
  const n = stops.length;
  if (x >= stops[n - 1][0]) return stops[n - 1][1];
  for (let i = 0; i < n - 1; i += 1) {
    const [t0, v0] = stops[i];
    const [t1, v1] = stops[i + 1];
    if (x <= t1) {
      const k = smoothstep(t0, t1, x);
      if (typeof v0 === 'number') return lerp(v0, v1, k);
      return v0.clone().lerp(v1, k);
    }
  }
  return stops[n - 1][1];
}

export function rampColor(stops, x, out = new THREE.Color()) {
  const v = ramp(stops, x);
  if (v instanceof THREE.Color) return out.copy(v);
  return out.set(v);
}
