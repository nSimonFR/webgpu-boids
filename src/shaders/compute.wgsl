struct BoidStruct {
  position: vec2f,
  velocity: vec2f,
  scale: vec2f,
};

struct Params {
  deltaT: f32,
  rule1Distance: f32,
  rule2Distance: f32,
  rule3Distance: f32,
  rule1Scale: f32,
  rule2Scale: f32,
  rule3Scale: f32,
};

@group(0) @binding(0)
var<storage, read_write> boidStructs: array<BoidStruct>;

@group(0) @binding(1)
var<uniform> params: Params;

@compute @workgroup_size(128)
fn compute(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
  var index = GlobalInvocationID.x;

  var vPos = boidStructs[index].position;
  var vVel = boidStructs[index].velocity;
  var cMass = vec2(0.0);
  var cVel = vec2(0.0);
  var colVel = vec2(0.0);
  var cMassCount = 0u;
  var cVelCount = 0u;
  var pos : vec2<f32>;
  var vel : vec2<f32>;

  for (var i = 0u; i < arrayLength(&boidStructs); i++) {
    if (i == index) {
      continue;
    }

    pos = boidStructs[i].position.xy;
    vel = boidStructs[i].velocity.xy;
    if (distance(pos, vPos) < params.rule1Distance) {
      cMass += pos;
      cMassCount++;
    }
    if (distance(pos, vPos) < params.rule2Distance) {
      colVel -= pos - vPos;
    }
    if (distance(pos, vPos) < params.rule3Distance) {
      cVel += vel;
      cVelCount++;
    }
  }

  if (cMassCount > 0) {
    cMass = (cMass / vec2(f32(cMassCount))) - vPos;
  }
  if (cVelCount > 0) {
    cVel /= f32(cVelCount);
  }
  vVel += (cMass * params.rule1Scale) + (colVel * params.rule2Scale) + (cVel * params.rule3Scale);

  // clamp velocity for a more pleasing simulation
  vVel = normalize(vVel) * clamp(length(vVel), 0.0, 0.1);

  // kinematic update
  vPos = vPos + (vVel * params.deltaT);

  // Wrap around boundary
  if (vPos.x < -1.0) {
    vPos.x = 1.0;
  }
  if (vPos.x > 1.0) {
    vPos.x = -1.0;
  }
  if (vPos.y < -1.0) {
    vPos.y = 1.0;
  }
  if (vPos.y > 1.0) {
    vPos.y = -1.0;
  }

  boidStructs[index].position = vPos;
  boidStructs[index].velocity = vVel;
}