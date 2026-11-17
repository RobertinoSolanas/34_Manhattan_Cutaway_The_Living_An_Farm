/**
 * src/below.js — everything under the street, which is the real spectacle.
 *
 * Foundations as heroes (caisson piers socketed into the rock, a tower mat with
 * drilled shafts, a slurry wall with panel joints and ties, two generations of
 * rubble footings), the cellars with their brick barrel vaults and street
 * vaults, the utility stratum with every main colour-coded and physically
 * routed around its neighbours, the cut-and-cover local line with a tiled
 * station, and the deep express tube driven in sound gneiss ring by ring.
 */

import * as THREE from 'three';
import { M } from './section.js';
import { KEYS } from './mat.js';
import { col, rng, lerp } from './util.js';
import { deep, jitterColor } from './build.js';
import { BUILDINGS, LEVEL, UPPER, EXPRESS, GALLERY, SERVICES, GEO_FEATURES, STREET } from './layout.js';
import { prepareBuildings } from './structure.js';

const FRONT = -1.1;

/* ─────────────────────────── cellar structure ─────────────────────────── */

function cellars(ctx, b) {
  if (!b.cellars.length) return;
  const R = b.R || rng(11);
  const in0 = b.x0 + 0.25;
  const in1 = b.x1 - 0.25;
  const zBack = -13.2;

  for (const c of b.cellars) {
    const yTop = c.top;
    const yBot = c.y0;
    /* void in the ground so the cellar can be seen */
    ctx.earth.addBox(in0, in1, yBot - 0.25, yTop - 0.1, FRONT, zBack, 0.42, R());
    /* enclosing masonry */
    ctx.solid(KEYS.body, b.x0, in0, yBot - 0.4, yTop, FRONT, zBack, '#8c8579', M.BRICK_WYTHE, { ink: 1 });
    ctx.solid(KEYS.body, in1, b.x1, yBot - 0.4, yTop, FRONT, zBack, '#8c8579', M.BRICK_WYTHE, { ink: 1 });
    ctx.solid(KEYS.body, in0, in1, yBot - 0.4, yBot, FRONT, zBack, '#8e8d86', M.REBAR, { ink: 0.9 });
    ctx.solid(KEYS.body, in0, in1, yTop - 0.26, yTop, FRONT, zBack, '#8e8d86', M.REBAR, { ink: 0.9 });
    /* the cellar front wall is only present above the cutting plane */
    ctx.solid(KEYS.body, in0, in1, yBot - 0.4, yTop, FRONT, FRONT + 0.5, '#7f7a70', M.BRICK, { ink: 0.9 });

    /* brick barrel vaults between the piers */
    if (c.rooms.some((r) => r.vaulted)) {
      const pitch = 3.1;
      for (let x = in0 + 0.6; x < in1 - 0.6; x += pitch) {
        const cx = Math.min(x + pitch / 2, in1 - 0.5);
        const r = Math.min(pitch / 2 - 0.12, (Math.min(x + pitch, in1) - x) / 2);
        ctx.shell(KEYS.body).tubeX('body', yTop - 0.3, -6.2, x, Math.min(x + pitch, in1), r - 0.14, r, 14, col('#9a6350'), { a0: 0, a1: Math.PI, caps: false });
        /* the cut through the vault: two brick skewbacks */
        ctx.onlyCut(x, Math.min(x + pitch, in1), yTop - 0.46, yTop - 0.3, M.BRICK, '#9a6350', { z0: -11.5, z1: -2.4, ink: 0.8 });
        /* pier under the springing */
        ctx.only3d(KEYS.body, x - 0.16, x + 0.16, yBot, yTop - 0.44, -1.6, -11.6, deep('#a09a8e', 0.3));
      }
    }
    /* cellar partitions per room */
    const rooms = c.rooms;
    for (let i = 1; i < rooms.length; i += 1) {
      const x = rooms[i].x0;
      ctx.solid(KEYS.body, x - 0.14, x + 0.14, yBot, yTop - 0.26, FRONT + 0.4, zBack, '#a8a297', M.CMU, { ink: 0.9 });
    }
    /* damp-proof course + a hint of rising damp */
    ctx.onlyCut(in0, in1, yTop - 0.34, yTop - 0.3, M.TAR, '#25282d', { z0: -13, z1: FRONT, ink: 0.5 });
  }

  /* columns under the tower / office grid */
  if (b.kind === 'glass' || b.kind === 'tower') {
    for (let x = b.x0 + 2.2; x < b.x1 - 1.4; x += 4.4) {
      ctx.solid(KEYS.metal, x - 0.18, x + 0.18, b.bottom - 0.3, -0.2, -2.4, -11.8, '#7f878f', M.IBEAM, { ink: 0.9 });
    }
  }
}

/* ──────────────────────────── foundations ─────────────────────────────── */

function foundations(ctx) {
  for (const b of BUILDINGS) {
    const f = b.foundation;
    if (!f) continue;
    const R = b.R || rng(5);

    if (f.type === 'caisson') {
      /* spread footing banding the bearing walls, then piers down to the rock */
      for (const [xa, xb] of [[b.x0 - 0.2, b.x0 + b.party + 0.2], [b.x1 - b.party - 0.2, b.x1 + 0.2]]) {
        ctx.solid(KEYS.body, xa - 0.35, xb + 0.35, f.top - 0.75, f.top, -2.2, -12.4, '#9c9b93', M.REBAR, { ink: 1 });
      }
      for (let x = b.x0 + 1.4; x < b.x1 - 0.8; x += f.pitch) {
        const rr = f.dia / 2;
        const socket = f.socket - Math.abs(Math.sin(x * 1.7)) * 1.6;
        /* the shaft, 3D */
        ctx.shell(KEYS.metal === undefined ? KEYS.body : KEYS.body).tubeY('body', x, -4.4, socket, f.top - 0.6, 0, rr, 14, col('#a3a199'), {});
        ctx.shell('body').tubeY('body', x, -9.9, socket - 0.4, f.top - 0.6, 0, rr, 14, col('#9d9b93'), {});
        /* bell at the socket, plus the cut section */
        ctx.onlyCut(x - rr, x + rr, socket - 0.55, socket + 0.35, M.CONCRETE, '#a6a49c', { z0: -5.3, z1: -3.5, ink: 0.9 });
        ctx.onlyCut(x - rr, x + rr, socket + 0.35, f.top - 0.6, M.REBAR, '#a6a49c', { z0: -5.3, z1: -3.5, ink: 0.9 });
        ctx.onlyCut(x - rr - 0.42, x + rr + 0.42, socket - 0.62, socket - 0.3, M.REBAR, '#b0aea6', { z0: -5.3, z1: -3.5, ink: 0.9 });
        /* the hole dug for it, backfilled with broken rock */
        ctx.earth.addBox(x - rr - 0.34, x + rr + 0.34, socket - 0.7, f.top - 0.5, -5.4, -3.4, 0.3, R());
      }
      /* a cellar-side footing pier under the party wall */
      ctx.solid(KEYS.body, b.x0 + b.party - 0.1, b.x1 - b.party + 0.1, f.top - 0.55, f.top - 0.1, -6.6, -6.0, '#9a9890', M.CONCRETE, { ink: 0.7 });
    }

    if (f.type === 'mat') {
      ctx.solid(KEYS.body, b.x0 - 0.6, b.x1 + 0.6, f.top - f.thick, f.top, -2.0, -12.8, '#a2a098', M.REBAR, { ink: 1 });
      ctx.earth.addBox(b.x0 - 0.9, b.x1 + 0.9, f.top - f.thick - 0.3, f.top + 0.1, FRONT, -13.2, 0.5, 0.31);
      for (const x of f.shafts) {
        const rr = f.dia / 2;
        ctx.shell('body').tubeY('body', x, -6.4, f.shaftDepth, f.top - f.thick + 0.1, 0, rr, 14, col('#9b9a92'), {});
        ctx.onlyCut(x - rr, x + rr, f.shaftDepth, f.top - f.thick, M.REBAR, '#a4a29a', { z0: -7.4, z1: -5.4, ink: 0.95 });
        ctx.earth.addBox(x - rr - 0.3, x + rr + 0.3, f.shaftDepth - 0.4, f.top - f.thick, -7.5, -5.3, 0.28, 0.7);
      }
      /* the tower's excavation cuts through the older cellar line */
      ctx.onlyCut(b.x0 - 0.6, b.x1 + 0.6, f.top - f.thick, f.top - f.thick + 0.06, M.MEMBRANE, '#3c4750', { z0: -2.0, z1: -12.8, ink: 0.6 });
    }

    if (f.type === 'slurry') {
      /* diaphragm wall panels, down to rock, with ties and a waler */
      ctx.solid(KEYS.body, f.at - f.thick / 2, f.at + f.thick / 2, f.bottom, f.top, -1.8, -12.9, '#9a9d9a', M.CONCRETE, { ink: 1 });
      for (let y = f.bottom + 2.4; y < f.top; y += 2.9) {
        ctx.onlyCut(f.at - f.thick / 2 - 0.03, f.at + f.thick / 2 + 0.03, y, y + 0.07, M.TAR, '#39414a', { z0: -12.9, z1: -1.8, ink: 0.6 });
      }
      for (const zt of f.ties) {
        ctx.shell('metal').tubeZ('metal', f.at, -3.4, zt - 0.08, zt + 0.08, 0, 0.11, 8, col('#8d949b'), {});
        ctx.only3d(KEYS.metal, f.at - 0.26, f.at + 0.26, -3.62, -3.18, zt - 0.2, zt + 0.2, '#7d848b');
      }
      /* soldier piles and the battered excavation floor */
      ctx.solid(KEYS.body, b.x0, f.at, -2.05, -1.75, -1.6, -12.9, '#8e8d86', M.REBAR, { ink: 0.7 });
      ctx.earth.addBox(b.x0, f.at, -2.3, -1.5, FRONT, -13.2, 0.4, 0.52);
      /* the parking slab */
      ctx.solid(KEYS.body, b.x0 + 0.2, f.at, LEVEL.cellar1Top - 0.34, LEVEL.cellar1Top - 0.05, -1.7, -12.8, '#a5a49c', M.REBAR, { ink: 0.8 });
    }

    if (f.type === 'rubble') {
      let y = f.top;
      let inset = 0;
      for (let s = 0; s < f.steps; s += 1) {
        const w = 0.46;
        ctx.solid(KEYS.body, b.x0 + inset, b.x0 + b.party + 0.2 + 0.3 - inset * 0.3, y - w, y, -2.1, -12.4, jitterColor('#a49a8a', R, 0.14), M.RUBBLE, { ink: 0.95 });
        ctx.solid(KEYS.body, b.x1 - b.party - 0.2 - 0.3 + inset * 0.3, b.x1 - inset, y - w, y, -2.1, -12.4, jitterColor('#a49a8a', R, 0.14), M.RUBBLE, { ink: 0.95 });
        y -= w;
        inset += 0.14;
      }
      /* timber cribbing under the oldest wall */
      for (let z = -2.6; z > -11; z -= 0.72) {
        ctx.only3d(KEYS.body, b.x0 + 0.1, b.x0 + b.party + 0.2, y - 0.12, y, z, z - 0.16, jitterColor('#5b4a35', R, 0.2));
      }
      ctx.earth.addBox(b.x0 - 0.4, b.x1 + 0.4, y - 0.4, f.top + 0.2, FRONT, -13.2, 0.36, 0.22);
    }
  }

  /* ── rock features: boulders, a gouge seam, the forgotten dry well ── */
  const R = rng(31337);
  for (const bo of GEO_FEATURES.boulder) {
    ctx.shell('body').blob('body', bo.x, bo.y, -3.6, bo.r, col('#6c6c72'), 9, 6, 0.7);
    ctx.onlyCut(bo.x - bo.r, bo.x + bo.r, bo.y - bo.r * 0.7, bo.y + bo.r * 0.7, M.ROCK, '#71717a', { z0: -6.5, z1: -1.2, ink: 0.7 });
  }
  const fa = GEO_FEATURES.fault;
  for (let y = -18; y > -42; y -= 1.1) {
    const x = fa.x + (y + 18) * fa.dip;
    ctx.onlyCut(x - fa.width / 2, x + fa.width / 2, y, y + 1.1, M.RUBBLE, '#5d5a52', { z0: -7.6, z1: -0.6, ink: 0.5 });
  }
  const dw = GEO_FEATURES.dryWell;
  ctx.earth.addBoreZ(dw.x, dw.y, dw.r + 0.28, dw.z0, dw.z1, 0.3, 0.44);
  ctx.shell('body').tubeZ('body', dw.x, dw.y, dw.z0, dw.z1, dw.r - 0.16, dw.r, 16, col('#8e6350'), {});
  ctx.skin.annulus(dw.x, dw.y, dw.r, dw.r - 0.16, M.BRICK, '#966552', { z0: dw.z0, z1: dw.z1, ink: 0.9 });
  ctx.only3d(KEYS.body, dw.x - dw.r, dw.x + dw.r, dw.y - dw.r, dw.y - dw.r + 0.16, dw.z0, dw.z1, deep('#5e5b52', 0.3));
}

/* ────────────────────────── utility stratum ───────────────────────────── */

function services(ctx) {
  const R = rng(808);
  const yTop = LEVEL.utilityTop;
  const yBot = LEVEL.utilityFloor;
  /* the service trench: concrete cradle, slab, and a wall behind */
  ctx.earth.addBox(-46, 46, yBot - 0.15, yTop + 0.35, FRONT, -12.6, 0.55, 0.77);
  ctx.solid(KEYS.body, -46, 46, yBot - 0.5, yBot, FRONT, -12.2, '#a8a69e', M.REBAR, { ink: 0.7 });
  ctx.solid(KEYS.body, -46, 46, yTop + 0.05, yTop + 0.5, FRONT, -12.2, '#a8a69e', M.REBAR, { ink: 0.7 });
  /* the trench's rear and side walls, so the stratum reads as built space */
  ctx.solid(KEYS.body, -46, 46, yBot, yTop + 0.1, -12.5, -12.2, '#9c9b93', M.CONCRETE, { ink: 0.5 });

  for (const s of SERVICES) {
    const codeCol = s.medium;
    if (s.axis === 'x') {
      const rOut = s.r + (s.insulation || 0);
      if (s.insulation) {
        ctx.tubeX(KEYS.body, s.y, s.z, s.x0, s.x1, s.r, rOut, 14, s.wrap || '#4a4f57', M.INSULATION, { ink: 0.8 });
      }
      ctx.tubeX(KEYS.metal, s.y, s.z, s.x0, s.x1, Math.max(0, s.r - 0.03), s.r, 14, codeCol, s.insulation || s.brick ? undefined : M.COPPER, { ink: 0.8 });
      if (s.brick) {
        /* brick egg sewer: the cut reads as two brick arch shoulders */
        ctx.skin.dyn(2, (w, cut) => {
          const dz = cut - s.z;
          if (Math.abs(dz) > s.r + 0.12) {
            w.box(-0.01, 0.01, 0, 0.01, M.BRICK, codeCol, { z0: 999, z1: 999 });
            w.box(-0.01, 0.01, 0, 0.01, M.BRICK, codeCol, { z0: 999, z1: 999 });
            return;
          }
          const yy = Math.sqrt(Math.max(0, (s.r + 0.11) * (s.r + 0.11) - dz * dz));
          w.box(s.x0, s.x1, s.y + yy - 0.06, s.y + yy + 0.02, M.BRICK, '#8f6a4e', { ink: 0.9 });
          w.box(s.x0, s.x1, s.y - yy - 0.02, s.y - yy + 0.06, M.BRICK, '#8f6a4e', { ink: 0.9 });
        });
      }
      /* hangers and brackets along the run */
      for (let x = -44; x < 44; x += 3.6 + R() * 1.4) {
        ctx.only3d(KEYS.metal, x - 0.05, x + 0.05, s.y - rOut - 0.34, s.y - rOut, s.z - rOut, s.z + rOut, '#7c838a');
        ctx.only3d(KEYS.metal, x - 0.24, x + 0.24, s.y - rOut - 0.4, s.y - rOut - 0.34, s.z - 0.1, s.z + 0.1, '#6f767d');
      }
      /* a valve with a wheel, and a flange pair, occasionally */
      if (R.chance(0.75)) {
        const vx = -30 + R() * 60;
        ctx.only3d(KEYS.metal, vx - 0.16, vx + 0.16, s.y - rOut - 0.1, s.y + rOut + 0.1, s.z - rOut - 0.08, s.z + rOut + 0.08, codeCol);
        ctx.shell('metal').tubeY('metal', vx, s.z, s.y + rOut, s.y + rOut + 0.42, 0, 0.05, 8, col('#b8442f'), {});
        ctx.shell('metal').tubeX('metal', s.y + rOut + 0.42, s.z, s.z - 0.34, s.z + 0.34, 0, 0.05, 8, col('#b8442f'), {});
      }
      if (R.chance(0.6)) {
        const gx = -34 + R() * 68;
        ctx.shell('metal').tubeY('metal', gx, s.z, s.y + rOut, s.y + rOut + 0.2, 0.02, 0.09, 10, col('#e8e4d8'), {});
      }
      /* colour code band wrapped on the pipe */
      for (let x = -42; x < 42; x += 11.5) {
        ctx.only3d(KEYS.body, x, x + 0.3, s.y - rOut - 0.005, s.y + rOut + 0.005, s.z - rOut - 0.005, s.z + rOut + 0.005, col(codeCol).multiplyScalar(1.1));
      }
    } else if (s.bank) {
      /* concrete duct bank with its cells and pulled cables */
      const bk = s.bank;
      ctx.solid(KEYS.body, s.x - bk.w / 2, s.x + bk.w / 2, s.y - bk.h / 2, s.y + bk.h / 2, s.z0, s.z1, '#a09e96', M.CONCRETE, { ink: 0.9 });
      const per = Math.ceil(bk.cells / 2);
      for (let i = 0; i < bk.cells; i += 1) {
        const cxx = s.x - bk.w / 2 + ((i % per) + 0.5) * (bk.w / per);
        const cyy = s.y + (i < per ? bk.h / 4 - 0.02 : -bk.h / 4 + 0.02);
        ctx.shell('body').tubeZ('body', cxx, cyy, s.z0 - 0.02, s.z1 + 0.02, bk.cd / 2 - 0.02, bk.cd / 2, 10, col('#7f7d76'), {});
        ctx.skin.annulus(cxx, cyy, bk.cd / 2, bk.cd / 2 - 0.02, M.IRON, '#8d8880', { z0: s.z0, z1: s.z1, ink: 0.9 });
        /* three cables per duct */
        for (let k = 0; k < 3; k += 1) {
          const a = (k / 3) * Math.PI * 2 + 0.4;
          const rr = bk.cd / 2 - 0.055;
          ctx.shell('body').tubeZ('body', cxx + Math.cos(a) * rr * 0.42, cyy + Math.sin(a) * rr * 0.42, s.z0 - 0.05, s.z1 + 0.05, 0.018, 0.032, 6, col(k === 0 ? '#c8452f' : k === 1 ? '#2f4f8f' : '#2f7f4f'), {});
        }
      }
    } else if (s.bundle) {
      /* telecom / feeder bundle in a tray */
      const n = s.bundle.n;
      for (let i = 0; i < n; i += 1) {
        const off = (i - (n - 1) / 2) * (s.bundle.spread / n);
        const rr = s.bundle.r;
        ctx.shell('body').tubeZ('body', s.x + off, s.y + Math.cos(off * 6) * 0.03, s.z0, s.z1, 0, rr, 6, col('#2f333a'), {});
        ctx.skin.disc(s.x + off, s.y + Math.cos(off * 6) * 0.03, rr, M.IRON, i % 4 === 0 ? '#c8452f' : '#343a42', { z0: s.z0, z1: s.z1, ink: 0.8 });
      }
      ctx.solid(KEYS.metal, s.x - s.bundle.spread / 2 - 0.12, s.x + s.bundle.spread / 2 + 0.12, s.y - 0.14, s.y - 0.09, s.z0, s.z1, '#7e858c', M.STEEL, { ink: 0.7 });
    } else if (s.duct) {
      ctx.hollow(KEYS.metal, s.x - s.duct.w / 2, s.x + s.duct.w / 2, s.y - s.duct.h / 2, s.y + s.duct.h / 2, s.z0, s.z1, '#98a2a8', M.STEEL, 0.02, { ink: 0.9 });
      ctx.only3d(KEYS.body, s.x - s.duct.w / 2 + 0.02, s.x + s.duct.w / 2 - 0.02, s.y - s.duct.h / 2, s.y - s.duct.h / 2 + 0.02, s.z0 + 0.4, s.z1, deep('#c9cdd0', 0.2));
    } else {
      /* plain service riser crossing the plane */
      ctx.tubeZ(KEYS.metal, s.x, s.y, s.z0, s.z1, Math.max(0, s.r - 0.02), s.r, 12, codeCol, M.COPPER, { ink: 0.9 });
      /* coupling collar */
      ctx.shell('metal').tubeZ('metal', s.x, s.y, -2.9, -2.7, s.r - 0.01, s.r + 0.05, 12, col('#8d949b'), {});
      ctx.skin.annulus(s.x, s.y, s.r + 0.05, s.r - 0.01, M.IRON, '#9aa1a8', { z0: -2.9, z1: -2.7, ink: 0.9 });
    }
  }

  /* gallery walkway, lamps, a rack of valves, puddles */
  ctx.solid(KEYS.body, -46, 46, LEVEL.utilityFloor, LEVEL.utilityFloor + 0.1, -5.4, -8.4, '#94938c', M.CONCRETE, { ink: 0.5 });
  for (let x = -40; x < 42; x += 6.2) {
    ctx.only3d(KEYS.metal, x - 0.04, x + 0.04, LEVEL.utilityTop + 0.1, LEVEL.utilityTop - 0.3, -3.0, -2.9, '#6f767d');
    ctx.only3d(KEYS.glow, x - 0.22, x + 0.22, LEVEL.utilityTop - 0.34, LEVEL.utilityTop - 0.28, -3.1, -2.8, col('#ffe2b0'));
  }
  /* steam main wisps get a physical vent here and there */
  for (const vx of [-22.4, -6.2, 17.8, 31.2]) {
    ctx.shell('metal').tubeY('metal', vx, -3.0, LEVEL.utilityTop + 0.4, LEVEL.utilityTop + 1.3, 0.06, 0.09, 8, col('#8d949b'), {});
    ctx.only3d(KEYS.metal, vx - 0.16, vx + 0.16, LEVEL.utilityTop + 1.3, LEVEL.utilityTop + 1.44, -3.16, -2.84, '#7d848b');
  }
}

/* ─────────────────────── upper local line + station ────────────────────── */

function upperLine(ctx) {
  const U = UPPER;
  const R = rng(2024);
  /* the box: floor, two side walls in section at the ends, roof slab */
  ctx.earth.addBox(U.x0, U.x1, U.floorY - 0.2, U.ceilY + 0.2, FRONT, U.z1, 0.62, 0.13);
  ctx.solid(KEYS.body, U.x0, U.x1, U.floorY - 0.7, U.floorY, FRONT, U.z1, '#93968f', M.REBAR, { ink: 0.9 });
  ctx.solid(KEYS.body, U.x0, U.x1, U.ceilY, U.ceilY + 0.6, FRONT, U.z1, '#93968f', M.REBAR, { ink: 0.9 });
  /* invert between the tracks, and the platform deck */
  ctx.solid(KEYS.body, U.x0, U.x1, U.platTop - 0.3, U.platTop, U.platformZ0, U.platformZ1, '#b8b3a6', M.TILE, { ink: 0.9 });
  /* platform edge stone + tactile strip */
  for (const zEdge of [U.platformZ0, U.platformZ1]) {
    ctx.solid(KEYS.body, U.x0, U.x1, U.platTop - 0.32, U.platTop + 0.02, zEdge - (zEdge === U.platformZ0 ? 0.16 : -0.16) * 1, zEdge, '#7f7c74', M.GRANITE, { ink: 0.9 });
  }
  ctx.only3d(KEYS.body, U.x0, U.x1, U.platTop + 0.005, U.platTop + 0.02, U.platformZ0 + 0.18, U.platformZ0 + 0.5, col('#d8c14a'));
  ctx.only3d(KEYS.body, U.x0, U.x1, U.platTop + 0.005, U.platTop + 0.02, U.platformZ1 - 0.5, U.platformZ1 - 0.18, col('#d8c14a'));

  /* back-of-house walls behind each track, tiled, with a base course */
  for (const [zWall, tint] of [[U.platformZ0 + 0.02, '#a9b8b2'], [U.platformZ1 - 0.02, '#9fb0a9']]) {
    ctx.solid(KEYS.body, U.x0, U.x1, U.floorY, U.ceilY - 0.1, zWall - 0.02, zWall + (zWall === U.platformZ0 + 0.02 ? -0.24 : 0.24), tint, M.METRO, { ink: 0.7 });
  }
  /* track beds: ballast, sleepers, rails, third rail */
  for (const zt of [U.trackA, U.trackB]) {
    ctx.only3d(KEYS.body, U.x0 - 26, U.x1 + 26, U.floorY, U.floorY + 0.22, zt - 1.5, zt + 1.5, deep('#5b5a58', 0.2));
    for (let x = U.x0 - 26; x < U.x1 + 26; x += 0.68) {
      ctx.only3d(KEYS.body, x, x + 0.24, U.floorY + 0.2, U.floorY + 0.34, zt - 1.2, zt + 1.2, deep('#4a4038', 0.25));
    }
    for (const rz of [zt - 0.71, zt + 0.71]) {
      ctx.solid(KEYS.metal, U.x0 - 26, U.x1 + 26, U.floorY + 0.34, U.floorY + 0.48, rz - 0.035, rz + 0.035, '#9aa0a6', M.STEEL, { ink: 0.7 });
    }
    /* third rail on its shelf */
    ctx.only3d(KEYS.body, U.x0 - 26, U.x1 + 26, U.floorY + 0.3, U.floorY + 0.42, zt + 1.62, zt + 1.9, deep('#6d7278', 0.15));
    ctx.solid(KEYS.metal, U.x0 - 26, U.x1 + 26, U.floorY + 0.44, U.floorY + 0.56, zt + 1.7, zt + 1.82, '#8d939a', M.STEEL, { ink: 0.8 });
  }

  /* cast-iron columns down the platform centre + canopy */
  for (let x = U.x0 + 2.2; x < U.x1 - 1.2; x += 4.6) {
    ctx.shell('metal').tubeY('metal', x, (U.platformZ0 + U.platformZ1) / 2, U.platTop, U.ceilY - 0.3, 0.14, 0.2, 10, col('#4e5a5e'), {});
    ctx.shell('metal').blob('metal', x, U.platTop + 0.22, (U.platformZ0 + U.platformZ1) / 2, 0.3, col('#4e5a5e'), 8, 4, 0.5);
    ctx.only3d(KEYS.metal, x - 1.5, x + 1.5, U.ceilY - 0.34, U.ceilY - 0.26, U.platformZ0 + 0.3, U.platformZ1 - 0.3, '#5a656a');
  }
  /* lighting strips along the platform */
  for (let x = U.x0 + 1.4; x < U.x1 - 0.6; x += 3.1) {
    ctx.only3d(KEYS.glow, x, x + 1.9, U.ceilY - 0.24, U.ceilY - 0.16, U.platformZ0 + 0.5, U.platformZ1 - 0.5, col('#ffeec8'));
  }
  /* ad panels, route roundel, tiled band on the wall */
  for (let x = U.x0 + 1.2; x < U.x1 - 2.2; x += 5.4) {
    for (const [zw, dir] of [[U.platformZ0 + 0.02, -1], [U.platformZ1 - 0.02, 1]]) {
      ctx.only3d(KEYS.glow, x, x + 2.6, U.platTop + 1.0, U.platTop + 2.35, zw + dir * 0.01, zw + dir * 0.06, col(R.chance(0.5) ? '#c9563c' : '#2f6f9e'));
    }
  }
  /* benches, waste bins, an exit stair up to the street */
  for (let x = U.x0 + 4; x < U.x1 - 4; x += 9.2) {
    ctx.only3d(KEYS.body, x, x + 2.1, U.platTop + 0.44, U.platTop + 0.52, U.platformZ0 + 0.9, U.platformZ0 + 1.5, deep('#6d5a45', 0.1));
    ctx.only3d(KEYS.metal, x + 0.1, x + 0.2, U.platTop, U.platTop + 0.44, U.platformZ0 + 1.1, U.platformZ0 + 1.18, '#7d848b');
    ctx.only3d(KEYS.metal, x + 1.9, x + 2.0, U.platTop, U.platTop + 0.44, U.platformZ0 + 1.1, U.platformZ0 + 1.18, '#7d848b');
  }

  /* the entrance: a stair hall from the platform up to the sidewalk */
  const sx0 = 10.2;
  const sx1 = 13.6;
  ctx.earth.addBox(sx0, sx1, U.platTop - 0.2, 0.4, FRONT, -5.2, 0.42, 0.66);
  ctx.solid(KEYS.body, sx0 - 0.3, sx0, U.platTop, 0.2, FRONT, -5.0, '#99958c', M.CMU, { ink: 0.9 });
  ctx.solid(KEYS.body, sx1, sx1 + 0.3, U.platTop, 0.2, FRONT, -5.0, '#99958c', M.CMU, { ink: 0.9 });
  const rise = (0 - U.platTop + 0.3);
  const nSteps = Math.round(rise / 0.165);
  const run = 4.3;
  for (let i = 0; i < nSteps; i += 1) {
    const y = U.platTop + 0.3 + (rise * i) / nSteps;
    const z = -0.6 - (run * i) / nSteps;
    ctx.only3d(KEYS.body, sx0 + 0.15, sx1 - 0.15, y - 0.06, y, z, z - run / nSteps - 0.02, deep('#9c968c', 0.2));
  }
  for (let i = 0; i < 8; i += 1) {
    const t = i / 8;
    ctx.onlyCut(sx0 + 0.15, sx1 - 0.15, U.platTop + 0.3 + rise * t - 0.2, U.platTop + 0.3 + rise * t + 0.06, M.CONCRETE, '#a5a49c', { z0: -0.6 - run * t - 0.3, z1: -0.6 - run * t + 0.3, ink: 0.6 });
  }
  /* turnstile bank at the top of the stairs */
  for (let i = 0; i < 3; i += 1) {
    const x = sx0 + 0.5 + i * 1.05;
    ctx.only3d(KEYS.metal, x, x + 0.55, -0.05, 1.0, -4.6, -5.0, '#9aa1a8');
    ctx.shell('metal').tubeY('metal', x + 0.28, -4.8, 0.55, 1.05, 0, 0.04, 8, col('#c8452f'), {});
  }

  /* tunnel beyond the station, both directions */
  for (const zt of [U.trackA, U.trackB]) {
    for (const [x0, x1] of [[-46, U.x0], [U.x1, 44]]) {
      ctx.earth.addBoreX(U.floorY + 2.3, zt, 2.95, x0, x1, 0.55, 0.4);
      ctx.shell('body').tubeX('body', U.floorY + 2.3, zt, x0, x1, 2.6, 2.95, 20, col('#c2ccc5'), { a0: -Math.PI * 0.02, a1: Math.PI * 1.02 });
      /* ring joints as shaded bands + service brackets */
      for (let x = Math.max(x0, Math.ceil(x0 / 0.8) * 0.8); x < x1; x += 0.8) {
        ctx.shell('body').tubeX('body', U.floorY + 2.3, zt, x, x + 0.07, 2.58, 2.97, 18, col('#98a49d'), { a0: 0, a1: Math.PI });
      }
      ctx.only3d(KEYS.metal, x0, x1, U.floorY + 3.3, U.floorY + 3.42, zt - 2.2, zt - 2.0, '#6f767d');
      ctx.only3d(KEYS.metal, x0, x1, U.floorY + 0.7, U.floorY + 0.78, zt + 2.25, zt + 2.45, '#6f767d');
    }
  }

  /* signals */
  for (const [sx, zt] of [[U.x0 - 3.4, U.trackA], [U.x1 + 3.0, U.trackA], [U.x0 - 6.0, U.trackB]]) {
    ctx.only3d(KEYS.metal, sx - 0.08, sx + 0.08, U.floorY + 0.4, U.floorY + 2.6, zt + 1.95, zt + 2.11, '#4e565c');
    ctx.only3d(KEYS.body, sx - 0.2, sx + 0.2, U.floorY + 2.6, U.floorY + 3.24, zt + 1.9, zt + 2.16, '#2b3138');
  }
}

/* ─────────────────────────── deep express tube ────────────────────────── */

function expressTube(ctx) {
  const E = EXPRESS;
  const segs = 26;
  ctx.earth.addBoreX(E.cy, E.cz, E.r + 0.42, E.x0, E.x1, 0.72, 0.83);
  /* cast-iron lining built ring by ring so the joints catch the light */
  for (let x = E.x0; x < E.x1; x += 0.78) {
    const shade = 0.86 + 0.16 * ((Math.floor(x / 0.78) % 3) / 3);
    ctx.shell('body').tubeX('body', E.cy, E.cz, x, Math.min(x + 0.74, E.x1), E.r - E.lining, E.r, segs, col('#7e8790').multiplyScalar(shade), { inner: true });
  }
  /* invert slab, walkway, rails, third rail, cable arms */
  ctx.only3d(KEYS.body, E.x0, E.x1, E.invertY - 0.3, E.invertY + 0.06, E.cz - 2.0, E.cz + 2.0, deep('#6e7378', 0.25));
  ctx.only3d(KEYS.body, E.x0, E.x1, E.invertY, E.invertY + 0.12, E.cz + 1.75, E.cz + 2.3, deep('#8a8f94', 0.1));
  for (const rz of [E.cz - 0.76, E.cz + 0.76]) {
    ctx.solid(KEYS.metal, E.x0, E.x1, E.invertY + 0.1, E.invertY + 0.24, rz - 0.035, rz + 0.035, '#a8aeb4', M.STEEL, { ink: 0.7 });
  }
  ctx.solid(KEYS.metal, E.x0, E.x1, E.invertY + 0.3, E.invertY + 0.44, E.cz + 2.35, E.cz + 2.5, '#8d939a', M.STEEL, { ink: 0.7 });
  for (let x = E.x0 + 2; x < E.x1 - 2; x += 7.4) {
    ctx.only3d(KEYS.metal, x, x + 0.12, E.cy + 0.4, E.cy + 2.1, E.cz - 2.62, E.cz - 2.42, '#5f666c');
    ctx.only3d(KEYS.glow, x - 0.3, x + 0.3, E.cy + 2.05, E.cy + 2.2, E.cz - 2.5, E.cz - 2.2, col('#ffdda6'));
  }
  /* the portals where the tube is sawn through by the section */
  for (const px of [-33.5, 30.5]) {
    ctx.shell('body').tubeZ('body', px, E.cy, E.cz - E.r, E.cz + E.r, 0, 0, 8, col('#6f767c'), {});
  }
  /* cross-passage to the local line */
  const passX = 21.5;
  ctx.earth.addBox(passX - 1.3, passX + 1.3, E.cy - 1.6, LEVEL.stationFloor, -3.4, -5.6, 0.4, 0.6);
  ctx.solid(KEYS.body, passX - 1.5, passX + 1.5, E.cy - 1.8, LEVEL.stationFloor + 0.2, -3.5, -3.3, '#8b9298', M.CONCRETE, { ink: 0.8 });
  ctx.solid(KEYS.body, passX - 1.5, passX + 1.5, E.cy - 1.8, LEVEL.stationFloor + 0.2, -5.7, -5.5, '#8b9298', M.CONCRETE, { ink: 0.8 });
  const steps = 34;
  for (let i = 0; i < steps; i += 1) {
    const y = E.cy - 1.5 + ((LEVEL.stationFloor - E.cy + 1.9) * i) / steps;
    const z = -5.4 + (1.9 * i) / steps;
    ctx.only3d(KEYS.body, passX - 1.1, passX + 1.1, y - 0.05, y, z, z - 0.14, deep('#8b9095', 0.2));
  }
}

/* ───────────────────────── service gallery + siding ───────────────────── */

function gallery(ctx) {
  const G = GALLERY;
  ctx.earth.addBox(G.x0, G.x1, G.y0 - 0.2, G.y1 + 0.2, G.z0, G.z1, 0.5, 0.27);
  ctx.solid(KEYS.body, G.x0, G.x1, G.y0 - 0.4, G.y0, G.z0, G.z1, '#8f8e87', M.REBAR, { ink: 0.8 });
  ctx.solid(KEYS.body, G.x0, G.x1, G.y1, G.y1 + 0.4, G.z0, G.z1, '#8f8e87', M.REBAR, { ink: 0.8 });
  ctx.solid(KEYS.body, G.x0, G.x1, G.y0, G.y1, G.z1 - 0.3, G.z1, '#9a958c', M.CMU, { ink: 0.8 });
  /* rail, a parked maintenance car, racks, lamps, a puddle */
  for (const rz of [G.z0 + 1.2, G.z0 + 3.0]) {
    ctx.solid(KEYS.metal, G.x0, G.x1, G.y0 + 0.1, G.y0 + 0.22, rz - 0.03, rz + 0.03, '#9aa0a6', M.STEEL, { ink: 0.6 });
  }
  ctx.only3d(KEYS.body, G.x0, G.x1, G.y0, G.y0 + 0.1, G.z0 + 3.9, G.z1 - 0.5, deep('#7f8288', 0.2));
  for (let x = G.x0 + 1.4; x < G.x1 - 1; x += 3.8) {
    ctx.only3d(KEYS.glow, x - 0.2, x + 0.2, G.y1 - 0.3, G.y1 - 0.22, G.z0 + 0.6, G.z0 + 1.0, col('#ffe6ba'));
  }
  for (let x = G.x0 + 0.8; x < G.x1 - 1; x += 2.4) {
    ctx.only3d(KEYS.metal, x, x + 1.4, G.y1 - 1.5, G.y1 - 0.5, G.z1 - 0.9, G.z1 - 0.4, deep('#5f666c', 0.2));
    for (let i = 0; i < 4; i += 1) {
      ctx.only3d(KEYS.metal, x + 0.1, x + 1.3, G.y1 - 1.3 + i * 0.24, G.y1 - 1.24 + i * 0.24, G.z1 - 0.85, G.z1 - 0.45, jitterColor('#c8b98a', R2, 0.2));
    }
  }
  /* sump, drips and a puddle with a reflection of the lamp */
  ctx.only3d(KEYS.body, G.x0 + 6, G.x0 + 9, G.y0 - 0.3, G.y0 + 0.02, G.z0 + 4.4, G.z0 + 6.0, col('#4a5a66'));
}
const R2 = rng(4711);

/* ─────────────────────────── street vaults ────────────────────────────── */

function streetVaults(ctx) {
  const R = rng(606);
  for (const v of STREET.vaultLight) {
    const x0 = v.x - 1.9;
    const x1 = v.x + 1.9;
    ctx.earth.addBox(x0, x1, -3.1, -0.55, -1.0, -4.6, 0.3, R());
    /* brick arch in section: the frame reads as the vault lining */
    ctx.hollow(KEYS.body, x0, x1, -3.2, -0.5, -1.0, -4.6, '#8f6a52', M.BRICK, 0.24, { ink: 0.9 });
    ctx.only3d(KEYS.body, x0 - 0.1, x1 + 0.1, -0.62, -0.5, -1.05, -4.7, deep('#8b857a', 0.2));
    /* hatch in the sidewalk + a slab of light escaping */
    ctx.only3d(KEYS.metal, v.x - 0.4, v.x + 0.4, -0.02, 0.06, -1.6, -0.9, '#6f767d');
    ctx.only3d(KEYS.glow, v.x - 0.34, v.x + 0.34, -0.1, -0.05, -1.5, -1.0, col('#ffcf8e'));
    ctx.only3d(KEYS.body, x0 + 0.3, x1 - 0.3, -3.1, -3.0, -1.0, -4.5, deep('#6b6055', 0.3));
  }
}

/* ────────────────────────────── driver ────────────────────────────────── */

export function buildBelow(ctx) {
  prepareBuildings();
  for (const b of BUILDINGS) cellars(ctx, b);
  foundations(ctx);
  services(ctx);
  upperLine(ctx);
  expressTube(ctx);
  gallery(ctx);
  streetVaults(ctx);
}
