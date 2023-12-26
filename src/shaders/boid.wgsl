struct BoidStruct {
  offset: vec2f,
  velocity: vec2f,
  scale: vec2f,
};

@group(0) @binding(0) var<uniform> boidStruct: BoidStruct;

struct BoidOutput {
  @builtin(position) position: vec4f,
};

@vertex fn vertex_main(
  @builtin(vertex_index) vertexIndex : u32
) -> BoidOutput {
  let pos = array(
    vec2f( 0.0,  0.5),  // top center
    vec2f(-0.3, -0.5),  // bottom left
    vec2f( 0.3, -0.5)   // bottom right
  )[vertexIndex];

  let angle = -atan2(boidStruct.velocity.x, boidStruct.velocity.y); // TODO
  let posRotated= vec2(
    (pos.x * cos(angle)) - (pos.y * sin(angle)),
    (pos.x * sin(angle)) + (pos.y * cos(angle))
  );

  var boid: BoidOutput;
  boid.position = vec4f(posRotated * boidStruct.scale + boidStruct.offset, 0.0, 1.0);
  return boid;
}

@fragment fn fragment_main(@builtin(position) pixelPosition: vec4f) -> @location(0) vec4f {
  var color = (1 / boidStruct.scale.x) / 40;
  return vec4f(0, color, color, 1);
}

@vertex fn compute_main(
  @builtin(vertex_index) vertexIndex : u32
) -> BoidOutput {
  let pos = array(
    vec2f( 0.0,  0.5),  // top center
    vec2f(-0.3, -0.5),  // bottom left
    vec2f( 0.3, -0.5)   // bottom right
  )[vertexIndex];

  let angle = -atan2(boidStruct.velocity.x, boidStruct.velocity.y);; // TODO
  let posRotated= vec2(
    (pos.x * cos(angle)) - (pos.y * sin(angle)),
    (pos.x * sin(angle)) + (pos.y * cos(angle))
  );

  var boid: BoidOutput;
  boid.position = vec4f(posRotated * boidStruct.scale + boidStruct.offset, 0.0, 1.0);
  return boid;
}