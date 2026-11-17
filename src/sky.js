/**
 * src/sky.js — the day/night dial: sun, sky dome, fog, exposure and the
 * activity profiles that the whole city is wired to.
 */

import * as THREE from 'three';
import { ramp, clamp, lerp, smoothstep, wrap, rng } from './util.js';
import { NOISE } from './glsl.js';
import { P } from './palette.js';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uSunUp;
uniform float uHaze;
uniform float uTime;

${NOISE}

float starField(vec3 d) {
  vec3 p = d * 260.0;
  vec3 c = floor(p);
  float h = hash21(vec2(c.x * 1.37 + c.z * 0.71, c.y * 2.13 - c.z * 0.31));
  float s = smoothstep(0.9975, 1.0, h);
  float tw = 0.6 + 0.4 * sin(uTime * 2.1 + h * 90.0);
  return s * tw;
}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y * 1.0, -1.0, 1.0);
  vec3 sky = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.62));
  /* city haze pooled at the horizon */
  float haze = exp(-abs(h) * 5.5);
  sky = mix(sky, uHorizon * 1.1 + vec3(0.04, 0.03, 0.015), haze * uHaze * 0.7);
  if (h < 0.0) sky = mix(uHorizon, uGround, smoothstep(0.0, -0.35, h));

  /* sun + its bloom in the atmosphere */
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  float disc = smoothstep(0.9988, 0.99955, sd);
  float glow = pow(sd, 26.0) * 0.55 + pow(sd, 5.0) * 0.16;
  sky += uSunColor * (disc * 2.6 + glow) * clamp(uSunUp * 1.4 + 0.25, 0.0, 1.4);

  /* stars after dusk */
  float night = clamp(-uSunUp * 3.0, 0.0, 1.0);
  sky += vec3(0.85, 0.9, 1.0) * starField(d) * night * smoothstep(-0.02, 0.25, h) * 1.5;

  gl_FragColor = vec4(sky, 1.0);
}
`;

export class Dial {
  constructor() {
    this.hour = 17.2;
    this.auto = true;
    this.rate = 0.14;          // hours per second
    this.day = 1;
    this.dusk = 0;
    this.profile = { outflow: 0, inflow: 0, hum: 0, night: 0, crowd: 0.5, steam: 0.4 };
  }

  update(dt) {
    if (this.auto) this.hour = wrap(this.hour + dt * this.rate, 24);
    const h = this.hour;
    /* sun geometry — a plausible mid-latitude arc, street canyon lighting */
    const el = Math.sin(((h - 6.0) / 13.0) * Math.PI);
    const az = lerp(-1.05, 1.05, clamp((h - 5.4) / 13.2, 0, 1));
    const elev = Math.asin(clamp(el, -1, 1));
    this.elevation = elev;
    this.sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(elev) * 0.62 + 0.42).normalize();
    this.day = smoothstep(-0.06, 0.16, Math.sin(elev));
    this.dusk = Math.max(0, 1 - Math.abs(Math.sin(elev)) / 0.22) * (h > 12 ? 1 : 0.7);
    this.night = 1 - this.day;

    /* crowd / activity profiles — morning outflow, midday hum, evening return */
    const p = this.profile;
    p.outflow = Math.exp(-Math.pow((h - 8.1) / 1.15, 2));
    p.inflow = Math.exp(-Math.pow((h - 17.6) / 1.5, 2));
    p.hum = 0.32 + 0.5 * Math.exp(-Math.pow((h - 13.0) / 3.4, 2));
    p.night = smoothstep(21.5, 25.0, h > 12 ? h : h + 24) * 0.9 + smoothstep(5.4, 3.0, h) * 0.7;
    p.crowd = clamp(0.12 + p.outflow * 0.9 + p.inflow * 0.95 + p.hum * 0.55 - smoothstep(1.0, 5.0, h) * 0.55, 0.06, 1.35);
    p.steam = 0.35 + 0.65 * Math.exp(-Math.pow((h - 6.8) / 3.2, 2)) + 0.4 * Math.exp(-Math.pow((h - 19.0) / 4.0, 2));
    p.interiors = clamp(0.25 + 0.85 * smoothstep(16.2, 19.6, h) + 0.45 * smoothstep(7.6, 5.4, h), 0.2, 1.35);
  }
}

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.dial = new Dial();

    const geo = new THREE.SphereGeometry(460, 32, 20);
    this.uniforms = {
      uZenith: { value: new THREE.Color('#3f79b8') },
      uHorizon: { value: new THREE.Color('#c8dbe8') },
      uGround: { value: new THREE.Color('#2a3742') },
      uSunColor: { value: new THREE.Color('#fff0cf') },
      uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.6) },
      uSunUp: { value: 1 },
      uHaze: { value: 0.6 },
      uTime: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    scene.fog = new THREE.Fog(new THREE.Color('#b6cbdb'), 90, 260);

    this.ambient = new THREE.AmbientLight(new THREE.Color('#7d9bb4'), 0.62);
    scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(new THREE.Color('#cfe4f5'), new THREE.Color('#4a4238'), 0.55);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(new THREE.Color('#fff2d8'), 2.2);
    scene.add(this.sun);
    this.fill = new THREE.DirectionalLight(new THREE.Color('#b9d4ea'), 0.5);
    this.fill.position.set(-0.55, 0.25, 0.9);
    scene.add(this.fill);
    this.bounce = new THREE.DirectionalLight(new THREE.Color('#ffd9b0'), 0.28);
    this.bounce.position.set(0.2, -0.7, 0.55);
    scene.add(this.bounce);

    /* underground service light pools */
    this.tunnelLights = [];
    const spots = [
      [-14, -12.0, -4.6, '#ffd9a8', 26, 0.7],
      [-2, -12.0, -4.6, '#ffe4bc', 30, 0.7],
      [8, -12.0, -4.6, '#ffd9a8', 26, 0.7],
      [-8, -13.0, -10.4, '#cfe0ff', 24, 0.5],
      [26, -15.4, -5.0, '#cfe6ff', 22, 0.55],
      [-24, -22.4, -2.7, '#ffd6a0', 26, 0.6],
      [14, -22.4, -2.7, '#ffd6a0', 26, 0.6],
      [-22, -6.4, -3.6, '#ffe8c8', 20, 0.45],
      [12, -6.4, -3.6, '#ffe8c8', 20, 0.45],
      [28, -11.6, -4.0, '#dfe9ff', 18, 0.4],
      [-32, -10.6, -4.4, '#ffe2b4', 24, 0.5],
      [-13, -10.6, -4.4, '#ffe2b4', 24, 0.5],
      [5, -10.6, -4.4, '#ffe2b4', 24, 0.5],
      [23, -10.6, -4.4, '#ffe2b4', 24, 0.5],
      [-8, -15.4, -6.8, '#e8f2ff', 26, 0.55],
      [6, -19.4, -3.0, '#cfe2f5', 26, 0.4],
      [-26, -19.4, -3.0, '#cfe2f5', 26, 0.4],
    ];
    for (const [x, y, z, c, d, i] of spots) {
      const l = new THREE.PointLight(new THREE.Color(c), i, d, 1.7);
      l.position.set(x, y, z);
      scene.add(l);
      this.tunnelLights.push(l);
    }
  }

  update(cameraPos) {
    const d = this.dial;
    const h = d.hour;
    const u = this.uniforms;

    u.uSunDir.value.copy(d.sunDir);
    u.uSunUp.value = Math.sin(d.elevation);
    u.uTime.value += 1 / 60;

    const dayF = d.day;
    const duskF = d.dusk;
    u.uZenith.value.copy(new THREE.Color('#0b1421').lerp(new THREE.Color('#2f68b0'), dayF));
    u.uHorizon.value.copy(new THREE.Color('#1b2a3c'));
    u.uHorizon.value.lerp(new THREE.Color('#a6c8e6'), dayF);
    u.uHorizon.value.lerp(new THREE.Color('#f2a35e'), duskF * 0.75);
    u.uGround.value.copy(new THREE.Color('#101821').lerp(new THREE.Color('#4a5560'), dayF * 0.8));
    u.uSunColor.value.copy(new THREE.Color('#ff9a4d')).lerp(new THREE.Color('#fff4dd'), clamp(dayF * 1.5, 0, 1));
    u.uHaze.value = 0.3 + 0.45 * duskF + 0.2 * (1 - dayF);

    this.sun.position.copy(d.sunDir).multiplyScalar(160).add(new THREE.Vector3(0, 20, 60));
    const high = smoothstep(0.06, 0.45, Math.sin(d.elevation));
    this.sun.color.copy(new THREE.Color('#ffb473')).lerp(new THREE.Color('#fff6ea'), high);
    this.sun.intensity = 3.4 * smoothstep(-0.06, 0.24, Math.sin(d.elevation)) + 0.04;
    this.hemi.intensity = 0.3 + 0.18 * dayF;
    this.hemi.color.copy(new THREE.Color('#26384d')).lerp(new THREE.Color('#cfe2f7'), dayF);
    this.ambient.intensity = 0.44 + 0.08 * dayF;
    this.ambient.color.copy(new THREE.Color('#3d607a')).lerp(new THREE.Color('#9dbdd8'), dayF);
    this.fill.intensity = 0.17 + 0.26 * dayF;
    this.bounce.intensity = 0.24 + 0.1 * dayF;

    for (const l of this.tunnelLights) {
      l.intensity = l.userData.base ?? (l.userData.base = l.intensity);
      l.intensity = l.userData.base * (0.78 + 0.5 * (1 - dayF));
    }

    /* fog tracks the sky and stays out of the way of the cut face */
    const dist = cameraPos ? cameraPos.length() : 100;
    this.scene.fog.color.copy(u.uHorizon.value).lerp(u.uZenith.value, 0.35);
    this.scene.fog.near = dist * 0.86;
    this.scene.fog.far = dist * 2.4 + 60;

    this.renderer.toneMappingExposure = lerp(1.24, 1.0, dayF) * (0.94 + 0.1 * duskF);
  }
}
