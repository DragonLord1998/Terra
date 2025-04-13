// src/shaders/sun.fragment.wgsl
// WGSL translation attempt for Sun Fragment Shader

// Input from Vertex Shader
struct VertexOutput {
  @builtin(position) clipPosition : vec4f,
  @location(0) uv : vec2f,
  @location(1) worldPosition : vec3f,
};

// Custom Material Uniforms
struct MaterialUniforms {
  time : f32,
};
// Assuming binding index 1 for custom material UBO (adjust if needed)
@group(0) @binding(1) var<uniform> material : MaterialUniforms;

// --- Noise Functions (Direct Translation) ---
// Basic pseudo-random hash
fn random(st : vec2f) -> f32 {
  return fract(sin(dot(st, vec2f(12.9898, 78.233))) * 43758.5453);
}

// 2D Noise based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
fn noise(st : vec2f) -> f32 {
  let i : vec2f = floor(st);
  let f : vec2f = fract(st);

  // Four corners in 2D of a tile
  let a : f32 = random(i);
  let b : f32 = random(i + vec2f(1.0, 0.0));
  let c : f32 = random(i + vec2f(0.0, 1.0));
  let d : f32 = random(i + vec2f(1.0, 1.0));

  // Smooth Interpolation - Use WGSL smoothstep or manual cubic
  // let u : vec2f = f * f * (3.0 - 2.0 * f); // Hermite interpolation
   let u : vec2f = smoothstep(vec2f(0.0), vec2f(1.0), f); // Using smoothstep

  // Mix 4 corners percentages
  return mix(a, b, u.x) +
         (c - a) * u.y * (1.0 - u.x) +
         (d - b) * u.x * u.y;
}

// Fractional Brownian Motion
fn fbm(st : vec2f) -> f32 {
  var value : f32 = 0.0;
  var amplitude : f32 = 0.5;
  var current_st = st; // Need mutable copy
  // Loop of octaves
  for (var i : i32 = 0; i < 5; i = i + 1) { // Reduced octaves slightly
    value = value + amplitude * noise(current_st);
    current_st = current_st * 2.0;
    amplitude = amplitude * 0.5;
  }
  return value;
}

// Rotation matrix function
fn rotate(angle : f32) -> mat2x2f {
  let s : f32 = sin(angle);
  let c : f32 = cos(angle);
  return mat2x2f(c, -s, s, c);
}

// --- Main Fragment Shader ---
@fragment
fn main(input : VertexOutput) -> @location(0) vec4f {
  let uv : vec2f = input.uv;
  let time : f32 = material.time * 0.05; // Slightly faster base time

  // Calculate distance from center for limb effects
  let edgeFactor : f32 = length(uv - 0.5) * 2.0; // Distance from center [0, 1]
  let limbDarkeningFactor : f32 = smoothstep(0.6, 1.0, edgeFactor); // More darkening towards edge
  let limbBrighteningFactor : f32 = smoothstep(0.8, 0.95, edgeFactor); // Brightening concentrated near the very edge

  // --- Granulation Layers (More contrast, slightly different speeds/scales) ---
  var uv1 : vec2f = uv * 4.0; // Slightly smaller scale
  uv1 = rotate(time * 0.1) * uv1; // Slower rotation
  let noise1 : f32 = fbm(uv1 + vec2f(time * 0.02));

  var uv2 : vec2f = uv * 10.0; // Smaller details
  uv2 = rotate(-time * 0.3) * uv2; // Faster counter-rotation
  let noise2 : f32 = fbm(uv2 + vec2f(-time * 0.05));

  // Combine granulation noise - use power for more contrast
  let granulationNoise : f32 = pow(noise1 * 0.6 + noise2 * 0.4, 1.5);

  // --- Sunspots (Larger scale, slow moving dark patches) ---
  var uvSunspots : vec2f = uv * 1.5; // Large scale
  uvSunspots = rotate(time * 0.05) * uvSunspots; // Very slow rotation
  let sunspotNoise : f32 = fbm(uvSunspots + vec2f(time * 0.01));
  let sunspotMask : f32 = smoothstep(0.3, 0.4, sunspotNoise); // Areas below 0.4 are spots

  // --- Faculae (Bright patches, often near spots or limb) ---
  var uvFaculae : vec2f = uv * 5.0; // Medium scale
  uvFaculae = rotate(time * 0.15) * uvFaculae;
  let faculaeNoise : f32 = fbm(uvFaculae + vec2f(time * 0.03));
  // Make faculae stronger near limb and where sunspot mask is high (edges of spots)
  let faculaeMask : f32 = smoothstep(0.6, 0.7, faculaeNoise) * (limbBrighteningFactor * 0.5 + (1.0 - sunspotMask) * 0.5);

  // --- Heat Wave Distortion (Apply to final noise lookup) ---
  let distortionUv : vec2f = uv * 5.0 + time * 0.1;
  let distortion : vec2f = vec2f(noise(distortionUv), noise(distortionUv + vec2f(5.2, 1.3))) * 0.02; // Slightly less distortion
  let finalNoise : f32 = pow(fbm((uv + distortion) * 4.0 + vec2f(time * 0.02)), 1.5); // Use distorted UVs, add contrast

  // --- Color Palette (Adjusted for more intensity) ---
  let colorDark : vec3f = vec3f(0.6, 0.15, 0.0);  // Darker base for spots/limb
  let colorMid : vec3f = vec3f(1.0, 0.4, 0.0);   // Main orange
  let colorBright : vec3f = vec3f(1.0, 0.8, 0.3); // Bright yellow
  let colorHottest : vec3f = vec3f(1.0, 1.0, 0.8); // Near white

  // Mix colors based on combined granulation noise
  var baseColor : vec3f = mix(colorDark, colorMid, smoothstep(0.2, 0.5, finalNoise));
  baseColor = mix(baseColor, colorBright, smoothstep(0.45, 0.65, finalNoise));
  baseColor = mix(baseColor, colorHottest, smoothstep(0.6, 0.8, finalNoise)); // More range for hottest

  // Apply Sunspots (Darken based on mask)
  baseColor = mix(baseColor, colorDark * 0.5, sunspotMask); // Make spots significantly darker

  // Apply Faculae (Brighten based on mask)
  baseColor = mix(baseColor, colorHottest, faculaeMask * 0.6); // Additive brightening, controlled intensity

  // --- Limb Darkening ---
  baseColor = baseColor * (1.0 - limbDarkeningFactor * 0.7); // Apply darkening
  baseColor = mix(baseColor, colorDark * 0.6, limbDarkeningFactor); // Blend towards dark at edge

  return vec4f(baseColor, 1.0);
}
