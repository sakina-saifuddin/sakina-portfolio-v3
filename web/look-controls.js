// Camera for the study room: a limited orbit around what the current view looks at.
// - Cursor movement alone never moves the camera (no parallax).
// - Left-drag / one-finger drag swings the camera around the target:
//     drag left  -> camera moves right around the CRT (see its right side, IBM corner behind it)
//     drag right -> camera moves left (see its left side, armchair side behind it)
//     drag down  -> camera rises (see the top of the CRT); drag up -> lowers to just above the desk
// - Wheel / pinch: distance 0.80-1.20x of the preset distance.
// - Camera clamped inside the room.
// Limits (round 2, checked against the room layout and renders): HOME orbits -62..+70 deg around the CRT at ~1.4 m
// (at -70 the plant filled the foreground); this keeps the camera clear of the plant and the desk edge; polar 35-90 deg keeps it below the
// ceiling (max height ~2.3 m) and above the desk. Other presets use tighter limits so they stay clear of walls.
import * as THREE from "three";

const D2R = THREE.MathUtils.degToRad;
// HOME limits are felixrieseberg.com's own (his desktop.js): absolute azimuth -1.3..+1.2 rad and polar 0.95..1.72 rad around the TV (the left stop is pulled in to -1.08 and the low stop to 1.6 here, where the plant fills the foreground),
// zoom 0.3..2.6 m with a home distance of 1.75 m, rotateSpeed 0.5, damping 0.06.
const HOME_LIMITS = { azMin: -1.08, azMax: 1.2, polarMin: 0.95, polarMax: 1.6, dolly: [0.5, 1.48] };
const CHAIR_PAN = [1.05, 0.5];             // how far the pivot slides toward the leather chair at the far end of the leftward swing
const PRESET_LIMITS = { az: D2R(35), polarSpan: D2R(20), polarMin: D2R(35), polarMax: D2R(95) };
const DOLLY_PRESET = [0.80, 1.20];
const RAD_PER_PX = 0.0042;                         // full drag across ~600 px swings 145 deg (the whole HOME range)
const YAW_MAX = D2R(80);                          // head turn past the left orbit stop, toward the right wall (opt-in: enableYaw)
const DRAG_THRESHOLD = 6;                          // px: below this a press is a click/tap
// x min follows the left wall (moved to x -2.30 in round 3) with a 35 cm margin
const smoothstepYaw = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const UP = new THREE.Vector3(0, 1, 0);
const ROOM = new THREE.Box3(new THREE.Vector3(-2.85, 0.35, -2.25), new THREE.Vector3(3.3, 2.5, 3.2));

export class LookControls {
  constructor(camera, dom) {
    this.camera = camera; this.dom = dom;
    this.enabled = true;
    this.enableYaw = false; this._home = false; this._yaw = 0; this._gYaw = 0;
    this.lookTarget = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.clickBlocked = false;                     // true when the last press became a drag/pinch
    this._center = new THREE.Vector3();
    this._dist = 1; this._az0 = 0; this._polar0 = Math.PI / 2;
    this._lim = { azMin: -1, azMax: 1, polarMin: 0.6, polarMax: 1.6 }; this._dollyLim = DOLLY_PRESET;
    this._az = 0; this._polar = 0; this._dolly = 1;         // current offsets (smoothed)
    this._gAz = 0; this._gPolar = 0; this._gDolly = 1;      // goals
    this._ptrs = new Map(); this._pinch0 = 0; this._dolly0 = 1; this._start = null;
    this._last = performance.now();
    dom.addEventListener("pointerdown", e => this._down(e));
    dom.addEventListener("pointermove", e => this._move(e));
    dom.addEventListener("pointerup", e => this._up(e));
    dom.addEventListener("pointercancel", e => this._up(e));
    dom.addEventListener("wheel", e => this._wheel(e), { passive: false });
  }

  // Adopt the camera's current position/target (after load or a preset flight). home=true -> wide HOME limits.
  setFromCamera(home = false) {
    this._home = home; this._yaw = this._gYaw = 0;
    this._center.copy(this.target); this.lookTarget.copy(this.target);
    const off = this.camera.position.clone().sub(this._center);
    this._dist = off.length();
    this._az0 = Math.atan2(off.x, off.z);
    this._polar0 = Math.acos(THREE.MathUtils.clamp(off.y / this._dist, -1, 1));
    if (home) {
      this._lim = { azMin: HOME_LIMITS.azMin - this._az0, azMax: HOME_LIMITS.azMax - this._az0,
                    polarMin: HOME_LIMITS.polarMin - this._polar0, polarMax: HOME_LIMITS.polarMax - this._polar0 };
    } else {
      this._lim = { azMin: -PRESET_LIMITS.az, azMax: PRESET_LIMITS.az,
                    polarMin: Math.max(PRESET_LIMITS.polarMin, this._polar0 - PRESET_LIMITS.polarSpan) - this._polar0,
                    polarMax: Math.min(PRESET_LIMITS.polarMax, this._polar0 + PRESET_LIMITS.polarSpan) - this._polar0 };
    }
    if (!home) this._dollyLim = DOLLY_PRESET; else this._dollyLim = innerWidth / innerHeight < 0.9 ? [0.5, 1.0] : HOME_LIMITS.dolly;
    this._az = this._gAz = 0; this._polar = this._gPolar = 0; this._dolly = this._gDolly = 1;
  }

  update() {
    const now = performance.now(), dt = Math.min(0.1, (now - this._last) / 1000); this._last = now;
    if (!this.enabled) return;
    const k = 1 - Math.exp(-dt * 5);               // about the glide of damping 0.06 at 60 fps
    this._az += (this._gAz - this._az) * k;
    this._polar += (this._gPolar - this._polar) * k;
    this._dolly += (this._gDolly - this._dolly) * k;
    this._yaw += (this._gYaw - this._yaw) * k;
    const az = this._az0 + this._az * (1 - smoothstepYaw(this._yaw / YAW_MAX)), polar = this._polar0 + this._polar, r = this._dist * this._dolly;
    let pan = 0;
    if (this._home && this._az < 0 && this._lim.azMin < 0) {
      const f = THREE.MathUtils.clamp(this._az / this._lim.azMin, 0, 1);
      pan = smoothstepYaw(THREE.MathUtils.clamp((f - 0.3) / 0.7, 0, 1));
    }
    const c = this._center.clone(); c.x += CHAIR_PAN[0] * pan; c.z += CHAIR_PAN[1] * pan;
    const pos = new THREE.Vector3(r * Math.sin(polar) * Math.sin(az), r * Math.cos(polar), r * Math.sin(polar) * Math.cos(az))
      .add(c);
    ROOM.clampPoint(pos, pos);
    this.camera.position.copy(pos);
    this.target.copy(c);
    this.camera.lookAt(this.target);
    this.lookTarget.copy(this.target);
    if (this._yaw > 1e-4) {
      this.lookTarget.sub(pos).applyAxisAngle(UP, -this._yaw).add(pos);
      this.camera.lookAt(this.lookTarget);
    }
  }

  _down(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    this._ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.dom.setPointerCapture?.(e.pointerId);
    if (this._ptrs.size === 1) { this._start = { x: e.clientX, y: e.clientY }; this.clickBlocked = false; }
    if (this._ptrs.size === 2) { this._pinch0 = this._spread(); this._dolly0 = this._gDolly; this.clickBlocked = true; }
  }

  _move(e) {
    const p = this._ptrs.get(e.pointerId);
    if (!p || !this.enabled) return;               // no button held: cursor movement does nothing
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this._ptrs.size >= 2) {
      const s = this._spread();
      if (this._pinch0 > 0) this._gDolly = THREE.MathUtils.clamp(this._dolly0 * this._pinch0 / s, this._dollyLim[0], this._dollyLim[1]);
      return;
    }
    if (this._start && Math.hypot(e.clientX - this._start.x, e.clientY - this._start.y) > DRAG_THRESHOLD) this.clickBlocked = true;
    if (!this.clickBlocked) return;
    const d = -dx * RAD_PER_PX;
    if (this.enableYaw && this._home) {
      if (d < 0) {
        const t = -d, useAz = Math.min(t, Math.max(0, this._gAz - this._lim.azMin));
        this._gAz -= useAz;
        this._gYaw = THREE.MathUtils.clamp(this._gYaw + (t - useAz), 0, YAW_MAX);
      } else {
        const useYaw = Math.min(d, this._gYaw);
        this._gYaw -= useYaw;
        this._gAz = THREE.MathUtils.clamp(this._gAz + d - useYaw, this._lim.azMin, this._lim.azMax);
      }
    } else this._gAz = THREE.MathUtils.clamp(this._gAz + d, this._lim.azMin, this._lim.azMax);
    this._gPolar = THREE.MathUtils.clamp(this._gPolar - dy * RAD_PER_PX, this._lim.polarMin, this._lim.polarMax);
  }

  _up(e) {
    this._ptrs.delete(e.pointerId);
    if (this._ptrs.size < 2) this._pinch0 = 0;
  }

  _wheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    this._gDolly = THREE.MathUtils.clamp(this._gDolly * Math.exp(e.deltaY * 0.0012), this._dollyLim[0], this._dollyLim[1]);
  }

  _spread() {
    const [a, b] = [...this._ptrs.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }
}
