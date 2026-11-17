/**
 * src/glsl.js — shared GLSL chunks (hash / value noise / fbm / ridge /
 * antialiased periodic helpers). No textures anywhere in this project.
 */

export const NOISE = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i += 1) { s += a * noise2(p); p = p * 2.07 + vec2(3.1, 1.7); a *= 0.5; }
  return s;
}
float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i += 1) { s += a * noise2(p); p = p * 2.13 + vec2(1.3, 7.7); a *= 0.5; }
  return s;
}
float ridge(vec2 p) { return 1.0 - abs(fbm3(p) * 2.0 - 1.0); }
/* antialiased periodic line mask (1 on the line) */
float lmask(float v, float period, float weight) {
  float d = abs(fract(v / period - 0.5) - 0.5) * period;
  float w = max(weight, fwidth(v) * 1.4);
  return 1.0 - smoothstep(w * 0.5, w * 1.7, d);
}
float lmaskY(vec2 v, float period, float weight) { return lmask(v.y, period, weight); }
float dotgrid(vec2 p, vec2 period, float radius) {
  vec2 c = (floor(p / period) + 0.5) * period;
  vec2 d = (p - c) / max(vec2(radius), vec2(1e-4));
  float l = length(d);
  return 1.0 - smoothstep(0.7, 1.0 - fwidth(l) * 0.7, l);
}
float speck(vec2 p, float scale, float thresh) { return step(thresh, hash21(floor(p * scale))); }
`;

export const PATTERN = /* glsl */ `

uniform float uPx;   /* world metres per pixel at the section plane, for LOD */

/* fade detail that would alias into mush at the current zoom */
float fineAmt(float scale) {
  float cellWorld = 1.0 / max(scale, 1e-3);
  return smoothstep(0.5, 1.85, cellWorld / max(uPx, 1e-4));
}

vec4 matPattern(float matId, vec2 w, vec2 loc, vec2 halfs, vec3 tint, float seed, float extraA, vec4 opts) {
  vec3 c = tint;

  if (matId < 0.5) {                                        /* concrete */
    c *= 0.9 + 0.17 * fbm(w * 1.7 + seed);
    c = mix(c, c * 1.34, (speck(w, 40.0, 0.93) * fineAmt(40.0)) * 0.5);
    c = mix(c, c * 0.72, lmask(w.y + seed, 0.9, 0.012) * 0.4 * fineAmt(1.1));
    float tie = dotgrid(w + vec2(0.31, 0.17) + seed, vec2(1.3, 0.65), 0.026);
    c = mix(c, vec3(0.16, 0.18, 0.2), tie * 0.7);
  } else if (matId < 1.5) {                                 /* concrete + rebar */
    c *= 0.88 + 0.2 * fbm(w * 2.1 + seed);
    c = mix(c, c * 1.28, (speck(w, 38.0, 0.9) * fineAmt(38.0)) * 0.5);
    float bars = dotgrid(vec2(w.x, loc.y * 2.0), vec2(0.2, 8.0), 0.03);
    float hi = dotgrid(vec2(w.x, loc.y * 2.0), vec2(0.2, 8.0), 0.013);
    c = mix(c, vec3(0.21, 0.18, 0.17), bars);
    c = mix(c, vec3(0.74, 0.64, 0.56), hi * 0.9);
    float chair = dotgrid(vec2(w.x + 0.1, loc.y), vec2(0.55, 8.0), 0.012);
    c = mix(c, vec3(0.18, 0.2, 0.24), chair * 0.7);
    c = mix(c, c * 0.75, lmask(w.y + seed, 0.9, 0.012) * 0.35);
  } else if (matId < 2.5) {                                 /* brick */
    float course = floor(w.y / 0.095);
    float stag = mod(course, 2.0) * 0.1;
    float joints = max(lmask(w.y, 0.095, 0.011), lmask(w.x + stag, 0.2, 0.009)) * fineAmt(10.5);
    vec3 brick = tint * (0.8 + 0.36 * hash21(vec2(floor(w.x / 0.2) + stag * 7.0, course)));
    brick = mix(brick, brick * 0.82, (speck(w, 60.0, 0.9) * fineAmt(60.0)) * 0.5);
    c = mix(brick, vec3(0.87, 0.83, 0.76), joints * 0.9);
    if (extraA > 0.5) {
      float gap = 1.0 - smoothstep(0.012, 0.032, abs(loc.x));
      c = mix(c, vec3(0.1, 0.12, 0.15), gap * 0.75);
    }
  } else if (matId < 3.5) {                                 /* two-wythe brick wall */
    float course = floor(w.y / 0.095);
    float stag = mod(course, 2.0) * 0.1;
    float joints = max(lmask(w.y, 0.095, 0.011), lmask(w.x + stag, 0.2, 0.009)) * fineAmt(10.5);
    vec3 brick = tint * (0.78 + 0.38 * hash21(vec2(floor(w.x / 0.2) + stag * 5.0, course)));
    c = mix(brick, vec3(0.86, 0.82, 0.75), joints * 0.88);
    float gap = 1.0 - smoothstep(0.012, 0.034, abs(abs(loc.x) - 0.42));
    c = mix(c, vec3(0.1, 0.12, 0.15), gap * 0.8);
    float cores = dotgrid(w, vec2(0.2, 0.19), 0.022);
    c = mix(c, vec3(0.26, 0.22, 0.2), cores * 0.4);
  } else if (matId < 4.5) {                                 /* concrete block */
    float course = floor(w.y / 0.19);
    float joints = max(lmask(w.y, 0.19, 0.015), lmask(w.x + mod(course, 2.0) * 0.2, 0.4, 0.013)) * fineAmt(5.3);
    c = mix(tint * (0.9 + 0.2 * hash21(vec2(floor(w.x / 0.4), course))), vec3(0.8, 0.78, 0.73), joints * 0.85);
    c = mix(c, vec3(0.13, 0.15, 0.17), step(0.74, abs(loc.x)) * 0.45);
  } else if (matId < 5.5) {                                 /* rubble masonry */
    vec2 g = floor(w * 2.1);
    float cell = hash21(g + seed);
    vec2 f = fract(w * 2.1) - 0.5;
    float mortar = 1.0 - smoothstep(0.24, 0.44, max(abs(f.x), abs(f.y)) - 0.07 * cell);
    vec3 stone = mix(tint * 0.66, tint * 1.28, cell);
    stone = mix(stone, stone * 0.85, (speck(w, 30.0, 0.92) * fineAmt(30.0)) * 0.6);
    c = mix(vec3(0.79, 0.75, 0.67), stone, mortar * 0.95);
  } else if (matId < 6.5) {                                 /* tile */
    float grout = max(lmask(w.x, 0.15, 0.008), lmask(w.y, 0.15, 0.008)) * fineAmt(6.7);
    c = tint * (0.93 + 0.14 * hash21(floor(w / 0.15) + seed));
    c = mix(c, vec3(0.6, 0.62, 0.61), grout * 0.8);
    c += 0.05 * smoothstep(-1.0, 1.0, loc.y);
  } else if (matId < 7.5) {                                 /* metro tile */
    float course = floor(w.y / 0.072);
    float grout = max(lmask(w.y, 0.072, 0.008), lmask(w.x + mod(course, 2.0) * 0.1, 0.2, 0.007)) * fineAmt(13.3);
    c = mix(tint * (0.9 + 0.2 * hash21(vec2(floor(w.x / 0.2), course))), vec3(0.52, 0.55, 0.53), grout * 0.85);
    float band = 1.0 - smoothstep(0.0, 0.02, abs(fract(w.y / 1.2 + seed) - 0.5) - 0.48);
    c = mix(c, tint * 0.5, band * 0.6);
  } else if (matId < 8.5) {                                 /* steel section */
    c = tint * (0.82 + 0.32 * (1.0 - abs(loc.y)));
    c = mix(c, c * 1.45, lmask((w.x + w.y), 0.05, 0.006) * 0.3 * fineAmt(20.0));
    if (extraA > 0.01) {
      float bolts = dotgrid(vec2(loc.x * halfs.x, loc.y * halfs.y), vec2(0.3, 8.0), 0.026);
      c = mix(c, vec3(0.74, 0.77, 0.8), bolts * 0.85);
    }
  } else if (matId < 9.5) {                                 /* cast-iron ring */
    c = tint * (0.84 + 0.3 * fbm(w * 3.0 + seed));
    float pitch = max(opts.w, 0.6);
    c = mix(c, c * 0.45, lmask(w.x + seed, pitch, 0.015) * 0.7);
    float bolts = dotgrid(vec2(w.x, loc.y * halfs.y), vec2(pitch * 0.5, 8.0), 0.024);
    c = mix(c, vec3(0.68, 0.72, 0.76), bolts * 0.85);
    c = mix(c, vec3(0.5, 0.29, 0.17), smoothstep(0.62, 0.92, fbm(w * 6.0)) * 0.35);
  } else if (matId < 10.5) {                                /* glass */
    c = mix(tint, vec3(0.78, 0.94, 1.0), 0.18 + 0.4 * fbm(vec2(w.x * 1.6 + w.y * 0.3, uTime * 0.015)));
    c += 0.16 * smoothstep(0.2, 1.0, abs(loc.x));
  } else if (matId < 11.5) {                                /* wood */
    float grain = lmask(w.y + fbm(vec2(w.x * 1.1, w.y * 0.3)) * 0.05, 0.019, 0.005) * fineAmt(52.0);
    c = tint * (0.86 + 0.26 * hash21(vec2(floor(w.x / 0.11), 3.0)));
    c = mix(c, c * 0.66, grain * 0.55);
    c = mix(c, c * 0.5, lmask(w.x, 0.11, 0.006) * 0.6 * fineAmt(9.0));
  } else if (matId < 12.5) {                                /* insulation */
    c = tint * (0.82 + 0.34 * fbm(w * 8.0 + seed));
    c = mix(c, vec3(0.74, 0.77, 0.8), lmask(w.y, 0.055, 0.006) * 0.35 * fineAmt(18.0));
    c += 0.05 * (speck(w, 90.0, 0.9) * fineAmt(90.0));
  } else if (matId < 13.5) {                                /* tar / damp-proof course */
    c = tint * (0.8 + 0.4 * fbm(w * 12.0));
  } else if (matId < 14.5) {                                /* plasterboard / plaster */
    c = tint * (0.94 + 0.1 * fbm(w * 3.0));
    c = mix(c, c * 0.78, lmask(w.x, 1.2, 0.006) * 0.4 * fineAmt(0.83));
  } else if (matId < 15.5) {                                /* terrazzo / screed */
    c = tint * (0.9 + 0.2 * hash21(floor(w * 50.0)));
    c = mix(c, c * 1.3, (speck(w, 50.0, 0.95) * fineAmt(50.0)) * 0.6);
  } else if (matId < 16.5) {                                /* asphalt */
    c = tint * (0.9 + 0.26 * fbm(w * 3.5));
    c = mix(c, vec3(0.48, 0.48, 0.5), (speck(w, 52.0, 0.9) * fineAmt(52.0)) * 0.55);
    c = mix(c, c * 0.7, lmask(w.y, 0.055, 0.006) * 0.3 * fineAmt(18.0));
  } else if (matId < 17.5) {                                /* granite setts */
    float joints = max(lmask(w.x, 0.2, 0.008), lmask(w.y, 0.1, 0.007)) * fineAmt(10.0);
    c = tint * (0.82 + 0.32 * hash21(floor(w / vec2(0.2, 0.1))));
    c = mix(c, vec3(0.58, 0.58, 0.56), joints * 0.7);
  } else if (matId < 18.5) {                                /* water */
    float rip = fbm(vec2(w.x * 2.6 + uTime * 0.8, w.y * 5.0 - uTime * 0.35));
    c = mix(tint, tint * 1.6, rip * 0.55);
    c += vec3(0.06, 0.1, 0.12) * smoothstep(0.8, 1.0, loc.y);
  } else if (matId < 19.5) {                                /* copper */
    c = tint * (0.84 + 0.36 * (1.0 - abs(loc.y)));
    c = mix(c, c * 0.7, lmask(w.x, 0.3, 0.006) * 0.5);
  } else if (matId < 20.5) {                                /* made ground / backfill */
    c = tint * (0.76 + 0.46 * fbm(w * 1.1 + seed));
    c = mix(c, vec3(0.68, 0.6, 0.5), step(0.962, hash21(floor(w * 9.0))) * 0.7);
    c = mix(c, vec3(0.36, 0.44, 0.3), step(0.988, hash21(floor(w * 3.4))) * 0.4);
  } else if (matId < 21.5) {                                /* clay / soft mud */
    c = tint * (0.82 + 0.32 * fbm(w * 0.9 + seed));
    c = mix(c, c * 1.24, lmask(w.y + fbm(w * 0.5) * 0.4, 0.32, 0.02) * 0.4 * fineAmt(3.1));
    c = mix(c, vec3(0.48, 0.44, 0.38), step(0.984, hash21(floor(w * 6.0))) * 0.5);
  } else if (matId < 22.5) {                                /* sand */
    c = tint * (0.86 + 0.26 * fbm(w * 1.4 + seed));
    float bed = lmask(w.y + sin(w.x * 0.8 + seed * 6.0) * 0.26, 0.4, 0.017) * fineAmt(2.5);
    c = mix(c, c * 0.76, bed * 0.45);
    c = mix(c, vec3(0.92, 0.84, 0.68), (speck(w, 24.0, 0.975) * fineAmt(24.0)) * 0.6);
  } else if (matId < 23.5) {                                /* gravel */
    c = tint * (0.74 + 0.52 * hash21(floor(w * 12.0) + seed));
    c = mix(c, vec3(0.26, 0.24, 0.22), 1.0 - smoothstep(0.18, 0.42, hash21(floor(w * 12.0) * 1.7)));
    c = mix(c, c * 1.2, (speck(w, 12.0, 0.9) * fineAmt(12.0)) * 0.35);
  } else if (matId < 24.5) {                                /* weathered rock */
    c = tint * (0.78 + 0.42 * fbm(w * 1.3));
    c = mix(c, vec3(0.3, 0.31, 0.33), lmask(w.x + fbm(w * 0.6) * 0.8, 0.6, 0.014) * 0.5 * fineAmt(1.7));
    c = mix(c, vec3(0.54, 0.45, 0.33), smoothstep(0.55, 0.95, fbm(w * 2.4)) * 0.4);
  } else if (matId < 25.5) {                                /* sound gneiss */
    float warp = fbm(w * vec2(0.05, 0.12)) * 2.4;
    float band = smoothstep(-0.3, 0.3, sin((w.y + warp * 1.5) * 1.7 + fbm(w * 0.2) * 3.2));
    c = mix(tint * 0.76, tint * 1.22, band);
    float vf = fineAmt(0.22);
    c = mix(c, vec3(0.86, 0.84, 0.77), smoothstep(0.9, 1.0, ridge(w * vec2(0.22, 0.5))) * 0.85 * mix(0.3, 1.0, vf));
    c = mix(c, vec3(0.16, 0.18, 0.22), smoothstep(0.88, 1.0, ridge(w * vec2(0.6, 0.24) + 11.0)) * 0.65 * mix(0.25, 1.0, vf));
    c = mix(c, vec3(0.25, 0.27, 0.3), lmask(w.x + fbm(w * 0.4) * 1.2, 2.05, 0.012) * 0.4 * fineAmt(0.49));
    c += 0.04 * (speck(w, 40.0, 0.96) * fineAmt(40.0));
    /* deep gneiss keeps a cool self-glow so the bottom of the drawing never dies */
    c += vec3(0.02, 0.045, 0.07) * smoothstep(0.44, 0.8, fbm(w * vec2(0.05, 0.08)));
  } else if (matId < 26.5) {                                /* membrane */
    c = tint * (0.9 + 0.2 * fbm(w * 22.0));
  } else if (matId < 27.5) {                                /* grating */
    c = mix(vec3(0.05, 0.06, 0.07), tint, lmask(w.x, 0.055, 0.021));
  } else if (matId < 28.5) {                                /* screen mesh */
    c = mix(tint * 0.3, tint, max(lmask(w.x, 0.05, 0.008), lmask(w.y, 0.05, 0.008)));
  } else {                                                  /* emissive strip */
    c = tint;
  }
  return vec4(c, 1.0);
}

`;
