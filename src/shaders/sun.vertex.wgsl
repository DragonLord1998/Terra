// src/shaders/sun.vertex.wgsl
// WGSL translation attempt for Sun Vertex Shader

// Uniforms provided by Babylon's ShaderMaterial
struct SceneUniforms {
  viewProjection : mat4x4f,
};
@group(0) @binding(0) var<uniform> scene : SceneUniforms;

struct MeshUniforms {
  world : mat4x4f,
};
@group(0) @binding(1) var<uniform> mesh : MeshUniforms;

// Vertex Input Attributes
struct VertexInput {
  @location(0) position : vec3f,
  @location(2) uv : vec2f, // Assuming UV is at location 2
};

// Vertex Output (to Fragment Shader)
struct VertexOutput {
  @builtin(position) clipPosition : vec4f,
  @location(0) uv : vec2f,
  @location(1) worldPosition : vec3f, // Pass world position
};

@vertex
fn main(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;

  output.uv = input.uv;

  // Calculate world position and clip position
  let worldPos4 : vec4f = mesh.world * vec4f(input.position, 1.0);
  output.worldPosition = worldPos4.xyz;
  output.clipPosition = scene.viewProjection * worldPos4;

  return output;
}
