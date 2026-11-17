/**
 * src/mat.js — material library (all clipping-aware), a merged-geometry shell
 * batcher, and instanced pools. The whole block is built from these so that
 * draw calls stay in the dozens, not the thousands.
 */

import * as THREE from 'three';
import { tmpM, tmpV, tmpQ, tmpE, col } from './util.js';

export const KEYS = {
  body: 'body',        // lit, vertex-coloured solid structure
  glow: 'glow',        // unlit emissive-ish (lit rooms, lamps, screens)
  soft: 'soft',        // soft additive (steam, light cones, glows)
  beacon: 'beacon',    // always-on: transit lights, signals, signage
  glass: 'glass',      // pane glass
  dark: 'dark',        // deep background shells, unlit-ish
  metal: 'metal',      // shinier metal (rails, train flanks)
  water: 'water',      // sewer flow, tank water
};

export class MatLib {
  constructor(cutPlane) {
    this.plane = cutPlane;
    this.cache = new Map();
    this.all = [];
    this.day = 1;
  }

  _track(m) {
    this.all.push(m);
    return m;
  }

  make(id, factory, { clip = true } = {}) {
    if (this.cache.has(id)) return this.cache.get(id);
    const m = factory();
    if (clip && this.plane) {
      m.clippingPlanes = [this.plane];
      m.clipShadows = false;
    }
    m.userData.key = id;
    this.cache.set(id, m);
    this.all.push(m);
    return m;
  }

  get body() {
    return this.make('body', () => new THREE.MeshLambertMaterial({ vertexColors: true }));
  }

  get metal() {
    return this.make('metal', () => new THREE.MeshPhongMaterial({
      vertexColors: true, shininess: 46, specular: new THREE.Color('#8fa0b4'),
    }));
  }

  /**
   * Lit-interior surface. `lit` scales with the day/night dial so windows warm
   * up floor-by-floor after sundown.
   */
  glow(id = 'glow', colorMul = 1, opacity = 1) {
    return this.make(`glow:${id}:${colorMul}:${opacity}`, () => new THREE.MeshBasicMaterial({
      vertexColors: true,
      color: new THREE.Color(colorMul, colorMul, colorMul),
      transparent: opacity < 1,
      opacity,
      toneMapped: true,
      depthWrite: opacity >= 0.98,
    }));
  }

  /** always-on emissive: signals, tunnel lighting, signage, cab displays */
  get beacon() {
    return this.make('beacon', () => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }));
  }

  get dark() {
    return this.make('dark', () => new THREE.MeshLambertMaterial({
      vertexColors: true, emissive: new THREE.Color('#0c1620'), emissiveIntensity: 1,
    }));
  }

  get glass() {
    return this.make('glass', () => new THREE.MeshLambertMaterial({
      vertexColors: true, transparent: true, opacity: 0.34, side: THREE.DoubleSide,
      depthWrite: false,
    }));
  }

  /** a soft additive sprite/plane material (steam, headlight cones, glows) */
  soft(id, opts = {}) {
    return this.make(`soft:${id}`, () => new THREE.MeshBasicMaterial({
      color: new THREE.Color(opts.color || '#ffffff'),
      transparent: true,
      opacity: opts.opacity ?? 0.35,
      blending: opts.blending ?? THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: true,
    }), { clip: opts.clip !== false });
  }
}

/* ─────────────────────────── shell batcher ─────────────────────────────── */

class Group {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.idx = [];
    this.count = 0;
    this.prims = 0;
  }
}

/**
 * Accumulates boxes / plates / tubes as merged, vertex-coloured geometry.
 * All coordinates are absolute world metres; the cut plane does the slicing.
 */
export class Shell {
  constructor() {
    this.map = new Map();
  }

  g(key) {
    let g = this.map.get(key);
    if (!g) {
      g = new Group();
      this.map.set(key, g);
    }
    return g;
  }

  get prims() {
    let n = 0;
    for (const g of this.map.values()) n += g.prims;
    return n;
  }

  quad(key, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, color, flip = false) {
    const g = this.g(key);
    if (g.prims > 260000) throw new Error(`prim budget blown on shell "${key}" — a builder loop is running away`);
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = dx - ax, vy = dy - ay, vz = dz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    const base = g.count;
    const pts = [[ax, ay, az], [bx, by, bz], [cx, cy, cz], [dx, dy, dz]];
    for (const p of pts) {
      g.pos.push(p[0], p[1], p[2]);
      g.nor.push(nx, ny, nz);
      g.col.push(color.r, color.g, color.b);
    }
    if (flip) g.idx.push(base, base + 3, base + 2, base, base + 2, base + 1);
    else g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    g.count += 4;
    g.prims += 1;
  }

  /** a single triangle (cones, roofs, braces, rats) */
  tri(key, ax, ay, az, bx, by, bz, cx, cy, cz, color) {
    const g = this.g(key);
    if (g.prims > 260000) throw new Error(`prim budget blown on shell "${key}" — a builder loop is running away`);
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    let ny = (bz - az) * (bx - ax) - (bx - ax) * (cz - az);
    let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    const base = g.count;
    const pts = [[ax, ay, az], [bx, by, bz], [cx, cy, cz]];
    for (const p of pts) {
      g.pos.push(p[0], p[1], p[2]);
      g.nor.push(nx, ny, nz);
      g.col.push(color.r, color.g, color.b);
    }
    g.idx.push(base, base + 1, base + 2);
    g.count += 3;
    g.prims += 1;
    return this;
  }

  /** axis-aligned box from (x0,y0,z0) to (x1,y1,z1). opts: {skip:[±x,±y,±z], ao} */
  box(key, x0, x1, y0, y1, z0, z1, colorIn, opts = {}) {
    let c = colorIn;
    if (opts.ao !== undefined && opts.ao !== 1) c = colorIn.clone().multiplyScalar(opts.ao);
    const skip = opts.skip || '';
    const yTop = !(skip.includes('+y') || skip === 'top');
    const yBot = !(skip.includes('-y') || skip === 'bottom');
    const xP = !(skip.includes('+x') || skip === 'right');
    const xM = !(skip.includes('-x') || skip === 'left');
    const zP = !(skip.includes('+z') || skip === 'front');
    const zM = !(skip.includes('-z') || skip === 'back');
    // +y
    if (yTop) this.quad(key, x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, c);
    // -y
    if (yBot) this.quad(key, x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, c);
    // +x
    if (xP) this.quad(key, x1, y1, z0, x1, y1, z1, x1, y0, z1, x1, y0, z0, c);
    // -x
    if (xM) this.quad(key, x0, y1, z1, x0, y1, z0, x0, y0, z0, x0, y0, z1, c);
    // +z
    if (zP) this.quad(key, x0, y1, z1, x0, y0, z1, x1, y0, z1, x1, y1, z1, c);
    // -z
    if (zM) this.quad(key, x1, y1, z0, x1, y0, z0, x0, y0, z0, x0, y1, z0, c);
    return this;
  }

  /** horizontal plate (xz) at height y */
  plate(key, x0, x1, z0, z1, y, color, opts = {}) {
    return this.box(key, x0, x1, y, y + (opts.t || 0.02), z0, z1, color, opts);
  }

  /** vertical face in the x-y plane at z (double sided handled by `both`) */
  face(key, x0, x1, y0, y1, z, color, both = false) {
    this.quad(key, x0, y1, z, x1, y1, z, x1, y0, z, x0, y0, z, color);
    if (both) this.quad(key, x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z, color, true);
    return this;
  }

  /** vertical face in the y-z plane at x */
  faceX(key, y0, y1, z0, z1, x, color) {
    this.quad(key, x, y1, z0, x, y1, z1, x, y0, z1, x, y0, z0, color);
    return this;
  }

  /** cylinder along the x axis (tube of revolution around X) */
  tubeX(key, cy, cz, x0, x1, rIn, rOut, seg, colorIn, opts = {}) {
    const c = opts.ao ? colorIn.clone().multiplyScalar(opts.ao) : colorIn;
    const a0 = opts.a0 ?? 0;
    const a1 = opts.a1 ?? Math.PI * 2;
    const showIn = opts.inner !== false;
    const showOut = opts.outer !== false;
    for (let i = 0; i < seg; i += 1) {
      const t0 = a0 + (a1 - a0) * (i / seg);
      const t1 = a0 + (a1 - a0) * ((i + 1) / seg);
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      const oy0 = cy + rOut * s0, oz0 = cz + rOut * c0;
      const oy1 = cy + rOut * s1, oz1 = cz + rOut * c1;
      const iy0 = cy + rIn * s0, iz0 = cz + rIn * c0;
      const iy1 = cy + rIn * s1, iz1 = cz + rIn * c1;
      if (showOut) this.quad(key, x1, oy0, oz0, x1, oy1, oz1, x0, oy1, oz1, x0, oy0, oz0, c);
      if (showIn && rIn > 0.001) this.quad(key, x0, iy0, iz0, x0, iy1, iz1, x1, iy1, iz1, x1, iy0, iz0, c, true);
      if (opts.caps !== false && rOut - rIn > 0.004) {
        // end rings (these are what the section reads as when the tube is cut)
        this.quad(key, x0, oy0, oz0, x0, oy1, oz1, x0, iy1, iz1, x0, iy0, iz0, c, true);
        this.quad(key, x1, oy1, oz1, x1, oy0, oz0, x1, iy0, iz0, x1, iy1, iz1, c);
      }
    }
    return this;
  }

  /** cylinder along the z axis */
  tubeZ(key, cx, cy, z0, z1, rIn, rOut, seg, colorIn, opts = {}) {
    const c = opts.ao ? colorIn.clone().multiplyScalar(opts.ao) : colorIn;
    const a0 = opts.a0 ?? 0;
    const a1 = opts.a1 ?? Math.PI * 2;
    for (let i = 0; i < seg; i += 1) {
      const t0 = a0 + (a1 - a0) * (i / seg);
      const t1 = a0 + (a1 - a0) * ((i + 1) / seg);
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      const ox0 = cx + rOut * c0, oy0 = cy + rOut * s0;
      const ox1 = cx + rOut * c1, oy1 = cy + rOut * s1;
      const ix0 = cx + rIn * c0, iy0 = cy + rIn * s0;
      const ix1 = cx + rIn * c1, iy1 = cy + rIn * s1;
      if (opts.outer !== false) this.quad(key, z1, ox0, oy0, z1, ox1, oy1, z0, ox1, oy1, z0, ox0, oy0, c);
      if (rIn > 0.001) this.quad(key, z0, ix0, iy0, z0, ix1, iy1, z1, ix1, iy1, z1, ix0, iy0, c, true);
    }
    return this;
  }

  /** vertical cylinder (y axis) */
  tubeY(key, cx, cz, y0, y1, rIn, rOut, seg, colorIn, opts = {}) {
    const c = opts.ao ? colorIn.clone().multiplyScalar(opts.ao) : colorIn;
    for (let i = 0; i < seg; i += 1) {
      const t0 = (Math.PI * 2 * i) / seg;
      const t1 = (Math.PI * 2 * (i + 1)) / seg;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      const ox0 = cx + rOut * c0, oz0 = cz + rOut * s0;
      const ox1 = cx + rOut * c1, oz1 = cz + rOut * s1;
      const ix0 = cx + rIn * c0, iz0 = cz + rIn * s0;
      const ix1 = cx + rIn * c1, iz1 = cz + rIn * s1;
      if (opts.outer !== false) this.quad(key, ox0, y1, oz0, ox1, y1, oz1, ox1, y0, oz1, ox0, y0, oz0, c);
      if (rIn > 0.001 && opts.inner !== false) this.quad(key, ix0, y0, iz0, ix1, y0, iz1, ix1, y1, iz1, ix0, y1, iz0, c, true);
    }
    return this;
  }

  /** sphere-ish blob (water tank domes, rats, bosses) */
  blob(key, cx, cy, cz, r, color, seg = 8, rings = 5, squash = 1) {
    for (let ring = 0; ring < rings; ring += 1) {
      const a0 = (ring / rings) * Math.PI;
      const a1 = ((ring + 1) / rings) * Math.PI;
      const y0 = Math.cos(a0) * r * squash;
      const y1 = Math.cos(a1) * r * squash;
      const rr0 = Math.sin(a0) * r;
      const rr1 = Math.sin(a1) * r;
      for (let i = 0; i < seg; i += 1) {
        const p0 = (i / seg) * Math.PI * 2;
        const p1 = ((i + 1) / seg) * Math.PI * 2;
        const c0 = Math.cos(p0), s0 = Math.sin(p0), c1 = Math.cos(p1), s1 = Math.sin(p1);
        this.tri(key,
          cx + rr1 * c0, cy + y1, cz + rr1 * s0,
          cx + rr0 * c0, cy + y0, cz + rr0 * s0,
          cx + rr0 * c1, cy + y0, cz + rr0 * s1, color);
        this.tri(key,
          cx + rr1 * c0, cy + y1, cz + rr1 * s0,
          cx + rr0 * c1, cy + y0, cz + rr0 * s1,
          cx + rr1 * c1, cy + y1, cz + rr1 * s1, color);
      }
    }
    return this;
  }

  /** the merged BufferGeometry for one key (used as instanced prop geometry) */
  geometry(key) {
    const g = this.map.get(key);
    if (!g || !g.count) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
    geo.setIndex(g.idx);
    geo.computeBoundingSphere();
    g.pos.length = 0; g.nor.length = 0; g.col.length = 0; g.idx.length = 0;
    g.count = 0;
    g.prims = 0;
    return geo;
  }

  build(mats, { castShadow = false, group = new THREE.Group(), layer = 0 } = {}) {
    for (const [key, g] of this.map) {
      if (!g.count) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
      geo.setIndex(g.idx);
      geo.computeBoundingSphere();
      const mat = typeof mats === 'function' ? mats(key) : mats[key] || mats.body;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = castShadow;
      mesh.frustumCulled = true;
      mesh.layers.set(layer);
      group.add(mesh);
      g.pos.length = 0; g.nor.length = 0; g.col.length = 0; g.idx.length = 0;
      g.count = 0;
    }
    this.map.clear();
    return group;
  }
}

/* ───────────────────────── instanced pools ─────────────────────────────── */

/**
 * A pool of identical props (chairs, rebar dots, people, tiles) with
 * per-instance colour. Call add() while laying out, then finish().
 */
export class Pool {
  constructor(geometry, material, max, { name = 'pool', dynamic = false } = {}) {
    this.geometry = geometry;
    this.material = material;
    this.max = max;
    this.i = 0;
    this.name = name;
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.StaticDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this._m = new THREE.Matrix4();
  }

  add(x, y, z, opts = {}) {
    if (this.i >= this.max) return -1;
    const idx = this.i;
    const ry = opts.ry || 0;
    tmpE.set(opts.rx || 0, ry, opts.rz || 0);
    tmpQ.setFromEuler(tmpE);
    tmpM.compose(tmpV.set(x, y, z), tmpQ, new THREE.Vector3(opts.sx ?? 1, opts.sy ?? 1, opts.sz ?? 1));
    this.mesh.setMatrixAt(idx, tmpM);
    const c = opts.color || WHITE;
    this.mesh.instanceColor.setXYZ(idx, c.r, c.g, c.b);
    this.i += 1;
    return idx;
  }

  addMat(matrix, color = WHITE) {
    if (this.i >= this.max) return -1;
    const idx = this.i;
    this.mesh.setMatrixAt(idx, matrix);
    this.mesh.instanceColor.setXYZ(idx, color.r, color.g, color.b);
    this.i += 1;
    return idx;
  }

  finish(parent) {
    this.mesh.count = this.i;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    if (this.i > 0 && parent) parent.add(this.mesh);
    return this.mesh;
  }
}

export const WHITE = new THREE.Color(1, 1, 1);

/** merge a list of geometries that share position/normal/color into one */
export function mergeSimple(geos) {
  const pos = [];
  const nor = [];
  const cc = [];
  const idx = [];
  let count = 0;
  for (const geo of geos) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position.array;
    const n = g.attributes.normal ? g.attributes.normal.array : null;
    const cAttr = g.attributes.color;
    for (let v = 0; v < p.length / 3; v += 1) {
      pos.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]);
      nor.push(n ? n[v * 3] : 0, n ? n[v * 3 + 1] : 1, n ? n[v * 3 + 2] : 0);
      if (cAttr) cc.push(cAttr.array[v * 3], cAttr.array[v * 3 + 1], cAttr.array[v * 3 + 2]);
      else cc.push(1, 1, 1);
    }
    const vc = p.length / 3;
    for (let v = 0; v < vc; v += 1) idx.push(count + v);
    count += vc;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
  out.setIndex(idx);
  out.computeBoundingSphere();
  return out;
}

/** paint every vertex of a geometry one colour */
export function paint(geo, hex) {
  const c = col(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
  return geo;
}
