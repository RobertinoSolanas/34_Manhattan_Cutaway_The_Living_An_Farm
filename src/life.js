/**
 * src/life.js — who is where, and what happens when a train arrives.
 *
 * The population is scheduled, not random: offices fill at nine, the diner at
 * one in the afternoon and again at nine at night, apartments in the evening,
 * the platform around every service. When a local opens its doors the exchange
 * is real — people step out, walk the platform, climb the entrance stair and
 * disperse into the street, while a handful of street people turn around and go
 * down. That pulse is what ties the top of the drawing to the bottom.
 */

import { Crowd, POSE } from './people.js';
import { INTERIOR } from './interiors.js';
import { BUILDINGS, LEVEL, UPPER, GALLERY, STREET, SCHEDULE } from './layout.js';
import { rng, clamp, lerp, smoothstep, wrap } from './util.js';

const SCHED_FOR = {
  kitchen: 'apartment', living: 'apartment', bedroom: 'apartment', bath: 'apartment',
  office: 'office', meeting: 'office', study: 'office', exec: 'office', lunch: 'office',
  retail: 'retail', diner: 'diner', lobby: 'lobby', bankLobby: 'vault',
  clinic: 'clinic', clinicExam: 'clinic', dance: 'dance', studio2: 'dance',
  boiler: 'industrial', laundry: 'industrial', workshop: 'industrial', woodShop: 'industrial',
  vault: 'vault', strongroom: 'vault', parking: 'industrial', garage: 'industrial',
  freight: 'industrial', storage: 'industrial', electrical: 'industrial', bikeStore: 'industrial',
  mechanical: 'industrial', backstage: 'industrial', sump: 'industrial', coal: 'industrial',
};

export class Life {
  constructor(app) {
    this.app = app;
    this.R = rng(60613);
    this.crowd = new Crowd(app);
    app.scene.add(this.crowd.mesh);
    this.streetTarget = 0;
    this.platformFolk = [];
    this.anchors = INTERIOR.anchors.map((a) => ({ a, p: null }));
    this.anchorCursor = 0;
    this.exitQueue = [];
    this.boarders = new Set();
    this.lastArrived = 0;
    this.doorWasOpen = 0;
    this.roofCrew = [];
    this.liftRiders = [];
    this.streetCount = 0;
    this.stationX = 12.0;
    this.platformPath = { x0: UPPER.x0 + 2, x1: UPPER.x1 - 2, z0: UPPER.platformZ0 + 0.75, z1: UPPER.platformZ1 - 0.75 };
    this.stairBottom = { x: 11.9, y: UPPER.platTop + 0.3, z: -1.9 };
    this.stairTop = { x: 12.4, y: 0.18, z: -5.0 };
    this.seeded = false;
  }

  get name() { return 'life'; }
  count() { return this.crowd.count(); }

  onDensity() { this.seed(); }

  /* ── the seed population ───────────────────────────────────────────────── */
  seed() {
    const R = this.R;
    const c = this.crowd;
    /* clear dynamic groups, keep anchor residents */
    c.people.length = 0;
    for (const rec of this.anchors) rec.p = null;
    this.platformFolk.length = 0;
    this.liftRiders.length = 0;
    this.roofCrew.length = 0;

    const q = this.app.q.crowd ?? 1;

    /* street: a bidirectional stream on the sidewalk */
    const nStreet = Math.round(46 * q);
    for (let i = 0; i < nStreet; i += 1) {
      const z = 1.15 + R() * 1.9;
      c.add({
        x: -40 + R() * 80, y: 0.155, z,
        pose: POSE.WALK,
        speed: 0.4 + R() * 0.7,
        path: { x0: -42 + R() * 6, x1: 40 + R() * 5, z0: z + (R() - 0.5) * 0.3, z1: z + (R() - 0.5) * 0.3 },
        speedBase: 1.05 + R() * 0.75,
      });
    }
    /* a few waiting at the bus stop and crossing */
    for (let i = 0; i < 4; i += 1) {
      c.add({ x: 15.2 + R() * 2.4, y: 0.155, z: 2.2 + R() * 0.8, pose: POSE.PHONE, speed: 0.1 });
    }
    /* the delivery that wheels a hand truck into the freight entrance */
    for (let i = 0; i < 2; i += 1) {
      c.add({
        x: 30.2, y: 0.155, z: 2.6,
        pose: POSE.WALK, speed: 0.4,
        path: { x0: 30.4, x1: 30.0, z0: 3.0, z1: -3.0, y0: 0.155, y1: -0.1 },
        speedBase: 0.9,
        mode: 'loop',
      });
    }

    /* platform: waiting for the next local */
    const nPlat = Math.round(26 * q);
    for (let i = 0; i < nPlat; i += 1) {
      const p = c.add({
        x: UPPER.x0 + 2 + R() * (UPPER.x1 - UPPER.x0 - 4),
        y: UPPER.platTop,
        z: lerp(UPPER.platformZ0 + 0.5, UPPER.platformZ1 - 0.5, R()),
        pose: R.chance(0.28) ? POSE.PHONE : POSE.STAND,
        speed: 0.12,
        path: { x0: UPPER.x0 + 2.5, x1: UPPER.x1 - 2.5, z0: 0, z1: 0 },
        speedBase: 0.85,
      });
      if (p) {
        p.path.z0 = lerp(UPPER.platformZ0 + 0.5, UPPER.platformZ1 - 0.5, R());
        p.path.z1 = lerp(UPPER.platformZ0 + 0.5, UPPER.platformZ1 - 0.5, R());
        p.onPlatform = true;
        this.platformFolk.push(p);
      }
    }

    /* the service gallery: track workers with headlamps */
    for (let i = 0; i < 4; i += 1) {
      c.add({
        x: GALLERY.x0 + 2 + i * 5.5, y: GALLERY.floorY + 0.1, z: GALLERY.z0 + 1.6 + (i % 2) * 1.4,
        pose: i % 2 ? POSE.WORK : POSE.WALK,
        speed: 0.3,
        path: { x0: GALLERY.x0 + 1.5, x1: GALLERY.x1 - 2, z0: GALLERY.z0 + 1.4, z1: GALLERY.z0 + 2.4 },
        speedBase: 0.7,
        lamp: true,
        coat: '#e07a2c',
      });
    }
    /* a rat or two — this is honest Manhattan */
    for (let i = 0; i < 3; i += 1) {
      this.dog = null;
    }

    /* lift riders: two per car on two shafts, glued to the cab floor */
    if (this.app.lifts) {
      for (const sh of this.app.lifts.shafts.slice(0, 4)) {
        const n = 1 + Math.floor(R() * 2);
        for (let i = 0; i < n; i += 1) {
          const p = c.add({ x: sh.x, y: sh.y + 0.1, z: sh.geo.z0 + 0.75, pose: POSE.STAND, speed: 0.08 });
          if (p) this.liftRiders.push({ p, sh, off: (i - 0.5) * 0.42 });
        }
      }
    }
    this.seeded = true;
  }

  /* ── scheduled interior occupancy ──────────────────────────────────────── */
  scheduleValue(type, hour) {
    const key = SCHED_FOR[type] || 'apartment';
    const table = SCHEDULE[key] || SCHEDULE.apartment;
    for (let i = 0; i < table.length - 1; i += 1) {
      const [t0, v0] = table[i];
      const [t1, v1] = table[i + 1];
      if (hour <= t1) {
        const k = smoothstep(t0, t1, hour);
        return lerp(v0, v1, k);
      }
    }
    return table[table.length - 1][1];
  }

  tendAnchors(hour, density, dial) {
    const q = this.app.q.crowd ?? 1;
    const budget = Math.round(this.anchors.length * 0.62 * q * clamp(density, 0.1, 1.5));
    /* revisit a slice of the anchors every frame so changes ripple through */
    const stepN = Math.max(3, Math.round(this.anchors.length / 90));
    for (let s = 0; s < stepN; s += 1) {
      this.anchorCursor = (this.anchorCursor + 1) % this.anchors.length;
      const rec = this.anchors[this.anchorCursor];
      const a = rec.a;
      const occ = this.scheduleValue(a.room, hour) * (a.pose === 'sit' ? 0.9 : 1);
      const want = this.R() < occ * 0.92 && this.crowd.count() < budget;
      if (want && !rec.p) {
        const pose = a.pose === 'sit' ? POSE.SIT : a.pose === 'work' ? POSE.WORK : a.pose === 'dance' ? POSE.DANCE : a.pose === 'cello' ? POSE.CELLO : a.pose === 'dog' ? POSE.STAND : POSE.STAND;
        const p = this.crowd.add({
          x: a.x, y: a.y + 0.04, z: a.z, ry: a.ry ?? 0, pose,
          speed: pose === POSE.DANCE ? 0.6 : 0.1,
          scale: 0.94 + this.R() * 0.12,
        });
        rec.p = p;
      } else if (!want && rec.p) {
        const idx = this.crowd.people.indexOf(rec.p);
        if (idx >= 0) this.crowd.people.splice(idx, 1);
        rec.p = null;
      }
    }
  }

  /* ── the train exchange ────────────────────────────────────────────────── */
  exchange(dt, trains, dial) {
    if (!trains) return;
    const local = trains.local[0];
    const R = this.R;
    const U = UPPER;

    /* doors just opened: let people out */
    if (local.state === 'dwell' && trains.doorOpen > 0.6 && this.doorWasOpen <= 0.6) {
      const n = Math.round((6 + 12 * clamp(dial.profile.crowd, 0, 1.3)) * (this.app.q.crowd ?? 1));
      for (let i = 0; i < n; i += 1) {
        const carIdx = Math.floor(R() * local.cars);
        const doorX = local.x - local.dir * (carIdx + 0.5) * (12.2 + 0.35) + local.dir * 6.1 + (R.pick([-4.6, -2.2, 0.2, 2.6, 4.9]) || 0) * (local.dir > 0 ? 1 : -1);
        const px = clamp(doorX, U.x0 + 1.5, U.x1 - 1.5);
        const pz = clamp(U.platformZ0 + 0.9 + R() * 0.8, U.platformZ0 + 0.5, U.platformZ1 - 0.5);
        const p = this.crowd.add({
          x: px, y: U.platTop, z: pz,
          pose: POSE.WALK, speed: 0.55,
          speedBase: 1.0 + R() * 0.5,
          wait: 0.6 + R() * 3.2,
        });
        if (!p) break;
        /* out across the platform, up the stairs, into the street */
        const mid = { x: this.stairBottom.x + (R() - 0.5) * 1.2, y: U.platTop, z: this.stairBottom.z };
        const top = { x: this.stairTop.x, y: this.stairTop.y, z: this.stairTop.z };
        const street = { x: 8 + R() * 20, y: 0.155, z: 1.3 + R() * 1.8 };
        p.target = mid;
        p.next = { x: top.x, y: top.y, z: top.z, yTrack: (x, z) => lerp(U.platTop + 0.3, 0.18, clamp((this.stairBottom.z - z) / (this.stairBottom.z - this.stairTop.z), 0, 1)), next: { x: street.x, y: 0.155, z: street.z, onArrive: (pp) => {
          pp.onPlatform = false;
          pp.path = { x0: -42, x1: 42, z0: pp.z, z1: pp.z + (R() - 0.5) * 0.4 };
          pp.mode = 'loop';
          pp.speedBase = 1.05 + R() * 0.7;
          pp.streetJoin = true;
        } } };
        p.yTrack = null;
      }
      /* and turn some platform waiters toward the doors */
      let taken = 0;
      for (const p of this.platformFolk) {
        if (taken > 7) break;
        if (!p.target && R.chance(0.5)) {
          const carIdx = Math.floor(R() * local.cars);
          const doorX = local.x - local.dir * (carIdx + 0.5) * (12.2 + 0.35) + local.dir * 6.1 + (R.pick([-4.6, -2.2, 0.2, 2.6, 4.9]) || 0);
          this.crowd.send(p, { x: clamp(doorX, U.x0 + 1, U.x1 - 1), y: U.platTop, z: U.platformZ0 + 1.0 });
          p.boarding = true;
          taken += 1;
        }
      }
    }
    this.doorWasOpen = trains.doorOpen;

    /* doors closing: anyone at the door steps into the car and is gone */
    if (local.state === 'dwell' && trains.doorOpen < 0.25) {
      for (let i = this.platformFolk.length - 1; i >= 0; i -= 1) {
        const p = this.platformFolk[i];
        if (p.boarding && p.target && Math.abs(p.x - p.target.x) < 0.7) {
          p.life = 0.35;
          p.pose = POSE.WALK;
          this.platformFolk.splice(i, 1);
        } else if (p.boarding && !p.target) {
          p.boarding = false;
        }
      }
    }

    /* after a departure the platform slowly refills from the street */
    if (local.state !== 'dwell') {
      const wantPlat = Math.round((10 + 22 * clamp(dial.profile.crowd, 0, 1.3)) * (this.app.q.crowd ?? 1));
      if (this.platformFolk.length < wantPlat && R.chance(0.55)) {
        /* find a street walker and send them down */
        const cand = this.crowd.people.find((p) => p.streetJoin || (!p.onPlatform && !p.target && p.y > 0 && Math.abs(p.y - 0.155) < 0.1));
        if (cand) {
          cand.streetJoin = false;
          cand.onPlatform = true;
          cand.target = { x: this.stairTop.x, y: this.stairTop.y, z: this.stairTop.z };
          cand.next = {
            x: this.stairBottom.x, y: UPPER.platTop, z: this.stairBottom.z,
            yTrack: (x, z) => lerp(0.18, UPPER.platTop + 0.3, clamp((this.stairTop.z - z) / (this.stairTop.z - this.stairBottom.z), 0, 1)),
            onArrive: (pp) => {
              pp.path = { x0: UPPER.x0 + 3, x1: UPPER.x1 - 3, z0: lerp(UPPER.platformZ0 + 0.6, UPPER.platformZ1 - 0.6, Math.random()), z1: lerp(UPPER.platformZ0 + 0.6, UPPER.platformZ1 - 0.6, Math.random()) };
              pp.speedBase = 0.85;
              pp.mode = 'loop';
              this.platformFolk.push(pp);
            },
          };
        }
      }
    }

    /* keep the platform list tidy */
    for (let i = this.platformFolk.length - 1; i >= 0; i -= 1) {
      if (this.crowd.people.indexOf(this.platformFolk[i]) < 0) this.platformFolk.splice(i, 1);
    }
  }

  roofLife(hour, dial) {
    const R = this.R;
    const want = (hour > 20.5 || hour < 3.5) ? 2 : (hour > 12 && hour < 15 ? 1 : 0);
    while (this.roofCrew.length < want) {
      const b = BUILDINGS.find((x) => x.roof?.type === 'watertower') || BUILDINGS[0];
      const p = this.crowd.add({
        x: b.x0 + 3.2 + R() * 1.6, y: b.top + 0.36, z: -3.2 - R() * 1.4,
        pose: R.chance(0.5) ? POSE.PHONE : POSE.STAND, speed: 0.08,
      });
      if (p) this.roofCrew.push(p);
    }
    while (this.roofCrew.length > want) {
      const p = this.roofCrew.pop();
      const i = this.crowd.people.indexOf(p);
      if (i >= 0) this.crowd.people.splice(i, 1);
    }
  }

  update(ctx) {
    const { dt, time, dial, density } = ctx;
    if (!this.seeded) this.seed();
    const hour = dial.hour;

    /* global street density follows the hour */
    const wantStreet = clamp(dial.profile.crowd, 0.05, 1.4);
    const street = this.crowd.people.filter((p) => p.y > 0 && p.path && !p.onPlatform);
    const targetStreet = Math.round(46 * (this.app.q.crowd ?? 1) * wantStreet);
    if (street.length > targetStreet + 3 && R0() < 0.35) {
      const victim = street[Math.floor(R0() * street.length)];
      const i = this.crowd.people.indexOf(victim);
      if (i >= 0) this.crowd.people.splice(i, 1);
    } else if (street.length < targetStreet) {
      const z = 1.15 + R0() * 1.9;
      this.crowd.add({
        x: R0() < 0.5 ? -42 : 42, y: 0.155, z,
        pose: POSE.WALK, speed: 0.4 + R0() * 0.6,
        path: { x0: -42, x1: 42, z0: z, z1: z + (R0() - 0.5) * 0.4 },
        speedBase: 1.0 + R0() * 0.8,
      });
    }

    this.tendAnchors(hour, density, dial);
    this.exchange(dt, this.app.trains, dial);
    this.roofLife(hour, dial);

    /* lift riders ride with their cab */
    for (const r of this.liftRiders) {
      if (!r.sh) continue;
      r.p.x = r.sh.x + r.off;
      r.p.y = r.sh.y + 0.1;
      r.p.z = r.sh.geo.z0 + 0.75;
    }

    this.crowd.update(ctx);
    this.streetCount = this.crowd.count();
  }
}

let _r = 1;
function R0() {
  _r = (_r * 16807) % 2147483647;
  return _r / 2147483647;
}
