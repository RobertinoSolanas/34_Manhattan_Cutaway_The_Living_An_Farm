# Block №34 — Manhattan Cutaway · The Living Ant Farm

A single Manhattan block sliced clean from bedrock to water tank and running like an
ant farm: trains sliding through tubes, elevators climbing inside towers, steam
mains venting, dozens of lit interiors stacked floor over floor and a street going
on right along the cut edge.

Everything is procedural — no textures, no models, no external assets beyond the
pinned Three.js build in the import map.

## Run it

```
npm install          # puppeteer-core, only for the headless test harness
npm start            # http://localhost:5173/
```

Then open <http://localhost:5173/>. The first frame is the finished section — no
intro, no labels. The control desk fades itself away after a few seconds; move the
mouse to bring it back.

## Test it (headless)

The harness drives a real Chrome (`/usr/bin/google-chrome`) through
`window.__cutaway`, with SwiftShader so it runs anywhere.

```
npm run smoke                      # console errors + scene census + fps
npm run shots                      # 14 hero jpegs → shots/*.jpg
npm run views                      # every preset, every section depth, every hour
npm run video                      # ~20 s film → shots/cutaway.mp4 (ffmpeg)
npm run perf                       # fps / draw calls per preset

VW=1280 VH=720 QUALITY=fast npm run shots       # cheaper sweep
PRESET=platform TIME=18.4 PARK=1 node tools/peek.mjs shots/x.jpg   # one shot
node tools/debug.mjs               # first page error with a stack
node tools/probe.mjs               # geometry bounds, cut-instance census
node tools/state.mjs               # trains / crowd / traffic state over time
node tools/ab.mjs                  # A/B a single layer against the rest
```

URL knobs: `?quality=high|std|fast`, `?time=17.9`, `?photo=1`.

## Controls

* **Viewpoints** — full section, whole block, street edge, platform, utility
  stratum, express tube, apartment stack, roof & tank, foundations & rock, service
  gallery (keys 1–0).
* **Time of day** — 24 h dial: morning outflow, midday hum, evening return,
  late-night skeleton crew. Drives sun, sky, fog, exposure, window warmth, crowd,
  steam and diner trade. `Day cycle` runs it.
* **Section depth** — slides the cutting plane from 1.15 m to 8.6 m into the block,
  re-slicing rooms, mains and tunnels live. `Cut sweep` animates it.
* **Activity** — crowd and prop density.
* **Quality** — High / Standard / Fast; trades interior prop density and far
  figures first, never the cut faces, the trains or the lifts.
* **Photo mode** (`P`) — hides the interface.
* Drag orbits (limited so you can look into rooms without going behind the cut),
  wheel zooms, shift-drag pans, idle returns to the lateral dolly.

## How it is made

| module | job |
| --- | --- |
| `src/section.js` | the cut face itself: one instanced-quad mesh sitting exactly on the plane. Per instance: shape (rect, disc, annulus, wide-flange, hollow frame, haunch), material id, tint and the z-range the plane actually crosses. Visibility is resolved in the vertex shader, so moving the plane costs nothing. Patterns — brick courses and wythes, rebar dots at a 0.2 m module, tile grout, steel hatch, ring bolts, aggregate, wood grain — are evaluated in world metres and analytically antialiased, then unified with a blueprint wash, a 45° hatch and an ink outline whose weight follows the pixel size. |
| `src/earth.js` | the geology quad: made ground, soft mud, cross-bedded sand, weathered gneiss, banded sound gneiss with pegmatite veins and migmatite seams, a schist band, the water table, and the jagged overbreak collars where excavations and bores were driven. Excavations are analytic shapes intersected with the plane on the CPU whenever the cut moves and uploaded as a uniform array. Three further copies back the excavations with rock walls so nothing ever sees through to the sky. |
| `src/build.js` | `ctx.solid()` registers a physical element *and* its cut face in one call — the slice can never disagree with the world behind it. Merged vertex-coloured shells keep the whole city at ~85 draw calls. |
| `src/structure.js` | street-wall anatomy: facades, slabs as finish / rebar deck / fireproofing, brick in wythe, party walls with joist pockets, hoistways, switch-back stairs cut as the stepped profile they really are, roof build-ups with insulation and membrane, the riveted water tank with a live water level, the affected-by-fire lot, the context block and skyline. |
| `src/below.js` | caisson piers socketed into the rock with bells and footings, a tower mat with drilled shafts, a slurry wall with panel joints, ties and a waler, two generations of rubble footing with timber cribbing, cellars with brick barrel vaults, the utility stratum (steam, water, gas, fire water, sewer in brick, duct banks with pulled cables, telecom trays, valves, gauges, colour code bands, hangers), the cut-and-cover local line with a tiled station, entrance stair, turnstiles and third rail, the deep cast-iron express tube, the service gallery with a maintenance car, street vaults, boulders, a fault gouge and a forgotten dry well. |
| `src/interiors.js` | a prop library of instanced merged geometry — kitchens, beds, sofas, bookshelves with spines, desks with monitors, diner counter and stools, booths, hood, clinic seating, dance barre and mirror, boilers, washers, workbench, vault door, safety-deposit wall, cars, racking, pallets, hand truck, radiators, picture frames, clutter — plus unlit warm washes so every room glows from inside after sundown. |
| `src/street.js` | sidewalk build-up in section, curb, asphalt strata, lane markings, crosswalks, manholes, grate frames, lamps, a phased traffic light, hydrant, bins, benches, bus shelter, scaffold, trees, parked cars — and the moving lane of taxis, a bus that stops, private cars, with head and tail glow that comes up at night. |
| `src/people.js` | one instanced figure: ten articulated parts with pivots baked per vertex, six poses (stand, walk, sit, work, dance, cello, phone) evaluated in the vertex shader, coat/trouser/skin/hair per instance, sliced by the section plane. |
| `src/transit.js` | the local that decelerates honestly into the platform, cycles its doors and exchanges passengers; the through train on the far track; the maintenance car in the gallery; the express at 23 m/s; the elevator cabs with counterweights on ropes, dispatched against calls that follow the hour, with shaft doors that open only when a car is level. |
| `src/life.js` | the schedules and the coupling: platform flow that empties a train into the street and back down again, interior occupancy by room type and hour, roof crew after nine, track workers with headlamps, lift riders, delivery into the freight entrance. |
| `src/fx.js` | GPU point systems: steam off the mains, the roof stack and the platform, grate puffs timed to the express passing beneath, drips through the station box, dust driven ahead of the express. |
| `src/sky.js` | the 24 h dial: sun arc and temperature, sky dome with haze and stars, fog that follows the lens, exposure, and the activity profiles everything else reads. |
| `src/camera.js` | lateral dolly, limited orbit, and the ten viewpoints. |

## Numbers (Standard, 1600×900)

`npm run smoke` reports the live census. Typical: ~300 k triangles, ~85 draw
calls, ~2 500 instanced props, 3 000+ particles, ~3 000 registered cut faces of
which the plane resolves a few hundred per frame, one figure mesh, one skin mesh,
one earth mesh. Device pixel ratio clamped to 2.
