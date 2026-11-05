# PORT.md  Roblox 0.3.368.0 → browser, constants ledger

Every number below was mined from the decompilation or the shipped content files
 not invented. Where the decomp did not contain a literal value, the entry is
flagged APPROX and the reasoning is given.

Anchors: `decomp/Roblox.exe.c` (line numbers are of the 913k-line file),
`content/fonts/*.rbxm`, `extra/Places/*.rbxl`.

---
## Update build number after a major or important edit.
## Always make git commits after each build.
## Don't mimic how roblox would do it, port it from decomp.
## No hardcoding games or hopperbins/gears to work, should always be a patch for all games.
## Decomp/ is the source of truth.
## 1. Enumerations (EXACT  decomp literals)

### BrickColor table (`web/js/brickcolors.js`)
- Source: `FUN_00581720` (static table builder), inserts via `FUN_005814a0`
  (id,name,r,g,b), nearest-neighbor match via `FUN_005812a0` (Manhattan
  distance)  all ported verbatim.
- 112 entries, ids 1..1032 (gaps preserved  the 2007 palette skips ids).
- Spot checks against character.rbxm usage: 23=Bright blue (torso),
  24=Bright yellow (head/arms), 119=Br. yellowish green (legs),
  194=Medium stone grey. RGB off-by-one vs later palette (e.g. 24 →
  (245,205,47)) is faithful to the decomp table.

### Shape / FormFactorInstanceShape (`world.js` buildPart)
- 0 = Ball (SphereMesh), 1 = Block (PBBMesh), 2 = Cylinder  the VIEW class
  is **CylinderAlongXMesh** (FUNCTION_MAP:29), so the cylinder's axis is the
  part's LOCAL X: length = size.x, round cross-section from size.y / size.z
  (elliptical when they differ  the mesh factory keys on the full extent).
- The earlier "Y-axis, radius = min(sx,sz)/2" reading is wrong; it made the
  Crossroads trampoline supports lie on their side. Fixed: geometry is
  CylinderGeometry rotated Z→X at bake time; colliders use size/2 per axis.

### SurfaceType (`world.js` face art)
- Tokens (Roblox.exe.c:490994 region): 0 Smooth, 1 Glue, 2 Weld,
  3 Studs, 4 Inlet, 5 Spawn, 6 Hinge, 7 Motor, 8 SteppingMotor.
  This build has **no Universal** surface.
- Constructor defaults (Roblox.exe.c:356583): Top=Studs(3), Bottom=Inlet(4),
  every other face Smooth(0); each face's Surface object starts with
  SurfaceInput=0, ParamA=−0.5, ParamB=0.5. `Instance.new` parts get these
  defaults; XML-loaded parts keep their shipped overrides.
- Runtime writes to any of the 24 face properties
  (`{Right,Top,Back,Left,Bottom,Front}` × `{Surface,SurfaceInput,ParamA,
  ParamB}`) are live: props update, `look.surf` updates, face cache
  invalidates, the part art rebuilds, and a Surface write marks the joint
  graph dirty so the next step re-clusters. Surface values accept the
  numeric enum or its name (`"Weld"`, `"Studs"`, …).
- Surface atlas Surfaces.png 64×512 = eight 64×64 tiles: 0/1 studs,
  2/3 inlet, 4/5 weld, 6/7 glue (the first of each pair is used; the
  variants differ by only a pixel or two). SurfacesStrip.png is the
  separate MegaTextureProxy; its studs/inlet rows are the same art as the
  atlas. The **game face renderer applies art only for Studs(3) and
  Inlet(4)**. Weld(2) and Glue(1) are joint types: their atlas
  X/blob tiles are the Surface Tool icons (the 2007 Studio toolbar shows
  exactly those X/blob icons), and a part face with Weld/Glue renders the
  solid brick colour in-game. The default noob's torso sides are Weld in
  character.rbxm yet read as solid colour in the 2007 screenshots, which
  is why `artRow` is `{3:0, 4:1}` into [studs, inlet] only.
  Hinge/motor/stepping are joint types: their faces draw the classic
  yellow peg (below), not atlas art. Spawn is the
  SpawnLocation class texture (decal path), not the face atlas.
  Face art is applied to block parts (shape 1); sphere/cylinder/SpecialMesh
  parts keep their base material because the atlas's face mapping for those
  meshes was not mined (APPROX 16).
- Hinge(6)/Motor(7)/SteppingMotor(8) faces draw the classic yellow peg:
  a cylinder on the face normal, centered and protruding. The decomp keeps
  the RotateJoint geometry but no recoverable surface-pass draw constants;
  proportions come from the shipped HingeTool.png. These parts are
  excluded from static batching so the child peg survives the merge.
- Decals are overlay planes, not face-material swaps. Replacing the face
  material with the decal PNG made every transparent pixel show the inside
  of the box (the see-through side bug). The base brick/surface material
  stays on all six faces; a transparent plane sits just proud of the decal
  face with polygon offset and `depthWrite:false`.
- SpawnLocation's class texture goes through the same overlay path
  (build 18): SpawnLocation.png is mostly transparent (the spiky wheel),
  so the old top-face material swap left the pad's top see-through. The
  child Decal is overlaid when the place ships it; a class-texture plane
  is added when it doesn't.
- Static batches copy the box UV attribute into the merged geometry. The
  old merge copied position/normal/index/groups but not UV, so every
  batched Studs/Inlet face sampled texel 0,0 and the surface art vanished.
- One 64×64 tile covers a 2×2-stud patch, so the UV repeat is size/2, not
  size. The atlas is a 50%-grey detail map; it is normalized to white at
  load so the brick colour is not halved. The tile's stud centres sit at
  0.25/0.75 of the tile, so UV 0 puts the first stud 0.5 studs from the
  face edge: a 1×1, 2×2 and 4×2 face all share the same stud grid.
  ParamA/B belong to the Surface Tool brush; the decomp face builders
  FUN_004d3bd0 / FUN_004e06f0 derive UVs from face size + surface token
  and never read ParamA/B, so they are **not** used as a texture phase.
- Procedural 2×2 fallback tiles at 64px when Surfaces.png is absent.

### Face NormalId (decal orientation)
- 0 Right(+x), 1 Top(+y), 2 Back(+z), 3 Left(−x), 4 Bottom(−y),
  5 Front(−z = LookVector).
- character.rbxm face decal and torso "roblox" logo decal are BOTH Face=5.

### HopperBin BinType (tools.js; decomp ~line 395596)
- 0 Script, 1 GameTool, 2 Grab, 3 Clone, 4 Hammer, 5 Slingshot,
  6 Rocket, 7 Laser.

### SurfaceType  full registration (decomp ~line 490994)
- `FUN_0058fc90(0,"Smooth")`, 1 "Glue", 2 "Weld", 3 "Studs", 4 "Inlet",
  5 "Spawn", 6 "Hinge", 7 "Motor", 8 "SteppingMotor"  verified against
  the DAT strings (`1 = Glue`, `2 = Weld`). This build has no "Universal".

### Surface textures  Surfaces.png (the client's part-face atlas)
- decomp :204405 loads `textures\surfaces.png` as a TextureProxy;
  :204465 loads `textures\SurfacesStrip.png` as a separate
  MegaTextureProxy. The part-face atlas is Surfaces.png, 64×512 = eight
  64×64 tiles: 0/1 studs, 2/3 inlet, 4/5 weld, 6/7 glue. The strip is not
  the part-face atlas.
- Pixel inspection confirms the 2×2 stud/inlet pattern and the centered
  weld X / glue blob. Port crops tiles 0,2,4,6 at 1:1, normalizes the
  128-grey detail map to white, and embeds Surfaces.png in IMAGE_DATA.
- UV rule: one tile covers a 2×2-stud patch, so repeat = size/2. The
  decomp's 0.25-stud border compression (FUN_004d3bd0 / FUN_004e06f0)
  is represented by the plain ring already in the shipped tile.
- SpawnLocation decal + face decal textures also embedded (IMAGE_DATA)
  WebGL may refuse file:// images; data URLs never fail.

### Chat / name colors  palette getters (decomp :2452xx)
- MINED GRA: #ff0000 red, #00ff00 green, #0000ff blue, #b200ff violet
  (0.7,0,1), #ffff00 yellow, #ff8000 orange (1,0.5,0), #000000 black,
  #b2b2b2 gray (0.7), #ffffff white.
- Message-class switch FUN_005b8060: 1→blue, 2→red, 5→black, 6→yellow,
  7→violet, default→gray. Used for: server msgs=blue, warnings/death=red,
  tips=yellow. Player-name colors cycle this palette (cycle ORDER not
  minable  flagged approx).

### UI font  comics.fnt (decomp :526125) → real Comic Sans MS files
- The client loads `Fonts\comics.fnt`  the shipped BMFont of Comic Sans
  MS (content/fonts/comics.fnt ships with the client). The whole 2007 HUD
  renders in it; the port sets Comic Sans MS for all DOM chrome and the
  over-head canvas text.
- Build 20 embeds the actual faces: `content/fonts/comic.ttf` (Regular)
  and `content/fonts/comicbd.ttf` (Bold) are base64'd into
  `window.FONT_DATA` by build-coreAssets.js and registered under the
  family name "Comic Sans MS" (weights 400/700) by `web/js/fonts.js`, so
  every existing rule and canvas ctx.font string resolves to the shipped
  glyphs. Data URLs are required  Chrome blocks @font-face src from
  file:// URLs (CORS).
- Weight map (the 2007 site's scheme): body text  descriptions, blurbs,
  list rows, chat lines, hotbar labels  stays Regular (comic.ttf);
  nav buttons (Toolbox/Edit Mode/Help/Fullscreen/Exit), title headers
  (ROBLOX), Player List header, Safe Chat breadcrumb, loading box, part
  tabs and T-shirt buttons get font-weight:bold (comicbd.ttf); in-game
  hints/notifications, center message modal and the info line take bold
  for readability over the 3D scene. Chat player names were already
  `<b>`  they now render real comicbd glyphs.

### HUD panels (strings mined)
- "Player List" at :509702, "Exit" :319476/:454844, "Fullscreen" :120838
  the 2007 Play Solo bar is Toolbox / Edit Mode / Help / Fullscreen /
  Exit with the Player List panel top-right (names colored from the
  palette). The on-screen HealthHud is the 10x100 vertical bar on the
  right, below the Player List (build 58).
- Classic cursor: content/textures/ArrowCursor.png (shipped with the
  client) is used as the body cursor. Its CSS hotspot is **39 40**  the
  arrow tip inside the 80×80 transparent canvas. Every shipped
  `*Cursor.png` hotspot is baked into `rbxenv.js CURSOR_HOTSPOTS` from the
  PNG's own pixels (arrow cursors = opaque bbox top-left, icon/crosshair
  cursors = opaque bbox centre); without it the browser pins the
  transparent corner to the pointer and the visible arrow lands ~39px
  down-right of every click. `test/cursor.js` re-derives all 28 and
  cross-checks the table + `index.html`.

### Super Safe Chat (`web/js/safechat.js`)
- Menu tree: `Fonts\safechat.xml` (loaded at :512332; file string
  `"Fonts\\safechat.xml"`). The port embeds the shipped file verbatim and
  stack-parses every `<utterance>`: 445 nodes, 11 root categories, depth 5.
  Typos are kept ("Greetings eveyone", "Seaons greetings!", "barbecque")
  because they are the menu text the classic client displayed.
- GUI builders: `ChatHud` (FUN_005d6230) is the typed-chat fold;
  `ChatMenuPanel` (FUN_005d6640) is this GUI. It owns a `ChatButton`
  child and calls the recursive `FUN_005d63d0`, which walks the utterance
  tree and creates one image widget per node. `RBX::ChatButton`
  (ctor FUN_005d4cd0 / base FUN_005d4bb0) is an
  `RBX::UnifiedImageWidget`.
- Button art: `FUN_005e8740` derives four textures from one base path
  `Chat.png` (normal), `Chat_ovr.png` (hover), `Chat_dn.png` (pressed),
  `Chat_ds.png` (disabled). All four shipped PNGs are 32×23; the port
  embeds them in IMAGE_DATA and swaps the `<img>` source per state.
- Interaction: the bubble sits immediately left of the typed-chat input;
  clicking opens `ChatMenuPanel` above the fold. Category rows drill down,
  the first row is "« Back", the header shows the utterance breadcrumb,
  and a leaf row sends its phrase through the same `ui.chat` path as
  typed text. Escape / outside-click closes; disabled state uses
  `Chat_ds.png`. Panel chrome sizes are APPROX  the decomp keeps the GUI
  layout constants in inlined draw code, so only the 32×23 button art and
  the utterance order/text are exact.

### Legacy .mesh text format (all files verified on disk)
- Tool meshes: `version 1.00\n<faceCount>\n` then 9 floats per vertex
  (27 per face) as `[pos][normal][uv]` triplets  non-indexed, vertices
  repeat per face.
- head.mesh packs the count into the version suffix:
  `version 1.00.244` = 244 faces (732 records weld to 126 unique verts).
  It is kept only as a parser regression fixture; the classic head is the
  generated HeadMesh below, not this file.
- Normals may be unnormalized in-file (e.g. tree 0,0,-2.79)  normalized
  at load (computeVertexNormals after the fit applies).
- No size in the file: FileMesh scale-fits uniformly by height (part
  height × SpecialMesh.Scale). This applies to the gear tool meshes; the
  head is MeshType=0 and never takes this path.

### Gear hand models / icons (shipped client files, no invented mapping)
- BinType↔font mesh: 1 GameTool→trowel.mesh, 3 Clone→clonewand.mesh,
  4 Hammer→hammer.mesh, 5 Slingshot→slingshot.mesh,
  6 Rocket→rocketlauncher.mesh  skins from their shipped textures
  (TrowelTexture.png, CloneWandTexture.png, hammertex128.png,
  SlingshotTexture.png, rocketlaunchertex.png).
- Hotbar icons: `rbxasset://Textures/<BinType-name>.png` resolve into
  content/textures (GameTool/Grab/Clone/Hammer/Slingshot/Rocket/Laser);
  TextureId wins when the HopperBin carries one. Custom BinType 0
  names map to the shipped Halloween/RocketBoots icons:
  Ghostwalk→HalloweenGhost, PumpkinBomb→HalloweenPumpkin,
  Rocket→HalloweenRocket, Skullshot→HalloweenSkull,
  SoulAsylum→HalloweenAsylum, JetBoots→RocketBoots.
- rbxasset path mapping lowercases the leading content segment (exe was
  case-insensitive; file systems are not)  this was the missing-icon bug.

### Input semantics (bugs fixed this pass)
- `leftPressed` is a per-Stepped edge: consumed each fixed step. A stale
  pressed-flag leaking across equips made tools fire without a click
  (the reported "auto-fire on equip").
- Jump sound: button.wav fires from the humanoid Jumping event (real
  jump request)  not from pose classification, so landing frames can
  never re-play it.
- The shipped script loops ONLY sRunning (footsteps). The swoosh is a
  ONE-SHOT on FreeFalling(true) (play() on a non-Looped Sound;
  FreeFalling(false) pauses it)  the port fires it once per flight
  (armed on ground contact, triggered at ≥0.12s airtime + vy<-7 so
  stair-bounce pose flaps don't machine-gun it). The old port drove a
  LOOPED swoosh per frame, and dying mid-freefall froze the fall state
  (airborne, vy<-7 forever), re-play()ing the loop for eternity  the
  "jump sound stays looping after death" bug. Death now pauses the
  footstep loop and the dead body drives no sounds at all.

### Overhead tag + health bar (decomp FUN_0060d5f0)
- The engine draws an over-head billboard when a Humanoid is present
  (visibility chain FUN_005a3770 → Humanoid cast).
- Literal geometry: bar width = character bounds width/8, height =
  width/10 (`(b-w)*0.125`, ×0.1).
- "Health" label color = FUN_005007d0 → (0,0,1) BLUE; bar fill =
  FUN_005007a0 → (0,1,0) GREEN; name white = FUN_00500920.
- Port: name always visible; the blue "Health" + bar only appear once
  health < max (classic: undamaged characters show the name only).

### Built-in meshes (decomp :202599-202637 + head region 217484-220100)
- Render mesh factory tables: `MeshFactory<PBBMesh,4>`, `SphereMesh,1`,
  `CylinderAlongXMesh,1`, `WedgeMesh,1`, `TorsoMesh,1`, `HeadMesh,1`.
  Every primitive is fit per-extent (variation tables keyed by Vector3).
- **HeadMesh is generated in code  no mesh file is ever loaded for heads.**
  Exact path: HeadMesh ctor FUN_004e1bb0; HeadBuilder ctor FUN_004df000;
  LevelBuilder stores HALF-extents `{min(x,z)/2, y/2, min(x,z)/2}`;
  `Render::Mesh::Level` rec[6]=5 = tessellation tier; surface dispatcher
  FUN_004e26e0 calls the six builders; FUN_004e8d30 appends a vertex
  (position, normal, uv) and FUN_004e2860 appends a quad.
- The exact mesh was captured by emulating those functions in
  `client/Roblox.exe` (Unicorn x86 harness, image base 0x400000): 600
  vertices, 486 quads → 972 triangles, canonical extent 1×1×1, y up,
  centred. The baked arrays live in `web/js/headmesh.js`; `build(size,
  scl)` applies the engine's size rules (both horizontal radii use
  `min(size.x, size.z)`, vertical uses `size.y`, then SpecialMesh.Scale).
  The normalized radius-vs-height profile was cross-checked against a
  ripped 2007–2009 head OBJ and matches exactly. This is not an
  approximation. `head.mesh` and the limb meshes are not used for the rig.


### CFrame serialization
- XML v4 `CoordinateFrame` = position (X,Y,Z) + rotation R00..R22
  **row-major** → fed straight into `THREE.Matrix4.set()` (row-major c-tors).
- Character front = LookVector = −col3 = local −Z; at yaw 0 the rig faces +Z.

### Property parsing  full pass (`xmlplace.js` parseProps)
Every property element is kept; the 2007-era place XML ships the full set
per part (verified by a census over all bundled places  74 distinct
element/name pairs): Anchored, six × {Surface, SurfaceInput, ParamA, ParamB},
BrickColor, CFrame, CanCollide, CastsShadows, Cullable, DraggingV1,
Elasticity, formFactor/formFactorRaw, FormFactor, Friction, Locked, Reflectance, Transparency,
RotVelocity, Velocity, archivable, shape, size (+ Lighting ClearColor /
TopAmbientV9 / BottomAmbientV9 / SpotLightV9 / TimeOfDay /
CelestialBodiesShown).
- Handlers added: `Axes`/`Faces`/`int64` (flag sums/plain ints),
  `Vector3int16` (like Vector3), `OptionalCoordinateFrame` (joints' C0/C1
  nested frame or legacy comma list), `BinaryString`, `Font`;
  unknown elements still land under `@name`.
- `world.js` consumption: texture array for all six faces with per-face
  strip tiles + ParamA/B spans; Reflectance → MeshPhongMaterial specular
  (live setter rebuilds the material; SpecialMesh shapes honour it and
  Transparency); Friction/Elasticity/Velocity/RotVelocity carried on collider look records
  (physics exposes `groundLook` with the ground part's record); Decal
  children with Face+Content render on their part plane (SpawnLocation's
  own class texture dedupes against child SpawnLocation decals);
  Lighting feeds ClearColor→scene background, TopAmbientV9/BottomAmbientV9→
  hemisphere light, TimeOfDay "HH:MM:SS"→sun arc (06:00 east → 12:00
  zenith → 18:00 west, night dims ambient).
- SpecialMesh types: 0 generated HeadMesh (above), 2 wedge, 3
  SphereMesh-per-extent ellipsoid, 4 CylinderAlongXMesh, 5 FileMesh via the
  `.mesh` text parser against embedded fonts/ (tool gear), 1/6 plain box.

---

## 2. Character rig (EXACT  content/fonts/character.rbxm, parsed at runtime)

The browser loads and parses `character.rbxm` itself (embedded as text in
`coreAssets.js` → `window.CORE_ASSETS`); no part of the rig is re-typed.
Verified rig (world pos at spawn; parser-inverted to torso-local):
- Torso 2×2×1, BrickColor 23, (0,3,25.5), Top=Studs(3), Bottom=Inlet(4),
  front decal "roblox" logo (Face=5).
- Head 2×1×1, BrickColor 24, (0,4.5,25.5) + SpecialMesh MeshType=0 (Head),
  Scale=1.25 + face decal (Face=5).
- Arms 1×2×1, BrickColor 24, ±1.5 x, y=3.
- Legs 1×2×1, BrickColor 119, ±0.5 x, y=1.

Torso basis is mirrored (−x,+y,−z) → torso-local arm offset is +1.5 (its own
right side). rig local offsets measured by the test suite: head +1.5y, arms
±1.5x at torso plane, legs ±0.5x / −2y. Head LookVector is +Z.

**Joints:** the rbxm contains NO joint instances  the engine built the motors
at runtime (`makeJoints` path of the original Humanoid). The port mirrors that:
pivot groups at limb tops (shoulder/hip) with identity Euler, animated by the
Animate port's servo chase (`MaxVelocity` rad/tick @60Hz).

The head is the exact engine-generated HeadMesh (`web/js/headmesh.js`,
exposed as `builtHeadGeometry` in world.js). The character's SpecialMesh
MeshType=0 never loads a mesh file; the decomp HeadBuilder mesh is used
directly. The classic face decal is a square texture with a wide
transparent border, so the port uses a square plane sized 1.12× the
rendered head bbox and sits it just proud of the front bbox. That puts the
visible smiley at roughly 0.61×0.48 studs on the 1.25-stud head, matching
the 2007 screenshot silhouette. The decal is still a flat plane, not a
projection onto the curved mesh  flagged APPROX in the ledger. head.mesh
and the other fonts/*.mesh character files are not used for the rig.

---

## 3. Humanoid / animate / health (script sources from character.rbxm)

`humanoidAnimate`  the shipped `fonts/humanoidAnimate.rbxm` (a single
Script named "Animate") IS the source of truth; the port mirrors it:
- target sampling at **10 Hz** (`time > nextTime → move(time); nextTime =
  time + 0.1`)  the servo chases each 60Hz tick against held targets,
  which produces the stair-lagged robotic swing (sampling targets at 60Hz
  smooths it away and loses the look).
- moveJump(): shoulder `MaxVelocity 0.5`, Right +3.14 / Left −3.14,
  **hips → 0** (legs stay straight in the classic jump).
- moveFreeFall(): MV 0.5, Right +1 / Left −1, hips 0.
- moveClimb(): MV 0.5, Right −3.14 / Left +3.14, hips 0  now reached
  whenever the solver is on a ladder/TrussPart (see §12).
- else-branch (Standing/Running/Dead/GettingUp/FallingDown all land here):
  MV 0.15; Running amplitude 1 frequency 9 else 0.1/1; shared
  `desired = amplitude·sin(time·frequency)` on both shoulders, negated on
  both hips; tool in hand pins Right Shoulder to 1.57.
- Pose decode (world): `makeJoints` hands the LEFT-side servos a mirrored
  axis, so world-euler(left) = −motor-angle while right limbs take +angle
   that handedness turns the same-sign targets into the classic
  contra-lateral walk (right arm forward with LEFT leg) and the mirrored
  front-sweep jump. The port overlays plain Euler pivots per limb with the
  sign flip on left joints.
- Events: Died→Dead; Running fires at speed>0 (port floors 0.1 physics
  jitter); Jumping/FreeFalling split at v.y=0 (ascent jump, descent
  freefall); Climbing is live on ladders/trusses and carries the climb
  speed (see §12); GettingUp/FallingDown wired.

`humanoidSound`  one-shot event sounds via the SoundService port;
files uuhhh.wav (Died), splat.wav (FallingDown), swoosh.wav
(FreeFalling), hit.wav (GettingUp), button.wav (Jumping)  and the
ONLY looped sound, bfsl-minifigfoots1.wav (sRunning, Looped=true
the shipped script loops nothing else).

`humanoidHealth`  regen +0.01·MaxHealth per second; cutoff when
health ≥ 1.05·max (i.e. stops slightly above full, as in the script).

APPROX (canon-2007 constants NOT literal in the decomp; flagged, standard
2007 engine values): gravity 196.2, WalkSpeed 16, JumpPower 50, friction 0.3.

Jump (`FUN_00611430`): the Jumping state applies force `(50−vy)·5000`, and
the body integrator cancels the mass factor, so the effective acceleration
is `(50−vy)·5000`  not divided by the rig mass. At 60 Hz this reaches
`vy=50` on the first tick, then transitions to FreeFall; a 0.5 s safety
window guarantees the state cannot keep applying upward force.

---

## 4. Tools / projectiles (EXACT  Rocket.rbxm & SlingshotPellet.rbxm, decomp)

### Rocket (content/fonts/Rocket.rbxm, script embedded in file)
- Per-Stepped: `shaft.Velocity = 7 * (target - shaft.Position)` with
  `target = target + dir` each tick  the test suite integrates this and
  confirms steady-state ≈ 60 studs/s (classic).
- 10s TTL then destroy; Touched → Explosion + destroy
- Swoosh.wav looping at volume 0.7 while alive
- OnRemove: PlayOnRemove-style sound `collide.wav` volume 1 + Explosion
- Visual from the file: 1×1×4 part, BrickColor 23 (red  note: the FILE's
  BrickColor literal wins over the 2007-era red canonical memory).

### SlingshotPellet (content/fonts/SlingshotPellet.rbxm)
- damage 8 on humanoid touch → humanoid.hurt; halved per world touch
- disconnect (destroy) when damage < 0.1 (suite: 7 world touches)
- gravity on pellet (anchored=false)
- TTL 1s; visual: ball, BrickColor 194

### ShootTool spawn math (decomp FUN_005c8f70 / FUN_005c9230)
- rocket: torso.CFrame · (+dir·5); pellet: torso.CFrame · (+dir·3)
- muzzle-adjacent offset 85.0 (decomp literal, scaled by 0.01 in projectile)

### Explosion
- Explosion class mined from the decomp ctor `FUN_00603df0` (Roblox.exe.c
  :501350ff): `BlastRadius` default **4.0f** (P0x40800000, :501387),
  `BlastPressure` default **500000.0f** (P0x48f42400, :501388); the ctor registers
  a Listener<RunService,Stepped> child listener and IRenderable. The draw
  path (:501512xx) calls `glColor3fv(material color)` with alpha forced 1.0
  then `FUN_0061d330` → `gluSphere(q, r, 0xf, 0xf)`  a solid expanding
  sphere at 15×15 tessellation, exactly what the port renders (web/js/
  world.js explode visuals + tools.js flash).
- The shipped RocketScript builds `Instance.new("Explosion")` per rocket
  contact; the port shares the same queues in tools.js.
- Detonation (`FUN_00604250`): accumulate time, fire after **0.1 s**; query
  the cube `pos ± BlastRadius`; keep parts with bounding radius <
  `2·BlastRadius`; fire `Explosion.Hit(part, distance)` (`FUN_00604150`);
  add `direction · BlastPressure · boundingRadius²` to the body
  (`FUN_006029c0`), then remove the Explosion instance. There is **no
  direct Health write or part destruction** in the decomp blast path.
- **Joint removal** is part of that per-hit path: `FUN_006029c0` calls
  `FUN_00572770` → `FUN_005ad810(body)` → `FUN_005ad770(body, 0)`, which
  unlinks every joint whose Part0/Part1 is the hit body  unconditionally,
  with no force threshold and including anchored/static bodies. The port
  (`dynamics.js breakJoints`) marks those pairs in `noJoin`; they stay cut
  until their AABBs separate, matching the engine's "AutoJoin only on a
  NEW contact" rule. See §12, explosion pass.
- Explosion **humanoid damage** is a gameplay layer, not a decomp write:
  linear falloff `100 · (1 − d/BlastRadius)` through `Character.takeDamage`
  (point blank = 100, 0 at the radius edge). The era's Health model is
  0–100, so a centre hit is lethal and the same blast still applies the
  mined pressure impulse to the body.

### Cooldowns (mined from each tool's own script; seconds)
- rocket 3.0 · pellet 0.45 · laser 1.1 · clone 0.4 · hammer 0.3

---

## 5. Crossroads script ports (`extra/Places/Crossroads.rbxl`, 25 scripts)

**The scripts run from their shipped Source on the Lua translation layer
(section 9)  the table below is the classification that the *fallback*
hardcode path (and the test suites) still use.**

Classification (by Lua-source probes in `scriptport.js`)  matches the test
suite exactly:

| kind         | count | behavior (literal from source)                                  |
|--------------|-------|------------------------------------------------------------------|
| regen        | 5     | `backup=model:clone()`/`wait(regenTime*(1-random*0.8))`/remove/wait(delay)/`backup:clone()` + Parent + `makeJoints()` |
| jumppad      | 13    | 0.5s setTimeout → `Torso.Velocity = (0,200,0)` (cooldown 0.6s)      |
| leaderboard  | 1     | LeaderboardV3 wipeout counter                                     |
| daycycle     | 1     | AndYetItMoves → world.applyTimeOfDay                              |
| armor        | 1     | BattleArmor: touch → MaxHealth doubled + full heal                |
| beacon       | 4     | TeamBeacon: BodyVelocity/BodyPosition sink/goUp, touch heal/team paint, `makeJoints` stud rebuild |

- The 4 team-beacon scripts now run from their shipped Source through the
  Lua interpreter (not the old skip path). Their BodyVelocity/BodyPosition
  movers are live in the assembly physics; the character can ride a rising
  beacon. Team membership itself is still a single-player no-op (there is
  no TeamService to join), but the shipped `Team` Color3Value tag and
  team-color paint execute.
- The 5 regen scripts run from their shipped Source too. Their
  RegenerationTime is **800 s** (jittered to 160-800 s) and
  RegenerationDelay is **4 s**, so the first visible cycle is legitimately
  minutes after join. The port used to show their detached `Message` at
  load (`Text=` displayed it immediately); it now appears only when
  `Parent = Workspace`. The restore path (`clone/Parent/makeJoints`) is
  fixed to rebuild the model in one component-level joint flood rather
  than one whole-map flood per part - see §12.
- 8 SpawnLocations: spawn selection is `SpawnerService::GetSpawnPosition`
  (`FUN_005a06d0`)  `rand() % count` picks uniformly from the registered
  pads on **every** LoadCharacter, initial join included; the returned
  point is the pad's CFrame position **+7 studs in Y** (it is the
  character torso/PrimaryPart position, so the feet start ~3 studs above
  the pad and gravity settles the rig). Respawn on death after 5s
  PlaySolo `Died:connect → wait(5) → LoadCharacter`.
- Place scripts are launched after the port creates the local Player, so
  `main.js` replays the engine ordering: run the script bodies, fire
  `Players.ChildAdded(player)`, run the join handlers, then render the
  first frame. On each respawn it fires `Player.Changed("Character")`
  after `setCharacter()`. This is what lets Haunted's
  `StopSpawnCampingNoobs` and Rocket Car Rally's `PlayerSpawn` apply their
  map-specific spawn point instead of the fallback.

---

## 6. World/lighting (EXACT  from each place file)

- Lighting.Sky cube order [rt, lf, up, dn, ft, bk] as in the v4 files;
  skybox vertices follow the camera.
- Color3 V9 = packed 0xAARRGGBB int.
- **Celestial bodies (`content/sky/`, shipped pack embedded verbatim in
  `skyAssets.js`)**: sun = sun.jpg (additive) + sun-rays.jpg additive halo,
  moon = moon.jpg masked by moon-alpha.jpg (alpha-map), lensflare.jpg is a
  screen-billboard stand-in. Positions run the full 24 h loop
  a=(hrs−6)/24·2π: 06:00 east (+X horizon), 12:00 zenith, 18:00 west,
  moon at the antipode; radius 1300 inside the 4000 skybox; opacities fade
  within 0.2 rad of the horizon; `CelestialBodiesShown=false` (Crossroads)
  hides the bodies but keeps the shipped cube. Places without a Sky get the
  client's default plainsky cube (null_plainsky512_*). Directional light
  aims from the sun by day / moon at night (0.30/0.10).
- Material cache: parts without textures share one material; arrays used
  only for studs/inlet/decals (HQ reaches 8061 colliders / ~8k meshes at
  ~14ms build; one shared vertex-colored merge is possible future work, see
  test/places.js summary for build times). Scripted colour/transparency
  writes clone the cached material for that part (build 37).
- Collision: colliders store enclosing AABBs for broadphase, while the
  horizontal sweeps test yawed player/OBB part boxes and resolve only the
  axis actually moved (a zero-motion axis is never swept  no sideways
  ejection from long walls); step-up 2.3 studs, swept head/ceiling
  collision, highest-support ground probe, void kill below y=−80; viewBox
  y −3..+2, half-width 2.02 (character assembly bounds). The humanoid also
  shares momentum with free assemblies (bodyMass from rig volumes) instead
  of acting massless, and resolves a moving body that enters the idle body.

---

## 7. Audio (EXACT  decomp sound table + content/sounds)

- `coreAssets.js` embeds all 34 shipped sounds as data-URLs (file:// fetch is
  forbidden by browsers, data-URLs are not). `audio.js` resolves every
  SoundType file name through `window.SOUND_DATA` first, then HTTP.
- The 14 built-in SoundType files map exactly like the engine's sound table
  (decomp ~line 371362); humanoid rig uses only the files named in its scripts.

---

## 8. Headless verification (`test/`)

Node suites validate the port without a browser:
- `test/headless.js`  BrickColor table, rig-offset math (inverse CFrame with
  the mirror basis), torso LookVector, rocket 7·error integration, pellet
  decay, and the decomp HeadMesh (600 verts / 972 tris / 1.25 span).
- `test/fonts.js`  the embedded Comic Sans MS TTFs (byte round-trip +
  TrueType magic), the @font-face rule text fonts.js emits, and the
  headless no-op of `register()`.
- `test/places.js` (+ `test/domshim.js`, a minimal XML-DOM)  parses the
  bundled place files and the REAL character.rbxm through the actual
  parser: Crossroads 1671 parts/25 scripts/8 spawns, HappyHome 1964/3 bins,
  RobloxHQ 8077 parts/8061 colliders/6 bins/7 humanoids, TabulaRasa 1 part,
  Haunted Mansion 2735 parts/2701 colliders/6 bins, rig has 6 parts with
  torso 2×2×1 and the decomp head (600 verts).
- `test/luaenv.js`  services/Backpack/Tool/HopperBin/Mouse and the shipped
  gear scripts through the Lua interpreter.
- `test/safechat.js`  the embedded `Fonts\safechat.xml` tree (445
  utterances / 11 categories / depth 5), the `ChatButton` four-state art
  lookup (FUN_005e8740), and a DOM-shim mount test covering hover/press/
  disabled states, category drill-down, back navigation, and phrase send.

`node test/headless.js && node test/places.js` → both print
"ALL ... PASSED".

- `test/harvester.js`  the HumanoidHarvesterHorror end-to-end arc
  (see §12): full harvest loop from the shipped Lua, error-free, with
  the render batch rebuilding live under the moving crane.

- `test/jetpack.js`  the ExperimentalJetPack place through the real stack:
  free assembly (Glue not bonding to the floor), Touched attach, rigid
  assembly CFrame move, `makeJoints` weld to the virtual character torso,
  jump-input lift and second-press toggle-off (build 35).
- `test/luaenv.js`  the translation-layer suite: runs every shipped place
  script through the bridge against the real world/character classes
  (jumppad (0,200,0), daycycle +1/s, Rocket full flight → Explosion,
  pellet −8 damage, per-place launch counts + 6s error-free smoke);
  section 6 exercises the assembly physics core end-to-end (beacon
  BodyVelocity/BodyPosition live-drive, touch→goUp ride +20.65 studs,
  debris drop → flush rest → sleep, explosion kick, `makeJoints`
  welding into 8 members, kicked-debris ballistic flight) and the
  REAL humanoid controller (carried ride via `dyn.takeCarry`,
  120 studs/s fast-fall landing flush, no tunneling); section 7 checks
  the embedded sky pack + the 24 h celestial sweep (noon antipode,
  horizon fades, midnight moon).
- Inventory/tool section: services by class alias (`RunService`,
  `SoundService`, `ControllerService`), `Player.Backpack` on every
  `Player`, the shipped `Animate` Script actually driving
  `Right Shoulder.DesiredAngle`, camera-raycast `Mouse.Target`/`Hit`, a
  generic `Tool` moving Backpack→Character with `RightGrip` +
  `Tool.Grip` placement and `Equipped`/`Activated`/`KeyDown`/`Unequipped`,
  a custom `HopperBin` moving Backpack→Character and firing
  `Selected`/`Button1Down`/`Button1Up`/`Deselected`, stale-handler
  cleanup after unequip, full Tool/HopperBin re-equip + re-click cycles,
  and Lua `Instance.new("Explosion").Hit` (the
  class-name shift bug).
- Haunted custom-gear section: all five shipped BinType 0 gears launch
  through Lua; `PumpkinBomb` plants a cloned model, `Ghostwalk` attaches
  a BodyVelocity and makes the character translucent.

---

## 9. Lua→JS translation layer (`luaport.js` + `rbxenv.js`)

Every place Script and gear script now runs from its shipped Source string
nothing is hand-ported to JS for behavior anymore. `scriptport.js` keeps the
old classification/hardcode jobs only as the fallback when the bridge is
absent (headless scaffold without the Lua files).

### luaport.js  Lua 5.1 interpreter (green core)
- Full 5.1 grammar lexer+parser → AST; every executor is a JS generator, so
  `wait(n)` suspends the *whole stack* across frames exactly like the engine.
- Scheduler `RBLXlua.sched`: fibers + due-waiters; `tick(dt)` advances
  `sched.time` and steps due fibers (per-`{t:'wait',d}` yield protocol;
  `{t:'spin'}` / `{t:'coyield'}` continue next tick; cap 8000 steps).
- `break` propagates out of `while`, `repeat`, numeric `for`, and generic
  `for` (all four loop executors consume the `{brk:true}` result; before
  this the statement was parsed but ignored, so Crossroads'
  `if newPlayer.Character ~= nil then break end` guard spun forever).
- coroutines (create/resume/yield/status/wrap) run inline via `stepInline`.
- All language semantics smoke-tested (`/tmp/opencode/luasmoke.js` ported
  checks live in the luaenv suite): metatables, closures, pcall, varargs,
  numeric for, string.format etc.  5.1 subset the shipped scripts use.
- Per-script environments: each launched Script gets its own `_G`
  (`makeEnv`) with the bridge globals installed; the scheduler carries a
  per-fiber interp (`launchFiber(f,args,onDone,onUnsupported,ipCtx)`; plain
  sync natives capture the calling env via `RBLXlua.currentIp()`), so
  `script`, globals and upvalues are isolated exactly like 2007 threads.
- `pairs`/`ipairs`/`#` also accept plain JS arrays (bridge `GetChildren`).

### rbxenv.js  the Roblox API bridge
- Value types: Vector3/Color3/BrickColor are plain JS objects with
  `[L.MT]` handler maps (arith/comparison/index rotate through luaport's
  meta dispatch; number * vector falls to the right operand's `__mul`,
  which is what the Rocket script's `7*error` relies on). CFrame is a
  `{pos, rot(row-major 3×3)}` pair  rotation composition identical to the
  XML's coordinates, LookVector = −column3.
- Instances: parsed `RbxInstance`s (xmlplace) + synthetic ones share one
  duck-typed shape `{cls, ref, props, children, parent}`; wrappers are
  memoised by WeakMap identity. `Instance.new` builds the classic defaults
  (Part 4×1.2×2, unanchored/collidable).
- Script lifecycle: `script.Parent` chains, `:clone()/:remove()/
  :makeJoints()`, `Disabled`, `Source`, per-instance Touched/Died/Changed
  signals  `signal:connect(fn)` runs fn as its own thread each firing
  (spawn semantics, `connection:disconnect()` active-flag). Handlers run
  in the connecting script's env. When an instance leaves the world, its
  scripts are killed and every connection they made is dropped, so a
  deselected Tool/HopperBin cannot keep receiving mouse or instance
  events.
- Place startup launches Workspace scripts only. StarterPack/Backpack gear
  Scripts wait until the Tool/HopperBin is parented into the character;
  otherwise their connections exist before the first equip and every
  re-equip races a stale Script that was already killed.
- World write path: `CFrame`/`Position` writes feed `placePart` (matrix
  identical to buildPart's `applyMatrix4` + enclosing-AABB refresh);
  `Velocity` writes register the look as a script mover (`scriptMover`);
  the assembly is excluded from the free-body solver so the two integrators
  cannot fight. Movers integrate per Stepped with gravity −196.2·dt, probe
  terrain (`raycastBoxes` - first contact zeroes velocity), and the
  character (enter-gated Touched, no re-fire while standing inside).
- Stepped: `RBLXenv.fireStepped(dt)` runs movers → Touched probes →
  Explosion visuals → `RunService.Stepped` fire → humanoid Died edge;
  main.js then steps the scheduler (`sched.tick(dt)`). `Stepped:wait()`
  returns `[time, stepLength]` (Rocket's `t, s = r.Stepped:wait()`).
- Fake tree: `game` (children = parsed root Items; missing services
  synthesized), `Workspace` = the real parsed inst; `Lighting`
  Get/SetMinutesAfterMidnight drives the real time-of-day.
- Service lookup is by **class/canonical alias**, not display `Name`:
  the bundled files ship `RunService` as "Run Service",
  `SoundService` as "Soundscape", and `ControllerService` as
  "Instance". `game:service(...)` normalises case/spaces and checks the
  parsed class before synthesising a missing standard service, so no
  duplicate `RunService` is created.
- `Players.Player1` has a `Backpack`; every additional `Player` under
  `Players` gets one too. `StarterPack` contents are moved into the local
  player's Backpack on join. The runtime character exposes a fake
  `Model(Player1) → Humanoid + Torso/Head/arms/legs` tree so
  `hit.Parent:findFirstChild("Humanoid")`, `Torso.Velocity=`, and the
  shipped TeamBeacon `humanoid.LeftLeg`/`RightLeg` aliases run verbatim
  (writes map to the real character motion/health). `Model.PrimaryPart`
  is the fake Torso; Motor6D children of Torso forward `MaxVelocity` /
  `DesiredAngle` / `CurrentAngle` to the real servo objects.
- The shipped `fonts/humanoidAnimate.rbxm` Script is launched with the
  fake rig. `Humanoid.Running` / `Jumping` / `FreeFalling` / `Climbing` /
  `GettingUp` / `FallingDown` / `Died` are fired on pose transitions;
  `RightArm:children()` returns a real Lua array so `#kidTable` works.
  While `animateLua` is active, character.js skips its JS fallback move
  loop and only chases the Lua-set servo targets.
- Side effects on attach: Message → HUD overlay, Explosion → 0.1 s fuse
  queue → `world.explodeAt` (Hit + pressure impulse) + tools Explosion
  flash, Script → launch, Sound →
  `Sounds.load/playBuf` (data-URL path), `PlayOnRemove`
  boom on destroy (Rocket's collide.wav), Parts/Models → build/restore.
- Gear: `tools.js` fires the SHIPPED `fonts/Rocket.rbxm` /
  `fonts/SlingshotPellet.rbxm` through `spawnFromXml` (initial muzzle
  velocity from the decomp: rocket 60 dir/s via its own servo, pellet 85);
  the Rocket class stays as the no-bridge fallback.

### Inventory / Tool / HopperBin lifecycle (`tools.js`)
- `world.inventory` preserves `.rbxl` traversal order; `main.js` builds
  the hotbar from it. `StarterPack` contents were replicated into
  `Player.Backpack` by `rbxenv.buildGameTree`.
- Equip: a `Tool` is reparented from `Backpack` into
  `Workspace.Character`; its shipped child `Script`s launch there.
  `Tool.Equipped` is fired one frame later so the script's main body has
  installed its `:connect` handlers. `Tool.Unequipped` fires before the
  Tool returns to `Backpack`.
- HopperBin selection follows the same lifecycle: the bin is reparented
  into `Workspace.Character`, its child Scripts launch, and their main
  bodies are stepped to the first `wait` (`tickScripts(0)`) BEFORE
  `Selected`/`onSelected` fire with the Mouse. This guarantees
  `bin.Selected:connect(onSelected)` exists on the first and every later
  equip. `Deselected`/`onDeselected` fire before it returns to
  `Backpack`; child scripts are killed, their signal connections and
  mouse handlers are dropped, and the next selection gets a fresh Lua
  environment instead of a dead one.
- **Tool.Grip is the canonical CFrame property.** The decomp registers
  `"Grip"` as a CFrame (`FUN_005d1ca0` at 0x775140) stored at Tool+0x1ac;
  `GripPos` = its translation, `GripRight`/`GripUp`/`GripForward` = its
  column 0 / column 1 / −column 2 (`FUN_005cfcb0`/`5cfce0`/`5cfd30`/`5cfd50`).
  The port keeps `Grip` canonical and derives/syncs the four vectors, so
  XML `<CoordinateFrame name="Grip">` and Lua writes to any of the five
  properties stay consistent.
- The engine weld `FUN_005d1450` is:
  `RightGrip.Part0 = Right Arm`, `Part1 = Handle`,
  `C0 = CFrame.new(0,-1,0) * CFrame.Angles(-π/2, 0, 0)`,
  `C1 = Tool.Grip`. The handle therefore sits at
  `RightArm.CFrame · C0 · Grip⁻¹`, in the hand at the **end** of the arm;
  the render handle is mounted on the right-shoulder joint (torso edge)
  with that offset folded in. The old port used the wrong C0
  (`CFrame.new(0,-1,0)`, no rotation), which held every tool in the wrong
  orientation.
- `RightGrip` is destroyed on unequip. It is what the shipped `Animate`
  script's `RightArm:children()` / `#kidTable` tool test sees.
- HopperBins carry only `BinType`/`TextureId` (no Grip data in the
  shipped places), so their hand models use the same engine frame with
  the identity Grip: `RightArm.CFrame · C0`. The gear meshes keep their
  authored origin and share one 1/3-stud-per-unit scale (every shipped
  hand mesh is authored at about 8 units); the old Y-height fit/eyeballed
  offsets and rotations are gone, so there is no per-gear hardcoding.
- HopperBins: `Selected`/`Deselected` fire with the Mouse;
  `Button1Down`/`Button1Up`/`KeyDown`/`KeyUp` are forwarded as instance
  events. Shipped scripts that connect `mouse.Button1Down` themselves
  are not also called through the global `onButton1Down` (no double
  fire). Built-in BinType 2–7 hardcoded behavior is used only when the
  bin has no shipped Script; custom BinType 0 gears run entirely through
  Lua.
- `Instance.new` keeps the class name (`a[0]`, parent `a[1]`), so
  `Instance.new("Explosion").Hit` exists for the shipped Rocket script.

### ScriptMouse
- `Mouse.Target` is the camera-raycast Part (or nil).
- `Mouse.Hit` is the ray/face CFrame; `p`/`lookVector`/basis vectors are
  available through the normal CFrame wrapper.
- `Mouse.X`/`Y`, `Icon`, `Button1Down`, `Button1Up`, `KeyDown`, `KeyUp`
  are exposed. `main.js` refreshes the ray each frame from the camera
  and forwards click/key edges to the active Tool/HopperBin.
- `Mouse.Icon` keeps the classic string (e.g.
  `rbxasset://textures\GunCursor.png`) but the browser cursor is set to
  the shipped `content/textures/<name>.png` path, so gear cursors load
  instead of resolving `rbxasset://` as a dead URL. `cursorHotspot(url)`
  appends the matching `x y` CSS hotspot, so the gear icon/crosshair is
  centred on the pointer instead of pinned by its transparent corner.

---

## 10. Classic assembly physics (`web/js/dynamics.js`)The 2007 engine's own rigid-body model, reconstructed from the shipped
places + the decompiled joint machinery (`decomp/FUNCTION_MAP.md`,
Roblox.exe.c):

- **Surface-driven auto-joints (mined, Roblox.exe.c)**  the engine does
  not weld "everything touching"; it joins by *surface types* through a
  chain of factories tried in strict order per touching face pair
  (`FUN_005f50a0` → hinge/motor → weld → snap → glue; the World's
  `AutoJoin` notifier `FUN_005adba0` drives it on contact, at load and
  in play; one joint max per pair, first factory hit wins):
  - **Hinge(6)/Motor(7)/SteppingMotor(8)**: needs **both** faces in 6..8
    (Bumps(9) is a separate token), faces anti-parallel (normal dot >
    0.025), axes aligned to 0.35 rad, plane/center separation ≤ 0.05
    (`FUN_005ea670`).
  - **Weld(2) face**: a `SnapJoint`/`WeldJoint` rigid bond when EITHER
    face is type 2 (welds to anything, `FUN_006142d0`).
  - **Studs(3)+Inlet(4)**: `SnapJoint` only on the exact pair 3↔4
    (`FUN_006141e0`).
  - **Glue(1) face**: `GlueJoint` = **4 PointToPoint corner pairs + a
    NormalBreakConnector**, break force = *min* of the two parts' own
    break force/torque (`FUN_005eb0a0`/`FUN_005ec070`); looser
    alignment 0.05 vs 0.01 for snap/weld.
  - Alignment precheck: face planes within 0.01 (snap/weld) or 0.05
    (glue), face axes within 0.35 rad, face centers within tolerance
    (`FUN_005eb0a0`). Faces enumerate the part's OBB axes
    (`FUN_004fe9f0`, 6 outward normals from ±X ±Y ±Z).
  - SurfaceType enum in this build (binary string-pool + enum registry
    FUN_00583950): 0 Smooth, 1 Glue, 2 Weld, 3 Studs, 4 Inlet, 5 Spawn,
    6 Hinge, 7 Motor, 8 SteppingMotor (+ "Bumps" string present; **no
    "Universal"**  that surface did not exist in 0.3.368). Spawn/
    Bumps/Smooth faces form no joints.
  - Shipped places obey it: Happy Home = 1961 Inlet bottoms / 1963
    Studs tops (stacked bricks snap-weld), ~2000 Weld faces in HQ,
    4–6 Glue faces in HQ, a few Hinges + one Motor in Crossroads.
- **Cluster semantics**: rigid joints (weld/snap) connect bodies into
  clusters; the root is picked **anchored-first, then by mass**
  (`FUN_005f0dc0` `{isAnchored=(body+0x6c), mass}` + comparator
  `FUN_005f0e40`)  any anchored member makes the cluster static.
  Anchored bodies never integrate. Destroying a part breaks the joints
  through it (JointStage destroy `FUN_005ef5d0` on both parts) and the
  remainder re-clusters; surviving assemblies waking after support loss
  fall (the classic "delete the baseplate, the build comes down" demo).
- **Load-time auto-weld (porting the pass)**: contact between OBB faces
  (candidate pairs prefiltered by `_canTouch`: AABB contact within 0.05,
  or within 1.2 when either side carries a Weld/Glue face), joined per
  the factory chain above.
  Weld(2) accepts plane separation up to 1.2 studs (overlap range, the
  shipped beacons need it); Glue(1) uses the decomp's flush 0.05 gate, as
  does Studs(3)+Inlet(4). The port implements Weld/Snap/Glue as rigid
  cluster edges. The loose Glue range had welded every `ExperimentalJetPack`
  model to the smooth Floor through an overlapping P4/P5 face, making the
  whole place static; see §12. Hinge/Motor/SteppingMotor pairs are carried as
  RIGID holding edges (wheels/pods stay attached; no rotation DOF and no
  spin); SurfaceInput is stored but not
  consumed by the joint factories yet (APPROX 19).
- **Runtime-built parts** get their own assembly; AutoJoin fires on
  contact. Fresh `Instance.new` parts use the Part ctor defaults (Top
  Studs, Bottom Inlet, other faces Smooth), so stacked fresh parts can
  snap on 3↔4 while smooth sides stay unbonded. The shipped scripts weld
  explicitly via `part:makeJoints()`  the beacon scripts' `rebuildStud`
  does exactly this. Explosions apply the pressure impulse to the hit
  assembly; breaking a weld through a destroyed brick is a separate
  destroy/re-flood path (the 2007 blast itself does not destroy parts).
- **BodyVelocity** = per-axis velocity constraint with force budget
  (bang-bang): budget m·|v_tgt−v|/dt ≤ maxForce → snap to target,
  else drive at maxForce/mass. Beacon Center: velocity (0,−2,0),
  maxForce (0,·40000,·0) → the 112·196.2 = 22000 N gravity load is
  under the Y budget, so beacons sink at exactly −2/s; X/Z budgets 0.
- **BodyPosition** = per-axis P·err − D·v force clamped to maxForce.
  Beacon: P 10000, D 1250, maxForce (500,0,500), target read LIVE
  every step from `position` (script writes act with no plumbing
  `center.BodyPosition.position = beacon.Center.Position` homes X/Z;
  Y budget 0 = no vertical bp force). Force anchor is the mover's own
  parent part look.
- **Static support wins over movers** (infinite-stiffness contact): a
  grounded assembly ignores a downward BodyVelocity pull, so a landed
  beacon rests instead of jittering through its pad. Loose assemblies
  sleep once grounded and |v| < SLEEP (0.4).
- **Gravity** 196.2 (canonical classic constant).
- **Explosion impulse** uses the decomp form
  `direction · BlastPressure · boundingRadius²`; the final Δv is
  mass-scaled and capped at 80 studs/s because the client's inlined
  inverse-mass integrator is not minable (APPROX  see ledger). The
  character torso uses the same capped radial impulse with an approximate
  mass of 10; there is no direct Health write in the decomp blast.
- **Player coupling**: `Humanoid.step` consumes `dyn.takeCarry()`
  assemblies the character stands on translate him first (beacon pad
  rides; the carrier detection is the humanoid's `groundLook`
  mirrored onto the character record, read by `dyn._charOn`). The carry
  delta is the support's **net movement this step only** (integration +
  collision resolution); it is not accumulated across ticks, so jumping
  off a moving assembly and later landing on it cannot apply the motion
  that happened while airborne as one teleport. `setCharacter()` clears
  any pending carry on respawn.
  Fast-fall anti-tunnel window max(1.0, −v.y·dt + 0.4) lives in
  physics.js `_vertical`; walls are resolved only along the moved axis in
  `_sweep` (a zero-motion axis is never swept, which prevents sideways
  ejection from long walls).
- Hash spatial grid (CELL 16) registers each look's exact cells at
  insert and movers re-register when their span drifts (no ghost
  contacts at stale positions).

**APPROX items physics**: CONTACT 0.05, SLEEP 0.4, explosion mass scale
`BLAST_DIV 20000` + `BLAST_CAP 80`, the angular contact constants
(CONTACT_FRICTION 0.2, CONTACT_ITERS 10, two outer passes, ANG_MAX
6 rad/s), plus the per-axis velocity/position servo clamps (the classic
integrator's internal scales were not minable).

### Equality semantics (classic value userdata)
Color3/Vector3/CFrame/BrickColor wrappers bind `__eq` (component
compare) in luaport's `cmp` path  the shipped beacon script's
`team.Value ~= teamColor` (enemy-branch kill) compares re-wrapped
Color3s, identity alone would mark every rider an enemy.

---

## 12. Physics/joints/Lua correctness pass (2026-10)

### Humanoid walk-on-plate teleport  fixed (`physics.js`)
The horizontal sweeps pushed the body out of EVERY overlapping
collider, including ledges within step-up reach. A brick whose top sat
within 2.3 studs of the feet (a loose brick on the plate you stand on,
a seam brick whose top is a float-epsilon above the feet) ejected the
body sideways along the swept axis  the "teleport to a random side".
Now colliders within the step band NEVER block horizontally:
- grounded → the full stepHeight band is walk-through (the `_vertical`
  step-up owns those faces; that is what makes 2-stud borders
  walkable), so approaching a low brick steps ON it instead of
  ejecting past it;
- airborne → only a 0.06 flush epsilon is skipped, so a jump still
  collides with low walls.
Headless regressions: plate-seam walk (zero lateral/backward motion)
and step-onto-a-low-brick (axis-aligned + oriented collider variants).

### Surface welds failing  root causes fixed (`dynamics.js`)
1. **Rotation gate was wrong.** The old `_rotEqual` demanded the two
   bodies' whole rotation matrices match within 0.01/0.05  a part
   rotated 90° (walls laid the other way) could NEVER weld/snap to an
   axis-aligned neighbour. The decomp's gate (FUN_005eb0a0) is on the
   FACE AXES ("axes ≤ 0.35 rad", i.e. the two touching faces
   anti-parallel within 0.35 rad), not the whole bodies. Ported as
   `dot > -cos(0.35) → no joint`.
2. **Face-center check now ported.** FUN_005eb0a0's third gate
   ("centers ≤ tB") was previously skipped. Without it, a 1-stud
   corner kiss between faces whose centers are 10+ studs apart welded
    which froze HumanoidHarvesterHorror's crane solid: the
   Tophandle's rear stud overlaps a rotated studs-top platform's
   corner at y=38.8, snapping the whole travelling crane into the
   anchored structure. The tB literal was not recovered, so the check
   is expressed as a face-rectangle overlap-area gate: the two faces
   must overlap ≥ 25% of the smaller face (APPROX  value chosen; the
   shipped beacons' corner pips at 100% overlap and standard aligned
   stacks at ~100% pass, the crane's 10% corner kiss fails, matching
   the shipped game where the crane must travel).
3. **Part-vs-part Touched now fires.** dynamics resolves part contacts
   but never signalled them; Touched only fired for the character.
   A `contactHook` on the collision loop feeds rbxenv, which
   edge-latches per ordered pair and fires the part's Touched with the
   other part  the HHH Engine parks by touching the "Stop" pad
   (CraneStatus=1) through exactly that path.

### Lua translation layer accuracy (`luaport.js` + `rbxenv.js`)
- **Real Lua 5.1 patterns** (lstrlib port): classes/sets/%b/%f/
  backrefs/captures in `string.find/match/gmatch/gsub` (with `plain`
  flag, `%1`-refs, table and function replacements). The old stubs
  were plain-text only.
- String metatable (`("x"):upper()`, `s:sub()`) via a module-level
  string table on rawIndex.
- String→number coercion in arithmetic (`"10"+1`).
- `os.time/clock`, `tick`, `time`, `ElapsedTime` globals.
- `table.insert/remove` bounds + hole-aware length; `next()` scans
  past array holes.
- Bridge: lowercase `className` (HHH `parts[p].className == "Part"`),
  `Players.NumPlayers`, `CFrame.new(x,y,z,R00..R22)` 12-number form
  (rotation was silently dropped), full-palette scans for BrickColor
  name lookup/nearest-match (the old code stopped at id 64 of 1032).
- **BrickColor presets** `Red()/White()/Blue()/…/Random()`  the HHH
  pump script's colors. Preset→id literals were NOT minable; each maps
  to the shipped palette entry of that name (APPROX, flagged in code).
- **BodyPosition on the character** (the crane escort lift): per-axis
  P·err − D·v force clamped to maxForce on the humanoid root (mass 10,
  same approx as the blast torso), with engine ctor defaults
  P=10000/D=1250 in Instance.new. Two stability rules keep the hold
  smooth (an unclamped explicit-Euler PD at P=10000/mass-10 overshoots
  ±3 studs per tick  the in-machine camera strobe): the per-axis
  speed is clipped so one tick can never cross the target (monotone
  approach), and while any Y-active servo holds the body physics skips
  landing/ground-probe/head-bump (those clamps zeroed the servo's vy
  tick by tick). Measured hold: torso spread 0.13 studs over 1.5s
  including the crane's own travel (test/harvester.js).
- Model:MakeJoints() applies to every descendant part but floods each
  contact-connected component once (`seen` shared across the walk); the
  bridge passes that set into `Dynamics.makeJoints(inst, seen)`.
- `clone()` copies bridge Vector3/Color3 property VALUES (previously
  aliased the source's wrapper objects).

### HumanoidHarvesterHorror  bundled + headless arc test
`web/places/HumanoidHarvesterHorror.rbxl.js` (embedded verbatim,
registry entry added) and `test/harvester.js`: drives the real stack
(parser → world → dynamics → humanoid controller → Lua layer) through
the shipped scripts' FULL arc  pickPlayer (NumPlayers=1) →
"Need another specimen!" Message at t≈1s → crane escort lifts the
character +22 studs on the cloned BodyPosition → Engine travels 48
studs -Z on its BodyVelocity between the two smooth rails → parks on
the Stop pad (part-vs-part Touched → CraneStatus=1) → blood extraction
(Health −30×2, BrickColor.Red()/White() pump, "Agh!…" renames) →
specimen dies at t≈29s → burger dispensed + crane regenerated via
Model:Clone()/MakeJoints() at t≈41s  zero script errors.
NOTE: the shipped "Regen" script carries Disabled=true (launched count
5/6 is correct).

### RocketCarRally GoButton  BodyForce + two palette bugs (2026-10)
The Rally cars (extra/Places/RocketCarRally.rbxl) are welded unanchored
assemblies whose `Engine` part carries a **BodyForce** child; the shipped
GoButton script (run from Source) steps `engine.BodyForce.force` through
(-100000,0,0) → (-50000,0,0) → (-5000,0,0) → 0 on character touch, with
the button flashing red for the burn. Three fixes made it work:
1. **BodyForce mover** (dynamics.js): the mover family only knew
   BodyVelocity/BodyPosition  BodyForce children were ignored entirely.
   Now scanned at assembly build and integrated as a constant force
   (F/mass·dt, no clamp; assemblies with movers never sleep, so a
   settled car reacts the instant the force turns on). Instance.new
   defaults force=(0,0,0). The standing character rides the accelerating
   car through the existing groundLook carry.
2. **matchBrickColorId double-scaled** its inputs (callers pass 0-255
   ints; the function multiplied by 255 again), so every scripted
   BrickColor write matched ~White  the GoButton turned WHITE instead
   of red.
3. **Palette poisoning**: looks held the SHARED window.BrickColors entry
   object, and recolorPart wrote `look.entry.rgb=[...]` in place  any
   scripted recolor mutated the global palette (after the GoButton's
   blue flash, `BrickColor.new(28)` returned Bright-blue colors
   page-wide, so the green restore silently wrote blue). Look entries
   are now per-look copies ({id,name,rgb.slice()}).
`test/rallycar.js` runs the real place headless: Touched → red → green
restore, the car propelled ~2900 studs on the burn schedule, character
carried -X, zero script errors. (The car eventually flies off the
track's end into the void  honest physics for a 100000 N boost on a
finite track.)


### Rotating hinges  the Crossroads drawbridge (2026-10)
Shipped evidence: Crossroads' "Climb Ramp" is a 76.8-stud plank hanging
off a tower cube whose single Hinge(6) face kisses the plank's smooth
face flush  the plank swings on that pin under gravity and dips into
the ramp (verified: hinge attaches at the kiss, plank swings ~68° and
rests against the map). Ported in dynamics.js:
- kind-3 hinge links: a Hinge face bonds to ANY flush face it kisses
  (sep ≤ 0.06 + edge-level overlap ≥2%  a hinge hangs by an EDGE; the
  25% patch gate rejected the drawbridge's 23% corner contact).
- The link becomes a ROTATING joint when the anchor side is static and
  the swinger is a small (≤8 members) all-smooth (no Weld/Glue faces)
  assembly lighter than its anchor; otherwise dynamic↔dynamic links
  rigid-merge (wheels stay on cars) and everything else ignores them.
  Link resolution is frozen per reflood (mid-pass merges cascaded).
- Swing physics: rigid-pendulum torque Σm·g·(r×ŷ)·axis / Σm·r⊥²,
  Rodrigues rotation of the base pose about (pivot, pin-axis = the
  mating normal through the contact patch), probe-then-apply with
  static-embed rejection (rest contact freezes the swing), damping
  0.995, sleep after 45 rest ticks. Angular constants are APPROX (not
  decomp-minable).
- Rest-probe fix (build 13): the embed rejection skipped the hinge
  parent's WHOLE assembly  the pin cube lives in the 1569-member
  static map, so the Floor was invisible and the plank buried itself
  17.5 studs deep (read in-game as "no-collide ramp clipping into the
  floor").  Only the pin-owner part itself is skipped now; the plank
  rests ON the Floor (verified: zero static overlap, aabb bottom at
  the floor top, asleep, still in world.colliders).
- Tilted hinged parts collide as real OBBs (build 17): the build-16
  "AABB-top" path could not stand on a tilted plank  the fat AABB top is
  far above the real surface, and the old 2D footprint ignored the long
  axis once it left the horizontal plane (the drawbridge became a 1×12
  sliver at its centre). The solver now slab-tests a vertical ray through
  the part for support (min/max top over the yawed footprint), treats a
  leading edge within step reach as a walkable slope instead of a wall,
  and keeps upright parts on the cheap AABB path. The earlier down-ray
  hacks (builds 14/15) are not back: support comes from the part's own
  OBB, not a fat-AABB special case. `test/ramp.js` climbs the drawbridge
  (feet 1.4 → 16.3) with zero penetration and the idle stand holds
  120/120 ticks.

### GameTool drag (BinType 1) + whole-assembly moves (2026-10)
- **BinType 1 "GameTool" is the in-game dragger** (Happy Home's GameTool
  hotbar item)  the built-in fallback previously no-op'd for it, so the
  tool did nothing.  It now shares the Grab/drag path: pick a brick, it
  rides the cursor along its own horizontal plane.  BinType 2 (Grab)
  behaves identically where a place ships one.
- **Drags move the whole connected assembly** (members keep their
  relative offsets  welds/hinges hold; a per-part drag tore hinged
  builds apart).  Giant clusters (>64 members, the map itself) refuse
  with a click, like the classic GrabTool refusing big models.  Grid
  cells refresh per member while dragging; on release the joint graph
  re-floods so the dragged build bonds to whatever its faces now touch
  at the destination.  (An earlier pass synthesized an extra "Move"
  bin  reverted; places' own tools are the real inventory.)
- test/tools.js: a hinge-faced pod+bracket pair forms one assembly,
  grabbing either member with the GameTool picks both, both translate
  together (equal deltas), and the hinge spacing is kept at the
  destination.

### Click-accuracy fix  stale camera matrix (2026-10)
The aim/pick ray is built in tools.update, which runs in step() BEFORE
render() refreshes the camera pose  three.js `unproject` reads
`camera.matrixWorld`, so the ray used LAST frame's view.  Turning the
camera while clicking (right-drag aim) landed hits where the camera WAS
a frame earlier  the "clicks inaccurate to where it's pointing" bug.
`rayFromCamera` now refreshes the camera's world matrix (and its
parent chain) before unprojecting, so the ray is always this frame's
view.  Regression in test/tools.js: a 15-part grid where every part's
projected screen center click must hit that exact part (15/15), plus a
pose-swing check  the camera turns WITHOUT a render in between and
the center-pixel ray must point along the new forward (dot=1.000).

### 2007 Lighting port (2026-10)
Mined anchors: `RBX::Lighting` (FactoryProduct/descriptors, Roblox.exe.c
:382770/:384812/:384842) registers exactly Color3 props  TopAmbientV9 /
BottomAmbientV9 / SpotLightV9 / ClearColor (packed AARRGGBB V9)  plus
the TimeOfDay string and the Brightness float ("Brightness set." :120354).
The render side is GL 1.x fixed-function via G3D: per-light
ambient(0x1200)/diffuse(0x1201)/specular(0x1202)/position(0x1203) uploads
(:117137ff), global ambient through `setAmbient` (:116429, divided by the
device gamma), and **GL_LIGHT_MODEL_TWO_SIDE (0x0B52)** enable
(FUN_00473690, :115623). Build 50 moves this model into the literal G3D
layer (below):
- TopAmbientV9/BottomAmbientV9 feed the hemispherical ambient term;
  GL_LIGHT0 takes **SpotLightV9 as the sun/moon diffuse color**.
- **Brightness** is the display gamma (`setBrightness` stores
  `1.0/brightness` at `+0x224`; the final pass applies it). It is no
  longer used as a light-intensity multiplier.
- **Two-sided brick lighting** (the mined GL_LIGHT_MODEL_TWO_SIDE):
  brick/batch materials are DoubleSide and the shader flips the normal on
  back faces.
- Live writes: `game:service("Lighting")` property writes (TimeOfDay,
  Brightness, the V9 colors, ClearColor, CelestialBodiesShown) re-apply
  the whole model next frame  the decomp setters mark the render device
  lighting-dirty (the +0x3bd flag), same effect.
- NOT invented: GeographicLatitude / ShadowColor / fog properties are
  absent or unwired in this build's Lighting registration (no
  descriptors); the sun-arc mapping from TimeOfDay remains the §6
  approximation.

### T-Shirt  ShirtGraphic.TextureId + start-page picker (2026-10)
Decomp facts (binary RTTI, Roblox.exe.c:130770/130794): the 2007 classes
are `RBX::ShirtGraphic : CharacterAppearance` carrying **TextureId**
(Content)  the T-shirt, one texture drawn on the torso front  and
`RBX::Shirt : ShirtGraphic` adding **BrickColor**. (No "TShirt" naming
exists in this build.) Ported:
- `Instance.new("ShirtGraphic"/"Shirt")` with those defaults;
  TextureId reads/writes through the bridge; a ShirtGraphic/Shirt
  parented under the character model applies live (syncShirts  latest
  active wins; removal reverts to the start-page shirt, else the
  default torso decal). Every LoadCharacter re-applies.
- character.applyTshirt swaps the torso front decal plane's map (the
  shipped rig's torso logo IS the default T-shirt slot; null restores).
- Start-page picker (index.html + startpage.js): a "T-Shirt:" row with
  Browse…/Remove in the same chrome as the color rows, and a preview at
  the bottom of the panel drawn over the CURRENT torso brick color;
  persisted on window.RBLXplayer.tshirt (localStorage, 900 KB data-URL
  cap with a size warning).
- **Mirror fix**: the decal planes rotate y=PI to face the front, which
  reads un-mirrored on its own  the old `mkTex(mirror:true)`
  compensation (repeat.x=-1) was itself the horizontal flip that
  mirrored the default logo. Compensation removed on both character
  decal paths (head + torso).

### Joint & contact-solver pass (2026-10)  Rally wheels/track, HappyHome slide
1. **Hinge/Motor/SteppingMotor faces now HOLD.** The factory chain
   detects the pair (both faces 6..8) but v1 left it unconnected, so
   Rally's hinged rocket pods and every motor/hinge wheel detached and
   fell. The port's assemblies have no rotation DOF, so the pair is
   carried as a RIGID holding edge with the same gates as weld (plane
   ≤1.2 + face-overlap)  wheels stay on the car; no spin (APPROX 19
   updated).  Rally drift after 6s: 28–58 studs → ≤2 (settling).
2. **Weld-range candidates reach the joint test.** `_reflood`'s
   prefilter demanded AABB contact within 0.05, but the weld factory
   accepts a 1.2-stud plane gap (the shipped beacons rely on it).
   `_canTouch` now qualifies any pair within 1.2 when either side carries
   a Weld/Glue face; `_joinKind` still applies the full plane/axis/overlap
   gates (Glue itself stays flush at 0.05). This re-anchored Rally's long
   Weld-edged track plates (they formed 2-member islands and slid off).
3. **Contact solver: kiss starvation + corner rest** (the HappyHome
   slide fell through the map  a 4-part unanchored island whose only
   supports are EDGE-FLUSH contacts: every x/z overlap with the
   platform caps is exactly 0.00):
   - a zero-width kiss resolved as a ZERO-length push along the kiss
     axis, consuming the tick's single resolution slot and starving
     the member's real rest contact  kiss-axis "resolutions" are now
     rejected before slot consumption;
   - a corner/lip contact (zero-width x/z footprint, vertical
     penetration, body on top) now resolves as REST on a held
     neighbor (the slide sits on the platform caps' edges exactly as
     the shipped map looks).  HappyHome drift after 6s: 3540 studs
     (free-fall through the world) → 0.
   The slide is genuinely floating in the file (all supports are
   edge-kisses; the decomp's face-center gate would reject welding
   them)  resting on the lips reproduces the shipped look.
   test/harvester.js's CraneStatus latch is now write-intercepted
   (Object.defineProperty)  the Stop-pad handler writes 1 and the
   escort loop resets it within ONE scheduler tick, which a per-tick
   sampler can never observe.

### Force-solver rigid body (builds 31–32)  ContactConnector springs, torque, quaternion
The build-25…30 sequential-impulse pass was replaced by the shipped
client's own force model, reconstructed from the decomp. Contacts are
penalty forces with real torque, integrated in the engine's substep loop;
sliding, rocking, tipping, bouncing and spin decay are outcomes, not
scripted transitions.
- **Kernel loop**: `RBX::Kernel::step` (`0x5c7dd0`) runs `0x13` = 19
  connector/force iterations per 1/240 s tick with `h = 1/4560 s`
  (`0x3965f36d`). Every assembly carries a COM, a world-frame quaternion,
  member poses relative to that frame, and a 3×3 body inertia assembled
  from the member boxes (own box inertia + parallel axis); torque is
  integrated through `I⁻¹` and quaternions advance by `0.5·ω·q·h`
  (`FUN_005f7ee0`), renormalised each substep. Angular momentum is damped
  `0.9998` per substep; gravity is reseeded as a force `−196.2·mass`.
- **Normal law** (`ContactConnector::update`, vtable `0x7bfea4` +4 =
  `0x611e00`): a stored separation reference `+0x38` decays
  `(x+0.01)·0.999−0.01` when nonzero, else takes the current separation;
  `+0x3c` decays the same way and, when it is still 0 with `+0x38`
  already set, starts at 0. The force is `(s38 − sep)·k`, with `k = +0x34`
  when the relative normal velocity is separating and `+0x2c` when
  approaching; it is zeroed when `s3c < sep`. `FUN_005ed340` maps
  Elasticity to `0.28/0.42/0.57/0.8/1.0` (default 0.5 → 0.57), scaling
  the separating stiffness. The base stiffness is calibrated as
  `7500 · min(massA, massB)` (APPROX 21).
- **Friction**: tangential accumulator `+0x44..4c` gains `v_t·h`, is
  clamped to `μ·N_prev/(0.2·k)` (the normal force stored by the previous
  substep, `+0x40`), projected off the normal, and produces
  `F_t = −0.2·k·acc`. Default `μ = 0.2`; the accumulated distance is real,
  so a 20 stud/s brick stops in 5.5 studs / 0.57 s (Coulomb predicts
  5.1 / 0.51).
- **Force application** (`FUN_005c78f0`): adds `F` to the body force
  accumulator (`+0x80..88`) and `r × F` to its torque (`+0x8c..94`) at
  the contact point. That off-centre torque is what tips an overhung
  brick, restores a rocking one, and couples shoves into rotation.
- **Contact geometry**: 15-axis OBB SAT (3 host faces + 3 incident faces
  + 9 edge cross products) picks the minimum-overlap normal; incident
  corners inside the host (or host corners inside the incident) are the
  contact points, with a clipped-edge fallback for plus-shaped crossing
  boxes. Each point carries its own separation from the host's `+n`
  plane / incident's `−n` plane (clamped to the SAT overlap), so a tilted
  body feels a genuine restoring torque instead of a pair-wide depth that
  cancels.
- **Bodies**: welded clusters become one rigid assembly; anchored members
  make it static. Mover-driven assemblies (beacons, Rally cars, the HHH
  crane) stay on the translation path their shipped scripts were tuned
  against and never sleep. Hinged assemblies stay kinematic for contact.
- **Sleep / wake**: sleep is island-based. All awake assemblies joined by
  real contact features form an island; the island sleeps only when every
  member has `|v| < 0.4`, `|ω| < 0.15`, the COM projects inside its contact
  support hull (degenerate line-support hulls use segment distance, and a
  genuine lateral/underside normal clears the tipping gate for plates
  wedged into a recess), and has been quiet for `QUIET_FRAMES = 6`.
  Sleeping bodies one at a time traded sleep/wake with a moving neighbour
  every few frames; the island gate removed that oscillation (RobloxHQ
  settles to zero free assemblies by ~20 s). A sleeping body pre-wakes
  when an awake body can reach it this frame (expanded-AABB candidate
  pair with relative speed > 1.0), on a blast, or when its assembly has a
  mover. `restOn` only counts awake/static support, so a bed falling away
  never leaves a floating sleeper.
- **Stable contact features**: manifold points are keyed by member slot
  (`i0…i7`, `h0…h7`) or clipped-edge endpoint ordinal (`e4_5_0/1`), and
  contact normals/anchors are stored in the owning box frame so the 19
  substeps refresh depth and force arms under rotation. The old edge key
  embedded the continuous clip parameter `t`, so every tick created a
  fresh spring state (`s1 = sep`, `Fn = 0`), thin plates never settled,
  and `pair.state` grew without bound. State entries not refreshed in
  the previous tick are now pruned once per kernel tick.
`test/topple.js` covers the overhung column tipping and settling, a
balanced column sleeping upright, a 24 stud/s shove pushing a sleeping
crate with no clipping (the check is an AABB overlap; a small tilt alone
inflates it, so the bound is 0.2 studs and the peak clears within three
60 Hz frames), the shove travelling down a 3-crate row without
tunnelling, a base step impact rocking but not scripting a trip, a 40°
brick settling on a face, and a hard-spun brick stopping. `test/contacts.js`
adds Coulomb sliding (distance and stop time), real bounces at
Elasticity 1.0 / 0.5 / 0.0, and a brick tumbling off a stair nose under
gravity torque.

- **Seats / VehicleSeat / SelectionBox / Handles do NOT exist in this
  build**  zero occurrences of Seat/VehicleSeat/SelectionBox/Handles/
  Adornee/Occupant in the binary or the decompilation (they shipped in
  later 2007+ clients). Not invented; the era's tool set is the
  HopperBin BinTypes + the Studio tool classes (GrabTool, CloneTool,
  HammerTool  all present in RTTI).
### HopperBin hand tools pass (2026-10)  held meshes, Grab, pick accuracy
- **Held gear mesh stayed after unequip** (`character.setToolVisual`):
  the cleanup removed the mesh from `torso.mount`, but it was mounted on
  the RIGHT ARM pivot  every equip/unequip cycle leaked one floating
  tool on the arm. Now removed from its actual parent; re-equipping
  swaps instead of stacking, and the hand placement seats the fitted
  mesh's handle in the fist (tool head up, slight natural tilt).
- **Grab (BinType 2) moved nothing that was render-batched**: the drag
  poked `obj.position` directly  batched members have
  matrixAutoUpdate=false and a merged copy that never saw the poke, and
  cf/AABB/props drifted. The drag now runs through `RBLXenv.placePart`
  (cf + AABB + mesh + props in sync; staticDirty re-merges anchored
  bricks at the new spot, un-batches dynamic ones). Freshly CLONED
  parts are grabbable by the same path.
- **Pick accuracy (Hammer/Clone/Grab aiming)**: `rayHit` tested only
  enclosing AABBs, so clicking beside a rotated wall hit its fat AABB.
  Now AABB is a broadphase and an exact OBB slab test (ray transformed
  into the part's local space) refines every candidate.
`test/tools.js` covers: equip/unequip cleanliness, plain/batched/clone
drags through the camera ray, and the 45°-wall pick-precision case.


### Large-place render batching (`world.js`)
Anchored-or-immobile (static-assembly) block parts collapse into
merged static meshes after the build: plain single-material parts into
ONE vertex-colored Lambert mesh, identical material-array parts (same
size+color+surface tokens ⇒ same cached array ⇒ same UV repeats) into
one merged mesh per array. The merge copies the box UV attribute as well
as position/normal/index/groups  omitting UVs made batched Studs/Inlet
faces sample texel 0,0 and the surface art disappear. **Build 32** also
buckets each merged mesh's indices by material slot and emits one
geometry group per slot: three.js draws once per group, so the old
per-part six-face groups turned a batch into 6×N calls (RobloxHQ had
~45k groups / 4773 calls). Measured RobloxHQ at 1280×720: draw calls
4773→555 (663 with avatars/tools), render 15→6 ms, and after the
contact-state fixes below the hardware LibreWolf run is 51.8 FPS
(dyn 4.9 ms, draw 6.2 ms, 21,288 tris). Decal, SpecialMesh, hinge/motor
and transparent parts stay solo (their child overlay/peg meshes are not
part of the box merge).
Individual meshes stay in the scene (hidden, matrixAutoUpdate off) so mutations pull members
back out; any change to a BATCHED member (move via placePart,
Size/Shape/Surface/Transparency/color write, destroy/restore) marks
the batch dirty and it rebuilds before the next render. Free dynamic
assemblies (the HHH crane) are never batched, so their motion never
triggers re-merges. Merge cost is one-time at join (~0.1–0.5 s behind the
loading bar; inline transform math, no per-vertex three.js calls).
Physics also keeps an AABB pre-reject and a per-look cached OBB in its
sweeps/probes (cache keyed on the cf object identity  placePart swaps it
every move). `main.js` exposes `window.__perf` (step/render/dyn/char/tools/
draw averages, `renderer.info` calls and triangles) for profiling and the
hardware benchmark; `window.__perf.reset()` starts a fresh window.

### Ladders / TrussPart climbing (2026-10)
The 2007 engine had no ladder state: `FUN_005e9b90` (Running, decomp
:477225) calls `FUN_005e96b0`, which casts a `G3D::Ray` from the torso
offset along the move direction at foot height, DOWNWARD, length
`0.8 × size` (:477019). On a hit the state sets `vx*=0.7`, `vz*=0.7` and
`vy=sqrt(vx²+vy²+vz²)·0.7` (:477260-477268; `0.7f` at VA `0x7a03d0`,
WalkSpeed `16.0f` at `0x7ad42c`), so rung gaps under the ray reach chain
the boost. That is a ledge/rung quirk  it cannot be held, reversed or
started from a standstill  so the port implements a real climb state:
- `world.js` flags a part climbable when it is a `TrussPart`, or when it
  or an ancestor is named `/ladder/i` (Crossroads' `Model[Ladder]`). A
  ladder model's part boxes are unioned into ONE `climbVolumes` entry, so
  the shipped rails + five rungs with 2-stud gaps never drop the climber.
  `placePart`/`destroyPart` keep the volume in sync (`_climbDirty`).
- `physics.js` attaches when the footprint is within 1.05 studs of a
  volume and the player pushes into the nearest face; the body snaps
  0.55 studs off that face and faces it. W/S (`input.climbAxis`) drive
  up/down at the mined `0.7 × WalkSpeed` = 11.2 studs/s; no input holds;
  Space pushes off with `JumpPower` and 8 studs/s outward; the top exits
  with the feet on the ladder top (holding W then walks onto the platform
  instead of re-grabbing) and S at the top re-grabs to descend. Ordinary
  walls never attach.
- `character.js` gives Climbing priority over Jumping/FreeFall in the
  pose classifier and fires `Humanoid.Climbing(speed)` with the climb
  rate (the engine registers that event with a `speed` arg: VA
  `0x7745e0`, string `0x7b590c`).
- `test/climb.js` drives the real Crossroads ladders + a TrussPart and
  the rig pose/event headlessly.

### Explosion joint-break + humanoid damage pass (2026-10)
The blast query now cuts joints before it decides whether a body can move,
exactly like the decomp's per-hit call chain:
- `dynamics.js breakJoints(look)` walks the hit part's touching neighbours,
  re-using the normal AutoJoin test (`_joinKind` → Snap/Weld/Glue/Hinge/
  Motor/SteppingMotor) plus explicit `makeJoints` welds, and records each
  broken pair in `noJoin`. `blastPart` calls it BEFORE the `a.static`
  return, so an anchored wall's joints break even though the wall cannot
  move (test: "anchored hits still cut" / "anchored bricks stayed put").
- `world.explodeAt` no longer skips `o.anchored` before calling
  `RBLXdyn.blastPart`; static assemblies still take only the joint cut and
  no impulse.
- `_joinKind` returns 0 for a marked pair, and `_sweepNoJoin` (every
  `step`) drops the mark once the two AABBs separate by > CONTACT (0.05).
  That matches AutoJoin firing only on a NEW contact: pieces blown apart
  re-bond if they later meet, pieces that stayed in contact stay cut.
- **Momentum across the re-cluster**: the blast kicks the welded assembly,
  then the joint cut dirties the graph and `_reflood` rebuilds the
  assemblies. A snapshot (`_refloodPrev`) carries each member's
  `vel`/`angVel` into the new assembly (averaged), so the impulse is not
  discarded with the old Assembly objects. Without it the pieces cut but
  did not fly ("Δxz 0.00" regression).
- **Damage**: `world.explodeAt` applies `BLAST_DAMAGE = 100` with linear
  falloff over `BlastRadius` through `Character.takeDamage` (die → Dead
  pose at 0). This is a gameplay layer: §4 documents that the decomp blast
  path has no Health write.
`test/blast.js` covers the tower cut + lateral kick, anchored wall cut
without motion, stale-pair sweep, no silent re-weld, pile settling/void
cull, and the 100→0 humanoid falloff (d=2 → 50 HP, outside radius → no
damage, point blank → dead).

### Explosion batching + debris hot paths (build 33, 2026-10)
The blast behavior above is unchanged; this pass removes algorithmic
main-thread stalls around it:
- `world.explodeAt` now queues all dynamic hit looks for
  `dynamics.blastParts`. That bulk path cuts every hit part's joints,
  performs **one** `_reflood`, then applies each radial kick through
  `_blastPartAfterCut` to the final post-split assembly. The old loop called
  `blastPart` per brick, and each call synchronously re-flooded the entire
  world: N hits meant N full assembly-graph rebuilds before a paint.
- `breakJoints` returns whether it made a NEW cut and only marks the graph
  dirty in that case. Already-suppressed `noJoin` pairs skip their 36-face
  rescan (unless an explicit weld still needs breaking), so repeated
  rockets against an anchored broken wall do not rebuild or recheck it.
- Broadphase margins are per assembly (`_pairMargin(a,dt)`), not the global
  fastest body's travel. One 80-stud/s fragment no longer expands every
  debris query by the 4-stud cap. Support/rest/sleep bookkeeping is sampled
  on the last substep of each 1/240 s kernel tick instead of duplicated in
  all 19 substeps; force/torque integration still runs all 19. Static and
  sleeping contact partners reuse their exact look CFrames during manifold
  refreshes rather than reconstructing an unchanged pose per substep.
- Headless 240-part anchored wall, 168 hits: **168 floods / ~1.54 s →
  1 flood / ~46 ms**; the identical repeat blast is 0 floods (~18 ms of hit
  queries, down from ~1.73 s). A 96-piece loose-wall run reduced late-step
  candidate pairs from ~1150 to ~650. Timings are engineering measurements,
  not new physics constants.
- `test/blast.js` now counts the rebuilds for a 48-brick wall (first blast
  exactly 1, repeat 0), verifies anchored pieces stay put, and its debris
  storm's `mkPart(world,…)` helper actually populates the world under test.

### Regeneration restore + root lifecycle (build 34, 2026-10)
The shipped regen scripts were executing correctly, but three generic
bridge issues made Crossroads look dead:
1. **Model:MakeJoints was O(parts) whole-map floods.** The bridge called
   `Dynamics.makeJoints` once for every descendant part. Each call flooded
   the entire touching component and rebuilt its assembly, and the restored
   LostTemple model has 465 parts (Castle/Hideout 384 each). With dynamics
   initialized this synchronous pass ran right after the clone was
   re-parented and blocked the frame long enough that the building never
   visibly returned (headless 3 s-regeneration run exceeded a 5-minute
   wall-clock timeout after 11 simulated seconds). The bridge now shares a
   `seen` set across the model walk; `Dynamics.makeJoints(inst, seen)`
   processes each connected component exactly once and returns the set.
2. **Joint pair generation was all-pairs.** `makeJoints` compared every
   visited part with every other visited part O(N²) (465 parts = ~108k
   touch tests per model). It now queries the spatial grid for each part's
   local neighbours, preserving the same weld edges.
3. **The root was skipped by parent/remove.** `attachToWorld` and
   `detachFromWorld` iterated `walkAll`, which excludes its root: a Script,
   Part or Message parented directly to Workspace never launched, built or
   displayed, and direct `part:remove()` left its look behind. Both now use
   the root-inclusive list. `Message.Text` writes only display while the
   Message is in the world, so the regen scripts' detached setup no longer
   posts "Regenerating ..." minutes before their first wait.
- Exact shipped timing stays: RegenerationTime 800 s (jittered
  160-800 s), Delay 4 s. The regression shortens only those NumberValues
  before launch and verifies removal, full part-count restore, Message
  show/hide, and component-level flooding (7 full floods across repeated
  cycles instead of one per part). `test/luaenv.js` also checks that a
  root Part builds and is destroyed on direct parent/remove.

### ExperimentalJetPack and generic rigid attachment (build 35, 2026-10)
The place's 19 JetPack models run their shipped Script unchanged; the port
adds no JetPack branch. Four engine contracts were missing or wrong:
1. **Glue was using the Weld-specific 1.2-stud overlap window.** Every
   JetPack P3/P4/P5 assembly was therefore glued to the smooth Floor (the
   P4/P5 Glue face planes were not flush), and because the Floor is
   anchored, `Dynamics` made all 19 models static. Glue now uses the mined
   flush gate (`sep <= 0.05`); Weld keeps 1.2 for the TeamBeacon pips.
2. **Script CFrame/Position writes moved one member, not the assembly.**
   The JetPack script only repositions P3, then relies on the whole model
   arriving at the torso together. `Dynamics.moveAssembly(look, cf)` now
   applies the part's delta transform `q = newR * oldR^T`,
   `t = newP - q*oldP` to every member and re-clusters next step.
   `rbxenv.moveScriptPart` uses it for the `CFrame`/`Position` setters;
   anchored/lone parts still fall back to the single-part path.
3. **Non-colliding parts were absent from the joint graph.** `world.buildPart`
   only gave colliders an AABB and `Dynamics.init` walked `world.colliders`,
   so P1/P2/P8/P9 (`CanCollide=false` decoration) never welded to P3-P7 and
   stayed on the floor. Every part now gets a geometry AABB, and the
   assembly graph is built from `world.partLook`; only contact-pair and
   mover-collision loops skip `canCollide=false`.
4. **Character Parts were not visible to `makeJoints()`.** The renderer
   keeps the humanoid rig separate, so P4/P5 could not find the torso.
   `Dynamics._characterPartBoxes()` exposes the live OBBs of the fake rig
   parts; `makeJoints` marks contacting looks `__charWeld` and `_make`
   promotes that to `Assembly.charAttach`. The previously orphaned sibling
   problem in partial `makeJoints` is also fixed (unvisited members are
   re-made instead of silently dropped).
5. **`Humanoid.Jumping` was a pose-edge with no argument.** The shipped
   `JetPack` script uses `onJump(isJumping)`, and `humanoidSound` uses
   `onState(state, sound)`; both require a boolean. Jumping now fires at the
   jump-input edge (`true`, including mid-air) and on landing (`false`).
   Pose transitions no longer re-fire it, so the jetpack's own ascent cannot
   toggle itself off.
- Attachment is kinematic: `_stepCharWeld` records each member's torso-local
  pose on the first step after the weld and re-applies it every frame.  The
  old free body accumulated -190 studs/s while sitting on the back, then
  overwrote the first jump; it now starts from the humanoid velocity, lets
  `BodyVelocity` drive `vel.y + gravity*dt`, follows walking/turning, and
  marks members `__charIgnore` so the humanoid does not collide with its own
  welded pack.  This is the behavioural equivalent of the engine welding the
  real torso Part into the assembly; see APPROX 23.
- `test/jetpack.js` drives the real place: all 16 complete JetPack scripts
  launch, only the touched model attaches and fires, all nine parts share
  one free assembly, `makeJoints` welds it at torso-local `(0,1,1)`, the
  first jump lifts ~12.9 studs in 1 s, horizontal flight keeps the model on
  the back, and a second press toggles it off.

### Gear equip / unequip / re-equip (build 36, 2026-10)
The shipped Harpoon in Nuke The Whales reproduced the generic failure:
the first equip fired, but every later equip logged its Script load and
then ignored `Selected` and the mouse. Two lifecycle errors were involved:
1. **StarterPack Scripts ran at place startup.** `launchPlaceScripts` walked
   every top-level service, including StarterPack, so a gear Script executed
   while still in the Backpack. The first equip therefore worked against an
   already-connected `bin.Selected`; after unequip killed that env, the
   re-equip launched a new body but `Selected` was fired before it reached
   `bin.Selected:connect`. Startup now launches Workspace Scripts only.
2. **HopperBin Selected raced the relaunched body.** `_equipBin` reparents
   the bin (which queues its child Scripts), then now calls
   `RBLXenv.tickScripts(0)` to run the new bodies to their first `wait`
   before firing `Selected`/`onSelected`. The Harpoon's
   `mouse.Button1Down` connection exists on every selection. Tools already
   used the one-frame `Equipped` deferral; the same cycle now holds for
   both classes.
- Unequip still fires `Deselected`/`Unequipped` before returning the item to
  Backpack, then kills every child Script and drops all signal/mouse
  connections. Re-equip creates a fresh env.
- `test/luaenv.js` cycles a generic Tool and HopperBin through
  equip/click/unequip/re-equip/click, asserting the Script relaunch, event
  reconnection, and second-equip mouse input. No place-specific branch is
  used.
- **Script-written `Velocity` is mover-owned (build 36).** `moverRegister`
  marks the look `scriptMover`; `Dynamics` excludes any assembly containing
  one from the free-body solver and from contact-pair generation. Before
  this, the shipped Harpoon rocket was integrated twice: the legacy mover
  advanced it while the free-body assembly applied gravity and committed
  its own pose, so the rocket stalled near the muzzle. A generic projectile
  in `test/tools.js` now travels 50 studs in 1 s with a 0.49-stud gravity
  dip, while a free body continues to use the force solver.

### Per-part colours/transparency (build 37, 2026-10)
`WorldBuilder._brick`/`_buildMaterials` cache render materials by colour,
surface tokens and transparency. `rbxenv.recolorPart` and the
`Transparency` setter used to write `color`/`opacity` directly into those
shared objects, so one scripted change affected every part using the same
cached material. Haunted's Storm writes `SkyBox.A..E.BrickColor` and the
PumpkinBomb's detonation sets its PrimaryPart `Transparency=1`; those edits
bled onto the mansion, recolouring unrelated bricks and making walls
disappear so their inside faces were visible (the "inside-out/deformed"
report).
- `ownLookMaterials(look)` clones the single material or six-face array and
  assigns the copy back to that look before any colour/opacity edit.
- `recolorPart` uses it and updates the per-look palette copy plus
  `staticDirty`; the static-batch rebuild consumes the cloned arrays.
- The `Transparency` property path uses it too, then sets visibility from
  the requested value. Other parts sharing the cached material are
  untouched.
- `test/tools.js` pins the invariant with two same-colour parts: before the
  script they share one material; after one part recolours and fades, the
  other keeps its exact colour, opacity and a distinct material object.

### Complete Part property set (build 38, 2026-10)
The runtime descriptors in the 2007 executable are `CFrame`, `Position`,
`Velocity`, `RotVelocity`, `shape`/`Shape`, `Color`, `BrickColor`,
`Transparency`, `Reflectance`, `Locked`, `Anchored`, `CanCollide`,
`CastsShadows`, `Cullable`, `size`/`Size`, `formFactor`/`FormFactor`,
`Elasticity`, `Friction`, `DraggingV1`, `ControllerFlagShown`, `Controller`
(FUN_00772da0..FUN_00773360, FUN_00775040/FUN_007750a0), the six face
`{Surface, SurfaceInput, ParamA, ParamB}` families, and the base
`Name`/`Parent`/`archivable`. All are parsed, exposed to Lua, and kept on the
live look record.
- **Defaults** (`Instance.new("Part")`): Reflectance 0, Transparency 0,
  CastsShadows true, Cullable true, Locked false, DraggingV1 false,
  Elasticity 0.5, Friction 0.3, FormFactor 1, Controller 0,
  ControllerFlagShown true, Velocity/RotVelocity zero, archivable true.
- **Reflectance** now has a live setter: it rebuilds that part's material as
  MeshPhong (specular = Reflectance, shininess 70) or back to Lambert, and is
  excluded from the vertex-coloured static batch so the reflection is not
  lost.
- **Transparency** and **Reflectance** are honoured by SpecialMesh shapes
  (head/sphere/cylinder/wedge/file meshes) too; those used a bare shared
  Lambert material before, so ghosted or reflective meshes stayed opaque.
- **CastsShadows** maps to the render object's `castShadow`;
  **Cullable=false** maps to `frustumCulled=false` and keeps the part out of
  merged batches. `Locked`/`DraggingV1`/`Controller`/`ControllerFlagShown`
  round-trip as the editor/controller flags they are in 2007; they have no
  runtime geometry effect.
- **Friction** and **Elasticity** writes update the live contact record used
  by the force solver, so scripts can change a surface mid-game.
- **RotVelocity** is integrated by the mover path as a world-space angular
  velocity about its own axis; an angular-only mover still falls under
  gravity unless Anchored, and terrain contact clears both linear and
  angular velocity.
- **Color3 fallback**: old parts that serialize only the deprecated `Color`
  property now derive their palette entry from it instead of rendering grey;
  reading `Part.Color` always returns the current live colour.
- `size`/`Shape`/`formFactor` lowercase aliases are accepted as well as the
  runtime spellings.
- `test/parts.js` checks the defaults, parsed values, SpecialMesh
  transparency/reflectance, the Color3 fallback, every scripted setter, and
  a real RotVelocity spin.

### GameTool / PartDragTool (build 39, 2026-10)
HappyHome's StarterPack `GameTool` is HopperBin BinType 1, the engine's
`PartDragTool` (`FUN_005cc9b0` constructs it through `FUN_00604ca0`). The
old fallback merged BinType 1/2 and refused any assembly over 64 members,
which made a house (one giant anchored weld cluster) completely ungrabbable.
- The clickable gate is `Locked` (PartInstance +0x1a8, set recursively by
  `FUN_00576b30`), tested in `FUN_005ccce0`; `Anchored` and assembly size do
  not gate the drag.
- BinType 1 now drags one part even when it belongs to a static weld cluster.
  BinType 2 Grab keeps the whole-assembly drag for loose builds (welds and
  hinges hold), and falls back to one part for static or oversized clusters.
- Drag plane = the clicked face's plane. A top-face click slides level; a
  side-face click moves vertically. Free movement snaps to 1 stud in the
  plane.
- Surface snap: the ray under the cursor picks another part's face, the
  dragged part's anti-parallel face is placed flush on it, and the contact
  point is snapped to a 1-stud lattice in that target face's tangent basis.
  The tiny outward epsilon is below the 0.05 AutoJoin gate.
- Rotate keys follow `FUN_00604a60`: `r` -> `FUN_006165c0` = 90 degrees
  around world Y; `t` -> `FUN_00616620` = 90 degrees around the world axis
  nearest the part's RightVector (`FUN_005a74d0`). Auto-repeat is ignored.
- `rbxenv.placePart` invalidates the look's cached `__faces`, so AutoJoin
  sees the new pose. Without this the studs/inlet pair was tested at the
  drag-start location and never welded.
- `test/movetool.js` builds a 70-part anchored weld cluster and checks
  Locked refusal, single anchored drag, R/T rotation, and a bottom Inlet
  on a top Studs face joining after release. A HappyHome smoke check picks
  an unlocked part inside its 1957-member anchored assembly and moves it.

### Character collision and mass (build 40, 2026-10)
- **Swept ceiling.** `_vertical` previously checked ceilings only in
  `[head-0.1, head+0.8]` after moving. At JumpPower 50 the body travels
  ~0.83 studs per 1/60 s tick, so the head could jump from below a roof to
  above it with the underside outside that band, then land on the roof.
  `_ceilingSweep` now sweeps `[previous head, new head]`, requires a
  horizontal footprint overlap, and clamps to the lowest underside crossed
  (tilted parts use their per-footprint underside). It zeroes vertical
  velocity and the jump state, so the player falls back.
- **Humanoid body mass.** `bodyMass()` sums the rig part volumes (the same
  volume-based mass the assembly solver uses; fallback 13 for bare test
  rigs). `_pushDynamic` shares momentum with a free assembly on a
  horizontal contact: light bricks receive velocity and wake, heavy bodies
  barely move, and the character remains outside the contact (no
  tunneling). Anchored, hinged, character-welded, and script-mover
  assemblies are excluded.
- **Moving body vs idle player.** `_pushOutDynamic` runs after the
  character step. If a free assembly moved into the idle yawed footprint
  (its own velocity is nonzero and vertical support does not apply), the
  character is pushed out along the minimum SAT axis and receives that
  axis velocity. This closes the reverse noclip where a car/debris passed
  through a standing player because `_sweep` returns early at zero input
  velocity.
- The character remains the classic kinematic humanoid; this is
  momentum sharing at contacts, not a full rigid-body rewrite.
- `test/headless.js`: real jump peak 9.79 (not the old trivially-passing
  no-jump), a roof underside 5.5 stops the head at 5.50, a light free
  brick reaches vx=16 when walked into, and a free body moving at -10 z
  shoves an idle humanoid to z=-0.72.

### Mouse camera pitch inversion (build 65, 2026-11)
- `cam.pitch` is the third-person boom elevation, not the view pitch:
  `back.y = sin(pitch)` places the camera above the target and `lookAt`
  tilts the view down. Mouse-up (`movementY < 0`) must therefore DECREASE
  pitch so the boom drops and the view tilts up.
- The old right-drag line used `cam.pitch -= dy`, which raised the boom and
  tilted the view down on mouse-up (the reported inverted camera). The
  shipped `CameraTiltUp`/`CameraTiltDown` pad already used
  `pitch -= / += 0.12`, so the mouse and the HUD disagreed; the mouse line
  now matches the pad (`cam.pitch += dy * 0.0035`). Horizontal drag was
  already correct (`cam.yaw -= dx` looks right).
- The page cannot detect an OS/driver-level invert-Y setting; this restores
  the client's default convention.

### G3D OpenGL fixed-function lighting (build 64, 2026-10)
- Build 64 ("Added opengl", tag `gllight`, version 63→64) moved the light
  equation into the **vertex shader** so it is GL 1.x Gouraud, replacing
  build 50's per-fragment approximation: `lightVertex()` computes ambient +
  hemispherical ambient + per-light diffuse/specular per vertex, using the
  constant eye-space view vector because `GL_LIGHT_MODEL_LOCAL_VIEWER` is
  off (the client never enables it).
- `GL_SEPARATE_SPECULAR_COLOR`: specular is now added after the texture
  environment instead of being folded into the lit base. Light specular is
  the fixed-function default white, independent of the sun's diffuse
  intensity, so material specular 0.2 gives every part the classic plastic
  sheen.
- `uEnvReflect` distinguishes the sky cube (sample the view direction; it
  is the background) from `GL_REFLECTION_MAP` parts (reflect around the
  vertex normal).
- Authored sky faces are bottom-up relative to GL's cube convention;
  `skyFaceCanvas()` flips them vertically before upload, fixing the
  upside-down sky.
- Safe Chat button/panel moved above the backpack strip (bottom 130px /
  158px), per the March-2007 capture.

### Sky reflections and lower HealthHud (build 63, 2026-10)
- Reflective parts now use the **sky cube map as an environment reflection**.
  G3D's reflection pass (`FUN_00476860`) binds a cube texture and enables
  `GL_REFLECTION_MAP` texgen (`glTexGeni(GL_S/T/R, GL_TEXTURE_GEN_MODE,
  GL_REFLECTION_MAP)`); the port stores the same sky cube built by
  `applySky` as `world.skyCube` and attaches it to every Phong material
  created for `Reflectance > 0`.
- `g3d.js` now has a `uReflectivity` uniform: `base = mix(base,
  textureCube(sky, reflectDir), reflectivity)` instead of replacing the
  base colour outright.  The sky billboard keeps reflectivity 1, while a
  part uses its `Reflectance` (0..1) as the blend amount.
- HealthHud lowered again by twice the previous 20px step: top 104px.
- No test suites were run for this build (per request); JS syntax checked.

### Health position and Report button (build 62, 2026-10)
- The HealthHud now hangs slightly lower under the Player List (top 84px
  instead of 64px), matching the client's right-side stack.
- Added the client's bottom-right **Report** button: the shipped
  `ReportAbuse.PNG` / `_ovr` / `_dn` 48x48 art, positioned 48px above the
  camera pad.  Hover swaps to `_ovr`, press to `_dn`; clicking reports
  that abuse reporting is unavailable in the offline port.
- `test/client.js` checks the lowered HealthHud, the Report button
  position and the shipped art file.

### 2007 chat fold (build 59, 2026-10)
- Chat history is the **top-left fold under the toolbar**, not the modern
  bottom-left panel.  The 2006-2007 screenshots (Fandom `2007 chat.png`,
  July 2006 chat, February 2007 Glass Houses) show the fold there, and
  `main.js`/`safechat.js` now place it at `left:0; top:26px`.
- Literal ChatsOutput draw (FUN_00606e70):
  - 12px font on a 14px line pitch (`local_118 += 14.0`, text draw size
    `0x4028000000000000` = 12.0); six visible lines.
  - Each line is its own shrink-wrapped box: rect from `left-2` to
    `left + nameColumn + messageWidth + 2`, `top+1` to text bottom-1.
  - Box colour = `FUN_00551ab0` = (0.6,0.6,0.6) with alpha 0.6, i.e.
    `rgba(153,153,153,0.6)`.
  - Name column per line = `max(measured name + 4, 20)`; the name string
    includes the colon.  Names use the per-message palette colour; the
    message text is `FUN_00500920` white.
- `ui.chat` now emits `name:` (no trailing space) and keeps six lines.
  `test/client.js` checks the fold geometry, the 0.6 grey box, the 12px
  font/14px pitch, the name column, white messages, the six-line cap and
  the exact prompt string.
- The native `CChatPrompt` (`To chat click here or press "/" key`) is
  always visible as a full-width Windows-edit-style bar at the very
  bottom of the screen.  The backpack strip and camera pad sit above it
  (bottom 28px).  Clicking the fold or pressing `/` focuses it; the
  shipped `Chat.png` bubble button sits inside the left end of the bar
  for Super Safe Chat.  Enter/Escape clears and blurs, leaving the bar
  in place.

### On-screen HealthHud (build 58, 2026-10)
- The client's third-generation health bar (March 2007 to October 2009)
  is a **vertical 10x100 bar on the right side of the screen**, below the
  Player List, with blue "Health" text underneath (Roblox Wiki, Health,
  gallery 2006-2009; the 90x140 reference crop shows a 10x100 solid bar
  over a blue caption).
- Literal port:
  - `HealthHud` constructor (FUN_0060d440) sets width 10.0 and height
    100.0 (`in_ECX[0x3f]=0x41200000`, `[0x40]=0x42c80000`).
  - `FUN_0060d5f0` splits the widget rect at
    `bottom - (Health/MaxHealth) * height`: the lower portion is the
    health colour, the upper portion is red (`FUN_00500770`).
  - Health colour is `FUN_005a2dc0` = (0.505882, 0.772549, 0.086275)
    (`rgb(129,197,22)`); the "Health" caption is
    `FUN_005007d0` blue (`#0000ff`).
- `ui.health(pct)` now drives the CSS bar (`#healthFill` height), clamps
  to 0..100%, and updates the meter's aria value.  The main step already
  calls it every frame with `character.health/character.maxHealth`, so
  the bar drains from the top in real time.
- The font is the shipped Comic Sans (the second-generation bar switched
  from Eras Demi ITC to Comic Sans); the port keeps the embedded
  `comicbd.ttf` bold face.
- The existing overhead name/health billboard is separate and unchanged.
- `test/client.js` checks the 10x100 geometry, the decomp colour, the red
  lost portion, the blue 18px caption, and the 0/50/100% fill behaviour.

### In-game HUD from the client chrome (build 57, 2026-10)
- The Play Solo chrome now follows the shipped client HUD instead of the
  CSS approximation:
  - Toolbar: five 100px-wide cells at the top-left, background
    `#d4d0c8`, labels in the client's own order and text
    (`Toolbox`, `Edit Mode`, `Help...`, `Fullscreen`, `Exit`).  The label
    strings are contiguous in Roblox.exe at 0x3bc2e0..0x3bc2c4.
    `Edit Mode` is intentionally inert: it only reports "This is the play
    client." (an actual editor is out of scope for the play client).
  - Player List: 178px translucent grey panel at the top-right, white
    shadowed header and blue names.
  - Backpack/hotkey strip: 96x96 cells flush at the bottom-left with no
    gaps, dark translucent backdrop, centred 84px icon, and the client's
    grey number box with the hotkey at the bottom-left (not the modern
    top-left blue counter).
  - Camera pad: the shipped `CameraTiltUp/ZoomIn/TiltDown/ZoomOut.png`
    circle icons in a 2x2 grid at the bottom-right.  One press tilts
    0.12 rad or zooms 2 studs, matching the wheel step.
  - Chat history is the top-left fold under the toolbar; the 2007
    client's HealthHud is the 10x100 vertical bar at the right.
- `test/client.js` cross-checks the toolbar labels/order, the Edit Mode
  notice, the 100px cells, the 178px Player List, the bottom-left
  backpack geometry, the number box, the camera order, and the presence
  of all four camera PNGs.

### Controller flags only on driven assemblies (build 56, 2026-10)
- The load-time flag pass used to attach a flag to every unanchored part
  with `Controller` 1-6.  RobloxHQ stores `Controller=2` on the castle and
  tree bricks (they are direct Workspace children, unlike Crossroads'
  ramps/trees which sit inside Models), so the port painted hundreds of
  red pennants over static scenery.
- A flag now requires a part that can actually be driven: not `Anchored`,
  and not part of an assembly welded/glued to an anchored member
  (`RBLXdyn.isImmobile`, the same test the static batch uses).  The
  load-time pass runs before the weld graph exists, so `main.js` calls
  `world.refreshControllerFlags()` after `RBLXdyn.init(world)`; the pass is
  idempotent and also runs from the live `Anchored` setter.
- This is an approximation of the unstripped predicate: `FUN_005350f0`
  also consults a cached virtual state at part+0x118 that the stripped
  binary does not name.  Static scenery has no meaningful controller flag,
  so excluding immobile assemblies matches the observed 2007 behaviour
  (RobloxHQ 304 load-time flags -> 0; Crossroads 0; the weapons test place
  keeps the two flags on its movable chassis/tool parts).
- `test/controller.js` covers an anchored `Controller=2` part and a part
  welded to an anchored base both staying flagless, while the movable
  model and standalone Chase parts keep their flags.

### Join-time high-part-count warning (build 55, 2026-10)
- Joining a place now shows a dismissible warning when the Workspace part
  total reaches `RBLXui.PERF_WARN_PARTS` (2500):
  `High part count (N parts)! Performance may be slow on older devices!`
  The count is `world.build()`'s part total (Part/SpawnLocation/TrussPart),
  so it covers bundled places and user-loaded XML alike.
- 2500 is a browser-port budget, not a 2007 engine constant.  The shipped
  places below it join cleanly (Crossroads 1679, HappyHome 1964); Haunted
  Mansion (2731) and RobloxHQ (8077) exceed it.
- The banner uses the classic HUD hint styling at top center, lasts eight
  seconds, and can be clicked away.  `test/client.js` covers the threshold
  boundary, the message text, and show/hide.

### Renderer/batching performance (build 54, 2026-10)
- Frozen batched parts are now **removed from the scene graph** instead
  of merely hidden. `Scene.updateMatrixWorld` and the renderer's traversal
  no longer walk thousands of invisible part meshes; un-batched parts are
  re-added when they become live again.
- Static surface-art batching no longer creates one material array/bucket
  per distinct part size.  Studs/Inlet faces share the base atlas tile,
  the per-size texture repeat/offset is baked into vertex UVs, and the
  brick colour becomes the batch material colour.  All same-colour studded
  faces merge into one mesh per tile; untextured faces go into the
  vertex-coloured plain mesh.  Headless Crossroads calls fell 1901→448,
  RobloxHQ 1593→470, HappyHome 391→91, Haunted 6231→1521.
- Projection/view matrices upload once per program per frame, and the
  normal matrix is computed once per object per frame instead of once per
  material group.
- `_batchable` also excludes parts carrying a `Texture` overlay, matching
  the existing Decal/SpecialMesh exclusion.

### Rig material isolation and opaque order (build 53, 2026-10)
- The character rig now uses `WorldBuilder.materialsForPart`, so its
  materials come from the same surface-material cache as workspace parts.
  A rig write (`setPartColor`/`setPartTransparency`, start-page body
  colors, ghost effects) must not mutate a world part that happens to
  share the same cache key.  `Character` now clones the material
  instance(s) per rig part; `test/character.js` verifies that rig colour
  and transparency writes leave the world material untouched.
- Opaque draw order is now the scene/traversal order (only `renderOrder`
  sorts), matching G3D's submission order.  With the mined LEQUAL depth
  test, a later-authored part wins on a coplanar face; sorting opaque
  objects by distance could let an underlying riser/trim overwrite the
  visible tread and produce the "odd colours" on the HappyHome/Rally
  stairs.  Transparent objects still sort back-to-front.

### Character studs and ControllerFlags (build 52, 2026-10)
- **Character studs.** The shipped `character.rbxm` carries per-face
  Surface tokens: Torso `Top=Studs(3)`, `Bottom=Inlet(4)`, sides Weld;
  both arms `Top=Studs`, `Bottom=Inlet`; both legs `Top=Studs`; Head
  `Top=Smooth(0)`.  `Character` now sends each block rig part through
  `WorldBuilder.materialsForPart`, the same six-face atlas builder used by
  workspace parts, so the torso/arms/legs get their top studs and the
  arms/torso their bottom inlets.  The HeadMesh path stays plain and is
  deliberately excluded: the shipped Head has no stud (TopSurface 0).
- **ControllerFlag geometry.** `FUN_005350f0` gates the flag on
  `ControllerFlagShown` and `Controller != Player(7)`;
  `FUN_00534fd0` draws it on the model's PrimaryPart with size 3.0.
  `FUN_005b8060` maps ControllerType to the client colour table:
  None/Joypads grey (0.7), KeyboardRight blue, KeyboardLeft red,
  Chase black, Flee yellow, Player violet.  Models with Controller 1-6
  and ControllerFlagShown now get a pole + triangular pennant attached
  to their PrimaryPart; standalone parts get the same flag (build 56 adds
  the movable-assembly gate that keeps static scenery flagless).  The
  cloth waves slightly; Controller/ControllerFlagShown writes remove or
  rebuild the flag live.  Flagged parts are excluded from the static
  merge.
- **Controller input.** ControllerType and InputType are the decomp
  enums (`FUN_0058fc90`): 0 None, 1 KeyboardRight, 2 KeyboardLeft,
  3 Joypad1, 4 Joypad2, 5 Chase, 6 Flee, 7 Player; inputs NoInput,
  LeftTread, RightTread, Steer, Throtle, UpDown, Action1-5, Constant,
  Sin.  KeyboardLeft is WASD, KeyboardRight is UHJK, Joypads use the
  arrow keys, Space is UpDown, and 1-5 are Action1-5.  Surface
  Motor/SteppingMotor parts and authored RotateP/RotateV joints read the
  part's Controller (or its model's) and SurfaceInput; tread mixing,
  steering and throttle drive at ParamA (forward) / ParamB (reverse)
  times 60 rad/s.  Constant(12) keeps the previous fixed drive and Sin(13)
  is a sine drive.
- **Approximations.** The flag pole/pennant dimensions are reconstructed
  from the March 2007 screenshots/decomp call (3.0-stud flag, right
  triangle); the decomp vertex wave is replaced by a small cloth
  rotation.  Chase/Flee get a basic primary-part steer toward/away from
  the local character (not the full decomp target-selection loop);
  Player(7) motors do not receive keyboard input.

### Sky cube face orientation (build 51, 2026-10)
The authored sky faces use G3D's cube convention, which differs from
three.js' `CubeTextureLoader` orientation.  The mismatch produced visible
vertical and horizontal outlines where the six faces met.  `applySky` now
loads the six images itself and rotates each into GL order before
building the cube:

  Rt 180, Lf 180, Up 90 CCW, Dn 90 CW, Ft 180, Bk 180

The table was derived by minimising colour discontinuity across every
shared face edge, and verified on both the shipped `null_plainsky512`
set and Crossroads' embedded 512px sky.  The cube is uploaded with
`LinearFilter` and no mipmaps (`generateMipmaps=false`), which also
removes the thin mip-edge lines that clamp filtering otherwise leaves
on cube seams.  Rotated faces are canvases, so custom embedded sky
faces use the same correction.  That mapping is one of the seamless cube
symmetries and is yawed +90 degrees from the client's sky heading, so the
sky mesh is rotated -90 degrees around Y; the result is both seamless and
in the original orientation.

The shipped `lensflare.jpg` is a solid white disc with a hard rim; drawn
directly it read as a circular outline over the sky.  It now uses a
radial grayscale alpha mask (white centre, black rim) and a lower opacity,
so the flare fades into the sky instead of showing a ring.

### Literal G3D RenderDevice layer (build 50, 2026-10)
The client does not render through a material graph: it drives G3D's
OpenGL 1.x `RenderDevice` (decomp `0x4735c0..0x475f50`). Build 50 ports
that layer into `web/js/g3d.js` and makes it the page's renderer.

- **State machine + cache.** Every setter mirrors its decomp function and
  only touches GL when the value changes: depth test
  (`FUN_00473ad0`: 0 LEQUAL, 1 LESS, 2 GEQUAL, 3 GREATER, 4 NOTEQUAL,
  5 EQUAL, 6 off, 7 NEVER), depth write, cull (`FUN_00473870`: 0 back,
  1 front, 2 off), blend factors (`FUN_00473390`: 0 SRC_ALPHA,
  1 1-SRC_ALPHA, 2 ONE, 3 ZERO, 5 SRC_COLOR, 6 1-SRC_COLOR), blend
  equations (`FUN_00474220`: 0 MIN, 1 MAX, 2 ADD, 3 SUBTRACT,
  4 REVERSE_SUBTRACT), alpha test (`FUN_00473dd0`), polygon offset,
  shade model, viewport, clear colour/depth, and texture env
  (`FUN_00474780`). The mined opaque fast path is kept: ONE/ZERO with
  ADD/SUBTRACT disables blending instead of uploading factors.
- **Colour material and material defaults.** `setColor` is the
  `glColor4fv`/`GL_COLOR_MATERIAL` ambient+diffuse source. Build 50 uses
  the G3D startup defaults from `FUN_0061d2d0`: specular
  `(0.2,0.2,0.2)`, shininess 64, emission black (the `.data` literals at
  `0x7c225c`/`0x7c224c` were read from the PE image to recover these).
- **Eight lights.** `setLight`/`enableLight`/`disableLight` carry the
  GL light position (w=0 directional, w=1 positional with
  constant/linear/quadratic attenuation), ambient, diffuse, specular and
  spot fields. Lighting's TopAmbientV9/BottomAmbientV9 become the
  hemispherical ambient term; SpotLightV9 becomes GL_LIGHT0
  (sun by day, moon by night); any AmbientLight adds to the global
  ambient (`setAmbient`, divided by the device gamma as in
  `FUN_00474470`).
- **Fixed-function shaders.** `web/js/g3d.js` carries one lit and one
  unlit GLSL ES 1.00 program: the fixed-function ambient+diffuse+Lambert
  equation, specular with shininess, two-sided normal selection via
  `gl_FrontFacing`, GL_MODULATE/DECAL/REPLACE/ADD/BLEND texture
  environments, vertex colours, alpha maps, cube environment maps,
  brightness gamma (`pow(c, 1/brightness)`), and texture matrices
  (`repeat`/`offset`/`rotation`) so the surface atlas tiling and decals
  keep their UV transforms.
- **Scene front end.** `RBLXg3d.Renderer` wraps a WebGL 1 context and
  consumes the existing three.js scene graph: meshes (including
  six-slot material arrays and groups), sprites (name tags, billboarded
  and depth-test-disabled), lines (laser tracer), the cube sky, the
  sun/moon/lens-flare billboards, transparent back-to-front sorting by
  render order and distance, frustum culling, and per-frame
  call/triangle stats. `main.js` builds this renderer instead of
  `THREE.WebGLRenderer`; `RBLXcaptureCanvas` and the F3 perf HUD keep
  working through `renderer.info`.
- **Immediate mode.** The device also exposes `begin/end/vertex/normal/
  texCoord/color`, converting QUADS/TRIANGLES/FAN/STRIP/LINES/STRIP/
  LOOP/POINTS into transient draws. The part path itself uses indexed
  vertex arrays, as the exe does.
- **Brightness is gamma, not light scale.** `setBrightness` keeps the
  value for the final shader gamma; `Lighting.Brightness` no longer
  multiplies the three.js light intensities (that made brightness both
  brighten the lights and the display). `applyLightingProps` also keeps
  the packed V9 colours when a live Lighting property changes (the old
  fallback reset them to the default white/blue).
- **WebGL 1, GLSL ES 1.00** is requested deliberately: WebGL2 requires
  GLSL ES 3.00 shaders unless aliased, while the 2007 pipeline is fixed
  function. 32-bit indices use `OES_element_index_uint`, with a Uint16
  narrowing fallback.
- **Approximations.** Lighting was per-fragment in build 50 rather than
  GL's per-vertex Gouraud evaluation (same equation, smoother
  interpolation); build 64 replaced it with the vertex-shader equation.
  COMBINE/DOT3 texture environments are approximated by MODULATE;
  alpha test only implements the less-than reference form; polygon
  offset uses factor/units `-1` for any material that asks for it;
  stencil, fog (no 0.3.368 Lighting registration), and G3D bloom are not
  wired. Brightness gamma is applied per fragment rather than as a final
  display-ramp pass (identical at Brightness=1; blending order differs
  only for other values). Two-sided materials also disable back-face
  culling, whereas GL can light two sides while still culling; the port
  keeps the existing DoubleSide brick policy.
- **Tests.** `test/g3d.js` checks the mined enum tables, state-cache
  dedupe, light/ambient upload, shader/uniform shape, indexed and
  immediate draws, UV transforms, material groups and transparent
  blending. `test/g3d-world.js` builds Crossroads and renders it through
  the device with a recording GL context (draw calls/triangles/clear).

### Client coverage: textures, hints, joints, teams, 3D audio (build 49, 2026-10)
- **`Texture` face class.** The 2007 client has both `Decal` and `Texture`
  (RTTI `Texture`, face image with `StudsPerTileU/V` and `OffsetU/V`).
  `Texture` now builds the same face overlay as a Decal but sets
  `RepeatWrapping`, `repeat = face size / tile size`, and the stud offset.
  ExperimentalJetPack's 512x320 wooden floor (a Texture on its top face)
  is textured again. `SpecialMesh.TextureId` is also applied: the mesh's
  own UVs receive the image instead of plain brick colour.
- **`Hint`.** `RBX::Hint` (TextDisplay) was missing; a Hint parented to
  Workspace now displays its Text in the classic top-centre line, follows
  Text writes, and hides on removal. Saved Hints show on join.
- **`LocalScript`.** The client runs both `Script` and `LocalScript`
  (the port is the client). Gear `hasScript` checks include both.
- **`BodyThrust`.** `RBX::BodyThrust : BodyMover` (Force + Location, both
  relative to the bearing assembly). Thrust-only assemblies stay in the
  free force solver so the offset produces real torque; a thruster welded
  into a mover-driven assembly applies its force in the translation path.
- **Authored `JointInstance`s.** `Weld`/`Snap` and `Glue` are rigid edges
  independent of surface contact; `Motor`/`RotateP`/`RotateV` are pin
  joints. `world.jointRecs` is filled by `rbxenv` when a joint is loaded,
  parented, or has Part0/Part1/C0/C1 written. Rigid joints snap the
  unanchored side to `Part0 * C0 * C1^-1` (and cluster it); pins rotate
  about the joint frame's X axis. `Motor` is the script servo
  (`DesiredAngle` at `MaxVelocity`, `CurrentAngle` live). Surface
  `Motor(7)`/`SteppingMotor(8)` faces are no longer rigid: with a
  non-zero `SurfaceInput` they drive the pin at `ParamB * 60` rad/s (the
  documented RotateV/RotateP Constant input); NoInput leaves the hinge
  free. Explosions delete the authored joint record, so it cannot rejoin.
- **Teams.** `Team` carries `Score`, `TeamColor` (BrickColor) and
  `AutoAssignable`; `Teams:GetTeams`, `Team:GetPlayers`,
  `PlayerAdded`/`PlayerRemoved` are live. The local player is
  auto-assigned to the first auto-assignable team (fewest-members is a
  tie with one player), `Player.Team`/`TeamColor`/`Neutral` follow, the
  overhead name tag and player list take TeamColor, and
  `SpawnLocation.TeamColor` filters LoadCharacter pads (neutral pads are
  194 / missing). The first spawn peeks at the file's Teams service
  because LoadCharacter runs before the bridge builds the game tree.
- **Debris and service stubs.** `Debris:AddItem(instance, delay)` with
  `MaxItems` cap; `BadgeService`, `TeleportService`,
  `ChangeHistoryService` and `CollectionService` (tags) are callable and
  return the honest single-player result instead of a nil-method error.
- **Positional audio.** The exe drives FMOD `Channel::set3DAttributes`
  (decomp 0x583f70), so Sounds under a BasePart are 3D. `AudioBus` creates
  a PannerNode (inverse distance, ref 10, max 10000), updates the
  WebAudio listener from the camera every frame, and `tickSoundPositions`
  moves loop emitters with their part. Sounds without a part ancestor
  (UI, chat) stay 2D.
- **Camera boom collision.** The third-person boom ray-tests its own
  length against the world and pulls in before crossing a collidable
  part; first-person hiding now keys on the effective (pulled-in)
  distance.
- Dynamics is re-initialised when a new place replaces the world instead
  of keeping the previous place's assembly graph.
- `test/client.js` covers Texture tiling, SpecialMesh.TextureId, Hint,
  LocalScript, BodyThrust force+torque, Weld clustering, Motor servo and
  surface Motor drive, Teams/spawn filtering, Debris and the audio panner.

### WebGL availability and canvas extraction (build 48, 2026-10)
- The start page now shows a clear warning when the browser cannot create a
  WebGL context (hardware acceleration/WebGL disabled).  The message lists
  the common browser settings, shows the renderer error detail, and has a
  "Reload and check again" button.  Joining is refused with the same
  warning instead of failing mid-load; the place list still renders.
- The renderer is created with `preserveDrawingBuffer: true` so the canvas
  pixels survive compositing and can be extracted with `toDataURL`/
  `toBlob` (screenshots, external tools).  `window.RBLXcanvas` exposes the
  canvas, and `window.RBLXcaptureCanvas(type, quality)` /
  `window.RBLXcaptureCanvasBlob(cb, type, quality)` render the current
  frame first and return the image data (null when no GL context).

### Embedded assets: binary + MD5 hash references (build 47, 2026-10)
- **The place archive stores each embedded asset once.** A `<Content>` can
  carry a base64 `<binary>`, and every duplicate reference elsewhere in the
  file uses `<Content><hash>...</hash></Content>`. The hash is the asset's
  **MD5**, serialized as per-byte hex with leading zero nibbles omitted
  (byte `0x0e` → `e`), so references can be 29-32 chars. `parseProps` now
  hashes each binary while loading, caches it under both padded and
  unpadded MD5, and resolves hash references after the whole tree exists
  (forward references are normal). The cache is per parse, so a large
  texture stored once is decoded once and shared by every reference.
  This fixes the missing skybox faces/decals in Crossroads and RobloxHQ.
- **Mime-aware data URLs.** An explicit `mimeType`/`xmime:contentType` is
  used first; otherwise the payload is sniffed (PNG/JPEG/GIF/WebP/WAV/OGG/
  MP3/BMP/text mesh) and falls back to the property class (`SoundId` →
  audio/wav, `MeshId` → text/plain, textures → image/png). Raw base64 in a
  `<url>` is wrapped in a data URL too.
- **Consumers accept data URLs everywhere.** `Sounds.resolve` no longer
  prefixes `content/sounds/` to `data:`/`blob:` URLs; `Sounds.load` uses
  the deferred byte decoder for any data URL (not only `SOUND_DATA`).
  `imageContent` normalizes raw base64/URLs for decals, shirts and sky
  faces. FileMesh now decodes an embedded `MeshId` (binary or hash) as
  text and builds the real mesh instead of falling back to a block.
- **Decal/T-shirt alpha after transparency.** `setPartTransparency` used to
  set `material.transparent=false` when a ghost effect returned to opacity
  1. The face and shirt planes are PNGs with alpha borders, so they became
  opaque black squares. Overlay materials now always keep
  `transparent=true`; only the base part material toggles.
- `test/assets.js` covers MD5, binary/hash resolution (padded and unpadded),
  Crossroads' real skybox hashes, embedded FileMesh geometry, data-URL
  consumers, and the face/T-shirt alpha regression.

### Chat visibility (build 46, 2026-10)
- The join line ("ROBLOX (2007 decomp port)  joined ...") was removed.
  The in-game controls hint remains.
- New chat messages now appear immediately. `#chatLog` has a
  `max-height:15vh` fold with `overflow:hidden`; appended lines landed
  below the visible area and only moved into view when enough spam
  removed earlier children. `UI.chat` now pins the log to the bottom
  (`scrollTop = scrollHeight`) after appending/trimming, so the newest
  line is always visible (the 9-line retention is unchanged).

### Skip rendering when unfocused/hidden (build 45, 2026-10)
- The render loop now has an explicit gate: it calls `renderer.render` only
  while `document.visibilityState==='visible'` and the window has focus
  (`document.hasFocus()`).  A blurred-but-visible window used to keep
  drawing the scene at 60 Hz behind another app; now GPU submission and
  drawing stop completely while the simulation keeps running (input is
  cleared on blur, so the player stands still).  A minimized/hidden tab
  already pauses RAF; the same gate covers it and the `visibilitychange`
  event.
- On entering the unfocused state the renderer's per-frame lists are
  disposed; they are rebuilt on the first focused frame.  On refocus the
  clock interval is dropped so the first frame does not run a catch-up
  burst.
- This complements the start-page idle gate: no GPU work at the menu and
  no GPU work behind another window.

### CPU: idle/quiescent work (build 44, 2026-10)
- **Shooting a rocket no longer stalls.** Two separate costs landed on the
  fire frame:
  - `Dynamics.attach` marked the whole world dirty for every spawned part,
    re-flooding every joint cluster on the next step (150-275 ms in
    Haunted, i.e. the shooting stall even before the rocket moved). It now
    only does that when the new part actually touches a neighbour; an
    isolated projectile in flight stays its own assembly.
  - `buildPart`/`destroyPart` marked the static batch dirty for every
    runtime part, so spawning (and removing) a projectile re-merged the
    whole world (2731 parts in Haunted: 30-50 ms per rebuild). Only parts
    that are actually batchable now mark the batch dirty; destroying a
    non-batched projectile leaves it untouched. A single `markStaticDirty`
    at the end of `build()` still produces the initial batch once dynamics
    can classify welded-immobile parts.
  - The 710 KB `Rocket whoosh 01.wav` data URL went through `fetch()`,
    which decoded the base64 on the shooting task (~80 ms in the profile).
    Embedded sounds now decode in a deferred task with a plain
    `atob`/byte loop before `decodeAudioData`; the first shot's step fell
    from 83-275 ms to ~1 ms, with only a short 3-10 ms decode task later.
- **Start-page loop is idle.** The 60 Hz step/render loop now returns
  immediately while `#login` is visible (it covers the viewport), only
  discarding elapsed time so joining does not run a catch-up burst.
- **Mouse rays are cached and spatially indexed.** `RBLXenv.updateMouse`
  signatures the mouse pixel, camera pose, collider count and a part-pose
  revision (`state.poseRev`, bumped by every `placePart`); an unchanged
  ray reuses the last `Mouse.Target/Hit`. When things move it runs at most
  once per rendered frame. `world.rayHit` and `raycastBoxes` now traverse
  the dynamics spatial hash (`Dynamics.rayCandidates`, 3D DDA) instead of
  testing every collider; non-colliding decorations are filtered so the
  result set is identical to the old collider scan.
- **Humanoid collision uses the same hash.** `Humanoid._near(k)` asks the
  dynamics grid for the colliders around the character (padded by one
  step of travel) instead of five/six full collider scans per step.
- **Dynamics early-outs and sleeping.** `_stepBodies` gathers the awake
  free bodies before building contact pairs and returns immediately when
  there are none. A displacement probe (`_still`, 0.12 studs / 0.08
  quaternion drift over 40 frames) sleeps grounded islands that the
  contact spring keeps jittering above the angular threshold; sleeping
  resets the probe, and existing support/tipping checks still apply.
- **Alloc churn.** The main step/render scratch vectors are reused, and
  `tickContacts` iterates the mover/touch sets directly instead of
  allocating an array every step.
- Headless profile (Haunted 2731 parts, idle after settling): whole step
  ~0.05 ms, down from ~12-18 ms with the solver and mouse ray running
  every step; RobloxHQ (8077 parts) ~0.07 ms, Crossroads ~0.9 ms (its
  moving beacon assemblies stay awake). Initial join settling is still
  the expensive part (~2-5 s of contact solving before the islands sleep).

### Tool grip from Tool.Grip (build 43, 2026-10)
- **Tool.Grip is a real property.** The decomp registers `"Grip"` as a
  CFrame (`FUN_005d1ca0` at `0x775140`, stored at Tool `+0x1ac`). The four
  `GripPos`/`GripRight`/`GripUp`/`GripForward` properties are views of it
  (translation, column 0, column 1, −column 2). `RBLXenv` now keeps the
  CFrame canonical, derives/syncs the four vectors, exposes all five to
  Lua, and honors `<CoordinateFrame name="Grip">` from XML. Tools that only
  stored the four vectors still work (the CFrame is derived).
- **The RightGrip weld was wrong.** `FUN_005d1450` builds
  `C0 = CFrame.new(0,-1,0) * CFrame.Angles(-π/2,0,0)` and
  `C1 = Tool.Grip`; the handle is at `RightArm.CFrame · C0 · Grip⁻¹`,
  i.e. in the hand at the end of the arm. The old port used the
  hand-tuned `C0 = CFrame.new(0,-1,0)` with no rotation, so every held
  tool/gear was oriented wrong (and bins were placed with further
  eyeballed offsets). The render handle and the Lua `RightGrip` weld now
  use the engine transform.
- **No per-gear placement.** HopperBins carry no grip data, so their hand
  models use the same frame with the identity Grip
  (`RightArm.CFrame · C0`). The gear meshes keep their authored origin and
  one shared `1/3` stud-per-unit scale; the old Y-height fit produced a
  9.4-stud clone wand and a 6-stud sideways rocket launcher. All
  per-BinType position/rotation constants are gone.
- **R6 shoulder joints were in the wrong place.** The engine's character
  joints (`FUN_005a4490`) use the classic C0/C1:
  `Right Shoulder C0 = (1, 0.5, 0)`, `C1 = (-0.5, 0.5, 0)` (mirrored for
  the left), so the arm pivots at the torso edge and the arm's centre is
  `(0.5,-0.5,0)` from it. The port pivoted at the arm's **top centre**
  `(1.5, 1, 0)`, which left a raised arm half a stud above and outboard
  of the torso (the "arm floats up/forward" look). The head now pivots at
  the neck (`(0,1,0)`) too. With the correct joint, a 90-degree raise is
  flush with the torso top and side; the hand is `(0.5,-1.5,0)` from the
  shoulder.
- Regressions: `test/luaenv.js` checks `Grip`/vector read-write sync, the
  XML `Grip` path, and the exact `C0`/`C1`/handle transform;
  `test/tools.js` checks the held frame and the shared mesh scale.

### Reset Avatar (build 42, 2026-10)
- Start page: a `#bodyReset` button ("Reset Avatar") sits in a new
  `.partTabsRow` next to the body-color part tabs. Its handler restores
  the start defaults (shipped rig: head/arms bc24, torso bc23, legs
  bc119; name Player1; no t-shirt), re-paints the tabs' chips, the
  swatch highlight and the t-shirt preview, and saves to
  localStorage so the Exit reload keeps the reset state.
- Side fix found by the harness: the load-time `renderShirt()` call in
  the tabs block ran before the T-shirt section's vars were
  initialized (hoisted `var` = undefined), so a persisted t-shirt never
  re-showed its preview on page open. `renderShirt()` now runs again
  after that section's elements are wired.
- `test/startpage.js` runs the widget against a minimal fake DOM: saved
  customization loads, limb/name edits persist, reset restores and
  persists defaults, chips/swatches/preview repaint, reload yields the
  defaults, and the username box stays live.

### Destroyed Sounds and Haunted Mansion (build 41, 2026-10)
- **Explosion decomp check.** `RBX::Explosion`'s ctor/detonation code
  (`FUN_00603df0`, `FUN_00604250`) has no audio call. `collide.wav` is
  SoundType 2 in the SoundService table (`FUN_00586d90`). The standard
  Rocket.rbxm and Haunted Rocket both carry a child `Sound` named
  `Explosion`, `SoundId=rbxasset://sounds/collide.wav`,
  `PlayOnRemove=true`; the rocket script stops its Swoosh, creates the
  Explosion, waits 0.1 s, then removes the shaft. Generic script-created
  Explosions without such a child remain silent, matching the decomp.
- **Parent destruction now tears down Sound children.** `detachFromWorld`
  had Part/Script/Message/Explosion branches but no Sound branch, so the
  child PlayOnRemove boom never played and a looping Swoosh could outlive
  its part. Sound children are now stopped, then PlayOnRemove ones are
  played when the root is actually destroyed (not when gear returns to a
  Backpack).
- **Async stop race.** `Sound:play` loads/decodes asynchronously. Stopping or
  removing during that window used to let the decode start a loop later.
  Each play gets a sequence token; `soundStop`/destruction bump it and a
  stale decode is discarded.
- **Haunted Mansion.** `extra/Places/Haunted.rbxl` is embedded as
  `web/places/Haunted.rbxl.js` under the display key "Haunted Mansion".
  `PLACE_FILES` maps that label to the embedded `Haunted` file and the
  registry array shows it on the start page. `test/places.js` parses and
  builds it (2735 parts, 2701 colliders).
- **Rocket shot.wav.** The shipped Haunted PumpkinBomb script creates and
  plays `Rocket shot.wav` in its `blowUp`; the rocket launcher does not use
  it. The rocket impact remains the child `collide.wav` one-shot.
- `test/sounds.js` verifies PlayOnRemove, loop stop, the decode race, and
  the real Rocket.rbxm sequence (whoosh starts, stops on impact, collide
  plays once).

---

## 11. Known non-exact bits (APPROX list, summary)

1. Gravity 196.2 / WalkSpeed 16 / JumpPower 50 / friction 0.3  canon 2007,
   not decomp literals.
2. Head geometry is exact (decomp emulation in `web/js/headmesh.js`).
   The only approximation is the face decal: it is a flat plane sized
   1.12× the head bbox and offset in front of the mesh, rather than the
   engine's projection onto the curved surface. head.mesh is a detailed
   leftover with nose/ear geometry, not the classic generated head, and is
   not used.
3. Torso "roblox" logo decal placement approximated to the chest plane.
4. Explosion radius 4 / pressure 500000 defaults (place scripts did not
   override them).
5. Team-beacon scripts launch from Source via the interpreter and their
   BodyVelocity/BodyPosition movers are live (the character can ride a
   rising beacon). Team membership itself still has no TeamService to
   join in single-player; the shipped `Team` Color3Value tag and
   team-color paint execute, but enemy/ally branching is effectively
   single-team.
6. Character turn-to-walk rate (8/s, decomp idle yaw servo ×8.0) and the
   kinematic step-up assist (`stepHeight` 2.3)  the decomp Running state
   scales blocked velocity by 0.7 instead of stepping; the assist keeps
   classic 2-stud borders walkable.
   Walk yaw target = atan2(-vx,-vz): the rig front is local -Z (Face=5
   decal planes sit there) and the camera move-basis confirms it.
7. Sound trigger hysteresis (0.08s ground before footsteps engage /
   0.12s airtime + vy<-7 before the freefall swoosh fires once)  event
   semantics exact per the shipped script (all one-shot edges except the
   looped footsteps); thresholds chosen to stop slope/stair pose-flap
   machine-gunning. Regression-tested in test/harvester.js: die while
   freefalling → exactly one swoosh pre-death, zero sounds after.
8. Chat name-color cycle order  palette values are exact; rotation order
   picked from the getter family order.
9. Spawn RNG sequence: selection/fallback now match the decomp exactly
   (random SpawnLocation at CFrame+7, else `(0, 100, 0)`  see §5), but
   the port uses `Math.random()` rather than the engine's C `rand()`, so
   the shuffle order differs while the distribution is the same.
10. Binary .rbxl places are rejected with a notice  the 2007 client era
    predates the modern binary format used by today's saves.
11. HopperBin hand models use the engine's held-tool frame (C0 plus the
    identity Grip, since bins carry no grip data) and the shipped
    meshes/textures. The shared 1/3-stud-per-mesh-unit conversion is a
    presentation choice (the .mesh format carries no unit metadata);
    generic `Tool` handles use the actual `Tool.Grip` transform instead
    (section 9). Bundled HopperBins have no `Handle`/Grip data, so their
    `RightGrip` is created with `Part1=nil` (Animate still sees a held
    item) while custom bins draw their own models.
12. Menu-strip labels beyond the mined strings (Player List, Exit,
    Fullscreen: Toolbox / Edit Mode / Help) are taken from the client's
    shipped toolbars; Toolbox/Edit Mode are shown inert (studio-only).
13. Cylinder cross-section is built elliptical from size.y/z when they
    differ (CylinderAlongXMesh keys on the full extent); ball parts are
    per-extent ellipsoids the same way  places with mismatched extents
    will show the honest classic squashed fit.
14. Celestial sizes/placement: sun disc, rays halo, moon and flare
    billboard sizes, plus rise/fade ramps, are presentation-approx (the
    exe's flare compositing is screen-space and unminable); positions/loop
    follow the classic 24 h sweep (section 6).
15. Surface face art: only Studs(3)/Inlet(4) are drawn on part faces;
    Weld(2)/Glue(1) are joint types and render the solid brick colour
    (the atlas X/blob is the Surface Tool icon, not a face material).
    One 64×64 tile covers a 2×2-stud patch, so repeat = size/2 with
    offset (0,0); ParamA/B are not a phase (FUN_004d3bd0/FUN_004e06f0
    derive UVs from face size + surface token and never read them).
    Two approximations remain: (a) the engine compresses the last
    0.25 stud of each face's UV span so the tile's edge ring meets the
    face edge; this port uses the tile's shipped edge ring without the
    extra compression; (b) the 128-grey detail map is normalized to
    white at load, which clips the stud highlight at white  the exact
    OpenGL texture-combine mode/scale was not recovered.
16. Hinge/Motor/SteppingMotor faces draw an approximated yellow peg
    (proportions from HingeTool.png; the decomp's surface-pass draw
    constants were not recovered). Sphere/cylinder/SpecialMesh parts
    still keep their base material for atlas art; only block (shape 1)
    faces take the surface atlas, because the strip's mapping for the
    curved meshes was not mined.
17. SpecialMesh FileMesh (type 5) height-fit rule (part height × Scale)
    matches the head convention; the classic per-file normalization was
    not mined. Only embedded fonts/*.mesh (gear tools) resolve  other
    files fall back to a block with a console note.
18. Assembly physics scalars: CONTACT auto-weld slop 0.05, sleep
    threshold SLEEP 0.4, Weld overlap range 1.2 studs (Glue 0.05), explosion
    impulse scaling BLAST_DIV 20000 with Δv cap BLAST_CAP 80, servo
    force clamp model (section 10). The 2007 integrator is inlined in
    the exe; these are engineering-plausible values that reproduce the
    mined end-states (beacon sink −2/s, X/Z homing, rides flush).
19. Surface-joint coverage: Weld(2)/Snap(3+4)/Glue(1) + Hinge(6)/Motor(7)/
    SteppingMotor(8) detection delivered per the mined factories; glue's
    4-corner P2P+break topology is carried as a rigid edge for now (no
    joint breaking by force in this build's port).
    Hinge(6) faces swing on a gravity pin. Motor(7)/SteppingMotor(8) faces
    drive that pin at `ParamB * 60` rad/s when `SurfaceInput` is non-zero
    (the documented RotateV/RotateP Constant input; NoInput leaves the pin
    free). Authored JointInstances are covered too: Weld/Snap/Glue are
    rigid, Motor is a DesiredAngle/MaxVelocity servo, RotateP/RotateV read
    Part0's surface input. Approximations: a pin's parent must be static to
    swing (two free bodies merge rigidly, the same policy as surface
    hinges), motor motion is kinematic with no contact torque, and the
    Constant rate is converted at the 60 Hz physics frame the docs use.
    Weld uses an overlap range of 1.2 studs (needed by the shipped
    TeamBeacon studs) instead of the decomp's 0.01 plane gate; Glue and Snap
    stay flush at 0.05. Rotation alignment is the decomp's FACE-AXIS gate
    (anti-parallel within 0.35 rad, FUN_005eb0a0)  whole-body rotation
    equality was wrong and blocked every 90°-rotated weld. The decomp's
    face-center check is now ported as a ≥25% face-rectangle overlap-area
    gate (the tB literal was not mined  value chosen so aligned stacks and
    the beacons' fully-overlapped pips bond while 1-stud corner kisses,
    like HHH's crane-on-platform, do not; see §12).
20. Ladder climbing is a deliberate departure from the 2007 ray quirk: the
    engine only re-boosted `vy` while its downward 0.8·size ground-ahead
    ray hit (so rung gaps under ~1.2 studs chained and nothing could be
    held/reversed). This port attaches to a whole ladder/truss volume and
    keeps the mined `0.7 × WalkSpeed` rate; the attach distance (1.05
    studs), face hug (0.55), 8 studs/s push-off and the top step-out are
    engineering choices, not decomp literals. Climbable geometry is the
    `TrussPart` class or any part/ancestor named `/ladder/i`; no truss art
    ships in 0.3.368, so a TrussPart renders as a plain part. See §12.
21. Contact force-solver calibration: the law structure is mined
    (`0x611e00` normal/friction update, `0x612260` relative velocity,
    `0x5c78f0` force+torque application, `0x5f7ee0` body integration,
    `0x5c7dd0` 19×`1/4560 s` substeps, `0x5ed340` Elasticity mapping).
    Not literal: the contact stiffness scale (`7500 · min mass`), the
    OBB contact-manifold generator (the exe dispatches GeoPair primitives
    through `0x611ae0`; engine primitives are not exposed as OBB pairs),
    the clipped-edge fallback (stable endpoint-ordinal feature keys; stale
    spring state pruned once per tick), per-point depth clamp, and the
    island-sleep thresholds (`|v| 0.4`, `|ω| 0.15`, 6 quiet frames,
    0.02-stud support tolerance, wake approach speed 1.0). Mover-driven
    assemblies deliberately stay translation-only
    and hinged assemblies kinematic; the client integrates their bodies
    too, but the shipped scripts were tuned against the simpler paths.
    See §12.
22. Explosion humanoid damage `100 · (1 − d/BlastRadius)` is a gameplay
    model, not a decomp literal (the blast path only writes body
    velocity). The radius used is `BlastRadius` and the Health ceiling is
    the era's 100; joint removal itself is exact per `FUN_005ad770`, and
    the `noJoin` suppression window follows the engine's new-contact
    AutoJoin rule. See §4 and §12.
23. Character-welded movers: the engine's humanoid rig is made of real
    Parts, so `makeJoints` welds a touched model directly into the body
    assembly. This port renders the rig separately and carries the
    equivalent behaviour at the assembly boundary: live rig OBBs are
    exposed to `makeJoints`, a contacting assembly gets `charAttach`, its
    members are held at their torso-local welded pose, and its
    `BodyVelocity` supplies the humanoid's velocity (with the gravity tick
    pre-compensated). This models the held body kinematically rather than
    through the free-body solver; the visible placement and mover response
    match the shipped script. The boolean `Jumping` edge source (jump
    input/landing) is reconstructed from the shipped JetPack/humanoidSound
    scripts; the decomp event registration itself carries no argument
    names. See §12.
