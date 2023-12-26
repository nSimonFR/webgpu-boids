@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> OurVertexShaderOutput {
  let pos = array(
    vec2f( 0.0,  0.5),
    vec2f(-0.5, -0.5),
    vec2f( 0.5, -0.5)
  );

  var vsOutput: OurVertexShaderOutput;
  vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  return vsOutput;
}
