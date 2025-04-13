// src/shaders/glow.vertex.wgsl
// WGSL translation attempt for Glow Vertex Shader

// Uniforms provided by Babylon's ShaderMaterial
struct SceneUniforms {
  viewProjection : mat4x4f; // Added semicolon
};
@group(0) @binding(0) var<uniform> scene : SceneUniforms;

struct MeshUniforms {
  world : mat4x4f, // Removed incorrect semicolon
  worldInverseTranspose : mat3x3f // Removed incorrect semicolon
}; // Semicolon belongs after the closing brace if needed
@group(0) @binding(1) var<uniform> mesh : MeshUniforms;

// Vertex Input Attributes
struct VertexInput {
  @location(0) position : vec3f,
  @location(1) normal : vec3f,
};

// Vertex Output (to Fragment Shader)
struct VertexOutput {
  @builtin(position) clipPosition : vec4f,
  @location(0) worldNormal : vec3f,
  @location(1) worldPosition : vec3f,
};

@vertex
fn main(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;

  // Calculate world position and clip position
  let worldPos4 : vec4f = mesh.world * vec4f(input.position, 1.0);
  output.worldPosition = worldPos4.xyz;
  output.clipPosition = scene.viewProjection * worldPos4;

  // Calculate world normal
  output.worldNormal = normalize(mesh.worldInverseTranspose * input.normal);

  return output;
}
