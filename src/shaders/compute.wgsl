struct BoidStruct {
  offset: vec2f,
  velocity: vec2f,
  scale: vec2f,
};

@group(0) @binding(0)
var<storage, read_write> boidStructs: array<BoidStruct>;

@compute @workgroup_size(1)
fn compute(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
  boidStructs[0].offset.x += 0.01;
  // boidStruct.offset.x += 0.01;
}