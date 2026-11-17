/**
 * src/camera.js — the lens rig.
 *
 * Default motion is a lateral dolly that keeps the section face parallel to
 * the picture plane (the way you read a drawing), with free orbit inside
 * sensible limits so you can look into rooms at an angle without ever getting
 * behind the cut. Presets tween; nothing teleports.
 */

import * as THREE from 'three';
import { clamp, damp, lerp, easeInOut, rng } from './util.js';

export const PRESETS = [
  { id: 'hero', label: 'Full section', target: [-1.0, 4.8, -2], dist: 136, theta: 0.085, phi: 1.447 },
  { id: 'heroWide', label: 'Whole block', target: [0, 4.2, -2], dist: 152, theta: -0.03, phi: 1.495 },
  { id: 'street', label: 'Street edge', target: [4.5, 0.2, 3.0], dist: 25, theta: 0.13, phi: 1.12 },
  { id: 'platform', label: 'Platform', target: [-1.5, -13.85, -4.4], dist: 19, theta: 0.17, phi: 1.572 },
  { id: 'utility', label: 'Utility stratum', target: [-4.5, -11.2, -3.2], dist: 12.5, theta: 0.14, phi: 1.56 },
  { id: 'express', label: 'Express tube', target: [3, -24.0, -2.4], dist: 15.5, theta: 0.155, phi: 1.47 },
  { id: 'stack', label: 'Apartment stack', target: [-22.5, 17.5, -3], dist: 21, theta: 0.185, phi: 1.46 },
  { id: 'roof', label: 'Roof & tank', target: [-25.5, 37.5, -4.4], dist: 18.5, theta: 0.21, phi: 1.28 },
  { id: 'footing', label: 'Foundations & rock', target: [-17, -13.4, -3], dist: 19, theta: 0.14, phi: 1.5 },
  { id: 'gallery', label: 'Service gallery', target: [25, -15.6, -5.4], dist: 13.5, theta: 0.19, phi: 1.56 },
];

export class Rig {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.target = new THREE.Vector3(-2, 3.4, -2);
    this.goal = { target: this.target.clone(), dist: 106, theta: 0.085, phi: 1.435 };
    this.cur = { dist: 106, theta: 0.085, phi: 1.435 };
    this.dist = 106;
    this.theta = 0.085;
    this.phi = 1.435;
    this.minDist = 6;
    this.maxDist = 190;
    this.dolly = true;
    this.idle = 0;
    this.t = 0;
    this.tween = 0;
    this.cutZ = -1.75;
    this.shakeT = 0;
    this._bind(dom);
  }

  _bind(dom) {
    let down = false;
    let px = 0;
    let py = 0;
    let mode = 'orbit';
    const point = (e) => (e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY });
    const onDown = (e) => {
      if (e.target !== dom && e.button === 0) return;
      down = true;
      mode = e.button === 2 || e.shiftKey ? 'pan' : 'orbit';
      const p = point(e);
      px = p.x;
      py = p.y;
      this.idle = 0;
    };
    const onMove = (e) => {
      if (!down) return;
      const p = point(e);
      const dx = p.x - px;
      const dy = p.y - py;
      px = p.x;
      py = p.y;
      this.idle = 0;
      this.tween = 0;
      if (mode === 'orbit') {
        this.theta = clamp(this.theta - dx * 0.0042, -0.72, 0.72);
        this.phi = clamp(this.phi - dy * 0.0034, 0.92, 1.93);
      } else {
        const k = this.dist * 0.0016;
        this.target.x = clamp(this.target.x - dx * k, -44, 44);
        this.target.y = clamp(this.target.y + dy * k, -40, 46);
      }
    };
    const onUp = () => { down = false; };
    const onWheel = (e) => {
      e.preventDefault();
      this.idle = 0;
      this.tween = 0;
      this.dist = clamp(this.dist * (1 + Math.sign(e.deltaY) * 0.085), this.minDist, this.maxDist);
    };
    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('touchstart', onDown, { passive: true });
    dom.addEventListener('touchmove', onMove, { passive: true });
    dom.addEventListener('touchend', onUp);
  }

  applyPreset(id, instant = false) {
    const p = PRESETS.find((x) => x.id === id) || PRESETS[0];
    this.goal.target.set(p.target[0], p.target[1], p.target[2]);
    this.goal.dist = p.dist;
    this.goal.theta = p.theta;
    this.goal.phi = p.phi;
    this.tween = 1;
    this.presetId = p.id;
    if (instant) {
      this.target.copy(this.goal.target);
      this.dist = this.goal.dist;
      this.theta = this.goal.theta;
      this.phi = this.goal.phi;
      this.tween = 0;
    }
    return p;
  }

  update(dt, time) {
    this.t += dt;
    this.idle += dt;

    if (this.tween > 0) {
      const k = 1 - Math.pow(0.0009, dt);
      this.target.lerp(this.goal.target, k);
      this.dist = lerp(this.dist, this.goal.dist, k);
      this.theta = lerp(this.theta, this.goal.theta, k);
      this.phi = lerp(this.phi, this.goal.phi, k);
      if ((this.target.distanceTo(this.goal.target) < 0.02) && Math.abs(this.dist - this.goal.dist) < 0.05) this.tween = 0;
    } else if (this.dolly && this.idle > 3.6) {
      /* the lateral dolly: slide along the face, breathe the lens */
      const blend = smooth01((this.idle - 3.6) / 2.2);
      const t = this.t;
      const dTheta = 0.115 * Math.sin(t * 0.062) + 0.04 * Math.sin(t * 0.019 + 1.7);
      const dPhi = 0.036 * Math.sin(t * 0.043 + 0.6);
      const dDist = 1 + 0.055 * Math.sin(t * 0.037 + 2.1);
      const dX = 5.4 * Math.sin(t * 0.028) + 1.6 * Math.sin(t * 0.011);
      this.theta = lerp(this.theta, clamp(this.goal.theta + dTheta, -0.7, 0.7), blend * 0.6 * dt * 3);
      this.phi = lerp(this.phi, clamp(this.goal.phi + dPhi, 0.95, 1.9), blend * 0.6 * dt * 3);
      this.dist = lerp(this.dist, clamp(this.goal.dist * dDist, this.minDist, this.maxDist), blend * 0.5 * dt * 3);
      this.target.x = lerp(this.target.x, clamp(this.goal.target.x + dX, -40, 40), blend * 0.45 * dt * 3);
    }

    /* never let the camera pass the cutting plane */
    const sinP = Math.sin(this.phi);
    let pos = new THREE.Vector3(
      this.target.x + this.dist * sinP * Math.sin(this.theta),
      this.target.y + this.dist * Math.cos(this.phi),
      this.target.z + this.dist * sinP * Math.cos(this.theta),
    );
    const zMin = this.cutZ + Math.max(3.0, this.dist * 0.1);
    if (pos.z < zMin) {
      const scale = (zMin - this.target.z) / Math.max(pos.z - this.target.z, 1e-3);
      pos.sub(this.target).multiplyScalar(clamp(scale, 0, 1)).add(this.target);
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
    this.pos = pos;
  }
}

const smooth01 = (x) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
