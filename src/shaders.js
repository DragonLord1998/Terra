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
    // Using the displaced normal directly for lighting:
    vWorldNormal = normalize( normalMatrix * (normal * (1.0 + displacement * uDisplacementScale)) );

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
    float time = uTime * 0.03; // Significantly slowed down time

    // --- Granulation Layers ---
    // Layer 1: Larger, slower cells
    vec2 uv1 = uv * 3.0; // Scale for larger features
    uv1 = rotate(time * 0.2) * uv1; // Slow rotation
    float noise1 = fbm(uv1 + vec2(time * 0.05)); // Slow movement

    // Layer 2: Smaller, faster details overlay
    vec2 uv2 = uv * 8.0; // Scale for smaller features
    uv2 = rotate(-time * 0.5) * uv2; // Faster counter-rotation
    float noise2 = fbm(uv2 + vec2(-time * 0.1)); // Faster movement

    // Combine noise layers
    float combinedNoise = noise1 * 0.6 + noise2 * 0.4;

    // --- Heat Wave Distortion --- (Subtler)
    vec2 distortionUv = uv * 4.0 + time * 0.2;
    vec2 distortion = vec2(noise(distortionUv), noise(distortionUv + vec2(5.2, 1.3))) * 0.03; // Reduced distortion amount
    float finalNoise = fbm((uv + distortion) * 3.0 + vec2(time * 0.05)); // Re-sample combined noise scale with distortion

    // --- Color Palette ---
    vec3 color1 = vec3(0.8, 0.3, 0.0); // Deep Orange/Red
    vec3 color2 = vec3(1.0, 0.6, 0.0); // Bright Orange
    vec3 color3 = vec3(1.0, 0.9, 0.5); // Bright Yellow/White

    // Mix colors based on final noise value
    vec3 color = mix(color1, color2, smoothstep(0.3, 0.55, finalNoise));
    color = mix(color, color3, smoothstep(0.5, 0.7, finalNoise)); // Less dominant bright highlights

    // --- Subtle Sparks (Less frequent, less flickery) ---
    float sparkNoise = noise(uv * 15.0 + time * 0.5); // Different scale/speed for sparks
    float sparkThreshold = 0.95; // Higher threshold = fewer sparks
    if (sparkNoise > sparkThreshold) {
        float sparkIntensity = smoothstep(sparkThreshold, 1.0, sparkNoise);
        // Use noise value itself for intensity, avoid sin modulation
        color = mix(color, vec3(1.0, 1.0, 0.9), sparkIntensity * 0.5); // Less intense white sparks
    }

    // --- Limb Darkening --- (More pronounced)
    float edgeFactor = length(uv - 0.5) * 2.0; // Distance from center [0, 1]
    edgeFactor = smoothstep(0.6, 1.0, edgeFactor); // Apply darkening more towards the edge
    color *= (1.0 - edgeFactor * 0.6); // Stronger darkening effect
    color = mix(color, color1 * 0.5, edgeFactor); // Shift edge color towards darker base

    gl_FragColor = vec4(color, 1.0);
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
  uniform vec3 sunDirection;
  uniform float uTime; // Time uniform for animation
  uniform vec3 uCameraPosition; // Need camera position if using view-dependent effects
  uniform sampler2D uNormalMap; // Add normal map uniform
  uniform float uNormalMappingEnabled; // Toggle uniform (0.0 = off, 1.0 = on)
  uniform float uNightBlendFactor;
  uniform float uAmbientFactorBase;
  uniform float uAmbientFactorNormalMap;
  uniform float uDirectFactorBase;
  uniform float uDirectFactorNormalMap;


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

    // 3. Calculate Land Color (Day/Night Blend) using Final Normal
    vec3 normalizedSunDir = normalize(sunDirection);
    float landIntensity = max(0.0, dot(finalNormal, normalizedSunDir)); // Use normal map normal for lighting
    vec3 landBlendedColor = mix(nightColor.rgb * uNightBlendFactor, dayColor.rgb, landIntensity);

    // 4. Calculate Animated Water Color using Normal Map
    vec2 waveUv = vUv * 5.0 + uTime * 0.15; // Faster wave animation
    float waveNoise = fbm(waveUv);
    // Perturb the normal map normal for waves
    vec3 perturbedFinalNormal = normalize(finalNormal + vec3(waveNoise * 0.1, waveNoise * 0.1, 0.0));
    float waterDiffuse = max(0.0, dot(perturbedFinalNormal, normalizedSunDir)); // Use perturbed normal map normal for lighting
    // Add some basic specular for water - requires cameraPosition, approximate for now
    // vec3 viewDirection = normalize(uCameraPosition - vWorldPosition); // Use actual camera position
    // vec3 reflectDirection = reflect(-normalizedSunDir, perturbedFinalNormal);
    // float waterSpecular = pow(max(dot(viewDirection, reflectDirection), 0.0), 16.0); // Basic specular
    float waterSpecular = 0.0; // Placeholder for specular
    vec3 baseWaterColor = vec3(0.05, 0.2, 0.4);
    vec3 animatedWaterColor = baseWaterColor * (waterDiffuse * 0.8 + 0.2) + vec3(waterSpecular * 0.3); // Combine diffuse, ambient, specular

    // 5. Blend Land and Water based on Mask
    vec3 finalBlendedColor = mix(landBlendedColor, animatedWaterColor, waterMask);

    // 6. Apply overall lighting using the final normal
    float diffuseIntensity = max(0.0, dot(finalNormal, normalizedSunDir));
    // Reduce direct light contribution slightly when normal mapping is on to avoid washout
    float directMultiplier = mix(uDirectFactorBase, uDirectFactorNormalMap, uNormalMappingEnabled);
    float ambientTerm = mix(uAmbientFactorBase, uAmbientFactorNormalMap, uNormalMappingEnabled);
    float diffuse = diffuseIntensity * directMultiplier + ambientTerm;

    gl_FragColor = vec4(finalBlendedColor * diffuse, 1.0);
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

  varying vec3 vNormal;
  varying vec3 vWorldPosition; // Receive world position

  void main() {
    // Calculate view direction (from surface point to camera)
    vec3 viewDirection = normalize( uCameraPosition - vWorldPosition );

    // Calculate intensity based on the dot product of the normal and view direction
    float intensity = pow( 1.0 - abs( dot( vNormal, viewDirection ) ), uGlowExponent );

    gl_FragColor = vec4( uGlowColor, intensity * uGlowIntensity );
  }
`;
