// src/shaders/glow.fragment.wgsl
// WGSL translation attempt for Glow Fragment Shader

// Input from Vertex Shader
struct VertexOutput {
  @builtin(position) clipPosition : vec4f,
  @location(0) worldNormal : vec3f,
  @location(1) worldPosition : vec3f,
};

// Uniforms
struct SceneUniforms {
  cameraPosition: vec3f, // Assuming cameraPosition is in Scene UBO
};
@group(0) @binding(0) var<uniform> scene : SceneUniforms;

struct MaterialUniforms {
  glowColor : vec3f,
  glowIntensity : f32,
  glowExponent : f32,
  time : f32, // For animated noise
};
// Assuming binding index 1 for custom material UBO
@group(0) @binding(1) var<uniform> material : MaterialUniforms;

// --- Noise Functions (Copied from Sun shader) ---
fn random(st : vec2f) -> f32 {
  return fract(sin(dot(st, vec2f(12.9898, 78.233))) * 43758.5453);
}

fn noise(st : vec2f) -> f32 {
  let i : vec2f = floor(st);
  let f : vec2f = fract(st);
  let a : f32 = random(i);
  let b : f32 = random(i + vec2f(1.0, 0.0));
  let c : f32 = random(i + vec2f(0.0, 1.0));
  let d : f32 = random(i + vec2f(1.0, 1.0));
  let u : vec2f = smoothstep(vec2f(0.0), vec2f(1.0), f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

fn fbm(st : vec2f) -> f32 {
  var value : f32 = 0.0;
  var amplitude : f32 = 0.5;
  var current_st = st;
  // Fewer octaves for glow noise
  for (var i : i32 = 0; i < 3; i = i + 1) {
    value = value + amplitude * noise(current_st);
    current_st = current_st * 2.0;
    amplitude = amplitude * 0.5;
  }
  return value;
}

// --- Main Fragment Shader ---
@fragment
fn main(input : VertexOutput) -> @location(0) vec4f {

  // Calculate view direction (from surface point to camera)
  let viewDirection : vec3f = normalize(scene.cameraPosition - input.worldPosition);

  // Calculate base intensity based on the dot product (rim lighting)
  // Use abs and pow with f32
  let rimDot : f32 = 1.0 - abs(dot(input.worldNormal, viewDirection));
  let rimIntensity : f32 = pow(rimDot, material.glowExponent);

  // Calculate noise based on world position projected onto a plane
  // Project world position onto XY plane relative to center for noise coordinates
  let noiseCoord : vec2f = input.worldPosition.xy * 0.1 + material.time * 0.02; // Scale and animate noise lookup
  let glowNoise : f32 = fbm(noiseCoord);

  // Modulate intensity and color with noise
  let noiseFactor : f32 = 0.7 + glowNoise * 0.6; // Add variation, ensure base intensity > 0
  let finalIntensity : f32 = rimIntensity * noiseFactor;

  // Slightly vary color based on noise too (optional)
  let noisyColor : vec3f = material.glowColor * (0.9 + glowNoise * 0.2);

  // Output final color and intensity (alpha controls glow)
  return vec4f(noisyColor, finalIntensity * material.glowIntensity);
}
