// src/shaders.js

// --- Earth Custom Shader ---

export const EARTH_VERTEX_SHADER = `
  attribute vec4 tangent; // Declare tangent attribute

  uniform sampler2D uHeightMap; // Add height map uniform
  uniform float uDisplacementScale; // Add displacement scale uniform

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition; // Pass world position for lighting calculation
  varying mat3 vTBN; // Pass TBN matrix to fragment shader

  void main() {
    vUv = uv;

    // Sample height map
    float displacement = texture2D(uHeightMap, vUv).r; // Use red channel

    // Calculate displaced position
    vec3 displacedPosition = position + normal * displacement * uDisplacementScale;

    // Calculate world position and normal *after* displacement
    vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
    vWorldPosition = worldPosition.xyz;

    // Calculate TBN matrix (Tangent, Bitangent, Normal) in world space
    vec3 worldNormal = normalize( normalMatrix * normal ); // Use original normal for TBN basis
    vec3 worldTangent = normalize( normalMatrix * tangent.xyz );
    vec3 worldBitangent = cross( worldNormal, worldTangent ) * tangent.w; // tangent.w handles handedness
    vTBN = mat3( worldTangent, worldBitangent, worldNormal );

    // Calculate final world normal after displacement (approximation)
    // We use the TBN matrix derived from the *original* geometry for transforming the normal map sample
    // The lighting normal should ideally account for displacement, but this is complex.
    // Using the standard normal for lighting calculation (ignoring displacement for now):
    vWorldNormal = normalize( normalMatrix * normal );

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
  }
`;


// --- Sun Custom Shader ---

export const SUN_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

export const SUN_FRAGMENT_SHADER = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  // Noise functions (copied for clarity, could be imported/shared)
  float random (vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  // 2D Noise based on Morgan McGuire @morgan3d
  // https://www.shadertoy.com/view/4dS3Wd
  float noise (in vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);

      // Four corners in 2D of a tile
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));

      // Smooth Interpolation
      vec2 u = f*f*(3.0-2.0*f);
      // u = smoothstep(0.,1.,f); // Alternative interpolation

      // Mix 4 corners percentages
      return mix(a, b, u.x) +
              (c - a)* u.y * (1.0 - u.x) +
              (d - b) * u.x * u.y;
  }

  // Fractional Brownian Motion
  float fbm (in vec2 st) {
      float value = 0.0;
      float amplitude = .5;
      float frequency = 0.;
      // Loop of octaves
      for (int i = 0; i < 5; i++) { // Reduced octaves slightly
          value += amplitude * noise(st);
          st *= 2.;
          amplitude *= .5;
      }
      return value;
  }

  // Rotation matrix
  mat2 rotate(float angle){
      return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }

  void main() {
    vec2 uv = vUv;
    float time = uTime * 0.05; // Slightly faster base time

    // Calculate distance from center for limb effects
    float edgeFactor = length(uv - 0.5) * 2.0; // Distance from center [0, 1]
    float limbDarkeningFactor = smoothstep(0.6, 1.0, edgeFactor); // More darkening towards edge
    float limbBrighteningFactor = smoothstep(0.8, 0.95, edgeFactor); // Brightening concentrated near the very edge

    // --- Granulation Layers (More contrast, slightly different speeds/scales) ---
    vec2 uv1 = uv * 4.0; // Slightly smaller scale
    uv1 = rotate(time * 0.1) * uv1; // Slower rotation
    float noise1 = fbm(uv1 + vec2(time * 0.02));

    vec2 uv2 = uv * 10.0; // Smaller details
    uv2 = rotate(-time * 0.3) * uv2; // Faster counter-rotation
    float noise2 = fbm(uv2 + vec2(-time * 0.05));

    // Combine granulation noise - use power for more contrast
    float granulationNoise = pow(noise1 * 0.6 + noise2 * 0.4, 1.5);

    // --- Sunspots (Larger scale, slow moving dark patches) ---
    vec2 uvSunspots = uv * 1.5; // Large scale
    uvSunspots = rotate(time * 0.05) * uvSunspots; // Very slow rotation
    float sunspotNoise = fbm(uvSunspots + vec2(time * 0.01));
    float sunspotMask = smoothstep(0.3, 0.4, sunspotNoise); // Areas below 0.4 are spots

    // --- Faculae (Bright patches, often near spots or limb) ---
    vec2 uvFaculae = uv * 5.0; // Medium scale
    uvFaculae = rotate(time * 0.15) * uvFaculae;
    float faculaeNoise = fbm(uvFaculae + vec2(time * 0.03));
    // Make faculae stronger near limb and where sunspot mask is high (edges of spots)
    float faculaeMask = smoothstep(0.6, 0.7, faculaeNoise) * (limbBrighteningFactor * 0.5 + (1.0 - sunspotMask) * 0.5);

    // --- Heat Wave Distortion (Apply to final noise lookup) ---
    vec2 distortionUv = uv * 5.0 + time * 0.1;
    vec2 distortion = vec2(noise(distortionUv), noise(distortionUv + vec2(5.2, 1.3))) * 0.02; // Slightly less distortion
    float finalNoise = pow(fbm((uv + distortion) * 4.0 + vec2(time * 0.02)), 1.5); // Use distorted UVs, add contrast

    // --- Color Palette (Adjusted for more intensity) ---
    vec3 colorDark = vec3(0.6, 0.15, 0.0);  // Darker base for spots/limb
    vec3 colorMid = vec3(1.0, 0.4, 0.0);   // Main orange
    vec3 colorBright = vec3(1.0, 0.8, 0.3); // Bright yellow
    vec3 colorHottest = vec3(1.0, 1.0, 0.8); // Near white

    // Mix colors based on combined granulation noise
    vec3 baseColor = mix(colorDark, colorMid, smoothstep(0.2, 0.5, finalNoise));
    baseColor = mix(baseColor, colorBright, smoothstep(0.45, 0.65, finalNoise));
    baseColor = mix(baseColor, colorHottest, smoothstep(0.6, 0.8, finalNoise)); // More range for hottest

    // Apply Sunspots (Darken based on mask)
    baseColor = mix(baseColor, colorDark * 0.5, sunspotMask); // Make spots significantly darker

    // Apply Faculae (Brighten based on mask)
    baseColor = mix(baseColor, colorHottest, faculaeMask * 0.6); // Additive brightening, controlled intensity

    // --- Limb Darkening ---
    baseColor *= (1.0 - limbDarkeningFactor * 0.7); // Apply darkening
    baseColor = mix(baseColor, colorDark * 0.6, limbDarkeningFactor); // Blend towards dark at edge

    gl_FragColor = vec4(baseColor, 1.0);
  }
`;

export const EARTH_FRAGMENT_SHADER = `
  // Noise functions for water waves
  float noise(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  float fbm(vec2 st) {
      float value = 0.0;
      float amplitude = .5;
      for (int i = 0; i < 4; i++) {
          value += amplitude * noise(st);
          st *= 2.;
          amplitude *= .5;
      }
      return value;
  }

  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform sampler2D specularMap; // Water mask
  uniform vec3 sunDirection; // Restored for DirectionalLight
  uniform float uTime; // Time uniform for animation
  uniform vec3 uCameraPosition; // Need camera position if using view-dependent effects
  uniform sampler2D uNormalMap; // Add normal map uniform
  uniform float uNormalMappingEnabled; // Toggle uniform (0.0 = off, 1.0 = on)
  uniform float uNightBlendFactor;
  uniform float uAmbientFactorBase;
  uniform float uAmbientFactorNormalMap;
  uniform float uDirectFactorBase;
  uniform float uDirectFactorNormalMap;
  uniform float uEnableEnhancedNightLights; // New uniform (0.0 = off, 1.0 = on)


  varying vec2 vUv;
  varying vec3 vWorldNormal; // Normal after displacement (for lighting)
  varying vec3 vWorldPosition; // Receive world position
  varying mat3 vTBN; // Receive TBN matrix

  void main() {
    // 1. Sample Textures
    vec4 dayColor = texture2D(dayTexture, vUv);
    vec4 nightColor = texture2D(nightTexture, vUv);
    float waterMask = texture2D(specularMap, vUv).r; // Assuming white = water in red channel

    // 2. Calculate Normal (conditionally use map)
    vec3 tangentNormal = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0; // Sample and unpack normal map
    vec3 mappedNormal = normalize(vTBN * tangentNormal); // Transform tangent-space normal to world space
    // Mix between geometry normal (vWorldNormal) and mapped normal based on the toggle uniform
    vec3 finalNormal = normalize(mix(vWorldNormal, mappedNormal, uNormalMappingEnabled));

    // 3. Calculate Light Direction (Use uniform for DirectionalLight)
    vec3 normalizedSunDir = normalize(sunDirection);

    // 4. Calculate Land Color (Day/Night Blend) using Final Normal & Light Direction
    float landIntensity = max(0.0, dot(finalNormal, normalizedSunDir));

    // --- Enhanced Night Lights Logic ---
    vec3 nightColorSample = nightColor.rgb;
    // Calculate how much night it is (0 = full day, 1 = full night)
    float nightIntensity = 1.0 - smoothstep(0.0, 0.15, landIntensity); // Sharper transition

    if (uEnableEnhancedNightLights > 0.5) {
        // Example: Increase brightness based on texture and add slight emissiveness
        float baseBrightness = nightColorSample.r + nightColorSample.g + nightColorSample.b; // Simple brightness check
        // Boost brighter spots more in darkness, scale by nightIntensity
        nightColorSample += nightColorSample * 1.5 * nightIntensity * smoothstep(0.1, 0.5, baseBrightness);
        // Add a subtle glow based on brightness, scale by nightIntensity
        nightColorSample += vec3(0.02, 0.02, 0.01) * nightIntensity * baseBrightness;
    }
    // --- End Enhanced Night Lights ---

    vec3 landBlendedColor = mix(nightColorSample * uNightBlendFactor, dayColor.rgb, landIntensity);


    // 5. Calculate Animated Water Color using Normal Map & Light Direction
    vec2 waveUv = vUv * 5.0 + uTime * 0.15; // Faster wave animation
    float waveNoise = fbm(waveUv);
    // Perturb the normal map normal for waves
    vec3 perturbedFinalNormal = normalize(finalNormal + vec3(waveNoise * 0.1, waveNoise * 0.1, 0.0)); // Use finalNormal
    float waterDiffuse = max(0.0, dot(perturbedFinalNormal, normalizedSunDir)); // Use perturbed normal for water lighting
    // Add some basic specular for water - requires cameraPosition, approximate for now
    // vec3 viewDirection = normalize(uCameraPosition - vWorldPosition); // Use actual camera position
    // vec3 reflectDirection = reflect(-normalizedSunDir, perturbedFinalNormal); // Use sun direction
    // float waterSpecular = pow(max(dot(viewDirection, reflectDirection), 0.0), 16.0); // Basic specular
    float waterSpecular = 0.0; // Placeholder for specular
    vec3 baseWaterColor = vec3(0.05, 0.2, 0.4);
    vec3 animatedWaterColor = baseWaterColor * (waterDiffuse * 0.8 + 0.2) + vec3(waterSpecular * 0.3); // Combine diffuse, ambient, specular

    // 6. Calculate Lighting Factor (Reduce ambient term slightly overall)
    float diffuseIntensity = max(0.0, dot(finalNormal, normalizedSunDir));
    float directMultiplier = mix(uDirectFactorBase, uDirectFactorNormalMap, uNormalMappingEnabled);
    float ambientTerm = mix(uAmbientFactorBase, uAmbientFactorNormalMap, uNormalMappingEnabled) * 0.8; // Reduced ambient term
    float diffuse = diffuseIntensity * directMultiplier + ambientTerm; // Overall lighting factor

    // 7. Select Base Texture based on Sun Angle
    vec3 nightTex = nightColorSample * uNightBlendFactor; // Use enhanced night color
    vec3 dayTex = dayColor.rgb;
    // Use smoothstep for a slightly softer transition between day/night textures
    vec3 baseTextureColor = mix(nightTex, dayTex, smoothstep(0.0, 0.1, landIntensity));

    // 8. Blend Base Land/Water Texture
    vec3 blendedBaseColor = mix(baseTextureColor, animatedWaterColor, waterMask);

    // 9. Calculate Lighting Components
    float diffuseIntensity = max(0.0, dot(finalNormal, normalizedSunDir));
    float directMultiplier = mix(uDirectFactorBase, uDirectFactorNormalMap, uNormalMappingEnabled);
    // Reintroduce ambient reduction, maybe slightly less than before
    float ambientTerm = mix(uAmbientFactorBase, uAmbientFactorNormalMap, uNormalMappingEnabled) * 0.7; // e.g., 0.7 instead of 0.8 or 1.0

    // 10. Calculate Combined Lighting Factor
    float combinedLight = ambientTerm + (diffuseIntensity * directMultiplier);

    // 11. Apply Combined Lighting and Clamp
    vec3 litColor = blendedBaseColor * combinedLight;
    vec3 finalColor = clamp(litColor, 0.0, 1.0); // Clamp to prevent over-brightening

    // --- DEBUG ---
    // gl_FragColor = vec4(vec3(combinedLight), 1.0); // Debug combined light factor
    // --- END DEBUG ---

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;


// --- Atmosphere / Glow Shader ---

export const GLOW_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition; // Pass world position

  void main() {
    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
    vWorldPosition = worldPosition.xyz; // Calculate world position

    vNormal = normalize( normalMatrix * normal );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

export const GLOW_FRAGMENT_SHADER = `
  uniform vec3 uCameraPosition; // Get camera position
  uniform vec3 uGlowColor;
  uniform float uGlowIntensity;
  uniform float uGlowExponent;
  uniform float uTime; // Add time uniform for animated noise

  varying vec3 vNormal;
  varying vec3 vWorldPosition; // Receive world position

  // Noise function (can reuse from Sun shader or define here)
  float random (vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  float noise (in vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      vec2 u = f*f*(3.0-2.0*f);
      return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

   float fbm (in vec2 st) {
      float value = 0.0;
      float amplitude = .5;
      for (int i = 0; i < 3; i++) { // Fewer octaves for glow noise
          value += amplitude * noise(st);
          st *= 2.;
          amplitude *= .5;
      }
      return value;
  }


  void main() {
    // Calculate view direction (from surface point to camera)
    vec3 viewDirection = normalize( uCameraPosition - vWorldPosition );

    // Calculate base intensity based on the dot product (rim lighting)
    float rimIntensity = pow( 1.0 - abs( dot( vNormal, viewDirection ) ), uGlowExponent );

    // Calculate noise based on world position projected onto a plane (or use UVs if available/meaningful)
    // Project world position onto XY plane relative to center for noise coordinates
    vec2 noiseCoord = vWorldPosition.xy * 0.1 + uTime * 0.02; // Scale and animate noise lookup
    float glowNoise = fbm(noiseCoord);

    // Modulate intensity and color with noise
    float noiseFactor = 0.7 + glowNoise * 0.6; // Add variation, ensure base intensity > 0
    float finalIntensity = rimIntensity * noiseFactor;

    // Slightly vary color based on noise too (optional)
    vec3 noisyColor = uGlowColor * (0.9 + glowNoise * 0.2);

    gl_FragColor = vec4( noisyColor, finalIntensity * uGlowIntensity );
  }
`;
