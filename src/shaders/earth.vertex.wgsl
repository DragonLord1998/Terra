// src/shaders/earth.vertex.wgsl
// WGSL translation attempt for Earth Vertex Shader

// Uniforms provided by Babylon's ShaderMaterial (Expected Structure)
struct SceneUniforms {
  viewProjection : mat4x4f; // Added semicolon
  // cameraPosition might be provided in a different UBO by Babylon
};
@group(0) @binding(0) var<uniform> scene : SceneUniforms;

struct MeshUniforms {
  world : mat4x4f, // Removed incorrect semicolon
  // Assuming worldInverseTranspose is provided for normals, might need adjustment
  worldInverseTranspose : mat3x3f // Removed incorrect semicolon
}; // Semicolon belongs after the closing brace if needed, but often omitted for last member
@group(0) @binding(1) var<uniform> mesh : MeshUniforms;

// Custom Uniforms (Needs separate UBO binding)
struct CustomUniforms {
  displacementScale: f32 // Removed incorrect semicolon
};
// Binding index might need adjustment based on how many UBOs Babylon uses by default
@group(0) @binding(2) var<uniform> custom : CustomUniforms;

// Texture and Sampler bindings (Group 1 is typical for textures/samplers)
@group(1) @binding(0) var heightMapSampler: sampler;
@group(1) @binding(1) var heightMapTexture: texture_2d<f32>;

// Vertex Input Attributes (Locations match common Babylon setup)
struct VertexInput {
  @location(0) position : vec3f,
  @location(1) normal : vec3f,
  @location(2) uv : vec2f,
  @location(3) tangent : vec4f, // tangent.w for handedness
};

// Vertex Output (to Fragment Shader)
struct VertexOutput {
  @builtin(position) clipPosition : vec4f,
  @location(0) uv : vec2f,
  @location(1) worldNormal : vec3f, // Original world normal for lighting basis
  @location(2) worldPosition : vec3f,
  @location(3) tbn : mat3x3f, // TBN matrix for normal mapping
};

@vertex
fn main(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;

  output.uv = input.uv;

  // Sample height map
  // Use textureSampleLevel with level 0 for explicit LOD control if needed, otherwise textureSample is fine
  let displacement : f32 = textureSample(heightMapTexture, heightMapSampler, input.uv).r;

  // Calculate displaced position in model space
  let displacedPosition : vec3f = input.position + input.normal * displacement * custom.displacementScale;

  // Calculate world position and clip position
  let worldPos4 : vec4f = mesh.world * vec4f(displacedPosition, 1.0);
  output.worldPosition = worldPos4.xyz;
  output.clipPosition = scene.viewProjection * worldPos4;

  // Calculate TBN matrix in world space
  // Use original normal and tangent for the basis vectors, transformed by worldInverseTranspose
  let worldNormalBasis : vec3f = normalize(mesh.worldInverseTranspose * input.normal);
  let worldTangentBasis : vec3f = normalize(mesh.worldInverseTranspose * input.tangent.xyz);
  // Recalculate bitangent using cross product, considering handedness from tangent.w
  let worldBitangentBasis : vec3f = cross(worldNormalBasis, worldTangentBasis) * input.tangent.w;
  output.tbn = mat3x3f(worldTangentBasis, worldBitangentBasis, worldNormalBasis);

  // Pass the *original* world normal (transformed) for basic lighting calculations if normal map is off
  output.worldNormal = worldNormalBasis;

  return output;
}
