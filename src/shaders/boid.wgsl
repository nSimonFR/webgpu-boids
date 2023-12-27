struct BoidStruct {
  offset: vec2f,
  velocity: vec2f,
  scale: vec2f,
};

@group(0) @binding(0)
var<storage, read> boidStructs: array<BoidStruct>;

struct BoidOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex fn vertex_main(
  @builtin(vertex_index) vertexIndex : u32,
  @builtin(instance_index) instanceIndex: u32,
) -> BoidOutput {
  let pos = array(
    vec2f( 0.0,  0.5),  // top center
    vec2f(-0.3, -0.5),  // bottom left
    vec2f( 0.3, -0.5)   // bottom right
  )[vertexIndex];

  let boidStruct = boidStructs[instanceIndex];
  let angle = -atan2(boidStruct.velocity.x, boidStruct.velocity.y); // TODO
  let posRotated = vec2(
    (pos.x * cos(angle)) - (pos.y * sin(angle)),
    (pos.x * sin(angle)) + (pos.y * cos(angle))
  );

  let color = (1 / boidStruct.scale.x) / 30;

  return BoidOutput(
    vec4f(posRotated * boidStruct.scale + boidStruct.offset, 0.0, 1.0),
    vec4f(0, color, color, 1),
  );
}

@fragment fn fragment_main(boidOutput: BoidOutput) -> @location(0) vec4f {
  return boidOutput.color;
}
