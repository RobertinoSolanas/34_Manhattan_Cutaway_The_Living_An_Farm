/**
 * src/earth.js — the ground itself, cut open.
 *
 * One large quad sitting exactly on the section plane (3 cm behind the built
 * cut faces) carrying the geological story of the block: made ground, soft
 * mud, sand & gravel with cross-bedding, weathered gneiss, sound banded gneiss
 * with pegmatite veins and dark migmatite seams, a schist band, the water
 * table, and the jagged collars where excavations and tunnel bores were driven
 * through the rock.
 *
 * Excavations are analytic shapes intersected with the plane on the CPU each
 * time the cut moves and uploaded as a small uniform array, so pushing the
 * section deeper instantly opens and closes trenches, bores and station boxes.
 */

import * as THREE from 'three';
import { NOISE, PATTERN } from './glsl.js';
import { P } from './palette.js';

const MAX_HOLES = 64;

const VERT = /* glsl */ `
uniform vec4 uRect;
uniform float uZ;
varying vec2 vWorld;
void main() {
  vec2 p = uRect.xy + position.xy * uRect.zw;
  vWorld = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, uZ, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

varying vec2 vWorld;

uniform float uTime;
uniform float uDay;
uniform float uInk;
uniform float uHoleCount;
uniform vec4 uHoleA[${MAX_HOLES}];
uniform vec4 uHoleB[${MAX_HOLES}];
uniform vec3 uInkColor;
uniform vec3 uFill;
uniform vec3 uClay;
uniform vec3 uSand;
uniform vec3 uWeath;
uniform vec3 uRock;
uniform vec3 uSchist;
uniform float uTop;
uniform float uDim;

${NOISE}
${PATTERN}

float sdRect(vec2 p, vec2 c, vec2 h) {
  vec2 d = abs(p - c) - h;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
float sdEllipse(vec2 p, vec2 c, vec2 h) {
  vec2 q = (p - c) / max(h, vec2(1e-3));
  return (length(q) - 1.0) * min(h.x, h.y);
}

/* nearest excavation: .x distance, .y collar width, .z seed */
vec3 nearestHole(vec2 p) {
  float best = 1e5;
  float collar = 0.0;
  float seed = 0.0;
  for (int i = 0; i < ${MAX_HOLES}; i += 1) {
    if (float(i) >= uHoleCount) break;
    vec4 A = uHoleA[i];
    vec4 B = uHoleB[i];
    vec2 reach = abs(A.zw) + B.y + 0.8;
    vec2 q = abs(p - A.xy) - reach;
    if (max(q.x, q.y) > 0.0) continue;
    float d = B.x < 0.5 ? sdRect(p, A.xy, abs(A.zw)) : sdEllipse(p, A.xy, abs(A.zw));
    if (B.y > 0.001) d += (fbm(p * (2.2 + B.z * 1.4) + B.z * 30.0) - 0.5) * B.y * 1.2;
    if (d < best) { best = d; collar = B.y; seed = B.z; }
  }
  return vec3(best, collar, seed);
}

void main() {
  vec2 p = vWorld;
  if (p.y > uTop) discard;

  /* ── stratigraphy ──────────────────────────────────────────────────── */
  float b1 = -3.4 + (fbm(vec2(p.x * 0.07, 1.3)) - 0.5) * 1.5;
  float b2 = -7.1 + (fbm(vec2(p.x * 0.06, 5.7)) - 0.5) * 1.7;
  float b3 = -11.1 + (fbm(vec2(p.x * 0.09, 9.1)) - 0.5) * 1.9;
  float b4 = -15.4 + (fbm(vec2(p.x * 0.05, 13.3)) - 0.5) * 2.2;
  float b5 = -30.5 + (fbm(vec2(p.x * 0.04, 21.7)) - 0.5) * 2.4;

  vec3 col = uRock;
  col = mix(col, uWeath, smoothstep(b4 - 0.8, b4 + 0.8, p.y));
  col = mix(col, uSand, smoothstep(b3 - 0.6, b3 + 0.6, p.y));
  col = mix(col, uClay, smoothstep(b2 - 0.6, b2 + 0.6, p.y));
  col = mix(col, uFill, smoothstep(b1 - 0.5, b1 + 0.5, p.y));
  col = mix(col, uSchist, (1.0 - smoothstep(b5 - 1.3, b5 + 1.3, p.y)) * 0.75);

  float midId = 25.0;
  if (p.y > b4) midId = 24.0;
  if (p.y > b3) midId = 22.0;
  if (p.y > b2) midId = 21.0;
  if (p.y > b1) midId = 20.0;
  col = matPattern(midId, p, vec2(0.0), vec2(1.0), col, p.x * 0.013, 0.0, vec4(1.0, 1.0, 0.0, 1.0)).rgb;

  /* water table */
  float wt = -6.2 + (fbm(vec2(p.x * 0.05, 31.0)) - 0.5) * 1.2;
  col = mix(col, col * vec3(0.64, 0.71, 0.8), smoothstep(wt + 0.5, wt - 1.4, p.y) * 0.55);
  col += vec3(0.02, 0.05, 0.07) * (1.0 - smoothstep(0.0, 0.18, abs(p.y - wt)));

  /* stratum banding ink */
  float inkW = max(uInk * 0.8, fwidth(p.x) * 1.4);
  float bInk = 0.0;
  bInk = max(bInk, 1.0 - smoothstep(0.0, inkW * 2.0, abs(p.y - b1)));
  bInk = max(bInk, 1.0 - smoothstep(0.0, inkW * 2.0, abs(p.y - b2)));
  bInk = max(bInk, 1.0 - smoothstep(0.0, inkW * 2.4, abs(p.y - b3)));
  bInk = max(bInk, 1.0 - smoothstep(0.0, inkW * 3.2, abs(p.y - b4)));
  bInk = max(bInk, 1.0 - smoothstep(0.0, inkW * 2.2, abs(p.y - b5)));
  col = mix(col, uInkColor, bInk * 0.6);

  float topInk = 1.0 - smoothstep(0.0, inkW * 2.4, abs(p.y - uTop));
  col = mix(col, uInkColor, topInk * 0.6);

  /* ── excavations & bores ───────────────────────────────────────────── */
  vec3 h = nearestHole(p);
  if (h.x < 0.0) discard;

  float collar = max(h.y, 0.0);
  if (collar > 0.001) {
    float band = 1.0 - smoothstep(0.0, collar, h.x);
    vec3 rough = col * (0.5 + 0.42 * fbm(p * 5.0 + h.z * 12.0));
    rough = mix(rough, rough * 1.55, speck(p, 26.0, 0.86) * 0.6);
    rough = mix(rough, rough * 0.55, lmask(p.x + p.y * 0.3 + h.z * 5.0, 0.4, 0.03) * 0.45);
    col = mix(col, rough, band * 0.9);
    col = mix(col, uInkColor, (1.0 - smoothstep(0.0, inkW * 2.6, h.x)) * 0.7);
    col *= mix(1.0, 0.7, band * 0.6);
  } else {
    col = mix(col, uInkColor, (1.0 - smoothstep(0.0, inkW * 1.8, h.x)) * 0.5);
  }

  /* ── shared drawing wash ───────────────────────────────────────────── */
  float hatch = lmask((p.x + p.y) * 0.7071, 0.055, 0.006);
  col = mix(col, mix(col, vec3(0.24, 0.36, 0.5), 0.3), 0.1);
  col = mix(col, col * 1.22, hatch * 0.09);

  float above = smoothstep(-2.0, 1.0, p.y);
  col *= mix(1.0, mix(0.62, 1.0, uDay), above);
  /* keep the strata chromatic: a little more hue, less chalk */
  /* warm soil over the rock head, cool grey-blue gneiss below it — the
     strata must never go mossy, which is what a flat blue wash does to ochre */
  float toneT = smoothstep(b4 - 1.6, b4 + 2.2, p.y);
  col = mix(col * vec3(0.80, 0.90, 1.12), col * vec3(1.10, 0.99, 0.84), toneT);
  col = mix(col * mix(1.0, 0.66, smoothstep(-19.0, -42.0, p.y)), mix(col * 0.72, vec3(0.16, 0.3, 0.45), 0.24), smoothstep(-18.5, -48.0, p.y));

  gl_FragColor = vec4(col * uDim, 1.0);
}
`;

export class EarthFace {
  constructor({ zAt = null, dim = 1, top = 0.02, rect = [0, -23.5, 48, 25.5] } = {}) {
    this.zAt = zAt;
    this.cut = -1.6;
    this.voids = [];
    const v4z = () => Array.from({ length: MAX_HOLES }, () => new THREE.Vector4(0, -999, 0, 0));
    this.uniforms = {
      uRect: { value: new THREE.Vector4(rect[0], rect[1], rect[2], rect[3]) },   // centre, half-extents
      uCut: { value: this.cut },
      uZ: { value: zAt === null ? this.cut - 0.03 : zAt },
      uDim: { value: dim },
      uTime: { value: 0 },
      uDay: { value: 1 },
      uInk: { value: 0.02 },
      uTop: { value: top },
      uPx: { value: 0.05 },
      uHoleCount: { value: 0 },
      uHoleA: { value: v4z() },
      uHoleB: { value: Array.from({ length: MAX_HOLES }, () => new THREE.Vector4(0, 0, 0, 0)) },
      uInkColor: { value: new THREE.Color(P.ink).multiplyScalar(0.72) },
      uFill: { value: new THREE.Color(P.fill) },
      uClay: { value: new THREE.Color(P.clay) },
      uSand: { value: new THREE.Color(P.sand) },
      uWeath: { value: new THREE.Color(P.weathered) },
      uRock: { value: new THREE.Color(P.rock) },
      uSchist: { value: new THREE.Color(P.schist) },
    };
    const geo = new THREE.PlaneGeometry(2, 2);
    /* NOTE: positions span -1..1 so uRect.zw are true half-extents */
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    this.material = mat;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.name = 'earthFace';
  }

  /** rectangular excavation / cellar / trench void */
  addBox(x0, x1, y0, y1, z0, z1, collar = 0.45, seed = 0.37) {
    const za = Math.min(z0, z1);
    const zb = Math.max(z0, z1);
    this.voids.push({ kind: 'box', x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1), z0: za, z1: zb, collar, seed });
  }

  /** tunnel bore with its axis along x (parallel to the cut) */
  addBoreX(cy, cz, r, x0, x1, collar = 0.6, seed = 0.5) {
    this.voids.push({ kind: 'boreX', cy, cz, r, x0, x1, z0: cz - r, z1: cz + r, collar, seed });
  }

  /** shaft or pipe bore with its axis along z */
  addBoreZ(cx, cy, r, z0, z1, collar = 0.22, seed = 0.5) {
    this.voids.push({ kind: 'boreZ', cx, cy, r, z0, z1, collar, seed });
  }

  update({ cut, day, time, ink, px }) {
    this.uniforms.uTime.value = time;
    this.uniforms.uDay.value = day;
    if (ink !== undefined) this.uniforms.uInk.value = ink;
    if (px !== undefined) this.uniforms.uPx.value = px;
    if (Math.abs(cut - this.cut) < 0.002) return false;
    this.cut = cut;
    this.uniforms.uCut.value = cut;
    if (this.zAt === null) this.uniforms.uZ.value = cut - 0.03;
    let n = 0;
    for (const v of this.voids) {
      if (n >= MAX_HOLES) break;
      const A = this.uniforms.uHoleA.value[n];
      const B = this.uniforms.uHoleB.value[n];
      if (v.kind === 'box') {
        if (cut > v.z1 + 0.02 || cut < v.z0 - 0.02) continue;
        A.set((v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2, Math.abs(v.x1 - v.x0) / 2, Math.abs(v.y1 - v.y0) / 2);
        B.set(0, v.collar, v.seed, 0);
        n += 1;
      } else if (v.kind === 'boreX') {
        const dz = cut - v.cz;
        if (Math.abs(dz) >= v.r * 0.995) continue;
        const hh = Math.sqrt(v.r * v.r - dz * dz);
        A.set((v.x0 + v.x1) / 2, v.cy, Math.abs(v.x1 - v.x0) / 2, hh);
        B.set(1, v.collar, v.seed, 0);
        n += 1;
      } else {
        if (cut > v.z1 + 0.02 || cut < v.z0 - 0.02) continue;
        A.set(v.cx, v.cy, v.r, v.r);
        B.set(1, v.collar, v.seed, 1);
        n += 1;
      }
    }
    for (let i = n; i < MAX_HOLES; i += 1) {
      this.uniforms.uHoleA.value[i].set(0, -999, 0, 0);
      this.uniforms.uHoleB.value[i].set(0, 0, 0, 0);
    }
    this.uniforms.uHoleCount.value = n;
    return true;
  }
}
