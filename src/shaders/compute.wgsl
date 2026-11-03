// Reynolds-style flocking, in CSS-pixel space.
// Reads from `src`, writes to `dst` (ping-pong) so every boid sees the same
// snapshot of the flock: no read/write race, no jitter.

struct Boid {
  pos: vec2f,
  vel: vec2f,
  size: f32,   // 0.7 .. 1.6, bigger boids are rarer and a bit slower
  tint: f32,   // palette index, fixed at spawn
  seed: f32,   // per-boid phase for the wander term
  _pad: f32,
};

struct Params {
  dt: f32,
  time: f32,
  width: f32,
  height: f32,
  mouse: vec2f,
  mouseStrength: f32, // 0..1, eases out when the pointer stops
  fade: f32,          // used by the render pass only
};

@group(0) @binding(0) var<storage, read> src: array<Boid>;
@group(0) @binding(1) var<storage, read_write> dst: array<Boid>;
@group(0) @binding(2) var<uniform> params: Params;

const PERCEPTION = 64.0;     // neighbourhood radius (px)
const SEPARATION = 26.0;     // personal space (px)
const FOV_COS = -0.45;       // ignore neighbours right behind (~230° field of view)
const CRUISE = 140.0;         // px/s
const MAX_SPEED = 195.0;
const MIN_SPEED = 80.0;
const MAX_FORCE = 185.0;     // px/s², caps how sharply a boid can turn
const W_SEP = 2.2;
const W_ALI = 1.0;
const W_COH = 0.6;
const W_CROWD = 0.9;
// Local density control (weighted neighbour count): cohesion fades out
// between COH_FULL and COH_NONE neighbours, and past CROWD_START boids push
// away from the local centre. Groups stay airy and big flocks split up
// instead of merging into one dense mass.
const COH_FULL = 5.0;
const COH_NONE = 14.0;
const CROWD_START = 12.0;
const CROWD_FULL = 26.0;
// Hidden flock id (from the per-boid seed): boids align and group only with
// their own flock but keep their distance from everyone, so several flocks
// weave through each other instead of fusing into one field.
const FLOCKS = 4.0;
const TAU = 6.2831853;
const SPEED_HOLD = 5.0;      // 1/s, how quickly boids return to cruise speed
const MOUSE_RADIUS = 220.0;
const FLEE_TURN = 10.0;      // rad/s, how fast a boid can turn away from the pointer
const FLEE_BOOST = 0.7;      // up to +70% speed right next to the pointer
const EDGE = 40.0;           // wrap this far off-screen so boids never pop in view

fn limit(v: vec2f, maxLen: f32) -> vec2f {
  let l = length(v);
  if (l > maxLen && l > 0.0) { return v * (maxLen / l); }
  return v;
}

fn safeNormalize(v: vec2f) -> vec2f {
  let l = length(v);
  if (l < 1e-5) { return vec2f(1.0, 0.0); }
  return v / l;
}

// Reynolds steering: turn the current velocity toward `desiredDir` at full speed.
fn steer(desiredDir: vec2f, vel: vec2f, speed: f32) -> vec2f {
  return limit(safeNormalize(desiredDir) * speed - vel, MAX_FORCE);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  let n = arrayLength(&src);
  if (i >= n) { return; }

  var me = src[i];
  let flock = floor(me.seed / TAU * FLOCKS);
  let dir = safeNormalize(me.vel);
  let maxSpeed = MAX_SPEED / sqrt(me.size);

  var sep = vec2f(0.0);
  var ali = vec2f(0.0);
  var coh = vec2f(0.0);
  var count = 0.0;   // same-flock neighbours (alignment / cohesion)
  var density = 0.0; // all neighbours (crowding)
  var crowdCentre = vec2f(0.0);

  for (var j = 0u; j < n; j++) {
    if (j == i) { continue; }
    let other = src[j];
    let offset = other.pos - me.pos;
    let d = length(offset);
    if (d > PERCEPTION || d < 1e-4) { continue; }
    // Field of view: don't react to boids directly behind.
    if (dot(dir, offset / d) < FOV_COS) { continue; }

    // Smooth falloff so neighbours fade in/out of influence instead of snapping.
    let w = 1.0 - smoothstep(PERCEPTION * 0.6, PERCEPTION, d);
    density += w;
    crowdCentre += other.pos * w;

    if (d < SEPARATION) {
      // Grows sharply at close range, so dense packs can't compress.
      let t = 1.0 - d / SEPARATION;
      sep -= (offset / d) * t * t;
    }

    if (floor(other.seed / TAU * FLOCKS) != flock) { continue; }
    ali += other.vel * w;
    coh += other.pos * w;
    count += w;
  }

  var acc = vec2f(0.0);
  if (count > 0.0) {
    let toCentre = coh / count - me.pos;
    acc += steer(ali / count, me.vel, maxSpeed) * W_ALI;
    acc += steer(toCentre, me.vel, maxSpeed) * W_COH * (1.0 - smoothstep(COH_FULL, COH_NONE, density));
  }
  if (density > CROWD_START) {
    acc += steer(me.pos - crowdCentre / density, me.vel, maxSpeed) * W_CROWD * smoothstep(CROWD_START, CROWD_FULL, density);
  }
  if (length(sep) > 0.0) {
    // Scale by how crowded the personal space is (capped), not a flat push.
    acc += steer(sep, me.vel, maxSpeed) * W_SEP * min(1.0, length(sep) * 2.0);
  }

  // Gentle wander: a slow sideways drift so lone boids curve instead of flying straight.
  let side = vec2f(-dir.y, dir.x);
  acc += side * sin(params.time * 0.35 + me.seed) * 18.0;

  // Pointer: boids flee, stronger and faster the closer they are.
  var fear = 0.0;
  var away = vec2f(0.0);
  if (params.mouseStrength > 0.0) {
    away = me.pos - params.mouse;
    let d = length(away);
    if (d < MOUSE_RADIUS) {
      // Full strength in the inner ~40% of the radius, easing out to the edge.
      fear = (1.0 - smoothstep(MOUSE_RADIUS * 0.4, MOUSE_RADIUS, d)) * params.mouseStrength;
      // Panic: flocking (following flockmates toward the pointer) fades out.
      acc *= 1.0 - 0.8 * fear;
    }
  }

  var vel = me.vel + acc * params.dt;
  if (fear > 0.0) {
    // Flee by turning, not braking: a push opposite to the velocity would only
    // slow the boid down, and the speed hold below would push it straight back
    // toward the pointer. Rotate the heading toward "away" at a capped rate.
    let heading = atan2(vel.y, vel.x);
    var diff = atan2(away.y, away.x) - heading;
    diff = diff - TAU * round(diff / TAU); // shortest way round
    let turn = clamp(diff, -FLEE_TURN * fear * params.dt, FLEE_TURN * fear * params.dt);
    vel = vec2f(cos(heading + turn), sin(heading + turn)) * length(vel);
  }
  // Keep speed in a comfortable band and ease back to cruise speed
  // (both raised while fleeing, so the burst isn't immediately damped).
  let boost = 1.0 + FLEE_BOOST * fear;
  let speed = clamp(length(vel), MIN_SPEED, maxSpeed * boost);
  let cruise = CRUISE / sqrt(me.size) * boost;
  let eased = mix(speed, cruise, 1.0 - exp(-SPEED_HOLD * params.dt));
  vel = safeNormalize(vel) * eased;

  var pos = me.pos + vel * params.dt;

  // Wrap around, off-screen.
  let w = params.width + EDGE * 2.0;
  let h = params.height + EDGE * 2.0;
  if (pos.x < -EDGE) { pos.x += w; }
  if (pos.x > params.width + EDGE) { pos.x -= w; }
  if (pos.y < -EDGE) { pos.y += h; }
  if (pos.y > params.height + EDGE) { pos.y -= h; }

  me.pos = pos;
  me.vel = vel;
  dst[i] = me;
}
