import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // For camera control

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101010); // Darker background for space

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 3; // Closer view

// Renderer (WebGL)
const renderer = new THREE.WebGLRenderer({ antialias: true });
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

// Load Textures (High Res)
const earthDayTextureHigh = textureLoader.load('earth_day_8K.jpg');
const earthNightTextureHigh = textureLoader.load('earth_night_8K.jpg');
const earthSpecularMapHigh = textureLoader.load('8k_earth_specular_map.png'); // Use 8k specular map
const earthCloudsTextureHigh = textureLoader.load('earth_clouds_8k.jpg');

// --- Set Texture Properties ---

// Low Res
earthDayTextureLow.wrapS = earthDayTextureLow.wrapT = THREE.RepeatWrapping;
earthNightTextureLow.wrapS = earthNightTextureLow.wrapT = THREE.RepeatWrapping;
earthCloudsTextureLow.wrapS = earthCloudsTextureLow.wrapT = THREE.RepeatWrapping;
earthSpecularMapLow.wrapS = earthSpecularMapLow.wrapT = THREE.RepeatWrapping;
earthDayTextureLow.encoding = THREE.sRGBEncoding;

// High Res
earthDayTextureHigh.wrapS = earthDayTextureHigh.wrapT = THREE.RepeatWrapping;
earthNightTextureHigh.wrapS = earthNightTextureHigh.wrapT = THREE.RepeatWrapping;
earthCloudsTextureHigh.wrapS = earthCloudsTextureHigh.wrapT = THREE.RepeatWrapping;
earthSpecularMapHigh.wrapS = earthSpecularMapHigh.wrapT = THREE.RepeatWrapping;
earthDayTextureHigh.encoding = THREE.sRGBEncoding;


// Earth Geometry (Higher Segments for Displacement, though not used by current shader)
const earthGeometry = new THREE.SphereGeometry(1, 512, 512);


// --- Custom Shader Material for Land/Water Blending ---

const customVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;
    // Calculate world normal (simpler version without modelMatrix for non-scaled/rotated spheres)
    vWorldNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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

  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    // 1. Sample Textures
    vec4 dayColor = texture2D(dayTexture, vUv);
    vec4 nightColor = texture2D(nightTexture, vUv);
    float waterMask = texture2D(specularMap, vUv).r; // Assuming white = water in red channel

    // 2. Calculate Land Color (Day/Night Blend)
    // Use normalized sun direction uniform
    vec3 normalizedSunDir = normalize(sunDirection);
    float landIntensity = max(0.0, dot(vWorldNormal, normalizedSunDir));
    vec3 landBlendedColor = mix(nightColor.rgb * 0.3, dayColor.rgb, landIntensity);

    // 3. Calculate Animated Water Color
    vec2 waveUv = vUv * 5.0 + uTime * 0.15; // Faster wave animation
    float waveNoise = fbm(waveUv);
    vec3 waterNormal = normalize(vWorldNormal + vec3(waveNoise * 0.1, waveNoise * 0.1, 0.0)); // Stronger perturbation
    float waterDiffuse = max(0.0, dot(waterNormal, normalizedSunDir)); // Use perturbed normal for lighting
    // Add some basic specular for water - requires cameraPosition, approximate for now
    // vec3 viewDirection = normalize(cameraPosition - (-vWorldNormal * 1.0)); // Approximate view dir needed for specular
    // vec3 reflectDirection = reflect(-normalizedSunDir, waterNormal);
    // float waterSpecular = pow(max(dot(viewDirection, reflectDirection), 0.0), 16.0); // Basic specular
    float waterSpecular = 0.0; // Placeholder for specular without camera pos
    vec3 baseWaterColor = vec3(0.05, 0.2, 0.4);
    vec3 animatedWaterColor = baseWaterColor * (waterDiffuse * 0.8 + 0.2) + vec3(waterSpecular * 0.3); // Combine diffuse, ambient, specular

    // 4. Blend Land and Water based on Mask
    vec3 finalBlendedColor = mix(landBlendedColor, animatedWaterColor, waterMask);

    // Basic lighting for the final color
    float diffuse = max(0.0, dot(vWorldNormal, normalizedSunDir)) * 0.7 + 0.3; // Add ambient term

    gl_FragColor = vec4(finalBlendedColor * diffuse, 1.0);
  }
`;

const customUniforms = {
    dayTexture: { value: earthDayTextureLow }, // Start with low-res
    nightTexture: { value: earthNightTextureLow }, // Start with low-res
    specularMap: { value: earthSpecularMapLow }, // Start with low-res
    sunDirection: { value: sunLight.position }, // Pass light position directly
    uTime: { value: 0.0 } // Add time uniform
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

// Animation loop
const clock = new THREE.Clock(); // For smooth rotation independent of frame rate

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime(); // Get elapsed time

    // --- LOD Texture Swapping ---
    const zoomThreshold = 2.5; // Distance to switch textures
    const currentDistance = controls.getDistance();
    let needsCloudUpdate = false;

    // Check if high-res is currently active (using one texture as proxy)
    const isHighRes = (customEarthMaterial.uniforms.dayTexture.value === earthDayTextureHigh);

    if (currentDistance < zoomThreshold && !isHighRes) {
        // Switch to High Res
        console.log("Switching to High-Res Textures");
        customEarthMaterial.uniforms.dayTexture.value = earthDayTextureHigh;
        customEarthMaterial.uniforms.nightTexture.value = earthNightTextureHigh;
        customEarthMaterial.uniforms.specularMap.value = earthSpecularMapHigh;
        cloudMaterial.map = earthCloudsTextureHigh;
        needsCloudUpdate = true;
    } else if (currentDistance >= zoomThreshold && isHighRes) {
        // Switch to Low Res
        console.log("Switching to Low-Res Textures");
        customEarthMaterial.uniforms.dayTexture.value = earthDayTextureLow;
        customEarthMaterial.uniforms.nightTexture.value = earthNightTextureLow;
        customEarthMaterial.uniforms.specularMap.value = earthSpecularMapLow;
        cloudMaterial.map = earthCloudsTextureLow;
        needsCloudUpdate = true;
    }

    if (needsCloudUpdate) {
        cloudMaterial.needsUpdate = true; // Important! Tell Three.js the texture changed
    }

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
