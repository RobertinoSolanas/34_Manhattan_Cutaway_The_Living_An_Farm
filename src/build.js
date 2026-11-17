/**
 * src/build.js — build context.
 *
 * `ctx.solid()` registers a physical element (3D volume behind the cut) *and*
 * its honest cut face on the plane in one call, so the slice can never disagree
 * with the world behind it. Everything merges into a handful of vertex-coloured
 * meshes; repetitive clutter goes through instanced pools.
 */

import * as THREE from 'three';
import { Shell, Pool, MatLib, KEYS } from './mat.js';
import { M } from './section.js';
import { col, rng } from './util.js';

export class Ctx {
  constructor({ skin, earth, plane, quality = 'high', seed = 7 }) {
    this.skin = skin;
    this.earth = earth;
    this.quality = quality;
    this.R = rng(seed);
    this.mats = new MatLib(plane);
    this.shells = {};
    for (const k of Object.values(KEYS)) this.shells[k] = new Shell();
    this.pools = new Map();
    this.stats = { solids: 0, cutFaces: 0 };
  }

  prims() {
    let n = 0;
    for (const s of Object.values(this.shells)) n += s.prims;
    return n;
  }

  shell(key = KEYS.body) {
    return this.shells[key] || this.shells[KEYS.body];
  }

  color(c) {
    return c instanceof THREE.Color ? c : col(c);
  }

  /** real element: 3D volume + cut face on the plane */
  solid(key, x0, x1, y0, y1, z0, z1, color, matId, opts = {}) {
    const c = this.color(color);
    this.shell(key).box(key, x0, x1, y0, y1, z0, z1, c, opts);
    if (matId !== undefined && matId !== null) {
      this.skin.box(x0, x1, y0, y1, matId, opts.tint || c, {
        z0, z1, seed: opts.seed, ink: opts.ink, glow: opts.glow, inner: opts.inner, innerY: opts.innerY,
      });
      this.stats.cutFaces += 1;
    }
    this.stats.solids += 1;
    return this;
  }

  /** 3D only — furniture, props, detailing that lives behind the plane */
  only3d(key, x0, x1, y0, y1, z0, z1, color, opts = {}) {
    this.shell(key).box(key, x0, x1, y0, y1, z0, z1, this.color(color), opts);
    return this;
  }

  /** cut face only — thin things that do not deserve 3D volume */
  onlyCut(x0, x1, y0, y1, matId, tint, opts = {}) {
    this.skin.box(x0, x1, y0, y1, matId, tint, opts);
    this.stats.cutFaces += 1;
    return this;
  }

  /** hollow rectangular section (ducts, conduit, box girder, duct bank cell) */
  hollow(key, x0, x1, y0, y1, z0, z1, color, matId, wall, opts = {}) {
    const c = this.color(color);
    this.shell(key).box(key, x0, x1, y0, y1, z0, z1, c, opts);
    this.skin.frame(x0, x1, y0, y1, wall, matId, opts.tint || c, { z0, z1, seed: opts.seed, ink: opts.ink });
    return this;
  }

  /** a pipe/tube running along x: clipped 3D shell + cut strips at the plane */
  tubeX(key, cy, cz, x0, x1, rIn, rOut, seg, color, matId, opts = {}) {
    const c = this.color(color);
    this.shell(key).tubeX(key, cy, cz, x0, x1, rIn, rOut, seg, c, opts);
    if (matId !== undefined) {
      const t = Math.max(0.016, (rOut - rIn) * 0.85);
      this.skin.dyn(2, (w, cut) => {
        const dz = cut - cz;
        if (Math.abs(dz) >= rOut - 0.005) {
          w.box(-0.001, 0.001, 0, 0.001, matId, c, { z0: 999, z1: 999 });
          w.box(-0.001, 0.001, 0, 0.001, matId, c, { z0: 999, z1: 999 });
          return;
        }
        const yy = Math.sqrt(Math.max(0, rOut * rOut - dz * dz));
        w.box(x0, x1, cy + yy - t, cy + yy + t, matId, opts.tint || c, { ink: 0.75 });
        w.box(x0, x1, cy - yy - t, cy - yy + t, matId, opts.tint || c, { ink: 0.75 });
      });
    }
    return this;
  }

  /** a tube running along z: full annulus in the cut face */
  tubeZ(key, cx, cy, z0, z1, rIn, rOut, seg, color, matId, opts = {}) {
    const c = this.color(color);
    this.shell(key).tubeZ(key, cx, cy, z0, z1, rIn, rOut, seg, c, opts);
    if (matId !== undefined) {
      this.skin.annulus(cx, cy, rOut, rIn, matId, opts.tint || c, { z0, z1, ink: opts.ink ?? 0.9 });
      this.stats.cutFaces += 1;
    }
    return this;
  }

  pool(name, geometry, materialKind = KEYS.body, max = 4096, opts = {}) {
    let p = this.pools.get(name);
    if (!p) {
      const m = this.mats;
      const mat = materialKind === KEYS.glow ? m.glow(name, opts.mul ?? 1, opts.opacity ?? 1)
        : materialKind === KEYS.metal ? m.metal
          : materialKind === KEYS.glass ? m.glass
            : materialKind === KEYS.dark ? m.dark
              : materialKind === KEYS.soft ? m.soft(name, opts)
                : m.body;
      p = new Pool(geometry, mat, max, { name, ...opts });
      this.pools.set(name, p);
    }
    return p;
  }

  /** merge all shells into the scene using the material library */
  finish(parent) {
    const m = this.mats;
    const pick = {
      [KEYS.body]: m.body,
      [KEYS.glow]: m.glow('shell', 1, 1),
      [KEYS.metal]: m.metal,
      [KEYS.glass]: m.glass,
      [KEYS.dark]: m.dark,
      [KEYS.soft]: m.soft('shellSoft', { color: '#ffffff', opacity: 1 }),
      [KEYS.beacon]: m.beacon,
    };
    this.matPick = pick;
    for (const [key, shell] of Object.entries(this.shells)) {
      const g = shell.build({ [key]: pick[key] });
      for (const mesh of g.children) {
        mesh.name = `shell:${key}`;
        parent.add(mesh);
      }
    }
    for (const p of this.pools.values()) p.finish(parent);
    return parent;
  }
}

/* ────────────────────────── shared small helpers ────────────────────────── */

export const INK = '#1d3350';

/** a colour sunk toward the section ink — for surfaces deep behind the cut */
export function deep(hex, t = 0.35) {
  return col(hex).lerp(col('#1b2f42'), t);
}

export function jitterColor(hex, R, amt = 0.12) {
  return col(hex).multiplyScalar(1 - amt + R() * amt * 2);
}

export function boxGeo(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}
