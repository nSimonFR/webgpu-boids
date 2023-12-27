struct BoidStruct {
  offset: vec2f,
  velocity: vec2f,
  scale: vec2f,
};

@group(0) @binding(0)
var<storage, read_write> boidStructs: array<BoidStruct>;

@compute @workgroup_size(128)
fn compute(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
  boidStructs[GlobalInvocationID.x].offset += boidStructs[GlobalInvocationID.x].velocity;

  if (boidStructs[GlobalInvocationID.x].offset.x > 1.0) {
    boidStructs[GlobalInvocationID.x].offset.x = -1.0;
  }
  if (boidStructs[GlobalInvocationID.x].offset.x < -1.0) {
    boidStructs[GlobalInvocationID.x].offset.x = 1.0;
  }
  if (boidStructs[GlobalInvocationID.x].offset.y > 1.0) {
    boidStructs[GlobalInvocationID.x].offset.y = -1.0;
  }
  if (boidStructs[GlobalInvocationID.x].offset.y < -1.0) {
    boidStructs[GlobalInvocationID.x].offset.y = 1.0;
  }
}