struct Boid {
  position: vec2f,
  velocity: vec2f,
  scale: vec2f,
};

@group(0) @binding(0)
var<storage, read> boids: array<Boid>;

struct Output {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex fn vertex_main(
  @builtin(vertex_index) vertexIndex : u32,
  @builtin(instance_index) instanceIndex: u32,
) -> Output {
  let pos = array(
    vec2f( 0.0,  0.1),  // top center
    vec2f(-0.1, -0.1),  // bottom left
    vec2f( 0.1, -0.1)   // bottom right
  )[vertexIndex];

  let boid = boids[instanceIndex];
  let angle = -atan2(boid.velocity.x, boid.velocity.y); // TODO
  let posRotated = vec2(
    (pos.x * cos(angle)) - (pos.y * sin(angle)),
    (pos.x * sin(angle)) + (pos.y * cos(angle))
  );

  // let color = (1 / angl) / 30;
  let color = vec4(
    1.0 - sin(angle + 1.0) - boid.position.y,
    pos.x * 100.0 - boid.position.y + 0.1,
    boid.position.x + cos(angle + 0.5),
    1.0,
  );

  return Output(
    vec4f(posRotated * boid.scale + boid.position, 0.0, 1.0),
    // vec4f(0, color, color, 1),
    color
  );
}

@fragment fn fragment_main(output: Output) -> @location(0) vec4f {
  return output.color;
}
