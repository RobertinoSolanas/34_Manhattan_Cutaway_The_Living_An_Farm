/**
 * src/palette.js — the colour library of the block.
 * Everything above the street is warm brick & daylight; everything below is
 * cool ink, wet concrete and lit tile. Cut faces get a unified blueprint wash.
 */

export const P = {
  // ── cut-face material ids (index into SECTION_MATS) ──────────────────────
  // (ids are declared in section.js; colours live here)
  brick: '#a8452f',
  brickDark: '#8a3625',
  brickBuff: '#c8a277',
  brickGrey: '#7d6a63',
  mortar: '#d8cec0',

  concrete: '#b3b2ab',
  concreteDark: '#8b8b86',
  concreteWet: '#7f8489',
  concreteForm: '#a09e95',
  grout: '#9a9a94',

  steel: '#8f9aa4',
  steelDark: '#5d666f',
  castIron: '#4d5560',
  copper: '#a5673a',

  glassCut: '#bfe3ea',
  insulation: '#3c4148',
  tar: '#22252b',
  plaster: '#ddd6c9',
  cmu: '#a8a49b',
  wood: '#a5763f',
  woodDark: '#7a542c',

  tile: '#dfe4e2',
  tileMetro: '#e8e2d2',
  terrazzo: '#cbc6bc',
  graniteSett: '#9d9a94',
  asphalt: '#3c3d41',
  asphaltWear: '#33343a',

  // ── geology ──────────────────────────────────────────────────────────────
  fill: '#8a6f52',
  till: '#9c8768',
  clay: '#9c875f',
  sand: '#c9ab77',
  gravel: '#b3a284',
  weathered: '#8d8175',
  rock: '#84888f',
  rockDark: '#71737d',
  rockVein: '#d6cfc2',
  schist: '#767d90',

  // ── services colour code ────────────────────────────────────────────────
  steam: '#d8543c',
  steamWrap: '#4a4f57',
  water: '#2f7fc4',
  gas: '#e0a72c',
  power: '#c0392b',
  telecom: '#3a3f4a',
  sewer: '#6b7a52',
  fireWater: '#d33a2c',
  duct: '#8fa3ad',

  // ── transit ─────────────────────────────────────────────────────────────
  tunnelTile: '#cdd6cf',
  tunnelTileDark: '#8fa09a',
  platformTile: '#d9d2c2',
  ballast: '#5b5a58',
  rail: '#b9bec4',
  thirdRail: '#6d7278',
  trainSteel: '#9aa2a9',
  trainBlue: '#2b5f9e',
  trainRed: '#b8322c',
  trainYellow: '#e2b020',
  trainInterior: '#f0e6cf',

  // ── life ─────────────────────────────────────────────────────────────────
  cab: '#f0c419',
  cabB: '#e8703a',
  bus: '#3f6fb5',
  carA: '#c9ccd1',
  carB: '#3d434b',
  carC: '#7c2f2c',
  taxiLight: '#fff3c4',
  skin: ['#e8b48c', '#c98a63', '#8d5a3b', '#5f3a26', '#f0c9a8', '#a06a45'],
  coats: ['#3b4a63', '#8a3f3a', '#2f6b57', '#c97a2b', '#4a4a52', '#7b5578', '#25303f', '#a8465f', '#5b6f3a', '#c2b7a3', '#2b6b96', '#7a3b2f'],
  trousers: ['#2d3540', '#3d3a44', '#4a4f57', '#26405a', '#54463a', '#1f2329', '#6b5b4a'],
  hair: ['#26211f', '#3d2a1e', '#0f0e10', '#6b4a2a', '#8a8381', '#141214', '#a8863f'],
  plant: ['#3f7a45', '#2f6b3f', '#5b8f4a', '#2b5a3a'],
  warmLight: '#ffd9a0',
  coolLight: '#cfe6ff',
  sodium: '#ffb45e',
  ink: '#1d3350',
};

/** deep (behind-the-cut) ambient tint per stratum, used for fog + back walls */
export const DEPTH_TINT = [
  { y: 46, color: '#b9d7ee' },
  { y: 0, color: '#9dbdd6' },
  { y: -6, color: '#5d6b7a' },
  { y: -14, color: '#37536b' },
  { y: -22, color: '#22384d' },
  { y: -34, color: '#16232f' },
];
