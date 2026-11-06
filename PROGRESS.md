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
- 2026-11-06 — **newversion: sharper computer screen, bigger photo, and the missing reference features** (`main-pad.js?v=127`, `ibm-terminal.js?v=8`, new `web/ibm-games.js`).
  Sharpness: terminal canvas is now 1280x960 (was 800x600) with a sharp-by-default shader (no blur, no scanline aliasing); film grain is faded to 0 and bloom lowered (0.42 -> 0.08) while she is using the computer. OPTIONS has a "Screen" toggle that switches the old soft CRT look back on.
  Photo above the monitor: photo 100 mm wide (was 71.6 mm), white card is exactly 3 mm bigger on every side (even thin border); bottom edge and position kept.
  New on the computer: SNAKE, BLOCKS, ZOMBIE games (arrows/WASD, P pause, Q quit, high scores kept in localStorage), DEMO screensaver (also starts by itself after 2 min of no typing; any key stops it), OPTIONS menu (Lo-fi site, Ask me, Screen sharp/retro, Sound on/off), DEBUG = fly around the room (WASD move, Q/E down/up, drag to look, Shift fast, Esc lands; Back button shown). HELP lists them all.
  Tested (headless Chromium, local three@0.160): each game started, took input and quit with Q; OPTIONS keys 1/3/4 fired their hooks; DEBUG fired the fly hook; DEMO started after the idle time and stopped on a key; no console errors. Real page run: see below.
  NOT verified: the real Netlify URL, real-GPU sharpness (cloud has only software rendering), on-screen keyboard for phones (still none).
- 2026-11-06 — **Controls + sticky-note guide (newversion).** Key row (T C N Z B H and ? Keys) is at the bottom right (hidden in the notebook view and on phones). The pad of sticky notes that was already on the desk behind the cup (`Note_Stack`, 17.7 x 12.2 cm, part of the baked `Room_Desk` mesh) is cut out at runtime (`keysNote.attach` in `main-pad.js`, same method as the mug disc), moved to x -0.43 / z -2.03 just above the notebook and slanted; its baked shading is kept, a handwriting layer (GUIDE + every key) and a soft contact shadow are laid over it. Clicking the pad / `?` opens a square note (no scroll bar, text auto-fits) at the top right; ESC puts it back. The old pad spot in the desk lightmap was painted out (lighting fitted from the surrounding wood + grain taken from a clean plank): new files `sakina-room-agx-both-pad.glb` and `-pad-m.glb` (only `lm_Desk` changed; old GLBs unchanged). NOT a Cycles re-bake (no GPU here); the friend-laptop final bake should include the moved pad (`Note_Stack` position in the Blender scene) so the paint-out is replaced by a true bake. Tested in a local headless browser only; not verified on the Netlify preview.


## 2026-11-06 — Standing lamp moved left (branch `newversion`, main-pad.js?v=129)
- Requested: "bring the standing lamp a little bit to the left". The lamp is cut out of the baked `Room_Right_Nook` mesh at load (`shiftStandingLamp`: connected pieces within 0.28 m of its axis) and shifted by `LS={x:-0.25,z:0}` m (toward the room centre, away from the right wall). Its shadow light, click areas and the lamp-dimming centre use the same `LS`; change `LS` to move it again.
- Quick runtime shift, not a re-bake: the lamp's old glow on the wall/ceiling and its floor shadow stay baked at the old position.
- Measured: in the chair view (key R) a move left puts the lamp closer to the screen edge (shade already cut off at the top there); the home view is unchanged (lamp is far off-screen right). Moving it toward the chair (+z) or the right wall (+x) would show more of it.
- Verified (local software render): shade moved to x 1.76..2.16 (centre 1.96); pole click toggles the lamp at the new spot; no console errors. NOT verified: look on a real GPU, the old baked glow on the wall.
- 2026-11-06 — **newversion: photo no longer merges with the monitor.** The overlay photo (and its white card) is now drawn on top (`depthTest:false`, renderOrder 30/31), so the monitor casing can't cut into it while orbiting; it still covers the baked grey pinned card underneath (that card is part of the room GLB, so the photo must stay over it). Nudged 6 mm right so it clears the screen glass. Light film grain (0.3) stays on while using the computer. Tested: real page, view from two angles, no console errors. Not verified on a real GPU/Netlify.

## 2026-11-06 — Calculator you can use (branch `newversion`, main-pad.js?v=128, sfx.js?v=9, felix-ui.css?v=22)
- Click the calculator on the desk (hover tip "CLICK TO USE THE CALCULATOR"): it lifts off the desk and hangs face-on in front of the camera; ESC, a click outside it or PUT DOWN sets it back. Every key works with the mouse/touch (key travels down, click sound) and with the keyboard (0-9 . + - * / Enter % R=root Backspace C=clear A=all clear, Esc). LCD digits are drawn live (8 digits, minus, M memory flag, E for error). Numbers stay until a reload.
- Bottom bar lists the calculator keys while it is in hand (replaces the normal shortcut row; hidden on phones).
- Built from the baked triangles themselves (same UVs and the very same material, so at rest it looks exactly like the baked one): 11 031 triangles cut out of `Room_Desk` into body + 25 key meshes; the baked digits are removed and redrawn on a canvas over the glass. Frame measured from the mesh: centre (-0.679, -2.079), yaw 8 deg.
- It is drawn in its own render pass (after the CRT video overlay), otherwise the video plane (no depth test) painted over it.
- Desk where it stood: a soft-edged patch with the same shader re-uses clean plank texels shifted 16 cm along the grain, so no black contact shadow is left.
- Verified (local software render, 640x360 and 1280x720): rest look, lift to front, 12+3=15, 9x7=63, keyboard 7*6=42, Escape puts it back, desk clean, no console errors. NOT verified: real fps, click sound, touch use, exact look of the shadow-free desk on the real device.

## 2026-11-06 — Calculator looks the same on the desk and in hand
- The lifted calculator now uses a copy of the desk material whose position-based tints (desk healing/brightening patches) are fixed to its rest position, so colour no longer changes when it leaves the desk. Removed the lifted-state brightness boost and LCD tint lerp; key travel reduced to 0.9 mm to avoid flicker/cast when pressing.
- Verified locally (software render): keys at rest ≈ (181,159,138), lifted ≈ (211,166,132), same hue; no console errors. Not yet verified on the published site.

## 2026-11-06 — Pencil holder: click to spin the pencils (branch `newversion`)
- Click the pencil holder (green cup left of the desk lamp, at x -0.70, z -1.94) and the pencils and pens turn once around inside it (slows to a stop, each click adds one more turn); hover hint "CLICK TO SPIN THE PENCILS"; soft wooden rattle (`sfx.pencils`). With reduced motion the turn is instant.
- How: `setupPencils` in main-pad.js cuts every connected piece that stands out of the cup (within 7.5 cm of its axis, above y 0.83) out of `Room_Desk` into its own small mesh (`PencilSticks`, ~16k triangles, same baked material), which turns about the cup's vertical axis, so the sticks stay inside the cup. The cup itself and the baked light stay as they were. Invisible `PencilHit` cylinder is the click area.
- Verified (local software render): sticks found, hover hint, click turns by 2π, a full turn returns the picture pixel-identical, quarter-turn renders show the sticks inside the cup, no console errors. NOT verified: the animation smoothness in motion, the rattle sound, taps on a phone, real-GPU look.
- Note: in the home view the holder sits just off the left edge of the screen; it shows when the view is dragged a little left or in the notepad view.
## 2026-11-06 — Calculator: true colour and correct keys
- Colour: the lifted calculator is drawn in an overlay pass that runs after OutputPass, so its colours were not sRGB-encoded and came out too dark. It now encodes itself while lifted; body in hand ≈ (165,147,123) vs (161,144,122) rendered in the room scene, i.e. the same as on the desk.
- Keys: some long body-plate triangles were assigned to keys (e.g. "4", "6", "0", "AC"), so clicks hit the wrong key (2 did nothing, 8 gave 1). Key triangles must now lie fully inside their own cell. Local test clicking projected key centres: 8,2,5,0,9,1 → display 825091, AC → 0.
- Verified locally only (software render); not yet on the published preview.


## Phone: recorded voice, continuous ring shake (web/phone.js)
- Sakina's recording (`web/sakina-phone-r2.mp3`, 86 s) plays when the phone is on speaker; the caption bubble scrolls with it.
- Ringing: the phone shakes continuously with a very quiet ring (`RING_GAIN=0.02`) until picked up; the ring stops on pick-up.
- Hang up, leaving the phone or the desk view pauses the voice and keeps the position; coming back resumes from there.
- After the voice ends, picking up and using speaker again restarts the voice and caption from the beginning.
- Tested headless (SwiftShader): shake, answer, speaker, hang-up pause, resume, leave-to-home pause, end of playback, restart. Not tested: real speakers, real GPU smoothness, touch.
- Open: caption text is the approved script, not a word-for-word transcript of the recording; graduation month/year not set.

## Phone: ring on every visit, shake with reduce-motion
- Cause of "phone not ringing": the phone started idle once it had been answered in the same tab session (sessionStorage), and reduce-motion disabled both shake and ring tone.
- Fix: phone always starts ringing on page load; shake is kept under reduce-motion (half amplitude); the ring tone no longer depends on reduce-motion (still needs the sound button on). phone.js v11, main-pad.js v140.
- Not tested: reduce-motion shake and the published site.

## Phone caption: Sakina's exact words
- Caption (`SCRIPT` in phone.js and `#phone-cap` in index.html) now uses her exact transcript, including "May 2027"; paragraphs shown via `white-space:pre-line`. phone.js v12, felix-ui.css v25, main-pad.js v141.

## Phone: caption Version 2, INCOMING sign removed
- Caption now uses Sakina's Version 2 transcript (exact words). The white "INCOMING" sign above the ringing phone is hidden (`syncCall` passes false); the phone still rings, shakes and is clickable. phone.js v13, main-pad.js v142.

## 2026-11-06 — Calculator: clean keys, correct percent
- Smeared/ghost patches on keys (%, √, −, +, =, MR, 1) came from the desk's healing tint acting on the calculator. It is now excluded for the calculator, so every key face is clean at rest and lifted; the keys still look as before otherwise.
- `%` now works like a pocket calculator: 5 × 5 % = 0.25, 50 ÷ 5 % = 1000, 200 + 10 % = 20 then = 220.
- Verified: arithmetic unit test (15 sequences) and real keyboard sequences in the page match; clicking 8,2,5,0,9,1 shows 825091. Local software render only.
- 2026-11-06 — **newversion: working TV remote** (`main-pad.js?v=134`, new `web/remote.js?v=4`). Click the remote on the desk (or key V): it lifts off the desk and comes up on the right of the view, same tan remote (crisp key/legend overlay on top of the baked one), keys clickable. ESC, V, or the "PUT THE REMOTE BACK" button returns it to its exact spot. While it is away the baked dark footprint on the desk is healed in the `Room_Desk` shader (`DG.h`, `deskGone`), and fades back when it is put down.
  Keys: POWER=TV on/off, EJECT, PLAY=resume/replay, PAUSE, STOP, REW=restart, FF=+10 s, REC=replay last 10 s, TIMER=slow-mo 0.5x, MENU=volume, CH rocker=next/prev tape, 1-9 = tape n, 0=mute, +10 cycles tapes 10-12, TV=zoom to TV. Hover tips explain each key. Debug hooks: `?noremote=1` disables it, `?dbg` exposes `window.__dbg`.
  Tested (local headless Chromium, software render): rest look identical to before; held look crisp; desk footprint shows no dark patch while held (slight streaking in the healed patch); put-back via V returns to rest; no console errors; power/eject/play/pause/stop/mute/volume/channel/tape keys fire.
  NOT verified: FF / REC replay / TIMER slow-mo and seeking with real video (headless can't decode the H.264 tapes), the real Netlify URL, a real GPU.
- 2026-11-06 — **newversion: remote keys look real** (`remote.js?v=6`, `main-pad.js?v=146`). Held remote keys redrawn as raised moulded buttons (drop shadow, dark gap, bevelled rim, glossy dome); number keys cream with dark digits, transport keys dark with cream symbols (play green, power/rec red), printed play/rew/ff/stop/pause/rec symbols, bigger legends, CH rocker with two arrows. Only the held-remote overlay changed; the remote on the desk and key positions/hit areas are unchanged. Checked in a local headless render only; not on Netlify or a real GPU.

## 2026-11-06 — Ringtone quieter
- Phone ring gain lowered from 0.02 to 0.011 (about 5 dB softer). `phone.js?v=14`.
- 2026-11-06 — **newversion: bottom-right controls no longer block the scene** (`felix-ui.css?v=27`). `.bar` and its lists/items are `pointer-events:none`; only the buttons (T Tapes, C Use computer, ..., Credits/Sound/Lo-fi) take clicks, so the remote (and anything behind the text) can be clicked next to the controls. Checked on a standalone copy of the bar (gaps hit the canvas, buttons hit buttons); not re-run on the full 3D page or Netlify.

## Loading-screen stills refreshed from the current room
- `crt-still.jpg` (1600x900), `crt-still-wide.jpg` (2100x900), `crt-still-p.jpg` (720x1280) and `crt-still-m.jpg` (900x506) are new captures of the live room's home view (desk, tapes, window photo as they are now). Taken in the cloud with software rendering (SwiftShader), so slightly softer than a real GPU.
- Desktop/wide glass corners unchanged (re-measured, identical). Portrait corners and box updated in `crt-gate.js` (`SD.p`) because the live portrait framing changed. Cache tags: crt-still v6, wide v6, p v2, m v2, crt-gate.js v11.
- Checked: loading screen overlay lines up with the TV glass at 1600x900, 2100x900 (rendered) and 360x640. Not checked: the published site.
