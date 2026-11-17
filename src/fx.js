/**
 * src/fx.js — air and water.
 *
 * GPU-simulated point systems: steam off the mains and the sidewalk grates
 * (the grates exhale when an express passes beneath), drips falling through the
 * station box, dust pushed ahead of the express, and the shimmer over the
 * summer asphalt. Every particle is a vertex; nothing is updated on the CPU.
 */

import * as THREE from 'three';
import { rng, clamp } from './util.js';

const FX_VERT = /* glsl */ `
attribute vec3 iOrigin;
attribute vec3 iVel;
attribute vec4 iMeta;      /* seed, rate, size, emitter */

uniform float uTime;
uniform float uScale;
uniform float uEmit[24];
uniform float uKind;       /* 0 steam, 1 drip, 2 dust */

varying float vAlpha;
varying float vSeed;

void main() {
  float seed = iMeta.x;
  float rate = iMeta.y;
  float life = 1.0 / max(rate, 0.01);
  float t = fract((uTime + seed * life) / life) * life;
  float k = t / life;

  vec3 p = iOrigin;
  float a = 0.0;
  if (uKind < 0.5) {
    /* steam: rises, billows, thins */
    p += iVel * t;
    p.x += sin(t * 0.9 + seed * 31.0) * 0.34 * k;
    p.z += cos(t * 0.7 + seed * 17.0) * 0.3 * k;
    p.y += 0.16 * t * t * 0.35;
    a = smoothstep(0.0, 0.14, k) * (1.0 - smoothstep(0.35, 1.0, k));
  } else if (uKind < 1.5) {
    /* drip: falls, then resets */
    p += iVel * t;
    p.y -= 4.9 * t * t;
    a = smoothstep(0.0, 0.05, k) * (1.0 - smoothstep(0.86, 1.0, k));
  } else {
    /* dust: driven along the tube */
    p += iVel * t;
    p.y += sin(t * 3.0 + seed * 12.0) * 0.12;
    a = smoothstep(0.0, 0.1, k) * (1.0 - smoothstep(0.4, 1.0, k));
  }

  float emit = uEmit[int(floor(iMeta.w + 0.5))];
  vAlpha = a * emit;
  vSeed = seed;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = iMeta.z * uScale * (1.0 + k * 2.2) / max(-mv.z, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FX_FRAG = /* glsl */ `
precision highp float;
varying float vAlpha;
varying float vSeed;
uniform vec3 uColor;
uniform float uOpacity;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.06, d);
  float a = vAlpha * soft * uOpacity;
  if (a < 0.004) discard;
  vec3 col = uColor * (0.75 + 0.5 * fract(vSeed * 7.3));
  gl_FragColor = vec4(col * a, a);
}
`;

class Cloud {
  constructor(kind, count, emitters, opts) {
    const R = rng(opts.seed || 1);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const origin = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const meta = new Float32Array(count * 4);
    for (let i = 0; i < count; i += 1) {
      const e = emitters[i % emitters.length];
      const ox = e.x + (R() - 0.5) * (e.spread || 0.6);
      const oy = e.y + (R() - 0.5) * (e.spreadY || 0.2);
      const oz = e.z + (R() - 0.5) * (e.spreadZ || 0.5);
      origin[i * 3] = ox;
      origin[i * 3 + 1] = oy;
      origin[i * 3 + 2] = oz;
      vel[i * 3] = (e.vx ?? 0) + (R() - 0.5) * (e.jitterX ?? 0.3);
      vel[i * 3 + 1] = (e.vy ?? 0.9) + (R() - 0.5) * 0.4;
      vel[i * 3 + 2] = (e.vz ?? 0) + (R() - 0.5) * (e.jitterZ ?? 0.3);
      meta[i * 4] = R();
      meta[i * 4 + 1] = e.rate ?? (0.18 + R() * 0.3);
      meta[i * 4 + 2] = (e.size ?? 0.7) * (0.6 + R() * 0.9);
      meta[i * 4 + 3] = e.index ?? 0;
      pos[i * 3] = ox;
      pos[i * 3 + 1] = oy;
      pos[i * 3 + 2] = oz;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('iOrigin', new THREE.BufferAttribute(origin, 3));
    geo.setAttribute('iVel', new THREE.BufferAttribute(vel, 3));
    geo.setAttribute('iMeta', new THREE.BufferAttribute(meta, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -8, 0), 120);
    this.emitters = emitters;
    this.uniforms = {
      uTime: { value: 0 },
      uScale: { value: 400 },
      uEmit: { value: new Float32Array(24) },
      uKind: { value: kind },
      uColor: { value: new THREE.Color(opts.color || '#e8f2fa') },
      uOpacity: { value: opts.opacity ?? 0.5 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: FX_VERT,
      fragmentShader: FX_FRAG,
      transparent: true,
      depthWrite: false,
      blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.name = opts.name || 'fx';
    this.count = count;
  }

  setEmit(index, v) {
    this.uniforms.uEmit.value[index] = v;
  }

  update(time, scale) {
    this.uniforms.uTime.value = time;
    this.uniforms.uScale.value = scale;
  }
}

export class FX {
  constructor(app) {
    this.app = app;
    const scene = app.scene;
    const grates = app.ctx.grates || [];

    /* 0..5 grate emitters, 6..9 mains vents, 10 roof stack, 11 tunnel dust */
    let idx = 0;
    this.grateIndex = [];
    const steamEmitters = [];
    for (const g of grates) {
      steamEmitters.push({ x: g.x, y: 0.16, z: g.z, index: idx, spread: g.w * 0.7, spreadZ: 0.4, vy: 0.85, rate: 0.5, size: 0.75 });
      this.grateIndex.push(idx);
      idx += 1;
    }
    for (const vx of [-22.4, -6.2, 17.8, 31.2]) {
      steamEmitters.push({ x: vx, y: -8.3, z: -3.0, index: idx, spread: 0.35, vy: 0.55, rate: 0.4, size: 0.6 });
      this.ventIndex = this.ventIndex || [];
      this.ventIndex.push(idx);
      idx += 1;
    }
    /* platform breath and the boiler-room chimney */
    this.stackIndex = idx;
    steamEmitters.push({ x: -26.0, y: 38.5, z: -6.4, index: idx, spread: 0.4, vy: 1.5, rate: 0.35, size: 1.1 });
    idx += 1;
    this.platformIndex = idx;
    steamEmitters.push({ x: -4, y: -11.2, z: -6.4, index: idx, spread: 14, vy: 0.28, rate: 0.3, size: 0.9 });
    idx += 1;

    this.steam = new Cloud(0, 2200, steamEmitters, { color: '#dfeaf4', opacity: 0.2, name: 'steam', seed: 812 });
    scene.add(this.steam.points);

    const dripEmitters = [];
    let di = 0;
    for (const [x, y, z] of [[-14.5, -11.1, -3.4], [3.5, -11.1, -2.6], [11.8, -10.9, -4.8], [-24.5, -4.6, -2.4], [27.8, -12.2, -6.0], [16.0, -16.0, -8.0]]) {
      dripEmitters.push({ x, y, z, index: di, spread: 0.5, spreadZ: 0.5, vy: 0, jitterX: 0.02, jitterZ: 0.02, rate: 0.3, size: 0.1 });
      di += 1;
    }
    this.drips = new Cloud(1, 260, dripEmitters, { color: '#cfe6ff', opacity: 0.75, name: 'drips', seed: 4471 });
    scene.add(this.drips.points);

    const dustEmitters = [{ x: 0, y: EXPRESS_Y(), z: -2.7, index: 0, spread: 30, spreadY: 1.4, spreadZ: 1.6, vx: 0, vy: 0.1, vz: 0, jitterX: 6, rate: 0.5, size: 0.5 }];
    this.dust = new Cloud(2, 700, dustEmitters, { color: '#cfd8dd', opacity: 0.22, name: 'dust', seed: 99 });
    scene.add(this.dust.points);

    this.steamAmt = 0.4;
    this.grate = 0;
    this.prevEvent = 0;
  }

  get name() { return 'fx'; }

  update(ctx) {
    const { dt, time, dial } = ctx;
    const px = this.app.px || 0.05;
    const scale = 1 / Math.max(px, 0.002);
    this.steam.update(time, scale);
    this.drips.update(time, scale);
    this.dust.update(time, scale);

    /* steam volume follows the hour and the cold of the night */
    const want = 0.22 + 0.85 * clamp(dial.profile.steam, 0, 1.6) * (0.6 + 0.5 * (1 - dial.day));
    this.steamAmt = this.steamAmt + (want - this.steamAmt) * clamp(dt * 0.7, 0, 1);
    for (const i of this.grateIndex) this.steam.setEmit(i, this.steamAmt * 0.5);
    for (const i of this.ventIndex) this.steam.setEmit(i, this.steamAmt);
    this.steam.setEmit(this.stackIndex, 0.35 + this.steamAmt * 0.5);
    this.steam.setEmit(this.platformIndex, 0.25 + this.steamAmt * 0.2);

    /* a train has just gone under the block: blow the grates */
    const ev = this.app.trains ? this.app.trains.event : 0;
    if (ev > this.prevEvent) this.grate = 1;
    this.prevEvent = ev;
    this.grate = Math.max(0, this.grate - dt * 0.42);
    if (this.grate > 0) {
      for (const i of this.grateIndex) this.steam.setEmit(i, this.steamAmt * 0.5 + this.grate * 2.6);
    }

    /* dust rides the express */
    const ex = this.app.trains ? Math.abs(this.app.trains.express.v) / 24 : 0;
    this.dust.setEmit(0, ex * 0.9);

    for (let i = 0; i < 6; i += 1) this.drips.setEmit(i, 0.4 + 0.6 * (1 - dial.day));
  }
}

function EXPRESS_Y() {
  return -24.4;
}
