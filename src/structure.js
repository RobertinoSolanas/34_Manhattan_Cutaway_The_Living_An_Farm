/**
 * src/structure.js — the anatomy of the street wall.
 *
 * Facades, floor slabs (finish / screed / rebar-reinforced deck / fireproofing),
 * brick bearing walls in wythe, party walls with joist pockets, elevator shafts
 * with guide rails and counterweight pockets, switch-back stairs cut as the
 * stepped profile they really are, roof build-ups with insulation and membrane,
 * the rooftop water tank with a live water level, and the context buildings
 * that close the block behind.
 */

import * as THREE from 'three';
import { M } from './section.js';
import { KEYS } from './mat.js';
import { BUILDINGS, BAND, CONTEXT, CUT_MIN } from './layout.js';
import { col, rng, lerp, clamp } from './util.js';
import { deep, jitterColor } from './build.js';

const SLAB = 0.23;

export function floorFinish(type) {
  if (type === 'bath' || type === 'laundry' || type === 'vault' || type === 'parking' || type === 'boiler'
    || type === 'storage' || type === 'mechanical' || type === 'lobby' || type === 'bankLobby'
    || type === 'freight' || type === 'garage' || type === 'electrical' || type === 'sump' || type === 'coal') return M.TILE;
  if (type === 'diner' || type === 'retail' || type === 'office' || type === 'meeting' || type === 'clinic'
    || type === 'clinicExam' || type === 'lunch' || type === 'strongroom') return M.TERRAZZO;
  return M.WOOD;
}

/** compute y levels for every floor and cellar, memoised on the building */
export function prepareBuildings() {
  for (const b of BUILDINGS) {
    const w = b.wall || {};
    b.wt = w.x ?? (b.kind === 'glass' ? 0.32 : 0.44);
    b.party = w.party ?? 0.62;
    b.fz = b.facade?.z0 ?? -0.62;
    b.frontWallZ1 = b.fz;
    b.frontWallZ0 = b.fz - (b.kind === 'glass' ? 0.14 : b.wt);
    b.backZ = -13.4;
    let y = 0;
    b.levels = [];
    for (let i = 0; i < b.floors.length; i += 1) {
      const f = b.floors[i];
      b.levels.push({ i, y0: y, h: f.h, rooms: f.rooms, top: y + f.h, kind: 'floor' });
      y += f.h;
    }
    b.top = y;
    b.cellars = [];
    let cy = 0;
    for (const c of b.basement || []) {
      b.cellars.push({ y0: c.y, h: c.h, rooms: c.rooms, top: c.y + c.h, kind: 'cellar' });
      cy = c.y;
    }
    b.bottom = b.cellars.length ? b.cellars[b.cellars.length - 1].y0 : 0;
    b.R = rng(hashId(b.id));
  }
  return BUILDINGS;
}

function hashId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FINISH_TINT = {
  [M.WOOD]: '#a5763f',
  [M.TERRAZZO]: '#c8c3b8',
  [M.TILE]: '#dfe2df',
};

/* ──────────────────────────── slabs ───────────────────────────────────── */

function slabBands(ctx, b, yTop, z0, z1, rooms, opts = {}) {
  const inner0 = b.x0 + b.party;
  const inner1 = b.x1 - b.party;
  const finishT = 0.035;
  const fire = 0.03;
  const concTop = yTop - finishT;
  const concBot = yTop - SLAB + fire;

  /* reinforced concrete deck, cut with rebar dots */
  ctx.solid(KEYS.body, inner0, inner1, concBot, concTop, z0, z1, '#a8a79f', M.REBAR, { ink: 1.0 });
  /* fireproofing / gypsum on the soffit */
  ctx.onlyCut(inner0, inner1, concBot - fire, concBot, M.PLASTER, '#c9c2b6', { z0, z1, ink: 0.8 });

  /* per-room floor finish so the cut reads kitchen ≠ lobby ≠ bedroom */
  for (const room of rooms) {
    const fin = floorFinish(room.type);
    ctx.onlyCut(Math.max(inner0, room.x0), Math.min(inner1, room.x1), concTop, yTop, fin, FINISH_TINT[fin], { z0, z1, ink: 0.85 });
  }
  /* slab edge at the party walls */
  ctx.onlyCut(b.x0, inner0, concBot - fire, concTop, M.CONCRETE, '#a8a79f', { z0, z1, ink: 0.8 });
  ctx.onlyCut(inner1, b.x1, concBot - fire, concTop, M.CONCRETE, '#a8a79f', { z0, z1, ink: 0.8 });

  if (opts.ceilingTiles !== false) {
    /* suspended ceiling grid, hung below the deck */
    const cy = yTop - SLAB - 0.16;
    ctx.only3d(KEYS.body, inner0, inner1, cy, cy + 0.025, z0 + 0.2, z1 + 0.05, deep('#ded9cd', 0.25));
    ctx.onlyCut(inner0, inner1, cy, cy + 0.025, M.PLASTER, '#e0dbcf', { z0, z1, ink: 0.5 });
  }
}

/* ──────────────────────────── walls ───────────────────────────────────── */

function brickWall(ctx, x0, x1, y0, y1, z0, z1, tint, opts = {}) {
  ctx.solid(KEYS.body, x0, x1, y0, y1, z0, z1, tint, (x1 - x0) > 0.34 ? M.BRICK_WYTHE : M.BRICK, { ink: 1.0, ...opts });
}

function partitionsForFloor(ctx, b, lv, z0, z1) {
  const R = b.R;
  const yTop = lv.y0;
  const yBot = lv.y0 - lv.h + SLAB + 0.18;
  const rooms = lv.rooms.filter((r) => r.band === 'front' || !r.band);
  for (let i = 1; i < rooms.length; i += 1) {
    const x = rooms[i].x0;
    const thick = R.chance(0.4) ? 0.22 : 0.12;
    const tint = R.chance(0.25) ? '#b8b3a8' : jitterColor('#cfc7b8', R, 0.06);
    ctx.solid(KEYS.body, x - thick / 2, x + thick / 2, yBot, yTop - SLAB, z0, z1, tint, M.PLASTER, { ink: 0.9 });
  }
  /* a deeper partition line so the second bay also reads */
  const zMid = BAND.mid[0];
  const in0 = b.x0 + b.party;
  const in1 = b.x1 - b.party;
  ctx.solid(KEYS.body, in0, in1, yBot, yTop - SLAB, zMid - 0.12, zMid, deep('#b9b2a6', 0.45), undefined, {});
  ctx.onlyCut(in0 + 0.6, in1 - 0.6, yBot, yTop - SLAB, M.PLASTER, '#b9b2a6', { z0: zMid - 0.12, z1: zMid, ink: 0.5 });
  /* doorway gaps punched in that deep wall */
  for (let i = 0; i < rooms.length; i += 1) {
    const dx = rooms[i].x0 + 0.8 + (i * 1.7) % 2.2;
    if (dx > in1 - 1) continue;
    ctx.only3d(KEYS.body, dx, dx + 1.0, yBot, yTop - SLAB - 0.15, zMid - 0.14, zMid + 0.02, deep('#8e9aa2', 0.2));
  }
}

/* ──────────────────────────── facades ─────────────────────────────────── */

function facadeBrick(ctx, b, levels) {
  const R = b.R;
  const zOut = b.fz;
  const t = b.wt;
  const zIn = zOut - t;
  const bays = b.facade.bays || 5;
  const brick = b.facade.brick || '#a8452f';
  const trim = b.facade.trim || '#c8a277';
  const span = b.x1 - b.x0;
  const pitch = span / bays;

  for (const lv of levels) {
    const isStore = lv.i === 0;
    const sill = isStore ? 0.28 : 0.95;
    const head = lv.h - (isStore ? 0.55 : 0.78);
    const winH = head - sill;
    if (winH < 0.5) continue;
    for (let i = 0; i < bays; i += 1) {
      const cx = b.x0 + pitch * (i + 0.5);
      const ww = isStore ? Math.min(2.6, pitch - 0.85) : Math.min(1.5, pitch - 1.5);
      const x0 = cx - ww / 2;
      const x1 = cx + ww / 2;
      /* glazing + frame */
      ctx.only3d(KEYS.glass, x0, x1, lv.y0 + sill, lv.y0 + head, zOut + 0.01, zOut - 0.06, col('#9dc0cf'));
      ctx.only3d(KEYS.body, x0 - 0.05, x1 + 0.05, lv.y0 + sill - 0.06, lv.y0 + sill, zOut - 0.1, zOut + 0.04, trim);
      ctx.only3d(KEYS.body, x0 - 0.06, x1 + 0.06, lv.y0 + head, lv.y0 + head + 0.09, zOut - 0.12, zOut + 0.05, trim);
      /* muntins */
      const nDiv = Math.max(1, Math.round(ww / 0.75));
      for (let k = 1; k < nDiv; k += 1) {
        const mx = x0 + (ww * k) / nDiv;
        ctx.only3d(KEYS.body, mx - 0.02, mx + 0.02, lv.y0 + sill, lv.y0 + head, zOut - 0.03, zOut + 0.02, '#6f6a62');
      }
      if (R.chance(0.35)) {
        ctx.only3d(KEYS.body, x0 - 0.16, x1 + 0.16, lv.y0 + head + 0.09, lv.y0 + head + 0.16, zOut - 0.2, zOut + 0.06, deep('#5d5a53', 0.2));
      }
      /* the section through this opening: frame + glass */
      ctx.onlyCut(x0 - 0.05, x1 + 0.05, lv.y0 + sill, lv.y0 + head, M.GLASS, '#a9d2dc', { z0: zIn, z1: zOut, ink: 0.9 });
    }
    /* piers and spandrels between the openings */
    let x = b.x0;
    const segments = [];
    for (let i = 0; i < bays; i += 1) {
      const cx = b.x0 + pitch * (i + 0.5);
      const ww = isStore ? Math.min(2.6, pitch - 0.85) : Math.min(1.5, pitch - 1.5);
      segments.push([x, cx - ww / 2]);
      x = cx + ww / 2;
    }
    segments.push([x, b.x1]);
    for (const [a, c] of segments) {
      if (c - a < 0.06) continue;
      ctx.solid(KEYS.body, a, c, lv.y0, lv.y0 + lv.h, zIn, zOut, brick, M.BRICK, { ink: 0.95 });
    }
    /* spandrels above and below the window band across the whole frontage */
    ctx.solid(KEYS.body, b.x0, b.x1, lv.y0, lv.y0 + sill, zIn, zOut, brick, M.BRICK, { ink: 0.9 });
    ctx.solid(KEYS.body, b.x0, b.x1, lv.y0 + head, lv.y0 + lv.h, zIn, zOut, brick, M.BRICK, { ink: 0.9 });
    /* belt course */
    ctx.only3d(KEYS.body, b.x0 - 0.06, b.x1 + 0.06, lv.y0 - 0.02, lv.y0 + 0.1, zOut - 0.16, zOut + 0.08, trim);
  }
}

function facadeGlass(ctx, b, levels) {
  const zOut = b.fz;
  const t = 0.14;
  const zIn = zOut - t;
  const glassC = b.facade.glass || '#9dc4d2';
  const mull = b.facade.mullion || '#7d8a93';
  const pitch = 1.35;
  for (const lv of levels) {
    const vision = lv.h - 0.95;
    ctx.only3d(KEYS.glass, b.x0, b.x1, lv.y0 + 0.72, lv.y0 + lv.h - 0.23, zOut, zOut - 0.04, col(glassC));
    for (let x = b.x0; x < b.x1; x += pitch) {
      ctx.only3d(KEYS.metal, x, x + 0.07, lv.y0, lv.y0 + lv.h, zOut - 0.09, zOut + 0.05, mull);
    }
    /* spandrel over the slab edge with a back-painted panel */
    ctx.solid(KEYS.body, b.x0, b.x1, lv.y0 - 0.23, lv.y0 + 0.72, zIn, zOut, '#8f9ba3', M.MEMBRANE, { ink: 0.8 });
    ctx.only3d(KEYS.metal, b.x0, b.x1, lv.y0 + 0.7, lv.y0 + 0.78, zOut - 0.1, zOut + 0.06, mull);
    ctx.only3d(KEYS.metal, b.x0, b.x1, lv.y0 + lv.h - 0.26, lv.y0 + lv.h - 0.19, zOut - 0.1, zOut + 0.06, mull);
    /* cut: curtain wall profile — glass, gasket, pressure plate, insulated spandrel */
    ctx.onlyCut(b.x0, b.x1, lv.y0 + 0.72, lv.y0 + lv.h - 0.23, M.GLASS, glassC, { z0: zIn, z1: zOut, ink: 0.8 });
  }
}

/* ──────────────────────────── shafts & stairs ─────────────────────────── */

function elevatorShaft(ctx, b, shaft, levels, top) {
  const R = b.R;
  const half = shaft.shaftW / 2;
  const x0 = shaft.x - half;
  const x1 = shaft.x + half;
  const t = 0.24;
  const z0 = -3.15;
  const z1 = -5.6;
  const yBot = b.bottom - 0.4;
  /* shaft walls — these are cut, so they read as reinforced concrete with rebar */
  ctx.solid(KEYS.body, x0 - t, x0, yBot, top + 1.6, z0, z1, '#9d9c95', M.REBAR, { ink: 1 });
  ctx.solid(KEYS.body, x1, x1 + t, yBot, top + 1.6, z0, z1, '#9d9c95', M.REBAR, { ink: 1 });
  /* back wall of the hoistway */
  ctx.only3d(KEYS.body, x0 - t, x1 + t, yBot, top + 1.6, z1 - 0.2, z1, deep('#7f8080', 0.5));
  /* guide rails */
  for (const rx of [x0 + 0.24, x1 - 0.24]) {
    ctx.only3d(KEYS.metal, rx - 0.05, rx + 0.05, yBot, top + 1.4, z0 + 0.55, z0 + 0.75, '#7d858d');
  }
  /* counterweight pocket + ropes */
  ctx.only3d(KEYS.metal, x1 - 0.55, x1 - 0.1, yBot, top + 1.0, z1 - 0.55, z1 - 0.15, '#5c646c');
  /* machine room on the roof */
  const mrY = top + 0.2;
  ctx.solid(KEYS.body, x0 - t - 0.25, x1 + t + 0.25, mrY, mrY + 2.5, z0 - 0.3, z1 + 0.4, '#8f8d85', M.CMU, { ink: 0.9 });
  ctx.only3d(KEYS.metal, x0 - 0.2, x1 + 0.2, mrY + 1.5, mrY + 2.0, z0 + 0.4, z0 + 1.5, '#6d757d');
  /* per-floor doors: 3D recess; the sliding leaves are dynamic (see living.js) */
  b.shaftDoors = b.shaftDoors || [];
  for (const lv of [...b.cellars].reverse().concat(levels)) {
    b.shaftDoors.push({ x: shaft.x, w: shaft.shaftW * 0.92, y: lv.y0, z: z0 + 0.1, shaft: shaft.x });
    ctx.only3d(KEYS.body, x0 + 0.02, x1 - 0.02, lv.y0, lv.y0 + 2.35, z0 - 0.05, z0 + 0.12, deep('#8b9299', 0.15));
  }
  shaft.geo = { x0, x1, z0, z1, yBot, t };
}

function stairwell(ctx, b, stair, levels) {
  const x0 = stair.x0;
  const x1 = stair.x1;
  const zFront = -1.75;
  const zBack = -6.4;
  /* enclosure walls (cut → concrete/ plaster strips) */
  ctx.solid(KEYS.body, x0 - 0.2, x0, b.bottom, b.top + 0.4, zFront, zBack, '#b6b0a4', M.PLASTER, { ink: 0.95 });
  ctx.solid(KEYS.body, x1, x1 + 0.2, b.bottom, b.top + 0.4, zFront, zBack, '#b6b0a4', M.PLASTER, { ink: 0.95 });
  ctx.only3d(KEYS.body, x0, x1, b.bottom, b.top + 0.4, zBack - 0.18, zBack, deep('#9c968a', 0.55));

  b.stairPaths = [];
  for (const lv of [...b.cellars].reverse().concat(levels)) {
    const yTop = lv.y0 + lv.h;
    const rise = (lv.h - SLAB) / 2;
    const run = 2.55;
    const steps = 11;
    /* flight 1: from this floor going back */
    for (let s = 0; s < steps; s += 1) {
      const t0 = s / steps;
      const y = lv.y0 + rise * t0;
      const z = zFront + 0.1 - (run * t0);
      ctx.only3d(KEYS.body, x0 + 0.05, x1 - 0.05, y, y + 0.06, z, z - run / steps + 0.02, deep('#a9a297', 0.28));
    }
    /* stepped cut profile — what the plane really removes */
    for (let s = 0; s < 5; s += 1) {
      const t0 = s / 5;
      const y = lv.y0 + rise * t0;
      ctx.onlyCut(x0 + 0.05, x1 - 0.05, y - 0.18, y, M.CONCRETE, '#a5a49c', { z0: zFront - 0.4, z1: zFront + 0.05, ink: 0.7 });
    }
    /* landing */
    ctx.only3d(KEYS.body, x0 + 0.05, x1 - 0.05, yTop - SLAB - 0.02, yTop - SLAB, zFront - run, zFront - run - 1.5, deep('#b3ada1', 0.35));
    /* flight 2 up to the next level */
    for (let s = 0; s < steps; s += 1) {
      const t0 = s / steps;
      const y = lv.y0 + rise + rise * t0;
      const z = zFront - run - 1.5 + (run * t0) * 0.98;
      ctx.only3d(KEYS.body, x0 + 0.05, x1 - 0.05, y, y + 0.06, z, z - run / steps + 0.02, deep('#a9a297', 0.4));
    }
    /* handrail */
    ctx.only3d(KEYS.metal, x0 + 0.28, x0 + 0.33, lv.y0 + 0.5, lv.y0 + 0.56, zFront - 0.1, zFront - run - 1.5, '#8d949b');
    b.stairPaths.push({ x: (x0 + x1) / 2, y0: lv.y0, y1: yTop, zFront: zFront + 0.05, zBack: zFront - run - 1.45 });
  }
}

/* ───────────────────────────── roofs ──────────────────────────────────── */

function roofBuildup(ctx, b) {
  const y = b.top;
  const in0 = b.x0;
  const in1 = b.x1;
  const z0 = b.frontWallZ0;
  const z1 = b.backZ;
  ctx.solid(KEYS.body, in0, in1, y - 0.02, y + 0.12, z0, z1, '#9c9b93', M.REBAR, { ink: 1 });
  ctx.solid(KEYS.body, in0, in1, y + 0.12, y + 0.26, z0, z1, '#3f444b', M.INSULATION, { ink: 0.9 });
  ctx.onlyCut(in0, in1, y + 0.26, y + 0.29, M.TAR, '#24272c', { z0, z1, ink: 0.8 });
  ctx.onlyCut(in0, in1, y + 0.29, y + 0.35, M.GRANITE, '#9a9891', { z0, z1: z0 + 2.2, ink: 0.7 });
  /* parapet */
  const pt = 0.3;
  ctx.only3d(KEYS.body, in0, in0 + pt, y + 0.3, y + 1.25, z0, z0 + 0.42, '#8e8a82');
  ctx.only3d(KEYS.body, in1 - pt, in1, y + 0.3, y + 1.25, z0, z0 + 0.42, '#8e8a82');
  ctx.only3d(KEYS.metal, in0 - 0.06, in0 + pt + 0.06, y + 1.25, y + 1.32, z0 - 0.08, z0 + 0.5, '#7d858c');
  ctx.onlyCut(in0, in0 + pt, y + 0.3, y + 1.25, M.BRICK, b.facade?.brick || '#a8452f', { z0, z1: z0 + 0.42, ink: 0.9 });
  ctx.onlyCut(in1 - pt, in1, y + 0.3, y + 1.25, M.BRICK, b.facade?.brick || '#a8452f', { z0, z1: z0 + 0.42, ink: 0.9 });
}

function waterTower(ctx, b) {
  const cx = b.x0 + 5.4;
  const cz = -4.6;
  const r = 2.95;
  const legY0 = b.top + 0.35;
  const baseY = legY0 + 2.1;
  const tankTop = baseY + 3.5;
  /* legs */
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.62;
    const lx = cx + Math.cos(a) * (r - 0.35);
    const lz = cz + Math.sin(a) * (r - 0.35);
    ctx.only3d(KEYS.metal, lx - 0.11, lx + 0.11, legY0, baseY, lz - 0.11, lz + 0.11, '#6b7178');
  }
  ctx.only3d(KEYS.metal, cx - r, cx + r, baseY - 0.16, baseY, cz - 0.16, cz + 0.16, '#767d84');
  ctx.only3d(KEYS.metal, cx - 0.16, cx + 0.16, baseY - 0.16, baseY, cz - r, cz + r, '#767d84');
  /* tank shell ( riveted steel, tapered ) */
  ctx.shell(KEYS.metal).tubeY('metal', cx, cz, baseY, tankTop, r - 0.05, r, 22, col('#8b8272'), {});
  ctx.shell(KEYS.metal).tubeY('metal', cx, cz, baseY - 0.3, baseY, r * 0.72, r, 22, col('#7d7566'), {});
  /* conical roof */
  for (let i = 0; i < 22; i += 1) {
    const a0 = (i / 22) * Math.PI * 2;
    const a1 = ((i + 1) / 22) * Math.PI * 2;
    ctx.shell(KEYS.metal).tri('metal',
      cx + Math.cos(a0) * r, tankTop + 0.05, cz + Math.sin(a0) * r,
      cx + Math.cos(a1) * r, tankTop + 0.05, cz + Math.sin(a1) * r,
      cx, tankTop + 1.55, cz, col('#6e665a'));
  }
  ctx.only3d(KEYS.metal, cx - 0.09, cx + 0.09, tankTop + 1.4, tankTop + 2.1, cz - 0.09, cz + 0.09, '#5e6068');
  /* ladder + platform */
  for (let i = 0; i < 9; i += 1) {
    const y = baseY + i * 0.42;
    ctx.only3d(KEYS.metal, cx + r - 0.02, cx + r + 0.5, y, y + 0.05, cz - 0.24, cz - 0.19, '#7d848b');
  }
  /* the section: two shell strips, the water, the air space — recomputed as the cut moves */
  const lvlRef = { h: 0.62 };
  b.waterLevel = lvlRef;
  ctx.skin.dyn(6, (w, cut) => {
    const dz = cut - cz;
    if (Math.abs(dz) > r) {
      for (let k = 0; k < 6; k += 1) w.box(-0.01, 0.01, 0, 0.01, M.STEEL, '#8f9aa4', { z0: 999, z1: 999 });
      return;
    }
    const hw = Math.sqrt(r * r - dz * dz);
    const t = 0.075;
    const wl = baseY + 0.15 + (tankTop - 0.35 - baseY) * lvlRef.h;
    w.box(cx - hw - t, cx - hw + t, baseY, tankTop, M.STEEL, '#96a0a8', { ink: 1 });
    w.box(cx + hw - t, cx + hw + t, baseY, tankTop, M.STEEL, '#96a0a8', { ink: 1 });
    w.box(cx - hw + t, cx + hw - t, baseY - 0.02, wl, M.WATER, '#3b6f8c', { ink: 0.9 });
    w.box(cx - hw + t, cx + hw - t, wl, wl + 0.035, M.STEEL, '#cfe2ea', { ink: 0.6 });
    /* rivet rows suggested by the steel pattern; add the overflow pipe */
    w.box(cx + hw - 0.1, cx + hw + 0.55, baseY - 0.55, baseY - 0.45, M.IRON, '#6f7681', { ink: 0.8 });
    w.box(cx - hw - 0.5, cx - hw - 0.34, tankTop + 1.2, tankTop + 2.0, M.IRON, '#6f7681', { ink: 0.8 });
  });
  /* riser down through the building */
  ctx.tubeZ(KEYS.metal, cx, cz, b.top - 0.2, b.bottom + 0.6, 0.1, 0.14, 10, '#6f7681', M.IRON, {});
  return { cx, cz, r, baseY, tankTop };
}

function roofPlant(ctx, b, R) {
  const y = b.top + 0.35;
  const z0 = -2.6;
  const n = b.kind === 'glass' ? 4 : 2;
  for (let i = 0; i < n; i += 1) {
    const x = b.x0 + 2.4 + i * ((b.x1 - b.x0 - 4.8) / Math.max(1, n - 1));
    ctx.only3d(KEYS.metal, x - 0.9, x + 0.9, y, y + 0.85, z0 - 0.8, z0 + 0.8, '#8d949a');
    ctx.only3d(KEYS.metal, x - 0.55, x + 0.55, y + 0.85, y + 1.0, z0 - 0.5, z0 + 0.5, '#6f767c');
    ctx.only3d(KEYS.metal, x - 0.3, x + 0.3, y + 1.0, y + 1.7, z0 - 0.3, z0 + 0.3, '#7c848b');
    ctx.shell(KEYS.metal).tubeX('metal', y + 0.45, z0 + 1.4, x - 0.8, x + 0.8, 0, 0.18, 8, col('#767d84'), {});
  }
  /* vent pipes, skylight, exhaust cowls */
  for (let i = 0; i < 5; i += 1) {
    const x = b.x0 + 1.4 + R() * (b.x1 - b.x0 - 2.8);
    const z = -3.4 - R() * 6.4;
    ctx.only3d(KEYS.metal, x - 0.09, x + 0.09, y, y + 0.6 + R() * 0.6, z - 0.09, z + 0.09, '#6d747a');
  }
  const skx = (b.x0 + b.x1) / 2;
  ctx.only3d(KEYS.glass, skx - 1.6, skx + 1.6, y, y + 0.22, -5.6, -3.2, col('#a9c8d2'));
  ctx.only3d(KEYS.metal, skx - 1.7, skx + 1.7, y - 0.06, y + 0.05, -5.7, -3.1, '#7d858c');
}

/* ───────────────────────── context, background ────────────────────────── */

function contextBlocks(ctx) {
  const R = rng(99);
  const zBack = CONTEXT.backZ;
  const mk = (cfg, side) => {
    const brick = side === 'left' ? '#8f5040' : '#7b6a5f';
    for (let z = zBack - 1.2; z > -26; z -= 4.2) {
      const top = cfg.top * (0.8 + R() * 0.35);
      ctx.only3d(KEYS.dark, cfg.x0, cfg.x1, -9, top, z - 3.6, z, deep(brick, 0.42));
      for (let y = 1.6; y < top - 1.2; y += 3.5) {
        for (let x = cfg.x0 + 1.2; x < cfg.x1 - 1.2; x += 2.6) {
          const lit = R.chance(0.3);
          ctx.only3d(KEYS.dark, x, x + 1.25, y, y + 1.6, z - 3.7, z - 3.55, lit ? '#4a5a68' : deep('#2c3740', 0.3));
        }
      }
    }
  };
  mk(CONTEXT.left, 'left');
  mk(CONTEXT.right, 'right');

  /* the deep background of the block behind the cut: merged, dim, endless */
  for (let z = -14.2; z > -34; z -= 3.4) {
    const h = 14 + R() * 26;
    const x0 = -44 + R() * 18;
    const w = 16 + R() * 26;
    ctx.only3d(KEYS.dark, x0, x0 + w, -6, h, z - 3.0, z, deep('#3f4a55', 0.5 - (z + 14) / 60));
    for (let y = 0; y < h - 2; y += 3.6) {
      for (let x = x0 + 1.4; x < x0 + w - 1.6; x += 2.4) {
        if (!R.chance(0.24)) continue;
        ctx.only3d(KEYS.dark, x, x + 1.1, y + 0.6, y + 2.0, z - 3.1, z - 2.95, '#5d7183');
      }
    }
  }
}

function skyline(ctx) {
  const R = rng(4242);
  const z = CONTEXT.skyline.z;
  for (let i = 0; i < CONTEXT.skyline.count; i += 1) {
    const x = -190 + R() * 380;
    const w = 8 + R() * 22;
    const h = 20 + Math.pow(R(), 1.7) * 150;
    ctx.only3d(KEYS.dark, x, x + w, 0, h, z - R() * 40, z, deep('#5b7186', 0.18));
    for (let y = 3; y < h - 2; y += 4.2) {
      for (let xx = x + 1; xx < x + w - 1; xx += 2.8) {
        if (!R.chance(0.2)) continue;
        ctx.only3d(KEYS.dark, xx, xx + 1.2, y, y + 2.0, z - 0.6, z, '#7d93a6');
      }
    }
  }
}

/* ─────────────────────────────── driver ───────────────────────────────── */

export function buildStructures(ctx) {
  prepareBuildings();
  for (const b of BUILDINGS) {
    const R = b.R;
    if (b.kind === 'ruin') {
      buildRuinLot(ctx, b);
      continue;
    }
    /* party walls */
    const z0 = b.frontWallZ0;
    brickWall(ctx, b.x0, b.x0 + b.party, b.bottom, b.top + 1.3, z0, b.backZ, b.facade?.brick || '#8a3625');
    brickWall(ctx, b.x1 - b.party, b.x1, b.bottom, b.top + 1.3, z0, b.backZ, b.facade?.brick || '#8a3625');
    /* rear wall */
    ctx.solid(KEYS.body, b.x0 + b.party, b.x1 - b.party, b.bottom - 0.3, b.top + 0.4, b.backZ - 0.34, b.backZ, '#9c968c', M.CMU, { ink: 0.85 });
    for (let i = 0; i < 6; i += 1) {
      const x = b.x0 + 1.6 + R() * (b.x1 - b.x0 - 3.2);
      ctx.only3d(KEYS.glass, x, x + 1.1, b.bottom + 1.2 + Math.floor(R() * 3) * 3.4, b.bottom + 3.0 + Math.floor(R() * 3) * 3.4, b.backZ - 0.36, b.backZ - 0.28, col('#7f97a4'));
    }

    /* front wall + facade */
    if (b.kind === 'glass') facadeGlass(ctx, b, b.levels);
    else facadeBrick(ctx, b, b.levels);

    /* slabs, partitions */
    const allLevels = [...b.cellars].reverse().concat(b.levels);
    for (const lv of allLevels) {
      const zTop = lv.kind === 'floor' ? b.frontWallZ0 : -2.05;
      slabBands(ctx, b, lv.y0, zTop, b.backZ, lv.rooms);
      partitionsForFloor(ctx, b, lv, b.frontWallZ0, BAND.mid[0]);
    }
    /* bottom slab / cellar floor */
    const yb = b.bottom - (b.cellars.length ? 0.0 : 0);
    slabBands(ctx, b, b.cellars.length ? b.cellars[b.cellars.length - 1].y0 : 0, -2.05, b.backZ, [{ x0: b.x0, x1: b.x1, type: 'storage' }]);

    /* shafts + stairs */
    for (const s of b.elevators || []) elevatorShaft(ctx, b, s, b.levels, b.top);
    if (b.stair) stairwell(ctx, b, b.stair, b.levels);

    /* roof */
    roofBuildup(ctx, b);
    if (b.roof?.type === 'watertower') {
      b.waterTower = waterTower(ctx, b);
      roofPlant(ctx, b, R);
    } else if (b.roof?.type === 'terrace') {
      roofPlant(ctx, b, R);
      for (let i = 0; i < 7; i += 1) {
        const x = b.x0 + 1.2 + R() * (b.x1 - b.x0 - 2.4);
        ctx.only3d(KEYS.body, x - 0.35, x + 0.35, b.top + 0.35, b.top + 0.75, -3.2 - R() * 3, -3.9 - R() * 3, '#6d5a48');
        ctx.shell(KEYS.body).blob('body', x, b.top + 0.95, -3.6, 0.5 + R() * 0.3, col('#3f7a45'), 7, 4, 0.8);
      }
    } else {
      roofPlant(ctx, b, R);
    }
  }
  contextBlocks(ctx);
  skyline(ctx);
}

function buildRuinLot(ctx, b) {
  const R = rng(777);
  const z0 = -1.6;
  const z1 = -12.6;
  /* two charred party walls with the ghosts of the removed floors */
  for (const [xa, xb] of [[b.x0, b.x0 + 0.62], [b.x1 - 0.62, b.x1]]) {
    ctx.solid(KEYS.body, xa, xb, -7.4, 7.4, z0, z1, '#6d5a52', M.BRICK_WYTHE, { ink: 1 });
  }
  for (let y = 3.2; y < 7.0; y += 3.3) {
    ctx.onlyCut(b.x0 + 0.62, b.x1 - 0.62, y - 0.1, y + 0.1, M.TAR, '#3a3330', { z0: -12.6, z1: -1.6, ink: 0.6 });
    for (let i = 0; i < 5; i += 1) {
      const x = b.x0 + 1.1 + i * 0.66;
      ctx.onlyCut(x, x + 0.2, y - 0.16, y + 0.02, M.WOOD, '#5a4634', { z0: -8.4, z1: -2.2, ink: 0.7 });
    }
  }
  /* the ragged top of the wall where the building was taken down */
  for (let x = b.x0; x < b.x1 - 0.3; x += 0.34) {
    const h = 6.6 + R() * 1.5;
    ctx.onlyCut(x, x + 0.34, h - 0.3, h, M.BRICK, '#6d5a52', { z0: -6.0, z1: -1.7, ink: 0.7 });
  }
  /* hoarding, rubble and a chain-link fence at street level */
  ctx.only3d(KEYS.body, b.x0 + 0.4, b.x1 - 0.4, 0, 2.35, -1.5, -1.2, '#4d5963');
  for (let x = b.x0 + 0.5; x < b.x1 - 0.4; x += 0.16) {
    ctx.only3d(KEYS.metal, x, x + 0.03, 2.35, 3.1, -1.35, -1.32, '#8a9199');
  }
  for (let i = 0; i < 22; i += 1) {
    const x = b.x0 + 0.8 + R() * (b.x1 - b.x0 - 1.6);
    const z = -2 - R() * 8;
    const s = 0.16 + R() * 0.42;
    ctx.only3d(KEYS.body, x, x + s, -0.4 + R() * 0.3, -0.4 + R() * 0.3 + s * 0.7, z, z + s, jitterColor('#8d8478', R, 0.3));
  }
  ctx.only3d(KEYS.body, b.x0 + 0.62, b.x1 - 0.62, -0.55, -0.4, z0, z1, '#6f6a60');
  /* an old timber crib and a stub of iron rail */
  ctx.only3d(KEYS.body, b.x0 + 0.9, b.x1 - 0.9, -2.4, -2.2, -3.2, -9.0, '#4e3d2c');
  ctx.only3d(KEYS.metal, b.x0 + 1.4, b.x0 + 1.62, -2.2, -2.05, -3.4, -9.4, '#7c6a5c');
}

export { BUILDINGS };
