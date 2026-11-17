/**
 * src/section.js — THE CUT FACE.
 *
 * A single instanced-quad mesh drawn exactly on the cutting plane. Every
 * sliced element (floor slab, brick wythe, steel column, service pipe, tunnel
 * ring, caisson, footing) is one instance carrying a shape, a material id, a
 * tint and the z-range in which the plane really passes through it. Visibility
 * is resolved in the vertex shader, so sliding the section depth re-slices the
 * entire city for free, in one draw call.
 *
 * Patterns are evaluated in world coordinates (brick courses line up across
 * separate walls, rebar dots sit on a shared module) and are analytically
 * antialiased, so the same faces read from the 100 m hero view down to a 2 m
 * close-up of a bathroom wall's tile thickness.
 */

import * as THREE from 'three';
import { NOISE, PATTERN } from './glsl.js';
import { P } from './palette.js';

export const M = {
  CONCRETE: 0,
  REBAR: 1,
  BRICK: 2,
  BRICK_WYTHE: 3,
  CMU: 4,
  RUBBLE: 5,
  TILE: 6,
  METRO: 7,
  STEEL: 8,
  IRON: 9,
  GLASS: 10,
  WOOD: 11,
  INSULATION: 12,
  TAR: 13,
  PLASTER: 14,
  TERRAZZO: 15,
  ASPHALT: 16,
  GRANITE: 17,
  WATER: 18,
  COPPER: 19,
  FILL: 20,
  CLAY: 21,
  SAND: 22,
  GRAVEL: 23,
  WEATHER: 24,
  ROCK: 25,
  MEMBRANE: 26,
  GRATE: 27,
  SCREEN: 28,
  EMISSIVE: 29,
};

export const SHAPE = {
  RECT: 0,
  DISC: 1,
  ANNULUS: 2,
  IBEAM: 3,
  FRAME: 4,
  TRI: 5,
};

const CAP = 11000;

const VERT = /* glsl */ `
attribute vec4 iRect;
attribute vec4 iShape;
attribute vec2 iRange;
attribute vec3 iTint;
attribute vec4 iOpts;

uniform float uCut;

varying vec2 vLocal;
varying vec2 vWorld;
varying vec2 vHalf;
varying vec4 vShape;
varying vec3 vTint;
varying vec4 vOpts;
varying float vAlive;

void main() {
  vLocal = position.xy;
  vShape = iShape;
  vTint = iTint;
  vOpts = iOpts;
  vHalf = abs(iRect.zw) + vec2(1e-4);
  vAlive = step(iRange.x - 1e-3, uCut) * step(uCut, iRange.y + 1e-3);
  vec2 p = iRect.xy + position.xy * iRect.zw;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, uCut, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

varying vec2 vLocal;
varying vec2 vWorld;
varying vec2 vHalf;
varying vec4 vShape;
varying vec3 vTint;
varying vec4 vOpts;
varying float vAlive;

uniform float uTime;
uniform float uInk;
uniform float uDay;
uniform vec3 uInkColor;
uniform vec3 uWash;
uniform float uWashAmt;
uniform float uY0;
uniform float uY1;

${NOISE}
${PATTERN}

/* returns (inside, distance to boundary in metres, unused) */
vec3 shapeMask(vec2 loc, vec2 halfs, float shapeId, float extraA, float innerY) {
  float inside = 1.0;
  float edge = 0.0;
  if (shapeId < 0.5) {
    vec2 d = (1.0 - abs(loc)) * halfs;
    edge = min(d.x, d.y);
  } else if (shapeId < 1.5) {
    float r = length(loc);
    edge = (1.0 - r) * halfs.x;
    inside = step(r, 1.0);
  } else if (shapeId < 2.5) {
    float r = length(loc);
    edge = min(abs(r - extraA), 1.0 - r) * halfs.x;
    inside = step(extraA - 1e-3, r) * step(r, 1.0);
  } else if (shapeId < 3.5) {
    float flange = step(0.74, abs(loc.y));
    float web = step(abs(loc.x), 0.17);
    inside = clamp(flange + web, 0.0, 1.0);
    edge = min((1.0 - abs(loc.x)) * halfs.x,
      min(abs(abs(loc.y) - 0.74) * halfs.y, (1.0 - abs(loc.y)) * halfs.y));
  } else if (shapeId < 4.5) {
    vec2 a = abs(loc);
    inside = clamp(step(extraA, a.x) + step(innerY, a.y), 0.0, 1.0)
      * step(a.x, 1.0) * step(a.y, 1.0);
    edge = min(min((1.0 - a.x) * halfs.x, (1.0 - a.y) * halfs.y),
      min(max((a.x - extraA) * halfs.x, 0.0) + 1e-4, max((a.y - innerY) * halfs.y, 0.0) + 1e-4));
  } else {
    float t = loc.y * 0.5 + 0.5;
    float wAt = mix(1.0, 0.28, t);
    inside = step(abs(loc.x), wAt);
    edge = min((wAt - abs(loc.x)) * halfs.x, (1.0 - abs(loc.y)) * halfs.y);
  }
  return vec3(inside, edge, 0.0);
}

void main() {
  if (vAlive < 0.5) discard;
  vec3 sm = shapeMask(vLocal, vHalf, vShape.x, vShape.w, vOpts.w);
  if (sm.x < 0.5) discard;

  vec3 c = matPattern(vShape.y, vWorld, vLocal, vHalf, vTint, vShape.z, vShape.w, vOpts).rgb;

  /* relief: soft inner shadow so cut elements sit proud of the drawing */
  float relief = mix(0.74, 1.0, smoothstep(0.0, 0.085, sm.y));
  c *= relief;

  /* the drawing ink line */
  float inkW = max(uInk * vOpts.y, fwidth(vWorld.x) * 1.3);
  float ink = 1.0 - smoothstep(inkW * 0.3, inkW * 1.35, sm.y);
  c = mix(c, uInkColor, ink * 0.9);

  /* unified blueprint wash + faint 45° hatch on cut surfaces */
  float hatch = lmask((vWorld.x + vWorld.y) * 0.7071, 0.055, 0.006);
  vec3 washed = mix(c, mix(c, uWash, 0.52), uWashAmt);
  washed = mix(washed, washed * 1.3, hatch * 0.12 * uWashAmt);

  /* above the street the cut follows daylight; below it the drawing glows */
  float above = smoothstep(-2.5, 1.5, vWorld.y);
  float lf = mix(1.06, mix(0.62, 1.0, uDay), above);
  washed *= lf;

  /* deep cut faces cool down slightly, matching the fog */
  float deep = smoothstep(2.0, -26.0, vWorld.y);
  washed = mix(washed, mix(washed, vec3(0.34, 0.52, 0.68), 0.3), deep);

  washed += c * vOpts.z;

  gl_FragColor = vec4(washed, 1.0);
}
`;

const tmpColor = new THREE.Color();

class SkinWriter {
  constructor(skin, cursor, limit = Infinity) {
    this.skin = skin;
    this.i = cursor;
    this.limit = limit;
  }

  _write(cx, cy, hw, hh, shapeId, matId, tint, o) {
    const s = this.skin;
    const i = this.i;
    if (i >= this.limit || i >= CAP) return -1;
    const x0 = o.x0, x1 = o.x1, y0 = o.y0, y1 = o.y1;
    s.rect[i * 4] = cx; s.rect[i * 4 + 1] = cy; s.rect[i * 4 + 2] = hw; s.rect[i * 4 + 3] = hh;
    s.shape[i * 4] = shapeId;
    s.shape[i * 4 + 1] = matId;
    s.shape[i * 4 + 2] = o.seed ?? (cx * 0.137 + cy * 0.311);
    s.shape[i * 4 + 3] = o.inner ?? 0;
    s.range[i * 2] = Math.min(o.z0, o.z1);
    s.range[i * 2 + 1] = Math.max(o.z0, o.z1);
    tmpColor.set(tint);
    s.tint[i * 3] = tmpColor.r; s.tint[i * 3 + 1] = tmpColor.g; s.tint[i * 3 + 2] = tmpColor.b;
    s.opts[i * 4] = o.ps ?? 1;
    s.opts[i * 4 + 1] = o.ink ?? 1;
    s.opts[i * 4 + 2] = o.glow ?? 0;
    s.opts[i * 4 + 3] = o.innerY ?? 0;
    this.i += 1;
    if (this.i > s.count) s.count = this.i;
    s.dirty = true;
    return i;
  }

  /** rectangle from absolute bounds */
  box(x0, x1, y0, y1, matId, tint, o = {}) {
    const oo = { ...o, x0, x1, y0, y1 };
    oo.z0 = o.z0 ?? -99;
    oo.z1 = o.z1 ?? 99;
    return this._write((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, SHAPE.RECT, matId, tint, oo);
  }

  /** structural slab / wall band with an optional finish layer on one face */
  disc(cx, cy, r, matId, tint, o = {}) {
    const oo = { ...o, z0: o.z0 ?? -99, z1: o.z1 ?? 99 };
    return this._write(cx, cy, r, r, SHAPE.DISC, matId, tint, oo);
  }

  annulus(cx, cy, rOut, rIn, matId, tint, o = {}) {
    const oo = { ...o, z0: o.z0 ?? -99, z1: o.z1 ?? 99, inner: Math.max(0.02, rIn / rOut) };
    return this._write(cx, cy, rOut, rOut, SHAPE.ANNULUS, matId, tint, oo);
  }

  ibeam(x0, x1, y0, y1, matId, tint, o = {}) {
    const oo = { ...o, z0: o.z0 ?? -99, z1: o.z1 ?? 99, inner: o.bolts === false ? 0 : 1 };
    return this._write((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, SHAPE.IBEAM, matId, tint, oo);
  }

  /** hollow rectangular section (duct, conduit, duct bank cell, box girder) */
  frame(x0, x1, y0, y1, wall, matId, tint, o = {}) {
    const hw = (x1 - x0) / 2;
    const hh = (y1 - y0) / 2;
    const oo = { ...o, z0: o.z0 ?? -99, z1: o.z1 ?? 99, inner: Math.max(0.02, (hw - wall) / hw), innerY: Math.max(0.02, (hh - wall) / hh) };
    return this._write((x0 + x1) / 2, (y0 + y1) / 2, hw, hh, SHAPE.FRAME, matId, tint, oo);
  }

  tri(x0, x1, y0, y1, matId, tint, o = {}) {
    const oo = { ...o, z0: o.z0 ?? -99, z1: o.z1 ?? 99 };
    return this._write((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, SHAPE.TRI, matId, tint, oo);
  }
}

export class SectionSkin {
  constructor() {
    this.capacity = CAP;
    this.count = 0;
    this.cut = -1.6;
    this.dyns = [];
    this.dirty = true;

    this.rect = new Float32Array(CAP * 4);
    this.shape = new Float32Array(CAP * 4);
    this.range = new Float32Array(CAP * 2);
    this.tint = new Float32Array(CAP * 3);
    this.opts = new Float32Array(CAP * 4);

    const base = new THREE.PlaneGeometry(2, 2);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    geo.setAttribute('iRect', new THREE.InstancedBufferAttribute(this.rect, 4));
    geo.setAttribute('iShape', new THREE.InstancedBufferAttribute(this.shape, 4));
    geo.setAttribute('iRange', new THREE.InstancedBufferAttribute(this.range, 2));
    geo.setAttribute('iTint', new THREE.InstancedBufferAttribute(this.tint, 3));
    geo.setAttribute('iOpts', new THREE.InstancedBufferAttribute(this.opts, 4));
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 200);

    this.uniforms = {
      uCut: { value: this.cut },
      uTime: { value: 0 },
      uInk: { value: 0.021 },
      uDay: { value: 1 },
      uInkColor: { value: new THREE.Color(P.ink).multiplyScalar(0.8) },
      uWash: { value: new THREE.Color('#4c7ea8') },
      uWashAmt: { value: 0.3 },
      uPx: { value: 0.05 },
      uY0: { value: -46 },
      uY1: { value: 46 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
      transparent: false,
      depthTest: true,
      depthWrite: true,
    });
    this.material = mat;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.name = 'sectionSkin';
    this.writer = new SkinWriter(this, 0);
  }

  /* ── static registration ─────────────────────────────────────────────── */
  box(x0, x1, y0, y1, matId, tint, o) { return this.writer.box(x0, x1, y0, y1, matId, tint, o); }
  disc(cx, cy, r, matId, tint, o) { return this.writer.disc(cx, cy, r, matId, tint, o); }
  annulus(cx, cy, ro, ri, matId, tint, o) { return this.writer.annulus(cx, cy, ro, ri, matId, tint, o); }
  ibeam(x0, x1, y0, y1, matId, tint, o) { return this.writer.ibeam(x0, x1, y0, y1, matId, tint, o); }
  frame(x0, x1, y0, y1, wall, matId, tint, o) { return this.writer.frame(x0, x1, y0, y1, wall, matId, tint, o); }
  tri(x0, x1, y0, y1, matId, tint, o) { return this.writer.tri(x0, x1, y0, y1, matId, tint, o); }

  /** a run of identical sliced elements along x (slabs, sills, lintels, covers) */
  runX(x0, x1, y0, y1, matId, tint, o = {}, pitch = 0, gap = 0.02) {
    if (!pitch) return this.box(x0, x1, y0, y1, matId, tint, o);
    let n = 0;
    for (let x = x0; x < x1 - 0.01; x += pitch) {
      this.box(x, Math.min(x1, x + pitch - gap), y0, y1, matId, tint, o);
      n += 1;
    }
    return n;
  }

  /* ── dynamic registration (re-solved whenever the cut moves) ──────────── */
  dyn(reserve, cb) {
    const start = this.count;
    const w = new SkinWriter(this, start, start + reserve);
    cb(w, this.cut);
    this.count = start + reserve;
    /* the shared static writer must hop over the reserved slots */
    if (this.writer && this.writer.i < this.count) this.writer.i = this.count;
    this.dyns.push({ start, reserve, cb, writer: new SkinWriter(this, start, start + reserve) });
    return this.count - 1;
  }

  refreshDyn(cut) {
    for (const d of this.dyns) {
      d.writer.i = d.start;
      d.cb(d.writer, cut);
    }
  }

  upload() {
    const g = this.mesh.geometry;
    g.instanceCount = Math.min(this.count, CAP);
    for (const [name, arr] of [['iRect', this.rect], ['iShape', this.shape], ['iRange', this.range], ['iTint', this.tint], ['iOpts', this.opts]]) {
      g.getAttribute(name).needsUpdate = true;
    }
    this.dirty = false;
  }

  setCut(cut) {
    if (Math.abs(cut - this.cut) < 0.002) return false;
    this.cut = cut;
    this.uniforms.uCut.value = cut;
    this.refreshDyn(cut);
    this.upload();
    return true;
  }

  update({ time, day, inkScale, px }) {
    this.uniforms.uTime.value = time;
    this.uniforms.uDay.value = day;
    if (inkScale !== undefined) this.uniforms.uInk.value = inkScale;
    if (px !== undefined) this.uniforms.uPx.value = px;
  }

  get used() { return this.count; }
}
