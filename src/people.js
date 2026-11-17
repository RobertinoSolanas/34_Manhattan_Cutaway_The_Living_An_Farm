/**
 * src/people.js — the inhabitants.
 *
 * One instanced figure mesh with a procedural gait evaluated in the vertex
 * shader (ten articulated parts, pivots baked per vertex, six poses) and a
 * small brain on the CPU: the platform flow that empties a train into the
 * street, diners at the counter, desk workers, a cellist, a dog on a lead,
 * track workers with headlamps, two people having a smoke under the water tank.
 * Figures are sliced by the section plane exactly like everything else.
 */

import * as THREE from 'three';
import { P } from './palette.js';
import { rng, clamp, lerp } from './util.js';

const MAX_PEOPLE = 900;

/* selector codes carried in the vertex colour attribute */
const SEL_COAT = 1;
const SEL_SKIN = 2;
const SEL_HAIR = 3;
const SEL_TROUSERS = 4;
const SEL_ACCENT = 5;

function figureGeometry() {
  const pos = [];
  const nor = [];
  const sel = [];
  const aPart = [];
  const aPivot = [];
  const idx = [];
  let count = 0;

  const box = (w, h, d, cx, cy, cz, part, pivot, selector, shade) => {
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;
    const faces = [
      [[1, 0, 0], [[hw, -hh, -hd], [hw, -hh, hd], [hw, hh, hd], [hw, hh, -hd]]],
      [[-1, 0, 0], [[-hw, -hh, hd], [-hw, -hh, -hd], [-hw, hh, -hd], [-hw, hh, hd]]],
      [[0, 1, 0], [[-hw, hh, -hd], [-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd]]],
      [[0, -1, 0], [[-hw, -hh, hd], [-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd]]],
      [[0, 0, 1], [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]]],
      [[0, 0, -1], [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]]],
    ];
    for (const [n, quad] of faces) {
      const base = count;
      for (const v of quad) {
        pos.push(v[0] + cx, v[1] + cy, v[2] + cz);
        nor.push(n[0], n[1], n[2]);
        sel.push(selector, shade, 0);
        aPart.push(part);
        aPivot.push(pivot[0], pivot[1], pivot[2]);
        count += 1;
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  };

  /* a person, facing +z, 1.8 m tall */
  box(0.4, 0.54, 0.24, 0, 1.18, 0, 1, [0, 0.92, 0], SEL_COAT, 1);
  box(0.19, 0.23, 0.2, 0, 1.63, 0, 0, [0, 1.5, 0], SEL_SKIN, 1);
  box(0.205, 0.11, 0.215, 0, 1.775, -0.008, 0, [0, 1.5, 0], SEL_HAIR, 1);
  box(0.13, 0.1, 0.13, 0, 1.5, 0.05, 0, [0, 1.5, 0], SEL_SKIN, 0.86);
  box(0.11, 0.34, 0.13, -0.27, 1.29, 0, 2, [-0.27, 1.46, 0], SEL_COAT, 0.92);
  box(0.11, 0.34, 0.13, 0.27, 1.29, 0, 3, [0.27, 1.46, 0], SEL_COAT, 0.92);
  box(0.1, 0.3, 0.11, -0.27, 0.99, 0.02, 4, [-0.27, 1.12, 0], SEL_SKIN, 0.95);
  box(0.1, 0.3, 0.11, 0.27, 0.99, 0.02, 5, [0.27, 1.12, 0], SEL_SKIN, 0.95);
  box(0.15, 0.46, 0.17, -0.1, 0.69, 0, 6, [-0.1, 0.92, 0], SEL_TROUSERS, 1);
  box(0.15, 0.46, 0.17, 0.1, 0.69, 0, 6, [0.1, 0.92, 0], SEL_TROUSERS, 1);
  box(0.13, 0.44, 0.14, -0.1, 0.24, 0.01, 7, [-0.1, 0.46, 0], SEL_TROUSERS, 0.84);
  box(0.13, 0.44, 0.14, 0.1, 0.24, 0.01, 7, [0.1, 0.46, 0], SEL_TROUSERS, 0.84);
  box(0.14, 0.07, 0.27, -0.1, 0.035, 0.05, 7, [-0.1, 0.46, 0], SEL_ACCENT, 0.5);
  box(0.14, 0.07, 0.27, 0.1, 0.035, 0.05, 7, [0.1, 0.46, 0], SEL_ACCENT, 0.5);
  /* shoulder bag — the one accessory that makes a crowd read as individuals */
  box(0.11, 0.2, 0.07, -0.33, 0.86, 0.06, 5, [-0.27, 1.12, 0], SEL_ACCENT, 1.15);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(sel, 3));
  geo.setAttribute('aPart', new THREE.Float32BufferAttribute(aPart, 1));
  geo.setAttribute('aPivot', new THREE.Float32BufferAttribute(aPivot, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

const FIG_VERT = /* glsl */ `
attribute float aPart;
attribute vec3 aPivot;
attribute vec3 iTint;
attribute vec3 iSkin;
attribute vec3 iHair;
attribute vec3 iTrousers;
attribute vec4 iAnim;   /* phase, speed, pose, spare */

uniform float uTime;

varying vec3 vNormal;
varying vec3 vColor;
varying float vWorldZ;
varying float vLamp;

void poseAngles(float pose, float ph, float spd,
    out float torso, out float head, out float armA, out float armB,
    out float thigh, out float shin, out float bob) {
  torso = 0.0; head = 0.0; armA = 0.0; armB = 0.0; thigh = 0.0; shin = 0.0; bob = 0.0;
  if (pose < 0.5) {                              /* waiting: weight shift, looking around */
    float s = sin(ph * 0.35);
    torso = 0.035 * s;
    head = 0.5 * sin(ph * 0.21 + 1.3);
    armA = 0.06 * s;
    armB = -0.05 * s;
    bob = 0.008 * s;
  } else if (pose < 1.5) {                       /* walking */
    float a = 0.5 * spd;
    thigh = a * sin(ph);
    shin = -a * 1.1 * max(0.0, sin(ph + 2.3));
    armA = -0.4 * spd * sin(ph);
    armB = -0.4 * spd * sin(ph + 3.1416);
    torso = 0.07 + 0.03 * sin(ph * 2.0);
    bob = 0.03 * abs(sin(ph));
    head = 0.05 * sin(ph);
  } else if (pose < 2.5) {                       /* sitting */
    thigh = -1.45;
    shin = 1.34;
    armA = -0.7;
    armB = -0.55;
    torso = 0.07;
    bob = -0.34;
  } else if (pose < 3.5) {                       /* working with the hands */
    armA = -1.0 + 0.5 * sin(ph * 1.7);
    armB = -0.8 + 0.42 * sin(ph * 1.7 + 1.1);
    torso = 0.26 + 0.06 * sin(ph * 0.9);
    thigh = 0.06;
    shin = -0.05;
    head = 0.22;
  } else if (pose < 4.5) {                       /* dancing */
    thigh = 0.32 * sin(ph * 1.6);
    shin = -0.32 * max(0.0, sin(ph * 1.6 + 2.0));
    armA = -2.2 + 0.8 * sin(ph * 1.6 + 0.4);
    armB = -2.2 + 0.8 * sin(ph * 1.6 + 2.6);
    torso = 0.18 * sin(ph * 0.8);
    head = 0.22 * sin(ph * 0.8 + 1.0);
    bob = 0.09 * abs(sin(ph * 1.6));
  } else if (pose < 5.5) {                       /* cello */
    armA = -1.2 + 0.4 * sin(ph * 2.2);
    armB = -0.9 + 0.3 * sin(ph * 2.2 + 2.0);
    torso = 0.26;
    thigh = -0.55;
    shin = 0.45;
    head = 0.3;
  } else {                                       /* on the phone */
    armA = -1.9 + 0.08 * sin(ph * 0.6);
    armB = 0.05 * sin(ph * 0.4);
    torso = 0.04 * sin(ph * 0.3);
    head = 0.2 * sin(ph * 0.24 + 2.0) - 0.12;
    bob = 0.006 * sin(ph * 0.5);
  }
}

void main() {
  float selId = color.r;
  float shadeV = color.g;
  vec3 c = iTint;
  if (selId > 1.5 && selId < 2.5) c = iSkin;
  else if (selId > 2.5 && selId < 3.5) c = iHair;
  else if (selId > 3.5 && selId < 4.5) c = iTrousers;
  else if (selId > 4.5) c = iTint * 0.55 + vec3(0.16);
  vColor = c * shadeV;

  float pose = iAnim.z;
  float ph = iAnim.x + uTime * (1.6 + iAnim.y * 4.0);
  float torso, headA, armA, armB, thigh, shin, bob;
  poseAngles(pose, ph, clamp(iAnim.y, 0.3, 1.7), torso, headA, armA, armB, thigh, shin, bob);

  vec3 p = position;
  float ang = 0.0;
  if (aPart < 0.5) ang = headA + torso;
  else if (aPart < 1.5) ang = torso;
  else if (aPart < 4.0) ang = (aPart < 2.5) ? armA : armB;
  else if (aPart < 6.0) ang = ((aPart < 4.5) ? armA : armB) * 1.05;
  else if (aPart < 7.0) ang = thigh;
  else ang = thigh + shin;

  /* head yaw first, for the idle poses */
  if (aPart < 0.5) {
    float ay = headA * 0.8;
    vec3 h = p - aPivot;
    h = vec3(cos(ay) * h.x + sin(ay) * h.z, h.y, -sin(ay) * h.x + cos(ay) * h.z);
    p = h + aPivot;
  }
  vec3 q = p - aPivot;
  float cs = cos(ang), sn = sin(ang);
  q = vec3(q.x, cs * q.y - sn * q.z, sn * q.y + cs * q.z);
  p = q + aPivot;
  p.y += bob;

  vec4 world = instanceMatrix * vec4(p, 1.0);
  vec4 mv = modelViewMatrix * world;
  vWorldZ = world.z;
  vNormal = normalize(mat3(instanceMatrix) * normal);
  vLamp = step(5.5, iAnim.w);
  gl_Position = projectionMatrix * mv;
}
`;

const FIG_FRAG = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec3 vColor;
varying float vWorldZ;
varying float vLamp;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uAmb;
uniform float uCut;

void main() {
  if (vWorldZ > uCut) discard;
  vec3 n = normalize(vNormal);
  float nd = max(dot(n, normalize(uSunDir)), 0.0);
  vec3 light = uAmb + uSunColor * nd + uSkyColor * (0.3 + 0.5 * n.y);
  light += uSkyColor * 0.4 * max(n.z, 0.0);
  vec3 c = vColor * light;
  /* headlamp: a hot core on the chest of track workers */
  c += vec3(1.0, 0.93, 0.78) * vLamp * max(n.z, 0.2) * 0.9;
  gl_FragColor = vec4(c, 1.0);
}
`;

const POSE = {
  STAND: 0, WALK: 1, SIT: 2, WORK: 3, DANCE: 4, CELLO: 5, PHONE: 6,
};

export class Crowd {
  constructor(app) {
    this.app = app;
    this.R = rng(90210);
    this.geometry = figureGeometry();
    const n = MAX_PEOPLE;
    this.aTint = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.aSkin = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.aHair = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.aTrousers = new Float32Array(n * 3);
    this.aTrousersAttr = new THREE.InstancedBufferAttribute(this.aTrousers, 3);
    this.aAnim = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    for (const [k, a] of [['iTint', this.aTint], ['iSkin', this.aSkin], ['iHair', this.aHair], ['iTrousers', this.aTrousersAttr], ['iAnim', this.aAnim]]) {
      a.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(k, a);
    }
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCut: { value: app.cut },
        uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.6) },
        uSunColor: { value: new THREE.Color('#ffe8cc') },
        uSkyColor: { value: new THREE.Color('#8fb4d4') },
        uAmb: { value: new THREE.Color('#2c3d4d') },
      },
      vertexShader: FIG_VERT,
      fragmentShader: FIG_FRAG,
      vertexColors: true,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, n);
    this.mesh.name = 'figures';
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.people = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.pruned = 0;
  }

  get name() { return 'crowd'; }
  count() { return this.people.length; }

  add(o) {
    if (this.people.length >= MAX_PEOPLE - 2) return null;
    const R = this.R;
    const p = {
      x: o.x, y: o.y, z: o.z,
      ry: o.ry ?? (R() - 0.5) * 1.2,
      pose: o.pose ?? POSE.STAND,
      speed: o.speed ?? (o.pose === POSE.WALK ? 0.5 + R() * 0.55 : 0.12),
      coat: new THREE.Color(o.coat ?? R.pick(P.coats)),
      trousers: new THREE.Color(o.trousers ?? R.pick(P.trousers)),
      skin: new THREE.Color(o.skin ?? R.pick(P.skin)),
      hair: new THREE.Color(o.hair ?? R.pick(P.hair)),
      scale: o.scale ?? (0.93 + R() * 0.15),
      path: o.path || null,
      t: o.t ?? R(),
      dir: o.dir ?? (R.chance(0.5) ? 1 : -1),
      wait: o.wait ?? 0,
      life: o.life ?? Infinity,
      mode: o.mode || 'loop',
      target: o.target || null,
      next: o.next || null,
      onArrive: o.onArrive || null,
      restPose: o.restPose ?? POSE.STAND,
      restAt: o.restAt || null,
      speedBase: o.speedBase ?? (1.05 + R() * 0.5),
      yTrack: o.yTrack || null,
      stops: o.stops ?? true,
      lamp: o.lamp ? 1 : 0,
      phase: R() * 6.28,
    };
    this.people.push(p);
    return p;
  }

  send(p, target, opts = {}) {
    p.target = target;
    p.next = opts.next || null;
    p.onArrive = opts.onArrive || null;
    p.pose = POSE.WALK;
    p.mode = opts.mode || p.mode;
    return p;
  }

  update(ctx) {
    const { dt, time, dial, cut } = ctx;
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uCut.value = cut;
    const sky = this.app.sky;
    u.uSunDir.value.copy(dial.sunDir);
    u.uSunColor.value.copy(sky.sun.color).multiplyScalar(clamp(sky.sun.intensity / 3.4, 0, 1.15));
    u.uSkyColor.value.copy(sky.hemi.color).multiplyScalar(0.42 * sky.hemi.intensity + 0.14);
    u.uAmb.value.copy(sky.ambient.color).multiplyScalar(sky.ambient.intensity * 0.95);

    const list = this.people;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      if (p.life !== Infinity) {
        p.life -= dt;
        if (p.life <= 0) { list.splice(i, 1); continue; }
      }
      if (p.wait > 0) {
        p.wait -= dt;
      } else if (p.target) {
        const dx = p.target.x - p.x;
        const dy = (p.target.y ?? p.y) - p.y;
        const dz = p.target.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.2) {
          p.x = p.target.x;
          p.z = p.target.z;
          if (p.target.y !== undefined) p.y = p.target.y;
          if (p.onArrive) p.onArrive(p);
          if (p.next) {
            const nx = p.next;
            p.next = nx.next || null;
            p.target = { x: nx.x, y: nx.y, z: nx.z };
            if (nx.onArrive) p.onArrive = nx.onArrive;
            if (nx.wait) p.wait = nx.wait;
          } else {
            p.target = null;
            p.pose = p.restPose;
          }
        } else {
          const sp = p.speedBase;
          p.x += (dx / dist) * sp * dt;
          p.z += (dz / dist) * sp * dt;
          if (p.yTrack) p.y = p.yTrack(p.x, p.z);
          else if (p.target.y !== undefined) p.y += (p.target.y - p.y) * clamp(dt * 4, 0, 1);
          p.ry = Math.atan2(dx, dz);
          p.pose = POSE.WALK;
          p.speed = clamp(sp / 1.5, 0.35, 1.5);
        }
      } else if (p.path) {
        const s = p.path;
        p.t += dt * (p.speed / 1.2) * 0.075 * p.dir;
        if (p.t > 1 || p.t < 0) {
          if (p.mode === 'once') { list.splice(i, 1); continue; }
          p.t = clamp(p.t, 0, 1);
          p.dir *= -1;
          p.wait = p.waitPeek ?? (0.4 + this.R() * 2.4);
        }
        const k = clamp(p.t, 0, 1);
        p.x = lerp(s.x0, s.x1, k);
        p.z = lerp(s.z0, s.z1, k);
        if (s.y0 !== undefined) p.y = lerp(s.y0, s.y1 ?? s.y0, k);
        p.ry = (p.dir > 0 ? 1 : -1) * Math.atan2(s.x1 - s.x0, (s.z1 - s.z0) || 0.0001);
        p.pose = (p.stops && ((time * 0.13 + i * 0.37) % 7) > 6.25) ? POSE.PHONE : POSE.WALK;
      }
    }

    const n = Math.min(list.length, MAX_PEOPLE);
    const tint = this.aTint.array;
    const skin = this.aSkin.array;
    const hair = this.aHair.array;
    const tr = this.aTrousersAttr.array;
    const anim = this.aAnim.array;
    for (let i = 0; i < n; i += 1) {
      const p = list[i];
      this._e.set(0, p.ry, 0);
      this._q.setFromEuler(this._e);
      this._v.set(p.x, p.y, p.z);
      this._s.setScalar(p.scale);
      this._m.compose(this._v, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
      tint[i * 3] = p.coat.r; tint[i * 3 + 1] = p.coat.g; tint[i * 3 + 2] = p.coat.b;
      skin[i * 3] = p.skin.r; skin[i * 3 + 1] = p.skin.g; skin[i * 3 + 2] = p.skin.b;
      hair[i * 3] = p.hair.r; hair[i * 3 + 1] = p.hair.g; hair[i * 3 + 2] = p.hair.b;
      tr[i * 3] = p.trousers.r; tr[i * 3 + 1] = p.trousers.g; tr[i * 3 + 2] = p.trousers.b;
      anim[i * 4] = p.phase;
      anim[i * 4 + 1] = p.speed;
      anim[i * 4 + 2] = p.pose;
      anim[i * 4 + 3] = p.lamp ? 6 : 0;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aTint.needsUpdate = true;
    this.aSkin.needsUpdate = true;
    this.aHair.needsUpdate = true;
    this.aTrousersAttr.needsUpdate = true;
    this.aAnim.needsUpdate = true;
  }
}

export { POSE };
