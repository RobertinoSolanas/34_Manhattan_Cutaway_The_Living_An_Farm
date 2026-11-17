/**
 * src/app.js — renderer, cutting plane, post chain, the world build and the
 * frame loop. Everything the test harness touches hangs off window.__cutaway.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { SectionSkin } from './section.js';
import { EarthFace } from './earth.js';
import { Ctx } from './build.js';
import { Sky } from './sky.js';
import { Rig } from './camera.js';
import { buildStructures } from './structure.js';
import { buildBelow } from './below.js';
import { buildInteriors } from './interiors.js';
import { buildStreet, Traffic } from './street.js';
import { Trains, Lifts } from './transit.js';
import { FX } from './fx.js';
import { Life } from './life.js';
import { CUT0, CUT_MIN, CUT_MAX } from './layout.js';
import { clamp, damp, lerp, smoothstep } from './util.js';
import { buildUI } from './ui.js';

export const QUALITY = {
  high: { dpr: 2, bloom: 0.58, crowd: 1, props: 1, fx: 1, grade: true },
  std: { dpr: 1.65, bloom: 0.46, crowd: 0.72, props: 0.78, fx: 0.75, grade: true },
  fast: { dpr: 1.15, bloom: 0, crowd: 0.45, props: 0.5, fx: 0.45, grade: false },
};

const GRADE = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.5 },
    uGrain: { value: 0.035 },
    uWarm: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uWarm;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec3 c = texture2D(tDiffuse, uv).rgb;
      /* vignette */
      vec2 q = uv - 0.5;
      float v = 1.0 - uVignette * dot(q, q) * 1.9;
      c *= v;
      /* a whisper of grain so the whole thing feels printed */
      float g = hash(uv * vec2(1920.0, 1080.0) + fract(uTime) * 91.0) - 0.5;
      c += g * uGrain;
      /* gentle split tone: cool shadows, warm highs */
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, c * vec3(0.93, 0.98, 1.09), (1.0 - l) * 0.35);
      c = mix(c, c * vec3(1.06, 1.01, 0.92), l * 0.3 + uWarm);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export class App {
  constructor(options = {}) {
    const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
    this.quality = options.quality || params.get('quality') || 'high';
    this.q = QUALITY[this.quality] || QUALITY.high;
    this.density = options.density ?? 1;
    this.cut = options.cut ?? CUT0;
    this.cutAuto = false;
    this.photo = options.photo ?? params.get('photo') === '1';
    this.time = 0;
    this.frameMs = 16;
    this.fps = 60;
    this.systems = [];
    this.ready = false;
    this.inkScale = 0.021;
  }

  init() {
    const stage = document.getElementById('stage');
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.quality !== 'fast',
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.dpr));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.localClippingEnabled = true;
    this.renderer.info.autoReset = false;
    stage.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(31, window.innerWidth / window.innerHeight, 0.6, 900);
    this.camera.position.set(6, 8, 106);

    /* the cutting plane: everything at z > cut is sliced away */
    this.cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), this.cut);

    this.sky = new Sky(this.scene, this.renderer);
    if (this.photo) this.sky.dial.auto = false;
    if (typeof location !== 'undefined') {
      const t = parseFloat(new URLSearchParams(location.search).get('time'));
      if (!Number.isNaN(t)) {
        this.sky.dial.hour = t;
        this.sky.dial.auto = false;
      }
    }
    this.dial = this.sky.dial;

    this.skin = new SectionSkin();
    this.scene.add(this.skin.mesh);
    this.earth = new EarthFace();
    this.scene.add(this.earth.mesh);
    /* rock backings so every excavation reads as ground, not as sky */
    this.backdrops = [
      new EarthFace({ zAt: -16.4, dim: 1.02, top: 0.1 }),
      new EarthFace({ zAt: -27.5, dim: 0.86, top: 0.1 }),
      new EarthFace({ zAt: -44.0, dim: 0.7, top: 0.1 }),
    ];
    for (const b of this.backdrops) this.scene.add(b.mesh);
    this.earth.uniforms.uCut.value = this.cut;
    this.skin.uniforms.uCut.value = this.cut;

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.ctx = new Ctx({ skin: this.skin, earth: this.earth, plane: this.cutPlane, quality: this.quality });
    this.ctx.q = this.q;

    this.rig = new Rig(this.camera, this.renderer.domElement);
    this.rig.cutZ = this.cut;
    this.rig.applyPreset('hero', true);

    this._post();
    window.addEventListener('resize', () => this.resize());
    return this;
  }

  _post() {
    const { renderer, scene, camera } = this;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.q.bloom, 0.72, 0.66);
    this.bloom.enabled = this.q.bloom > 0 && !this.photo;
    this.bloomOn = this.bloom.enabled;
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GRADE);
    this.grade.enabled = this.q.grade;
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  build() {
    const t0 = performance.now();
    buildStructures(this.ctx);
    buildBelow(this.ctx);
    buildInteriors(this.ctx);
    buildStreet(this.ctx);
    this.ctx.finish(this.world);
    this.skin.upload();
    this.earth.update({ cut: this.cut, day: 1, time: 0, ink: this.inkScale });
    /* the living systems, in dependency order */
    this.lifts = this.addSystem(new Lifts(this));
    this.trains = this.addSystem(new Trains(this));
    this.traffic = this.addSystem(new Traffic(this));
    this.fx = this.addSystem(new FX(this));
    this.life = this.addSystem(new Life(this));
    this.buildMs = performance.now() - t0;
    return this;
  }

  addSystem(sys) {
    this.systems.push(sys);
    return sys;
  }

  /* ── controls ─────────────────────────────────────────────────────────── */
  setCut(v) {
    this.cut = clamp(v, CUT_MIN, CUT_MAX);
    this.cutPlane.constant = this.cut;
    this.skin.setCut(this.cut);
    this.earth.update({ cut: this.cut, day: this.dial.day, time: this.time, ink: this.inkScale });
    this.rig.cutZ = this.cut;
    return this.cut;
  }

  setCutAuto(v) {
    this.cutAuto = v;
    return this.cutAuto;
  }

  setTime(h) {
    this.dial.hour = ((h % 24) + 24) % 24;
    this.dial.auto = false;
    return this.dial.hour;
  }

  setDayAuto(v) { this.dial.auto = v; }
  setDayRate(r) { this.dial.rate = r; }
  setDolly(v) { this.rig.dolly = v; if (!v) this.rig.idle = 0; }
  setDensity(v) {
    this.density = clamp(v, 0.05, 1.6);
    for (const s of this.systems) s.onDensity?.(this.density);
  }

  setQuality(q) {
    if (!QUALITY[q]) return;
    this.quality = q;
    this.q = QUALITY[q];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.dpr));
    this.bloom.strength = this.q.bloom;
    this.bloom.enabled = this.q.bloom > 0 && !this.photo;
    this.bloomOn = this.bloom.enabled;
    this.grade.enabled = this.q.grade;
    this.resize();
    for (const s of this.systems) s.onQuality?.(q);
  }

  setPhoto(v) {
    this.photo = v;
    this.ui?.setPhoto(v);
    this.bloom.enabled = this.q.bloom > 0 && !v;
    this.bloomOn = this.q.bloom > 0 && !v;
  }

  applyPreset(id, instant = false) {
    const p = this.rig.applyPreset(id, instant);
    if (p?.cut !== undefined) this.setCut(p.cut);
    return p;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  /* ── readouts for the harness ─────────────────────────────────────────── */
  get stats() {
    const info = this.renderer.info;
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      frameMs: this.frameMs,
    };
  }

  census() {
    let meshes = 0;
    let instances = 0;
    let figures = 0;
    this.scene.traverse((o) => {
      if (o.isInstancedMesh) {
        instances += o.count;
        if (o.name === 'figures') figures = o.count;
      } else if (o.isMesh) meshes += 1;
    });
    return {
      meshes,
      instances,
      figures,
      cutFaces: this.skin.used,
      cutInstancesCapacity: this.skin.capacity,
      earthVoids: this.earth.voids.length,
      earthHolesLive: this.earth.uniforms.uHoleCount.value,
      solids: this.ctx.stats.solids,
      systems: this.systems.map((s) => s.name ?? 'system'),
      buildMs: Math.round(this.buildMs ?? 0),
      quality: this.quality,
      cut: Number(this.cut.toFixed(2)),
      hour: Number(this.dial.hour.toFixed(2)),
    };
  }

  stateLabel() {
    const p = this.dial.profile;
    if (p.night > 0.55) return 'late-night skeleton crew';
    if (p.outflow > 0.5) return 'morning outflow';
    if (p.inflow > 0.5) return 'evening return';
    if (this.dial.day > 0.5) return 'midday hum';
    return 'dusk settling in';
  }

  trainLabel() {
    return this.trains ? this.trains.label : '—';
  }

  peopleCount() {
    return this.systems.reduce((n, s) => n + (s.count?.() ?? 0), 0);
  }

  liftLabel() {
    return this.lifts ? this.lifts.liftLabel : '—';
  }

  /* ── the loop ─────────────────────────────────────────────────────────── */
  start() {
    this.ui = buildUI(this);
    let last = performance.now();
    const tick = (now) => {
      const raw = (now - last) / 1000;
      last = now;
      const dt = clamp(raw, 0.0005, 0.06);
      this.frameMs = lerp(this.frameMs, raw * 1000, 0.08);
      this.fps = lerp(this.fps, 1 / clamp(raw, 0.0005, 1), 0.08);
      this.time += dt;
      this.step(dt);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  step(dt) {
    this.renderer.info.reset();
    this.dial.update(dt);
    const day = this.dial.day;

    if (this.cutAuto) {
      const span = CUT_MAX - CUT_MIN;
      const k = (Math.sin(this.time * 0.14) * 0.5 + 0.5);
      this.setCut(CUT_MIN + span * k);
    }

    this.rig.update(dt, this.time);

    /* ink weight follows the lens so the drawing lines never disappear */
    const dist = this.rig.pos ? this.rig.pos.distanceTo(this.rig.target) : 100;
    /* world metres per pixel on the section plane — drives every pattern LOD */
    this.px = (2 * dist * Math.tan((this.camera.fov * Math.PI / 180) / 2)) / Math.max(1, this.renderer.domElement.height / this.renderer.getPixelRatio());
    this.inkScale = this.px * 1.45;
    this.skin.update({ time: this.time, day, inkScale: this.inkScale, px: this.px });
    this.earth.update({ cut: this.cut, day, time: this.time, ink: this.inkScale * 0.9, px: this.px });
    for (const b of this.backdrops) b.update({ cut: this.cut, day, time: this.time, ink: this.inkScale, px: this.px });

    const ctx = { dt, time: this.time, day, dial: this.dial, density: this.density, cut: this.cut };
    for (const s of this.systems) s.update(ctx);

    const pick = this.ctx.matPick;
    if (pick) {
      pick.glow.color.setScalar(0.95 + 1.0 * (1 - day));
      pick.beacon.color.setScalar(0.86 + 0.4 * (1 - day));
    }
    /* a lens fill so the sliced interiors read from the front, like a photographer's bounce */
    if (this.rig.pos) {
      this.sky.fill.position.copy(this.rig.pos).sub(this.rig.target).normalize().multiplyScalar(140);
      this.sky.bounce.position.copy(this.sky.fill.position).multiplyScalar(0.6).setY(-40);
    }
    this.grade.uniforms.uTime.value = this.time;
    this.grade.uniforms.uWarm.value = (1 - day) * 0.03;
    this.sky.update(this.rig.pos);
    this.composer.render();
    this.ui?.tick(dt, this);
    this.ready = true;
  }
}
