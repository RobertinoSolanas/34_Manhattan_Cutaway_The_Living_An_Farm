# 34_Manhattan_Cutaway_The_Living_An_Farm
Create a maximum-ambition Three.js cutaway of one dense Manhattan block, sliced clean like an architectural section drawing and running like a living ant farm: subway trains sliding through tubes below, foundations gripping bedrock, basements, steam mains and sewers layered like strata, elevators climbing inside towers, dozens of lit interiors stacked floor over floor, and the street with taxis and pedestrians running right along the cut edge. This must not be a dollhouse with three rooms, a static diagram, a low-poly schematic or a dark cross-section. It is the hidden vertical machinery of a real city, all working at once.

The goal is the visual impression of a billion individually considered pieces: rebar in the cut concrete, brick courses, duct runs, cable trays, tunnel rings, platform tiles, apartment furniture, office desks, boiler rooms, water tanks, and the geological banding of the bedrock itself. Achieve this with extreme visible detail, instancing and disciplined LOD, not raw geometry counts.

If you use Three.js, add an import map before the module script mapping "three" and "three/addons/" to the same pinned version, and import only via those names. Everything procedural; no external assets.

#### FIRST FRAME - THE CITY OPENED LIKE A BOOK
- Open directly on the completed section: a straight-on, slightly elevated view of the cut face, composed like the world's most detailed architectural drawing brought to life. Above ground: a mid-rise pre-war building, a sliver tower, and a corner of a glass office block, all sliced open. Below ground: two stacked subway lines, a station platform with waiting passengers, utility layers, foundations and deep glowing-cool bedrock.
- The cut face must be immediately, unmistakably alive: a train pulling into the platform, elevators mid-climb, people moving on stairs, steam drifting from a main, taxi headlights crossing the street edge.
- Bright and readable: warm interior light spilling from dozens of rooms, clean daylight on the street level, cool tones below ground but never murky. Every layer legible at one glance, endless on inspection.
- No menus, labels, titles or reveals.

#### THE SECTION CUT - CRAFT OF THE SLICE
- The cutting plane is razor clean and shows honest construction: sliced floor slabs with rebar dots, brick wythes, steel columns in section, insulation layers, tile thickness on bathroom walls, tunnel cast-iron rings, granite bedrock with veins and seams.
- Give the cut faces a subtle unified treatment (a faint blueprint-like tint on cut surfaces) so structure reads instantly, while everything behind the cut is fully rendered, colored and lit.
- The slice must include a satisfying variety of building anatomy: lobby, stairwells, elevator shafts with visible counterweights, mechanical floors, a rooftop water tower with internal water level, basement laundry, parking, a bank vault, and street vaults under the sidewalk.

#### BELOW THE STREET - THE REAL SPECTACLE
- Two subway levels: an upper local line with a station (platform, columns, turnstiles, ads suggested as color panels, waiting passengers, arriving and departing trains with correct deceleration, door cycles and passenger exchange) and a deeper express tube where trains pass in a rush of light.
- A utility stratum that is beautiful in its density: steam mains wrapped in insulation venting occasional wisps, water and gas lines, electrical duct banks, a sewer with visible flow, telecom bundles, all color-coded and physically routed around each other.
- Foundations as heroes: caisson piers and spread footings gripping the rock, older rubble foundations beside modern concrete, a slurry wall, and the bedrock itself with layered banding, seams and a forgotten dry well.
- Below-ground life: track workers with headlamps in a side gallery, a rat or two (this is honest Manhattan), drips, signal lights changing, a maintenance train parked on a siding.

#### ABOVE THE STREET - STACKED LIVES
- Fill the sliced floors with dozens of distinct, furnished interiors that reward zooming: apartments with kitchens, plants, bookshelves and televisions flickering; offices with desks and meeting rooms; a dance studio; a doctor's waiting room; a corner diner at street level with counter seating; a boiler room; a super's workshop.
- Populate with autonomous inhabitants at readable scale: cooking, meetings, a cello practice, elevator queues, a dog waiting at a door, roof access for a smoke break by the water tower. Figures are stylized but individually varied and purposeful.
- Elevators, stairs and building systems visibly work: cabs and counterweights moving, stair users, water tank level, steam risers warming radiators.
- The street layer stitches worlds: pedestrians, taxis and a bus crossing the cut edge, a delivery hand-truck entering the freight entrance, a sidewalk grate exhaling subway air as a train passes beneath - timed together.

#### DYNAMISM AND SYSTEM COUPLING
- The joy is watching systems interconnect: a train arrives below, a pulse of passengers rides escalators up and disperses into the lobby and street; evening deepens and windows warm up floor by floor; the diner gets busy; steam venting increases.
- Include a day-night cycle control that transforms the section: morning outflow, midday hum, evening return, late-night skeleton activity with the express trains still running.

#### EXPLORATION AND CONTROLS
- Camera slides parallel to the cut face by default (a beautiful lateral dolly with zoom), plus free orbit within sensible limits so the viewer can look into rooms at an angle without going behind the section.
- Presets: full-section hero view; platform level as a train arrives; utility stratum close-up; mid-tower apartment stack; rooftop and water tower against the sky.
- Compact controls: time of day, section depth (slide the cutting plane a few meters deeper into the block, re-slicing rooms and tunnels live - this is a showpiece), activity density, photo mode.

#### PERFORMANCE
- Bespoke detail nearest the default camera; instanced furniture, figures, pipes, rebar, tiles and windows; merged shells for the deep background of the block behind the cut.
- Quality selector reduces interior prop density and far figures before ever sacrificing the cut-face craft, the trains or the elevator motion.
- Smooth on a modern laptop, devicePixelRatio clamped to 2. The outcome: the ant farm you cannot stop watching.

use also image jpeg and video for test