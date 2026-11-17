/**
 * src/layout.js — the program of the block.
 *
 * One declarative description of everything: six street-wall buildings with
 * their floors and furnished rooms, the cellars, the utility stratum, two
 * subway levels, the deep express tube, the service gallery, the foundations
 * and the street. The cut faces, the 3D geometry, the schedules and the crowd
 * are all generated from this, so the slice and the world behind it can never
 * disagree.
 *
 * x  → along the block (metres).   y  → up, street level = 0.
 * z  → into the block; the section plane starts at CUT0 and slides to -8.
 */

import { P } from './palette.js';

export const CUT0 = -1.7;
export const CUT_MIN = -8.6;
export const CUT_MAX = 0.15;
export const X_EDGE = 46;

/* depth bands behind the section plane */
export const BAND = {
  front: [-2.0, -5.4],
  mid: [-5.4, -9.2],
  deep: [-9.2, -13.2],
};

export const LEVEL = {
  streetTop: 0,
  cellar1Top: -4.75,
  cellar2Top: -9.0,
  utilityTop: -9.7,
  utilityFloor: -13.0,
  stationFloor: -14.35,
  stationCeil: -10.9,
  railTopUpper: -15.55,
  mezzFloor: -9.4,
  expressAxis: -24.4,
  expressR: 2.95,
  rockHead: -15.4,
  bottom: -44,
};

export const UPPER = {
  x0: -19.5, x1: 14.5,
  floorY: -16.35, ceilY: -10.85,
  z0: -1.15, z1: -15.0,
  trackA: -4.55,      // near track, platform edge beside it
  trackB: -10.6,      // far track
  platformZ0: -6.35, platformZ1: -9.0,
  platTop: -15.05,
  wallX0: -19.5, wallX1: 14.5,
};

export const EXPRESS = {
  x0: -46, x1: 46,
  cy: LEVEL.expressAxis,
  cz: -2.7,
  r: LEVEL.expressR,
  lining: 0.34,
  ringPitch: 0.78,
  invertY: LEVEL.expressAxis - 2.28,
};

export const GALLERY = {
  x0: 12.0, x1: 40.0,
  y0: -17.4, y1: -13.0,
  z0: -2.2, z1: -9.6,
  floorY: -17.4,
};

/* ── services ──────────────────────────────────────────────────────────────
 * axis 'z' services are cut by the plane → colour-coded circular sections.
 * axis 'x' services are long runs receding behind the cut.
 */
export const SERVICES = [
  { id: 'steamA', code: 'steam', medium: P.steam, wrap: P.steamWrap, axis: 'x', y: -10.55, z: -3.0, r: 0.34, insulation: 0.13, x0: -46, x1: 46 },
  { id: 'steamB', code: 'steam', medium: P.steam, wrap: P.steamWrap, axis: 'x', y: -10.55, z: -4.05, r: 0.34, insulation: 0.13, x0: -46, x1: 46 },
  { id: 'waterA', code: 'water', medium: P.water, axis: 'x', y: -11.65, z: -2.4, r: 0.22, x0: -46, x1: 46 },
  { id: 'gasA', code: 'gas', medium: P.gas, axis: 'x', y: -11.65, z: -3.55, r: 0.15, x0: -46, x1: 46 },
  { id: 'sewer', code: 'sewer', medium: P.sewer, axis: 'x', y: -12.35, z: -6.2, r: 0.62, brick: true, x0: -46, x1: 46, flow: true },
  { id: 'fireWater', code: 'fire', medium: P.fireWater, axis: 'x', y: -11.1, z: -7.9, r: 0.19, x0: -46, x1: 46 },

  { id: 'riserW1', code: 'water', medium: P.water, axis: 'z', x: -27.5, y: -11.4, r: 0.16, z0: -2.6, z1: -9.5 },
  { id: 'riserW2', code: 'water', medium: P.water, axis: 'z', x: -26.7, y: -11.4, r: 0.11, z0: -2.6, z1: -9.5 },
  { id: 'riserS1', code: 'steam', medium: P.steam, wrap: P.steamWrap, axis: 'z', x: -22.2, y: -10.9, r: 0.2, insulation: 0.1, z0: -2.4, z1: -8.6 },
  { id: 'riserG1', code: 'gas', medium: P.gas, axis: 'z', x: -17.4, y: -11.8, r: 0.13, z0: -2.4, z1: -7.6 },
  { id: 'ductBank', code: 'power', medium: P.power, axis: 'z', x: -12.6, y: -11.9, r: 0, bank: { w: 1.5, h: 0.92, cells: 6, cd: 0.2 }, z0: -2.3, z1: -10.4 },
  { id: 'ductBank2', code: 'power', medium: P.power, axis: 'z', x: 8.4, y: -11.9, r: 0, bank: { w: 1.2, h: 0.72, cells: 4, cd: 0.18 }, z0: -2.3, z1: -9.2 },
  { id: 'telecom', code: 'telecom', medium: P.telecom, axis: 'z', x: -4.4, y: -11.3, r: 0, bundle: { n: 11, spread: 0.62, r: 0.052 }, z0: -2.4, z1: -11.0 },
  { id: 'telecom2', code: 'telecom', medium: P.telecom, axis: 'x', y: -11.25, z: -8.9, r: 0.052, bundle: { n: 9, spread: 0.5 }, x0: -46, x1: 46, tray: true },
  { id: 'conduitA', code: 'power', medium: P.power, axis: 'z', x: 3.1, y: -10.6, r: 0.085, z0: -2.2, z1: -8.4 },
  { id: 'conduitB', code: 'power', medium: P.power, axis: 'z', x: 3.55, y: -10.6, r: 0.085, z0: -2.2, z1: -8.4 },
  { id: 'riserHVAC', code: 'duct', medium: P.duct, axis: 'z', x: 12.6, y: -10.8, r: 0, duct: { w: 1.1, h: 0.62 }, z0: -2.4, z1: -9.8 },
  { id: 'sprinkler', code: 'fire', medium: P.fireWater, axis: 'z', x: 17.8, y: -11.55, r: 0.09, z0: -2.4, z1: -10.6 },
  { id: 'outfall', code: 'sewer', medium: P.sewer, axis: 'z', x: 26.4, y: -12.2, r: 0.34, z0: -2.2, z1: -11.4 },
  { id: 'steamBranch', code: 'steam', medium: P.steam, wrap: P.steamWrap, axis: 'z', x: -33.4, y: -10.75, r: 0.22, insulation: 0.11, z0: -2.4, z1: -8.2 },
];

/* ── buildings ───────────────────────────────────────────────────────────── */

const R = (x0, x1, type, band = 'front', extra = {}) => ({ x0, x1, type, band, ...extra });

export const BUILDINGS = [
  {
    id: 'prewar', name: 'The pre-war', kind: 'brick',
    x0: -31.4, x1: -14.6,
    facade: { brick: P.brick, trim: P.brickBuff, bays: 5, z0: -0.62 },
    wall: { x: 0.44, party: 0.62, slab: 0.2, finish: 0.05 },
    foundation: { type: 'caisson', top: -9.0, socket: -18.6, pitch: 3.3, dia: 1.05, footing: 1.5 },
    basement: [
      { y: LEVEL.cellar1Top, h: 4.75, rooms: [
        R(-31.0, -26.2, 'laundry', 'front'),
        R(-31.0, -26.2, 'storage', 'mid'),
        R(-26.2, -22.4, 'workshop', 'front'),
        R(-26.2, -22.4, 'coal', 'mid'),
        R(-22.4, -15.0, 'boiler', 'front'),
        R(-22.4, -15.0, 'coal', 'mid'),
      ] },
      { y: LEVEL.cellar2Top, h: 4.25, rooms: [
        R(-31.0, -23.0, 'storage', 'front', { vaulted: true }),
        R(-23.0, -15.0, 'sump', 'front'),
      ] },
    ],
    roof: { type: 'watertower', waterLevel: 0.62 },
    elevators: [{ x: -25.0, cars: 2, shaftW: 1.9 }, { x: -22.9, cars: 1, shaftW: 1.6 }],
    stair: { x0: -16.6, x1: -15.0 },
    floors: [
      { h: 5.3, rooms: [
        R(-31.0, -25.4, 'lobby', 'front'),
        R(-25.4, -20.4, 'retail', 'front'),
        R(-20.4, -15.0, 'diner', 'front', { double: true }),
        R(-31.0, -20.4, 'backstage', 'mid'),
      ] },
      { h: 3.72, rooms: [
        R(-31.0, -27.0, 'kitchen', 'front'),
        R(-27.0, -22.6, 'living', 'front'),
        R(-22.6, -20.0, 'bedroom', 'front'),
        R(-20.0, -15.0, 'living', 'front', { cello: true }),
        R(-24.0, -20.4, 'bath', 'mid', { wet: true }),
      ] },
      { h: 3.72, rooms: [
        R(-31.0, -26.6, 'living', 'front', { tv: true }),
        R(-26.6, -22.2, 'kitchen', 'front'),
        R(-22.2, -15.0, 'bedroom', 'front', { dog: true }),
        R(-27.4, -23.4, 'bath', 'mid', { wet: true }),
      ] },
      { h: 3.72, rooms: [
        R(-31.0, -25.0, 'office', 'front', { study: true }),
        R(-25.0, -20.2, 'living', 'front'),
        R(-20.2, -15.0, 'kitchen', 'front'),
        R(-20.2, -15.0, 'bath', 'mid', { wet: true }),
      ] },
      { h: 3.9, rooms: [
        R(-31.0, -24.6, 'clinic', 'front'),
        R(-24.6, -19.8, 'clinicExam', 'front'),
        R(-19.8, -15.0, 'clinic', 'front'),
      ] },
      { h: 3.72, rooms: [
        R(-31.0, -26.2, 'kitchen', 'front'),
        R(-26.2, -21.4, 'living', 'front', { tv: true }),
        R(-21.4, -15.0, 'bedroom', 'front'),
        R(-26.2, -22.0, 'bath', 'mid', { wet: true }),
      ] },
      { h: 3.72, rooms: [
        R(-31.0, -25.0, 'living', 'front'),
        R(-25.0, -20.0, 'dance', 'front', { small: true }),
        R(-20.0, -15.0, 'kitchen', 'front'),
      ] },
      { h: 3.72, rooms: [
        R(-31.0, -26.6, 'bedroom', 'front'),
        R(-26.6, -21.6, 'living', 'front', { plants: true }),
        R(-21.6, -15.0, 'office', 'front'),
        R(-25.0, -21.0, 'bath', 'mid', { wet: true }),
      ] },
      { h: 3.72, rooms: [
        R(-31.0, -24.0, 'kitchen', 'front', { roofAccess: true }),
        R(-24.0, -15.0, 'living', 'front', { tv: true }),
      ] },
    ],
  },

  {
    id: 'gaplot', name: 'The affected-by-fire lot', kind: 'ruin',
    x0: -14.6, x1: -11.2,
    wall: { party: 0.62 },
    foundation: { type: 'rubble', top: -7.6, steps: 4 },
    floors: [
      { h: 3.4, rooms: [R(-14.2, -11.6, 'ruins', 'front')] },
      { h: 3.2, rooms: [R(-14.2, -11.6, 'ruins', 'front')] },
    ],
    roof: { type: 'open' },
  },

  {
    id: 'sliver', name: 'The sliver tower', kind: 'tower',
    x0: -11.2, x1: -3.4,
    facade: { metal: '#8f9ea8', glass: '#8fb6c8', z0: -0.5 },
    wall: { x: 0.3, slab: 0.22 },
    foundation: { type: 'mat', top: -8.4, thick: 1.9, shafts: [-9.4, -6.9, -4.6], shaftDepth: -22.4, dia: 1.15 },
    basement: [
      { y: LEVEL.cellar1Top, h: 4.75, rooms: [
        R(-10.8, -6.6, 'bikeStore', 'front'),
        R(-6.6, -3.8, 'electrical', 'front'),
      ] },
    ],
    roof: { type: 'terrace' },
    elevators: [{ x: -8.0, cars: 2, shaftW: 1.75, panoramic: true }],
    stair: { x0: -5.4, x1: -3.8 },
    mechanical: 12,
    floors: [
      { h: 4.6, rooms: [R(-10.8, -3.8, 'lobby', 'front', { residential: true })] },
      { h: 3.12, rooms: [R(-10.8, -8.2, 'office', 'front'), R(-8.2, -3.8, 'meeting', 'front')] },
      { h: 3.12, rooms: [R(-10.8, -8.2, 'kitchen', 'front'), R(-8.2, -3.8, 'living', 'front', { tv: true })] },
      { h: 3.12, rooms: [R(-10.8, -8.2, 'bedroom', 'front'), R(-8.2, -3.8, 'living', 'front')] },
      { h: 3.12, rooms: [R(-10.8, -8.2, 'living', 'front', { plants: true }), R(-8.2, -3.8, 'kitchen', 'front')] },
      { h: 3.12, rooms: [R(-10.8, -8.2, 'office', 'front'), R(-8.2, -3.8, 'bedroom', 'front')] },
      { h: 3.12, rooms: [R(-10.8, -8.2, 'kitchen', 'front'), R(-8.2, -3.8, 'dance', 'front', { small: true })] },
      { h: 3.12, rooms: [R(-10.8, -8.2, 'living', 'front', { tv: true }), R(-8.2, -3.8, 'office', 'front')] },
      { h: 3.12, rooms: [R(-10.8, -8.2, 'bedroom', 'front'), R(-8.2, -3.8, 'kitchen', 'front')] },
      { h: 3.12, rooms: [R(-10.8, -8.2, 'living', 'front'), R(-8.2, -3.8, 'clinic', 'front', { small: true })] },
      { h: 3.12, rooms: [R(-10.8, -3.8, 'mechanical', 'front', { exposed: true })] },
      { h: 3.4, rooms: [R(-10.8, -3.8, 'mechanical', 'front', { exposed: true, hvac: true })] },
    ],
  },

  {
    id: 'bank', name: 'The savings bank', kind: 'brick',
    x0: -3.4, x1: 6.6,
    facade: { brick: P.brickBuff, trim: '#ddd0b6', bays: 3, z0: -0.7 },
    wall: { x: 0.5, slab: 0.24 },
    foundation: { type: 'raft', top: -7.2, thick: 1.1, piers: [-2.0, 1.6, 5.2] },
    basement: [
      { y: LEVEL.cellar1Top, h: 4.75, rooms: [
        R(-3.0, 2.2, 'vault', 'front', { vaulted: true }),
        R(2.2, 6.2, 'strongroom', 'front'),
      ] },
    ],
    roof: { type: 'parapet' },
    stair: { x0: 4.6, x1: 6.2 },
    floors: [
      { h: 5.6, rooms: [R(-3.0, 6.2, 'bankLobby', 'front')] },
      { h: 4.3, rooms: [R(-3.0, 1.6, 'dance', 'front'), R(1.6, 6.2, 'studio2', 'front')] },
      { h: 3.8, rooms: [R(-3.0, 1.2, 'clinic', 'front'), R(1.2, 6.2, 'clinicExam', 'front')] },
      { h: 3.6, rooms: [R(-3.0, 6.2, 'office', 'front')] },
    ],
  },

  {
    id: 'office', name: 'The glass corner', kind: 'glass',
    x0: 6.6, x1: 22.8,
    facade: { glass: '#9dc4d2', mullion: '#7d8a93', z0: -0.45 },
    wall: { x: 0.32, slab: 0.22 },
    foundation: { type: 'slurry', top: -1.6, bottom: -18.9, thick: 0.8, at: 21.4, ties: [-4.6, -8.9, -13.2] },
    basement: [
      { y: LEVEL.cellar1Top, h: 4.75, rooms: [
        R(7.0, 15.6, 'parking', 'front'),
        R(15.6, 22.4, 'parking', 'mid'),
      ] },
    ],
    roof: { type: 'plant' },
    elevators: [{ x: 16.2, cars: 2, shaftW: 1.85 }, { x: 18.4, cars: 1, shaftW: 1.85 }],
    stair: { x0: 20.2, x1: 22.4 },
    mechanical: 7,
    floors: [
      { h: 5.4, rooms: [R(7.0, 15.2, 'lobby', 'front', { corporate: true }), R(15.2, 22.4, 'retail', 'front')] },
      { h: 4.15, rooms: [R(7.0, 15.2, 'office', 'front'), R(15.2, 22.4, 'meeting', 'front')] },
      { h: 4.15, rooms: [R(7.0, 15.2, 'office', 'front'), R(15.2, 22.4, 'office', 'front', { exec: true })] },
      { h: 4.15, rooms: [R(7.0, 15.2, 'office', 'front'), R(15.2, 22.4, 'meeting', 'front')] },
      { h: 4.15, rooms: [R(7.0, 15.2, 'office', 'front'), R(15.2, 22.4, 'lunch', 'front')] },
      { h: 4.15, rooms: [R(7.0, 15.2, 'office', 'front'), R(15.2, 22.4, 'office', 'front')] },
      { h: 4.3, rooms: [R(7.0, 22.4, 'mechanical', 'front', { exposed: true, hvac: true })] },
    ],
  },

  {
    id: 'loft', name: 'The old loft', kind: 'loft',
    x0: 22.8, x1: 33.4,
    facade: { brick: P.brickGrey, trim: '#9c968d', bays: 4, z0: -0.6 },
    wall: { x: 0.46, slab: 0.2 },
    foundation: { type: 'rubble', top: -6.9, steps: 5 },
    basement: [
      { y: LEVEL.cellar1Top, h: 4.75, rooms: [
        R(23.2, 28.4, 'storage', 'front', { vaulted: true }),
        R(28.4, 33.0, 'freight', 'front'),
      ] },
    ],
    roof: { type: 'parapet' },
    stair: { x0: 31.2, x1: 33.0 },
    floors: [
      { h: 4.5, rooms: [R(23.2, 28.0, 'garage', 'front'), R(28.0, 33.0, 'freight', 'front')] },
      { h: 3.85, rooms: [R(23.2, 28.4, 'woodShop', 'front'), R(28.4, 33.0, 'storage', 'front')] },
      { h: 3.85, rooms: [R(23.2, 28.4, 'office', 'front'), R(28.4, 33.0, 'laundry', 'front', { commercial: true })] },
      { h: 3.85, rooms: [R(23.2, 33.0, 'office', 'front')] },
      { h: 3.85, rooms: [R(23.2, 28.4, 'living', 'front', { artist: true }), R(28.4, 33.0, 'office', 'front')] },
    ],
  },
];

/* ── context: what stands either side and behind ─────────────────────────── */
export const CONTEXT = {
  left: { x0: -46, x1: -31.4, top: 26.5, style: 'brick', bays: 5 },
  right: { x0: 33.4, x1: 46, top: 31.0, style: 'brick', bays: 4 },
  backZ: -15.4,
  alleyZ: [-15.4, -21.0],
  skyline: { z: -128, count: 46 },
};

/* ── street ──────────────────────────────────────────────────────────────── */
export const STREET = {
  sidewalk: { z0: -2.4, z1: 3.35 },
  curb: { z0: 3.35, z1: 3.75, top: 0.15 },
  road: { z0: 3.75, z1: 13.6 },
  laneZ: [5.4, 7.5, 9.6, 11.9],
  parkingZ: 4.5,
  grate: [
    { x: -12.9, w: 0.9 }, { x: -9.4, w: 0.7 }, { x: 2.4, w: 0.9 }, { x: 11.2, w: 0.7 }, { x: 24.6, w: 0.9 },
  ],
  lamps: [-29.4, -18.2, -6.4, 5.2, 16.4, 27.6, 38.4],
  hydrant: -24.2,
  signs: [-13.2, 9.2],
  vaultLight: [{ x: -27.6 }, { x: -25.0 }, { x: 5.6 }],
  streetTrees: [-30.2, -16.0, 4.2, 21.0, 32.0],
};

/* ── foundations & geology features ─────────────────────────────────────── */
export const GEO_FEATURES = {
  dryWell: { x: 27.8, y: -13.4, r: 1.15, z0: -3.4, z1: -9.2 },
  oldWall: { x0: -40.5, x1: -33.2, y0: -8.6, y1: -2.2 },
  boulder: [{ x: 34.5, y: -19.6, r: 2.2 }, { x: -42.0, y: -22.4, r: 2.8 }, { x: 18.2, y: -21.2, r: 1.7 }],
  fault: { x: 30.2, dip: 0.34, width: 0.5 },
};

/* ── schedules: what a room does across the day ─────────────────────────── */
/** occupancy 0..1 by hour for a room type */
export const SCHEDULE = {
  apartment: [[0, 0.5], [6, 0.8], [8.5, 0.2], [12, 0.35], [16, 0.5], [18.5, 0.95], [22, 0.7], [24, 0.5]],
  office: [[0, 0.03], [7, 0.15], [9, 0.9], [12.5, 0.6], [14, 0.95], [18, 0.5], [20, 0.15], [24, 0.03]],
  retail: [[0, 0], [8, 0.2], [11, 0.8], [15, 0.9], [19, 0.5], [21, 0.15], [24, 0]],
  diner: [[0, 0.25], [5, 0.4], [8, 0.85], [11, 0.6], [13, 0.95], [18, 0.8], [21, 1.0], [24, 0.4]],
  clinic: [[0, 0], [8, 0.6], [12, 0.8], [14, 0.4], [17, 0.5], [19, 0.1], [24, 0]],
  dance: [[0, 0], [9, 0.3], [11, 0.7], [16, 0.6], [19, 0.95], [21, 0.7], [23, 0.05]],
  lobby: [[0, 0.1], [7.5, 0.7], [9, 0.9], [12.5, 0.5], [17.5, 0.9], [19, 0.5], [23, 0.15]],
  industrial: [[0, 0.15], [6, 0.5], [8, 0.85], [16, 0.7], [19, 0.25], [24, 0.15]],
  transit: [[0, 0.35], [6, 0.55], [8.5, 1.0], [12, 0.7], [17.5, 1.0], [20, 0.6], [24, 0.3]],
  vault: [[0, 0.05], [9, 0.4], [12, 0.3], [16, 0.25], [18, 0.05], [24, 0.05]],
  sleep: [[0, 0.5], [7, 0.3], [9, 0.1], [18, 0.15], [22, 0.45]],
};

/** lighting warmth by hour (kelvin-ish tint mix) */
export const LIGHT_TINT = [
  [0, '#ffb46a'], [6, '#ffd39a'], [9, '#ffe9c8'], [13, '#fff6e4'],
  [17, '#ffd9a2'], [20, '#ffc07a'], [24, '#ffb46a'],
];
