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
