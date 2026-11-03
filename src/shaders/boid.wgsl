struct Boid {
  pos: vec2f,
  vel: vec2f,
  size: f32,
  tint: f32,
  seed: f32,
  _pad: f32,
};

struct Params {
  dt: f32,
  time: f32,
  width: f32,
  height: f32,
  mouse: vec2f,
  mouseStrength: f32,
  fade: f32,
};

@group(0) @binding(0) var<storage, read> boids: array<Boid>;
@group(0) @binding(1) var<uniform> params: Params;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

// Fixed, muted palette matching the site accent (#AB47BC). Each boid keeps
// one colour for its whole life: no per-frame colour changes, no strobing.
const PALETTE = array<vec3f, 4>(
  vec3f(0.671, 0.278, 0.737), // #AB47BC
  vec3f(0.808, 0.576, 0.847), // #CE93D8
  vec3f(0.494, 0.341, 0.761), // #7E57C2
  vec3f(0.502, 0.871, 0.918), // #80DEEA (rare accent)
);

@vertex
fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> VSOut {
  // Dart shape in local px, pointing along +x.
  let shape = array<vec2f, 3>(
    vec2f(7.0, 0.0),
    vec2f(-5.0, 3.5),
    vec2f(-5.0, -3.5),
  );

  let b = boids[i];
  let dir = normalize(b.vel + vec2f(1e-5, 0.0));
  let local = shape[v] * b.size;
  let world = b.pos + vec2f(local.x * dir.x - local.y * dir.y, local.x * dir.y + local.y * dir.x);

  let clip = vec2f(world.x / params.width * 2.0 - 1.0, 1.0 - world.y / params.height * 2.0);

  // Smaller boids read as further away: dimmer. Global fade-in on start.
  let depth = mix(0.45, 0.9, saturate((b.size - 0.7) / 0.9));
  let alpha = depth * params.fade;
  let rgb = PALETTE[u32(b.tint)];

  var out: VSOut;
  out.position = vec4f(clip, 0.0, 1.0);
  out.color = vec4f(rgb * alpha, alpha); // premultiplied
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  return in.color;
}
