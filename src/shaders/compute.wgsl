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
const SEPARATION = 20.0;     // personal space (px)
const FOV_COS = -0.45;       // ignore neighbours right behind (~230° field of view)
const CRUISE = 85.0;         // px/s
const MAX_SPEED = 120.0;
const MIN_SPEED = 45.0;
const MAX_FORCE = 110.0;     // px/s², caps how sharply a boid can turn
const W_SEP = 1.7;
const W_ALI = 1.0;
const W_COH = 0.6;
const MOUSE_RADIUS = 150.0;
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
  let dir = safeNormalize(me.vel);
  let maxSpeed = MAX_SPEED / sqrt(me.size);

  var sep = vec2f(0.0);
  var ali = vec2f(0.0);
  var coh = vec2f(0.0);
  var count = 0.0;

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
    ali += other.vel * w;
    coh += other.pos * w;
    count += w;
    if (d < SEPARATION) {
      sep -= (offset / d) * (1.0 - d / SEPARATION);
    }
  }

  var acc = vec2f(0.0);
  if (count > 0.0) {
    acc += steer(ali / count, me.vel, maxSpeed) * W_ALI;
    acc += steer(coh / count - me.pos, me.vel, maxSpeed) * W_COH;
  }
  if (length(sep) > 0.0) {
    acc += steer(sep, me.vel, maxSpeed) * W_SEP;
  }

  // Gentle wander: a slow sideways drift so lone boids curve instead of flying straight.
  let side = vec2f(-dir.y, dir.x);
  acc += side * sin(params.time * 0.35 + me.seed) * 18.0;

  // Pointer: boids steer away smoothly, stronger the closer they are.
  if (params.mouseStrength > 0.0) {
    let away = me.pos - params.mouse;
    let d = length(away);
    if (d < MOUSE_RADIUS) {
      let k = (1.0 - d / MOUSE_RADIUS) * params.mouseStrength;
      acc += steer(away, me.vel, maxSpeed) * 2.5 * k;
    }
  }

  var vel = me.vel + acc * params.dt;
  // Keep speed in a comfortable band and ease back to cruise speed.
  let speed = clamp(length(vel), MIN_SPEED, maxSpeed);
  let cruise = CRUISE / sqrt(me.size);
  let eased = mix(speed, cruise, 0.4 * params.dt);
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
