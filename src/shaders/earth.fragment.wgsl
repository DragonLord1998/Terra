// src/shaders/earth.fragment.wgsl
// WGSL translation attempt for Earth Fragment Shader

// Input from Vertex Shader
struct VertexOutput {
  @builtin(position) clipPosition : vec4f,
  @location(0) uv : vec2f,
  @location(1) worldNormal : vec3f, // Original world normal for lighting basis
  @location(2) worldPosition : vec3f,
  @location(3) tbn : mat3x3f, // TBN matrix for normal mapping
};

// Uniforms (Combine Scene and Custom into one UBO for simplicity, adjust bindings)
struct SceneUniforms {
  // Assuming cameraPosition is provided here by Babylon
  cameraPosition: vec3f,
};
@group(0) @binding(0) var<uniform> scene : SceneUniforms;

// Custom Material Uniforms
struct MaterialUniforms {
  sunDirection : vec3f, // Direction TO the sun
  time : f32,
  normalMappingEnabled : f32, // Use f32 for bool-like toggle (0.0 or 1.0)
  nightBlendFactor : f32,
  ambientFactorBase : f32,
  ambientFactorNormalMap : f32,
  directFactorBase : f32,
  directFactorNormalMap : f32,
  enableEnhancedNightLights : f32, // Use f32 for bool-like toggle
};
@group(0) @binding(1) var<uniform> material : MaterialUniforms; // Use different binding index

// Textures and Samplers (Group 1)
@group(1) @binding(0) var defaultSampler: sampler; // Assuming one sampler for all for now
@group(1) @binding(1) var dayTexture: texture_2d<f32>;
@group(1) @binding(2) var nightTexture: texture_2d<f32>;
@group(1) @binding(3) var specularMap: texture_2d<f32>; // Water mask
@group(1) @binding(4) var normalMap: texture_2d<f32>;

// --- Noise Functions (Direct Translation) ---
fn noise(st : vec2f) -> f32 {
  // Basic pseudo-random noise (replace with better hash if needed)
  return fract(sin(dot(st, vec2f(12.9898, 78.233))) * 43758.5453);
}

fn fbm(st : vec2f) -> f32 {
  var value : f32 = 0.0;
  var amplitude : f32 = 0.5;
  var current_st = st; // Need mutable copy
  for (var i : i32 = 0; i < 4; i = i + 1) {
    value = value + amplitude * noise(current_st);
    current_st = current_st * 2.0;
    amplitude = amplitude * 0.5;
  }
  return value;
}

// --- Main Fragment Shader ---
@fragment
fn main(input : VertexOutput) -> @location(0) vec4f {

  // 1. Sample Textures
  let dayColorSample : vec4f = textureSample(dayTexture, defaultSampler, input.uv);
  let nightColorSample : vec4f = textureSample(nightTexture, defaultSampler, input.uv);
  // Assuming white = water in red channel of specular map
  let waterMask : f32 = textureSample(specularMap, defaultSampler, input.uv).r;

  // 2. Calculate Normal (conditionally use map)
  // Sample and unpack normal map (-1 to 1 range)
  let tangentNormal : vec3f = textureSample(normalMap, defaultSampler, input.uv).xyz * 2.0 - 1.0;
  // Transform tangent-space normal to world space using TBN matrix
  let mappedNormal : vec3f = normalize(input.tbn * tangentNormal);
  // Mix between geometry normal (input.worldNormal) and mapped normal based on the toggle uniform
  let finalNormal : vec3f = normalize(mix(input.worldNormal, mappedNormal, material.normalMappingEnabled));

  // 3. Calculate Light Direction (using uniform)
  // Ensure sun direction is normalized (should be done in JS ideally, but normalize here too)
  let normalizedSunDir : vec3f = normalize(material.sunDirection);

  // 4. Calculate Land Color (Day/Night Blend) using Final Normal & Light Direction
  // NdotL - basic diffuse lighting factor
  let landIntensity : f32 = max(0.0, dot(finalNormal, normalizedSunDir));

  // --- Enhanced Night Lights Logic ---
  var nightColorRgb = nightColorSample.rgb;
  // Calculate how much night it is (0 = full day, 1 = full night)
  let nightFactor : f32 = 1.0 - smoothstep(0.0, 0.15, landIntensity); // Sharper transition

  if (material.enableEnhancedNightLights > 0.5) {
      // Example: Increase brightness based on texture and add slight emissiveness
      let baseBrightness : f32 = nightColorRgb.r + nightColorRgb.g + nightColorRgb.b; // Simple brightness check
      // Boost brighter spots more in darkness, scale by nightFactor
      nightColorRgb = nightColorRgb + nightColorRgb * 1.5 * nightFactor * smoothstep(0.1, 0.5, baseBrightness);
      // Add a subtle glow based on brightness, scale by nightFactor
      nightColorRgb = nightColorRgb + vec3f(0.02, 0.02, 0.01) * nightFactor * baseBrightness;
  }
  // --- End Enhanced Night Lights ---

  // Blend day/night textures based on lighting intensity
  // Use the potentially enhanced nightColorRgb
  let landBlendedColor : vec3f = mix(nightColorRgb * material.nightBlendFactor, dayColorSample.rgb, smoothstep(0.0, 0.05, landIntensity)); // Sharper transition

  // 5. Calculate Animated Water Color using Normal Map & Light Direction
  let waveUv : vec2f = input.uv * 5.0 + material.time * 0.15; // Faster wave animation
  let waveNoise : f32 = fbm(waveUv);
  // Perturb the final normal for waves (simple approximation)
  let perturbedFinalNormal : vec3f = normalize(finalNormal + vec3f(waveNoise * 0.1, waveNoise * 0.1, 0.0));
  // Use perturbed normal for water lighting diffuse term
  let waterDiffuse : f32 = max(0.0, dot(perturbedFinalNormal, normalizedSunDir));

  // Basic specular for water (requires view direction)
  let viewDirection : vec3f = normalize(scene.cameraPosition - input.worldPosition);
  let reflectDirection : vec3f = reflect(-normalizedSunDir, perturbedFinalNormal);
  // Use pow with f32 arguments
  let waterSpecular : f32 = pow(max(dot(viewDirection, reflectDirection), 0.0), 8.0); // Lowered exponent for roughness

  let baseWaterColor : vec3f = vec3f(0.05, 0.2, 0.4);
  // Combine diffuse, ambient (approximated), specular for water
  let animatedWaterColor : vec3f = baseWaterColor * (waterDiffuse * 0.8 + 0.2) + vec3f(waterSpecular * 0.05); // Further lowered intensity

  // 6. Calculate Final Lighting Factor (Ambient + Diffuse)
  let diffuseIntensity : f32 = max(0.0, dot(finalNormal, normalizedSunDir)); // NdotL using final normal
  let directMultiplier : f32 = mix(material.directFactorBase, material.directFactorNormalMap, material.normalMappingEnabled);
  let ambientTerm : f32 = mix(material.ambientFactorBase, material.ambientFactorNormalMap, material.normalMappingEnabled) * 0.7; // Reduced ambient
  let combinedLight : f32 = diffuseIntensity * directMultiplier; // Removed ambientTerm

  // 7. Blend Base Land/Water Color based on water mask
  let blendedBaseColor : vec3f = mix(landBlendedColor, animatedWaterColor, waterMask);

  // 8. Apply Combined Lighting and Clamp
  let litColor : vec3f = blendedBaseColor * combinedLight;
  let finalColor : vec3f = clamp(litColor, vec3f(0.0), vec3f(1.0)); // Clamp to [0, 1] range

  return vec4f(finalColor, 1.0); // Output final color with full alpha
}
