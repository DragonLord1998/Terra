import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // For camera control

// --- Global Settings ---
let normalMappingEnabled = false; // Toggle for normal mapping

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101010); // Darker background for space

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 3; // Closer view

// Renderer (WebGL)
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputEncoding = THREE.sRGBEncoding; // Correct output color space
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth camera movement
controls.minDistance = 1.5;
controls.maxDistance = 10;

// Lighting
// Ambient light to softly illuminate the dark side
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

// Directional light simulating the sun
const sunLight = new THREE.DirectionalLight(0xffffff, 3.0); // Stronger sun
sunLight.position.set(5, 3, 5); // Position the sun
scene.add(sunLight);

// Texture Loader
const textureLoader = new THREE.TextureLoader();

// Load Textures (Low Res)
const earthDayTextureLow = textureLoader.load('earth_day.jpg');
const earthNightTextureLow = textureLoader.load('earth_night.jpg');
const earthSpecularMapLow = textureLoader.load('2k_earth_specular_map.png'); // Used as water mask
const earthCloudsTextureLow = textureLoader.load('earth_clouds.jpg');
const earthHeightMapTexture = textureLoader.load('earth_height_map.png'); // Load Height Map
const earthNormalMapLow = textureLoader.load('2k_earth_normal_map.png'); // Load Normal Map Low Res

// Load Textures (High Res)
const earthDayTextureHigh = textureLoader.load('earth_day_8K.jpg');
const earthNightTextureHigh = textureLoader.load('earth_night_8K.jpg');
const earthSpecularMapHigh = textureLoader.load('8k_earth_specular_map.png'); // Use 8k specular map
const earthCloudsTextureHigh = textureLoader.load('earth_clouds_8k.jpg');
const earthNormalMapHigh = textureLoader.load('8k_earth_normal_map.png'); // Load Normal Map High Res

// --- Set Texture Properties ---

// Low Res
earthDayTextureLow.wrapS = earthDayTextureLow.wrapT = THREE.RepeatWrapping;
earthNightTextureLow.wrapS = earthNightTextureLow.wrapT = THREE.RepeatWrapping;
earthCloudsTextureLow.wrapS = earthCloudsTextureLow.wrapT = THREE.RepeatWrapping;
earthSpecularMapLow.wrapS = earthSpecularMapLow.wrapT = THREE.RepeatWrapping;
earthHeightMapTexture.wrapS = earthHeightMapTexture.wrapT = THREE.RepeatWrapping; // Set wrapping for height map
earthNormalMapLow.wrapS = earthNormalMapLow.wrapT = THREE.RepeatWrapping; // Set wrapping for normal map
earthDayTextureLow.encoding = THREE.sRGBEncoding;

// High Res
earthDayTextureHigh.wrapS = earthDayTextureHigh.wrapT = THREE.RepeatWrapping;
earthNightTextureHigh.wrapS = earthNightTextureHigh.wrapT = THREE.RepeatWrapping;
earthCloudsTextureHigh.wrapS = earthCloudsTextureHigh.wrapT = THREE.RepeatWrapping;
earthSpecularMapHigh.wrapS = earthSpecularMapHigh.wrapT = THREE.RepeatWrapping;
earthNormalMapHigh.wrapS = earthNormalMapHigh.wrapT = THREE.RepeatWrapping; // Set wrapping for normal map
earthDayTextureHigh.encoding = THREE.sRGBEncoding;


// Earth Geometry (Higher Segments for Displacement)
const earthGeometry = new THREE.SphereGeometry(1, 512, 512);
earthGeometry.computeTangents(); // Compute tangents for normal mapping


// --- Custom Shader Material for Land/Water Blending ---

const customVertexShader = `
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

const customFragmentShader = `
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
    vec3 landBlendedColor = mix(nightColor.rgb * 0.3, dayColor.rgb, landIntensity);

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
    float directMultiplier = mix(0.7, 0.6, uNormalMappingEnabled); // Use 0.7 normally, 0.6 when normal map is on
    float ambientTerm = mix(0.3, 0.25, uNormalMappingEnabled); // Reduce ambient when normal map is on
    float diffuse = diffuseIntensity * directMultiplier + ambientTerm;

    gl_FragColor = vec4(finalBlendedColor * diffuse, 1.0);
  }
`;

const customUniforms = {
    dayTexture: { value: earthDayTextureLow }, // Start with low-res
    nightTexture: { value: earthNightTextureLow }, // Start with low-res
    specularMap: { value: earthSpecularMapLow }, // Start with low-res
    sunDirection: { value: sunLight.position }, // Pass light position directly
    uTime: { value: 0.0 }, // Add time uniform
    uHeightMap: { value: earthHeightMapTexture }, // Add height map texture uniform
    uDisplacementScale: { value: 0.02 }, // Add displacement scale uniform (adjust as needed)
    uCameraPosition: { value: camera.position }, // Pass camera position
    uNormalMap: { value: earthNormalMapLow }, // Add normal map uniform, start with low-res
    uNormalMappingEnabled: { value: 0.0 } // Add toggle uniform, default off
};

const customEarthMaterial = new THREE.ShaderMaterial({
    vertexShader: customVertexShader,
    fragmentShader: customFragmentShader,
    uniforms: customUniforms,
});


// Earth Mesh
const earthMesh = new THREE.Mesh(earthGeometry, customEarthMaterial); // Use the new custom material
scene.add(earthMesh);


// Cloud Layer Geometry
const cloudGeometry = new THREE.SphereGeometry(1.02, 512, 512); // Slightly larger

// Cloud Material
const cloudMaterial = new THREE.MeshPhongMaterial({ // Phong for potential specular highlights on clouds
    map: earthCloudsTextureLow, // Start with low-res
    transparent: true,
    opacity: 0.4, // Reduce opacity to make clouds fainter
    // blending: THREE.AdditiveBlending, // Experiment with blending
    depthWrite: false // Render clouds after Earth
});

// Cloud Mesh
const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
scene.add(cloudMesh);


// --- Atmospheric Glow ---

const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition; // Pass world position

  void main() {
    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
    vWorldPosition = worldPosition.xyz; // Calculate world position

    vNormal = normalize( normalMatrix * normal );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

const atmosphereFragmentShader = `
  uniform vec3 uCameraPosition; // Get camera position
  varying vec3 vNormal;
  varying vec3 vWorldPosition; // Receive world position

  void main() {
    // Calculate view direction (from surface point to camera)
    vec3 viewDirection = normalize( uCameraPosition - vWorldPosition );

    // Calculate intensity based on the dot product of the normal and view direction
    // Closer to 0 means closer to the edge (grazing angle)
    float intensity = pow( 1.0 - abs( dot( vNormal, viewDirection ) ), 3.0 ); // Adjust exponent (e.g., 3.0) for falloff

    vec3 glowColor = vec3(0.3, 0.6, 1.0); // Soft blue glow

    gl_FragColor = vec4( glowColor, intensity * 0.8 ); // Multiply intensity to control brightness (e.g., 0.8)
  }
`;

const atmosphereMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uCameraPosition: { value: camera.position } // Add camera position uniform
  },
  vertexShader: atmosphereVertexShader,
  fragmentShader: atmosphereFragmentShader,
  blending: THREE.AdditiveBlending,
  side: THREE.BackSide, // Render the inside facing towards the sphere
  transparent: true,
  depthWrite: false
});

const atmosphereGeometry = new THREE.SphereGeometry(1.04, 512, 512); // Slightly larger than clouds
const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
scene.add(atmosphereMesh);


// Handle window resize
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Keyboard listener for toggle
window.addEventListener('keydown', (event) => {
    if (event.key === 'n' || event.key === 'N') {
        normalMappingEnabled = !normalMappingEnabled;
        console.log(`Normal Mapping ${normalMappingEnabled ? 'Enabled' : 'Disabled'}`);
        // Update the shader uniform immediately
        customEarthMaterial.uniforms.uNormalMappingEnabled.value = normalMappingEnabled ? 1.0 : 0.0;
    }
});

// Animation loop
const clock = new THREE.Clock(); // For smooth rotation independent of frame rate

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime(); // Get elapsed time

    // --- LOD Texture Swapping ---
    const zoomThreshold = 2.5; // Distance to switch textures
    const currentDistance = controls.getDistance();
    let needsMaterialUpdate = false; // Flag for any material update

    // Check if high-res is currently active (using one texture as proxy)
    const isHighRes = (customEarthMaterial.uniforms.dayTexture.value === earthDayTextureHigh);

    if (currentDistance < zoomThreshold && !isHighRes) {
        // Switch to High Res
        console.log("Switching to High-Res Textures");
        customEarthMaterial.uniforms.dayTexture.value = earthDayTextureHigh;
        customEarthMaterial.uniforms.nightTexture.value = earthNightTextureHigh;
        customEarthMaterial.uniforms.specularMap.value = earthSpecularMapHigh;
        customEarthMaterial.uniforms.uNormalMap.value = earthNormalMapHigh; // Switch normal map
        cloudMaterial.map = earthCloudsTextureHigh;
        needsMaterialUpdate = true;
    } else if (currentDistance >= zoomThreshold && isHighRes) {
        // Switch to Low Res
        console.log("Switching to Low-Res Textures");
        customEarthMaterial.uniforms.dayTexture.value = earthDayTextureLow;
        customEarthMaterial.uniforms.nightTexture.value = earthNightTextureLow;
        customEarthMaterial.uniforms.specularMap.value = earthSpecularMapLow;
        customEarthMaterial.uniforms.uNormalMap.value = earthNormalMapLow; // Switch normal map
        cloudMaterial.map = earthCloudsTextureLow;
        needsMaterialUpdate = true;
    }

    if (needsMaterialUpdate) {
        cloudMaterial.needsUpdate = true; // Update cloud material if its map changed
        // customEarthMaterial.needsUpdate = true; // Shader uniforms update automatically, no need for this
    }

    // Note: This check was originally for needsCloudUpdate, but cloudMaterial.needsUpdate is now handled
    // within the needsMaterialUpdate block above. This if-statement might be redundant now
    // unless other logic specifically required needsCloudUpdate. Keeping it commented out for now.
    // if (needsMaterialUpdate) { // Corrected variable name, but logic might be redundant
    //     cloudMaterial.needsUpdate = true; // Important! Tell Three.js the texture changed
    // }

    // Update atmosphere camera position uniform
    atmosphereMaterial.uniforms.uCameraPosition.value.copy(camera.position);

    // Update time uniform for water animation
    customEarthMaterial.uniforms.uTime.value = elapsedTime;

    // Rotate Earth
    earthMesh.rotation.y += 0.1 * delta; // Slower rotation

    // Rotate Clouds slightly faster/different
    cloudMesh.rotation.y += 0.12 * delta;

    // Update controls for damping
    controls.update();

    // Update sun direction uniform if light moves (optional)
    // customEarthMaterial.uniforms.sunDirection.value.copy(sunLight.position);

    renderer.render(scene, camera);
}

animate();
