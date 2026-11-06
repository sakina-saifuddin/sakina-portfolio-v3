# Progress

## Last verified working version

**`144419e`** — Cycles-baked room live at https://sakinav3.netlify.app/.
Verified 2026-10-31 on the published site (laptop built-in browser): loads with no errors; T / I / N / Esc open
the tape, IBM PC and notepad panels and return home; city visible through the window.
Known pre-existing bug: 6 of 13 tapes open the project of the tape above them (measured with
`pipeline/tests/tape_click_test.py`).

## Log

- 2026-10-31 — Fixed "FAILED TO LOAD SCENE" (mesh-name mismatch), Three.js r160, stale-JS caching,
  shipped V2's baked room (Draco 37.7 → 7.6 MB), city visible (far plane).
- 2026-10-31 — Project docs created; V2 bake pipeline copied into `pipeline/bake/` and parity-tested on CPU.
- 2026-10-31 — **Edit #1 in progress** (tapes shorter + slanted stacks, smaller VCR):
  edit script `pipeline/edits/e01_tapes_vcr.py`; Cycles before/after previews rendered for approval.
  Next after approval: re-bake Tapes, Monitor, Desk groups; per-tape click boxes; publish to `/preview/`.
- 2026-11-01 — **Edit #2 in progress** (club chair on the right wall): `pipeline/edits/e02_club_chair.py`;
  Cycles before/after previews rendered for approval (`chair` and `chair_wide` views in `render_preview.py`).
  Nothing re-baked, nothing published; live site unchanged (`144419e`).
  Next after approval: decide the leather-detail approach (see DECISIONS.md), re-bake Right_Nook only, publish to `/preview/`.
- 2026-11-01 — Edit #2 revised: leather rebuilt from the reference photo's pixels (crackle + croc sheets), arms rounder,
  back cushion and seat more pillowy. New Cycles previews rendered for approval; still nothing re-baked or published.
- 2026-11-01 — **Edit #3 in progress** (antique bookcase + nook re-arrangement, branch `edit3-bookcase`):
  `pipeline/edits/e03_antique_bookcase.py`; Cycles previews (`nook`, `bookcase` views) rendered for approval.
  Nothing re-baked or published; live site unchanged (`144419e`). Web caveat: the glass doors need a decision before the
  Right_Nook re-bake (transmissive glass does not bake; plan: bake with the doors transparent and add a faint reflective
  pane in Three.js).
- 2026-11-01 — Sakina approved the chair / bookcase / side table / lamp / carton positions (see DECISIONS.md). No bake, no GLB,
  no /preview/ publish, main unchanged. When merging `edit3-bookcase` (which contains e02 + e03), treat the merge as source
  only; the live site stays on `144419e` until a bake is separately requested.
- 2026-11-01 — Edit #4 (radiator under the desk) built and previewed (`under_desk`, `radiator_close` views). Not baked, not published.
- 2026-11-01 — Edit #5 (under-desk wires removed) built and previewed. Not baked, not published.
- 2026-10-31 — **Round 2** (branch `round2`): hero opening camera, orbit-around-the-CRT camera (drag only, limited
  zoom, kept inside the room), golden pothos, tape stacks closer, IBM PC/AT rebuilt in the corner, night sky.
  Published to `/preview/` (57bdb1d); live check of the orbit camera still pending (laptop browser needed).
- 2026-10-31 — **Round 3** (branch `round3`): edits e04–e07 (left wall 0.7 m in, wooden dresser, aged computer,
  realistic postcards + clock; CRT bezel/funnel/housing + VCR; right nook lounge chair, painted side table, linen
  floor lamp, wall picture; warm practical lighting with shadow-linked lamp leak). Cycles previews sent.
  Full re-bake at 64 spp + OIDN (albedo-guided) — parity test: brightness ratio 0.998 vs 192 spp.

- 2026-11-01 — **Round 5 / integration/v3-final** (all approved branches merged: retro PC, club chair, bookcase, radiator, wire removal, round3 floor/plant/tapes/CRT,
  room-refresh lamp+remote+calculator, e14 window, clocks + centred degree + wall colour). New edits on top: e17 (wider window 1.60 m centred on the CRT, linen
  curtains with 4 cm hem over the desk, desk slid to the wall and shortened to 2.52 m, pillar + blue poster removed, cable over the VCR removed), e18 (CRT black,
  neutral screen light), e19 (pebbles + mud in the pot), e20 (gallery centred on the cabinet, standing lamp moved off the armchair). Fixed: CRT/screen text objects
  (type FONT) were left behind by the desk move.
- 2026-11-01 — **LOW-RES PREVIEW BAKE deployed to main** (Sakina asked to see the site from all angles before the final GPU bake). CPU bake in the cloud:
  `SPP=32 DENOISE=1 RES_SCALE=0.25` (about 18 min). Files: `web/sakina-room-r4lo.glb` (4 MB), `web/sakina-view-r4lo.glb` (Berlin photo window view, new
  `pipeline/bake/export_view.py`), `web/sakina-outside-r4lo.glb`. `web/main.js` follows the 0.48 m desk move (HOME camera, CRT glass overlay, notepad hotspot);
  `web/tapes.json` regenerated. Tested locally (three@0.160.0 from npm, swiftshader): 11/11 tapes open the right project, no console errors, orbit/IBM/notepad/tapes
  views screenshotted (`previews/final/site_*.png`, `pipeline/tests/site_tour.py`). NOT verified on the real Netlify URL (cloud cannot reach it).
  ROLLBACK: `main` before this push was `57bdb1d`; `git revert` the fast-forward range or reset the site to that commit.
  Low-res lightmaps look blotchy on curtains/wood; the final bake (SPP 192, full res, GPU laptop) replaces these files under new names.

- 2026-11-01 — **Round 5b (Sakina's phone feedback on the live low-res site)**: (1) from a high camera the lower window panes were black. Cause: the Berlin photo patch only covers
  about 44 deg x 29 deg; below it the extension panorama faded to flat dark ground. `components/window_view/panorama.py` now continues the rail yard in ground space
  (rays below the photo hit the yard nearer: sideways positions kept, so rails fan out toward the viewer), adds ballast grain, sleepers, rails and sodium/white lamps,
  4096x2048. New file `web/sakina-view-r5.glb` (swapped with `pipeline/tools/swap_pano.mjs`). (2) The dark round disc beside the coffee cup was `Mug_Stain_B`: removed in
  `e20_polish.py` for the final bake; for the live preview its triangles were cut from the desk group (`pipeline/tools/cut_disc.mjs`; note the Room_Desk node has an 8 deg
  rotation, so cuts must apply the node transform) -> `web/sakina-room-r5.glb`. `main.js?v=9`. Verified locally only (phone viewport 430x930); not yet on the real Netlify URL.

- 2026-11-01 — **Round 5c: window photo zoom (candidate at /preview/, main page NOT changed)**. Sakina rejected the invented rail-yard extension ("blurred, looks like a hallucination") and asked
  to just zoom the photo instead of limiting the camera angle. The synthetic extension (r5 view GLB, panorama.py changes) is reverted: main again loads `sakina-view-r4lo.glb`
  (original photo + original pano). `pipeline/tools/zoom_view_photo.mjs` enlarges the photo patch 3.7x in angle space about the horizon / vanishing point -> `web/sakina-view-r6.glb`;
  the photo then reaches about 43 deg below eye level (was 9), so a steep camera still sees real rails/yard from the photo. Trade-off: the home view shows a tighter crop of the skyline
  (TV tower and the Arena no longer both fit). `/preview/` serves it (copy of the site with `../` asset paths). Main keeps the disc-removed room (`sakina-room-r5.glb`).
- 2026-11-01 — Round 5d: /preview/ photo zoom raised 3.7x -> 5.2x (`web/sakina-view-r7.glb`; r6 removed) because the bottom of the lowest panes still showed the dark extension. Photo now reaches about 64 deg below eye level. Main page untouched.
- 2026-11-01 — **Friend bake kit built** (`pipeline/friend_bake/`, zip made by `make_kit.sh`): packed `v3-integrated.blend` (all 21 edits incl. new e21 photo zoom 5.2x), `run_bake.py` + `run_bake.bat`, README for a non-technical user.
  `bake_lightmaps.py` gained `DEVICE` (OPTIX/CUDA/HIP/CPU, clear error if no GPU) and `PACK` (lightmaps embedded in the returned .blend). Final settings: SPP 256, full group resolutions (Room/Desk/... 4096), no OIDN.
  Tested in the cloud: GPU-missing error path, and a CPU end-to-end test run (one group) that saved a .blend with the lightmap embedded. NOT tested on a real GPU yet: the `test` run on the friend's PC is the first GPU check.
  NEXT after the file comes back: lightmaps -> `fix_baked21.py` -> `export_web.py` -> Draco -> new GLB filenames -> /preview/ -> approval -> main.
- 2026-11-01 — Round 5e: /preview/ photo zoom now 3.7x anchored on the METRO sign column (photo px 1680) instead of the vanishing point (`web/sakina-view-r8.glb`; r7 removed), so METRO stays readable in the right window pane and steep views still sit inside the photo (~43 deg below eye level).
  e21 + zoom_view_photo.mjs updated to the same anchor. The bake kit zip already sent still contains the old 5.2x e21: harmless (WindowView is not a bake group; its zoom is re-applied at export time, undo 5.2x about the old vanishing point or rebuild from r4lo).
- 2026-11-01 — Round 5f (Sakina's reference: felixrieseberg.com, wide outside view with tracks visible): /preview/ photo zoom lowered to 1.3x (METRO-anchored; `web/sakina-view-r9.glb`, r8 removed) AND the orbit tilt is now limited to where the photo ends
  (`web/preview/look-controls.js`, `_photoPolarMin`: steepest allowed polar 72.5 deg straight on, 78 deg at 60 deg sideways, computed in the cloud for dolly 0.8-1.2). Result: skyline + TV tower + METRO + rails visible at once; at the steepest tilt the window still shows only real photo. e21 default zoom set to 1.3.
  Main page still untouched. Home camera polar is 81.8 deg, so the allowed look-up range is ~9 deg (it was 47 deg before): tell Sakina this is the price of "no blank".
- 2026-11-01 — Round 5g (Sakina: blurry patches left/right outside the window, wants tilt over the CRT back, tracks visible): zoom 1.3x only covered +-10 deg of sideways swing, so side swings ran off the photo (blurred pano). Computed (S, anchor) vs window-ray yaw/elevation coverage for dolly 0.8-1.2:
  zoom 3.2x anchored at photo px 1700 (`web/sakina-view-r10.glb`) -> photo covers yaw -89..+52 deg, 34 deg below eye level; METRO fits a phone-width view. `/preview/` orbit limits now az -40..+70 deg (was -62..+70) and tilt >= 47 + 16 (az/70)^2 deg polar (home 81.8 deg: ~35 deg look-up range, was 9). e21 defaults 3.2 / 1700.
  Main page still the original window. Rule of thumb: bigger zoom = more orbit freedom but a tighter crop of the skyline; the final choice is Sakina's.

- 2026-11-06 — **newversion: performance (lag) fix #1.** The two lamp point lights cast cube shadow maps (2 lights x 6 faces x 1536 px over the
  ~875k-triangle room) and three.js redrew them on every frame. `web/main-pad.js` now sets `renderer.shadowMap.autoUpdate=false` and redraws them only when a
  shadow caster moves or changes (tape, phone handset, pencil, geometry/visibility), plus the first 90 frames. No resolution, texture or shadow-quality change.
  `main-pad.js?v=108`. Checked locally with reduced motion (frozen animation): walls, floor and room pixel-identical to before; only the steam wisp differs
  (animated). The cloud has no GPU (software rendering, about 0.3 fps both ways), so the real fps gain is NOT measured yet: needs the laptop browser on the
  `newversion` preview. Not merged to main.

- 2026-11-06 — **newversion: notebook keeps its writing.** `web/notebook.js` no longer wipes the page when the camera leaves the notebook (the old `reset()`
  repainted page 1 and restarted the script on every visit). A finished page stays as written (pencil just rests on it), page 2 stays open, and an
  unfinished page carries on from where the pencil stopped; a page turn in progress is completed instantly when leaving. State lives in memory only, so a
  reload starts fresh. `notebook.js?v=7`, `main-pad.js?v=109`. Tested locally (reduced motion): written TODO page identical before leaving and after returning.
  Not tested: leaving mid-stroke (software rendering is too slow to catch a half-written page), page-2 round trip.

- 2026-11-06 — **newversion: CRT intro timing + ghost screen.** (1) After the gate opens, the name screen (SAKINA SAIFUDDIN) now stays 10 s (counted from
  when the gate has faded, so 11 s after the click) before the intro film ("At the edge of the dataset") starts; the name->"INSERT TAPE" fallback moved from 6 s to
  12 s; `videos/intro.mp4` is fetched during the hold so it starts straight away. (2) Ghost screen: the video layer (`vidMat`) was semi-transparent whenever
  `uK+uNs < 1` (film fading out, static burst, buffering dip right after `currentTime=0`) while the name / INSERT TAPE canvas and the OSD were switched on beneath it
  (`k<0.97`). Now the layer is opaque as soon as it is visible (`smoothstep(0,.08)`), the screen canvas / OSD only show when the layer is gone, and a buffering
  dip shorter than 0.4 s no longer fades the picture. `main-pad.js?v=110`. Verified in the cloud: the 11 s timer is registered and the intro file is requested
  right after Enter; no console errors. NOT verified by eye (software rendering too slow to watch a transition): needs a look on the laptop.

- 2026-11-06 — **newversion: name screen shortened to 6 s** (was 10 s): `NAME_HOLD=6000` in `web/main-pad.js` (intro film starts 7 s after the click: 6 s after the gate has faded);
  the name->"INSERT TAPE" fallback is now 8 s. `main-pad.js?v=111`.

- 2026-11-06 — **newversion: removed the CRT "LOADING" screen shown between "click to enter" and the name screen.** It was the `crtScreen` canvas in `loading` mode
  (">> LOADING", "CH 00", bar at 100%) showing through the entry gate during its 1 s fade-out; the name screen only took over once the gate element was removed.
  `crtScreen` now switches to `name` on the `crt-enter` event. `main-pad.js?v=112`. Checked: no console errors; the transition itself is NOT verified by eye
  (software rendering too slow); needs a look on the laptop.

- 2026-11-06 — **newversion: softer phone ring.** `web/phone.js`: ring tone changed from a square wave (gain 0.018) to a sine (gain 0.0065, soft attack/release),
  and only the first 3 rings are audible (`RING_MAX`); the handset shake and the blinking red lamp continue until answered. `phone.js?v=7`, `main-pad.js?v=113`.
  Not listened to (no audio in the cloud): needs a check on the laptop; adjust `RING_GAIN` / `RING_MAX`.

- 2026-11-06 — **newversion: "INCOMING CALL" chip.** A small pulsing pill (red dot, amber border glow; "CLICK TO ANSWER" on wider screens) at the top-left under the name,
  shown while the phone is ringing (`phone.mode==="ringing"` and the entry gate is gone); click = `go("phone")` (answers). Hides when answered. `index.html` (`#call-hint`),
  `style.css` (`.call-hint`, reduced-motion = no pulse), `main-pad.js` (`syncCall`), `main-pad.js?v=114`. Tested locally: chip appears after entering, click makes it hide, no console errors.

- 2026-11-06 — **newversion: phone "INCOMING" speech bubble (replaces the top-left chip).** A rectangular bubble with a tail and a blinking red dot sits on top of the phone
  (placed each frame from the 3D phone position, `syncCall` in `main-pad.js`; kept on screen and pointing toward the phone when it is past the edge, which it is in the
  home view). While the phone rings: bubble + handset shake + blinking red lamp + soft ring, all until answered. As soon as it is answered (`mode!=="ringing"`) all four stop;
  the lamp no longer stays half-lit during the call (`phone.js`). The 3-ring cap was removed: the soft ring repeats until answered. Click on the bubble answers.
  `main-pad.js?v=116`, `phone.js?v=8`. Tested locally: bubble visible after entering, click hides it, no console errors; ring sound and shake not heard/seen in the cloud.

- 2026-11-06 — **newversion: phone bubble rebuilt as a white 3D bubble.** Replaces the DOM bubble. `callBubble` in `web/main-pad.js`: two `THREE.Sprite`s (white bubble with "INCOMING" and a long
  pointer whose tip sits on top of the phone; red receiver icon that shakes in time with the handset), positioned from `phone.frame` every frame, so it stays fixed in the room when the
  camera moves (billboards toward the camera, drawn on top, no bloom). The phone is at the very edge of the home view, hence the long pointer so the bubble body stays on screen.
  Visible only while `phone.mode==="ringing"`; click on it answers the phone (added to `pick` targets only while visible). `main-pad.js?v=119`. Tested locally: bubble visible after Enter,
  click flies to the phone, lifts the handset and the bubble disappears; no console errors. Shake animation and ring sound not seen/heard in the cloud.

- 2026-11-06 — **newversion: window view uses the enlarged photo (`sakina-view-r10.glb`), runtime zoom off.** Sakina's phone screenshot of the live site showed black lower panes and smeared
  (low-res panorama) patches outside the window. `main-pad.js` now loads `sakina-view-r10.glb` (the Berlin photo patch enlarged 3.2x in angle space about the vanishing point, anchor px 1700, built earlier by
  `pipeline/tools/zoom_view_photo.mjs`) and `VIEW_ZOOM` defaults to 1 (was 2.3 scaled at runtime on the small patch; `?vz=` still overrides). Compared at phone size (430x932, window view, drag left / right / steep down):
  before = smeared panorama, after = real photo (skyline, METRO, TV tower, rails) everywhere. Trade-off: the photo is magnified more (source is 2576x1718), so fine detail is limited by that file.
  Not changed: baked wood of the window sill looks soft (room bake resolution). `main-pad.js?v=120`.

## 2026-11-06 — Mug sip (branch `newversion`, main-pad.js?v=123, sfx.js?v=6)
- Click the mug on the desk: soft sip sound (synth, `sfx.sip`), coffee level drops, steam weakens. Six sips to empty; empty click gives a dry sound and a message. Reload refills.
- Coffee surface (~1600 flat triangles) is cut from `Room_Desk` at runtime and drawn as its own disc that sinks and narrows with the cup. Hover hint: "CLICK TO TAKE A SIP OF COFFEE". Invisible `MugHit` cylinder is picked before the notepad fallback.
- Verified (local software-render Playwright): coffee disc found, 6 sips move the level 0.8081 → 0.7405, no console errors, crops show the level dropping.
- NOT verified: sip sound (no audio in cloud), tween smoothness, real hover/click on a phone, whether the coffee colour darkening looks right (it looked darker than the original after the first sips).

## 2026-11-06 — Louder sip (main-pad.js?v=124, sfx.js?v=7)
- Sip sound rebuilt much louder (long wet slurp, bubbles, big gulp). While it plays, the CRT video volume ducks to 12% for 1.9 s so the sip is clearly heard, then returns to the previous level.
- Verified: syntax, page loads, sips still run, no console errors. NOT verified: actual loudness (no audio in cloud).

## 2026-11-06 — Real slurp recording for the mug (main-pad.js?v=125, sfx.js?v=8)
- Sakina's file (freesound_community, "slurping", 19.6 s) cut into three normalized clips: `web/sfx/sip1.mp3` (1.7 s), `sip2.mp3` (2.4 s), `sip3.mp3` (1.5 s). Each click plays a different clip (random, never the same twice in a row) at slightly varied speed, gain 2.2. CRT video is lowered for exactly the clip length + 0.3 s.
- The synthesized sip stays as a fallback if the clips are not loaded yet. Empty-mug sound unchanged (synth).
- Verified: all three clips served 200, decode in Chromium, sip returns the clip duration, no console errors. NOT verified: how it sounds/loudness (no audio in cloud).
- Credit: Freesound community "slurping" (check the licence on the Freesound page before going to main; credit may be required).
- 2026-11-06 — **newversion: the IBM computer screen now works like the reference (Felix's site): the visitor types.** Before, the screen printed ABOUT by itself after boot and
  scrolled on and on; only a few words could be typed. Now (`web/ibm-terminal.js`, `web/ibm-content.js`, new `web/basic.js`): boot text "Personal Computer BASIC Version 1.10 /
  Hi! Type ABOUT to start, or HELP." then READY and a blinking cursor, and **nothing runs until the visitor types**. 40 x 25 text screen (wide VT323, bright command names), function-key
  row `1ABOUT 2ONLINE 3HELP 4FILES 5RUN` (F1-F5 or click: the computer types the word and presses Enter). HELP copied from the reference screenshot, with her own commands (WORK, PROJECTS,
  HACKS, ROLES, EMAIL, LINKEDIN, GITHUB, ASK, SYSTEM). ABOUT/ROLES/WORK/PROJECTS/HACKS text unchanged, typed out a page at a time ("-- PRESS ENTER FOR MORE --"; Up/PageUp scroll back).
  ONLINE (also the CONTACT menu button) = a "SAKINA BBS" links screen like his Night Owl BBS (big block banner, keys 1-4 or click to open, Q hangs up). Real BASIC: type `PRINT 2+2`, or
  number a line and RUN; PRINT INPUT LET IF/THEN/ELSE GOTO GOSUB FOR NEXT WHILE DATA READ DIM, LIST NEW EDIT DELETE SAVE TRON/TROFF, Ctrl+C stops. FILES lists HELLO, SQUARES, GUESS, SKILLS
  (`RUN "HELLO"`). Letters typed while text is still printing wait (type-ahead). Screen memory is kept when she leaves and returns; a power cycle reboots it.
  Controls: "C Computer" is now **"C Use computer"** in both the top key row and the "?" sticky note (`index.html`). Computer camera moved closer (0.94 m -> 0.52 m, `VIEWS.ibm` in `main-pad.js`) so the 40-column text is readable. Ctrl+C is let through to the
  screen while it is active (`main-pad.js` key handler). `main-pad.js?v=126`, `ibm-terminal.js?v=7`.
  Tested: `pipeline/tests/basic_test.mjs` (interpreter, 14 checks pass); canvas rendered headless with VT323 and driven by keystrokes (boot, HELP, program run, INPUT, Ctrl+C break, FILES/SAVE,
  F-keys, ONLINE open-link, type-ahead); real page loaded with local three@0.160 (no console errors; C opens the view, typing `help` shows HELP, Esc returns). NOT verified on the real Netlify URL.
  Not done: the reference's SNAKE / BLOCKS / ZOMBIE games, DEMO screensaver, OPTIONS, DEBUG fly-around, RENUM/AUTO/CONT; no on-screen keyboard for phones yet (taps on the F-key row still work).

## 2026-11-06 — Clickable lamps (branch `newversion`, main-pad.js?v=125, sfx.js?v=7)
- Click the desk lamp or the standing lamp to switch it off; click again to switch it on. Hover hint: "CLICK TO TURN THE DESK LAMP OFF/ON" (STANDING LAMP for the floor lamp); a short message and a soft switch click (`sfx.lamp`) confirm it. Fades over ~0.4 s (instant with reduced motion).
- The room light is baked, so it is dimmed in the shader (`lampDim` in main-pad.js): every baked material multiplies its final colour by a factor from the pixel's distance to each lamp and that lamp's state. Some baked light is kept everywhere (floor 0.14; window 0.42, monitor group 0.28), so the room goes dark but stays readable. The CRT picture, window view and other live overlays are not dimmed. Wall/floor shadows fade with the lamps.
- Both lamps on = factor exactly 1: verified pixel-identical (max diff 0) to the previous frame after a full off/on cycle.
- Click areas are invisible boxes/cylinders (`LampHit_*`, `setupLamps`): desk lamp box at (-0.45,0.95,-2.29); standing lamp shade, pole and foot at x 2.21, z -0.96. The standing lamp is only on screen in the chair view (key R); its shade is partly above the frame there, the pole is the easy target.
- Verified (local software-render Playwright, reduced motion): hover hint, desk-lamp click, standing-lamp click from the chair view, one-off and both-off screenshots, restore; no console errors. One lamp off darkens nearby surfaces about 30% (tapes 0.67, desk 0.70, CRT 0.99).
- NOT verified: the 0.4 s fade (reduced motion snaps), switch sound (no audio in cloud), touch taps on a phone, real-GPU look and frame rate. `web/mobile.html`/`mobile.js` is a separate page and was not changed.
