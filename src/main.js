// src/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as Config from './config.js';
import * as Shaders from './shaders.js';
import * as Factory from './celestialFactory.js';

// --- Global Variables ---
let scene, camera, renderer, controls, clock, textureLoader;
let sunLight, ambientLight;
let earthMaterial, sunGlowMaterial, atmosphereMaterial; // Materials needing uniform updates
let sunMesh, sunMaterialBasic, sunMaterialShader; // Sun specific objects
let sunShaderEnabled = false; // State for sun shader toggle
let earthMesh, cloudMesh, moonOrbitAnchor, earthSystemAnchor; // Objects needing rotation updates
const planetOrbits = []; // Array to hold { anchor: Object3D, speed: number } - Used for simple rotation
let normalMappingEnabled = Config.EARTH_NORMAL_MAP_TOGGLE_DEFAULT;
let cameraLockedToEarth = true; // Default: Camera follows Earth
const earthWorldPosition = new THREE.Vector3(); // Helper vector
let targetIndicator; // For visualizing the camera target

// --- Physics State ---
let gravitySimulationEnabled = false;
const celestialBodies = []; // Array to hold { name: string, mesh: Object3D, mass: number, position: Vector3, velocity: Vector3 }
const forceVector = new THREE.Vector3(); // Reusable vector for force calculations
const accelerationVector = new THREE.Vector3(); // Reusable vector
const distanceVector = new THREE.Vector3(); // Reusable vector

// Textures (loaded asynchronously)
let textures = {};

// --- Initialization ---

async function init() {
    setupScene();
    setupLighting();
    setupControls();

    try {
        textures = await loadTextures();
        createMaterials();
        createSolarSystem(); // Populates celestialBodies array
        setupEventListeners();
        animate();
    } catch (error) {
        console.error("Initialization failed:", error);
    }
}

function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101010);

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        Config.CAMERA_FAR_PLANE
    );
    camera.position.z = Config.CAMERA_INITIAL_POS_Z;
    camera.position.y = Config.CAMERA_INITIAL_POS_Y;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();
    textureLoader = new THREE.TextureLoader();
}

function setupLighting() {
    ambientLight = new THREE.AmbientLight(0xffffff, Config.AMBIENT_LIGHT_INTENSITY);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xffffff, Config.SUN_LIGHT_INTENSITY);
    sunLight.position.set(
        Config.SUN_LIGHT_POSITION.x,
        Config.SUN_LIGHT_POSITION.y,
        Config.SUN_LIGHT_POSITION.z
    );
    scene.add(sunLight);
}

function setupControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.1; // Allow much closer zoom to Earth
    controls.maxDistance = Config.CONTROLS_MAX_DISTANCE;
}

async function loadTextures() {
    const texturePromises = [
        // Earth Textures
        textureLoader.loadAsync('earth_day.jpg').then(t => ({ key: 'earthDayLow', texture: t })),
        textureLoader.loadAsync('earth_night.jpg').then(t => ({ key: 'earthNightLow', texture: t })),
        textureLoader.loadAsync('2k_earth_specular_map.png').then(t => ({ key: 'earthSpecularLow', texture: t })),
        textureLoader.loadAsync('earth_clouds.jpg').then(t => ({ key: 'earthCloudsLow', texture: t })),
        textureLoader.loadAsync('earth_height_map.png').then(t => ({ key: 'earthHeight', texture: t })),
        textureLoader.loadAsync('2k_earth_normal_map.png').then(t => ({ key: 'earthNormalLow', texture: t })),
        textureLoader.loadAsync('earth_day_8K.jpg').then(t => ({ key: 'earthDayHigh', texture: t })),
        textureLoader.loadAsync('earth_night_8K.jpg').then(t => ({ key: 'earthNightHigh', texture: t })),
        textureLoader.loadAsync('8k_earth_specular_map.png').then(t => ({ key: 'earthSpecularHigh', texture: t })),
        textureLoader.loadAsync('earth_clouds_8k.jpg').then(t => ({ key: 'earthCloudsHigh', texture: t })),
        textureLoader.loadAsync('8k_earth_normal_map.png').then(t => ({ key: 'earthNormalHigh', texture: t })),
        // Sun & Moon
        textureLoader.loadAsync('8k_sun.jpg').then(t => ({ key: 'sun', texture: t })),
        textureLoader.loadAsync('8k_moon.jpg').then(t => ({ key: 'moon', texture: t })),
        // Other Planets (filter out Earth as it's handled separately)
        ...Config.PLANET_DATA.filter(p => p.name !== "Earth").map(p =>
             // Check if textureFile exists before attempting to load
             p.textureFile ? textureLoader.loadAsync(p.textureFile).then(t => ({ key: p.name, texture: t })) : Promise.resolve(null)
        ),
        // Venus Atmosphere (conditional load)
        Config.PLANET_DATA.find(p => p.name === "Venus")?.atmosphereTextureFile
            ? textureLoader.loadAsync(Config.PLANET_DATA.find(p => p.name === "Venus").atmosphereTextureFile).then(t => ({ key: 'venusAtmosphere', texture: t }))
            : Promise.resolve(null) // Resolve immediately if no atmosphere texture
    ];

    const loadedTextures = await Promise.all(texturePromises);
    const textureMap = {};

    loadedTextures.filter(item => item !== null).forEach(item => {
        const { key, texture } = item;
        // Set common properties
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        // Set encoding (most surface textures are sRGB)
        if (key && !key.toLowerCase().includes('specular') && !key.toLowerCase().includes('height') && !key.toLowerCase().includes('normal') && key !== 'venusAtmosphere') {
             texture.encoding = THREE.sRGBEncoding;
        }
        textureMap[key] = texture;
    });

    console.log("Textures loaded:", Object.keys(textureMap));
    return textureMap;
}


function createMaterials() {
    // Earth Material
    const earthUniforms = {
        dayTexture: { value: textures.earthDayLow },
        nightTexture: { value: textures.earthNightLow },
        specularMap: { value: textures.earthSpecularLow },
        uHeightMap: { value: textures.earthHeight },
        uNormalMap: { value: textures.earthNormalLow },
        sunDirection: { value: sunLight.position },
        uTime: { value: 0.0 },
        uDisplacementScale: { value: Config.EARTH_DISPLACEMENT_SCALE },
        uCameraPosition: { value: camera.position },
        uNormalMappingEnabled: { value: normalMappingEnabled ? 1.0 : 0.0 },
        uNightBlendFactor: { value: Config.EARTH_NIGHT_BLEND_FACTOR },
        uAmbientFactorBase: { value: Config.EARTH_SHADER_AMBIENT_FACTOR_BASE },
        uAmbientFactorNormalMap: { value: Config.EARTH_SHADER_AMBIENT_FACTOR_NORMAL_MAP },
        uDirectFactorBase: { value: Config.EARTH_SHADER_DIRECT_FACTOR_BASE },
        uDirectFactorNormalMap: { value: Config.EARTH_SHADER_DIRECT_FACTOR_NORMAL_MAP }
    };
    earthMaterial = Factory.createEarthMaterial(Shaders, earthUniforms);

    // Sun Glow Material
    const sunGlowUniforms = {
        uCameraPosition: { value: camera.position },
        uGlowColor: { value: new THREE.Color(Config.SUN_GLOW_COLOR.r, Config.SUN_GLOW_COLOR.g, Config.SUN_GLOW_COLOR.b) },
        uGlowIntensity: { value: Config.GLOW_INTENSITY_MULTIPLIER },
        uGlowExponent: { value: Config.GLOW_FALLOFF_EXPONENT }
    };
    sunGlowMaterial = Factory.createGlowMaterial(Shaders, sunGlowUniforms);

    // Earth Atmosphere Material
    const atmosphereUniforms = {
        uCameraPosition: { value: camera.position },
        uGlowColor: { value: new THREE.Color(Config.EARTH_ATMOSPHERE_COLOR.r, Config.EARTH_ATMOSPHERE_COLOR.g, Config.EARTH_ATMOSPHERE_COLOR.b) },
        uGlowIntensity: { value: Config.GLOW_INTENSITY_MULTIPLIER },
        uGlowExponent: { value: Config.GLOW_FALLOFF_EXPONENT }
    };
    atmosphereMaterial = Factory.createGlowMaterial(Shaders, atmosphereUniforms);

    // --- Sun Materials (Basic Texture + Custom Shader) ---
    // Basic texture material
    sunMaterialBasic = Factory.createBasicMaterial(textures.sun);

    // Custom shader material
    const sunShaderUniforms = {
        uTime: { value: 0.0 }
        // Add other uniforms like uResolution if needed by the shader
    };
    sunMaterialShader = Factory.createShaderMaterial(
        Shaders.SUN_VERTEX_SHADER,
        Shaders.SUN_FRAGMENT_SHADER,
        sunShaderUniforms
    );
}

function createSolarSystem() {
    // --- Sun ---
    const sunGeometry = Factory.createSphereGeometry(Config.SUN_RADIUS);
    // Use the globally created basic material initially
    // Assign to the global sunMesh variable
    sunMesh = Factory.createMesh(sunGeometry, sunMaterialBasic);
    sunMesh.position.set(0, 0, 0);
    scene.add(sunMesh);
    // Add Sun to physics bodies (fixed position, zero velocity)
    celestialBodies.push({
        name: "Sun",
        mesh: sunMesh, // Reference to the visual mesh
        mass: Config.SUN_MASS,
        position: new THREE.Vector3(0, 0, 0), // Initial position
        velocity: new THREE.Vector3(0, 0, 0)  // Initial velocity
    });

    // Sun Glow
    const sunGlowGeometry = Factory.createSphereGeometry(Config.SUN_RADIUS * Config.SUN_GLOW_RADIUS_FACTOR);
    const sunGlowMesh = Factory.createMesh(sunGlowGeometry, sunGlowMaterial); // Use pre-created material
    sunGlowMesh.position.set(0, 0, 0);
    scene.add(sunGlowMesh);

    // --- Earth System ---
    earthSystemAnchor = Factory.createOrbitAnchor(scene);
    earthSystemAnchor.position.x = Config.EARTH_ORBIT_RADIUS;
    // Add Earth System to physics bodies
    const earthData = Config.PLANET_DATA.find(p => p.name === "Earth");
    celestialBodies.push({
        name: "EarthSystem", // Treat Earth+Moon as one for external gravity
        mesh: earthSystemAnchor, // The anchor is what moves due to physics
        mass: earthData.mass, // Using Earth's mass for the system
        position: new THREE.Vector3(earthSystemAnchor.position.x, earthSystemAnchor.position.y, earthSystemAnchor.position.z), // Initial position from anchor
        velocity: new THREE.Vector3(0, 0, 0) // Initial velocity calculated later if sim enabled
    });

    // Earth
    const earthGeometry = Factory.createSphereGeometry(Config.EARTH_RADIUS);
    earthGeometry.computeTangents(); // Crucial for normal mapping
    earthMesh = Factory.createMesh(earthGeometry, earthMaterial); // Use pre-created material
    earthSystemAnchor.add(earthMesh); // Add Earth to its system anchor

    // Clouds
    const cloudGeometry = Factory.createSphereGeometry(Config.EARTH_RADIUS * Config.CLOUD_ALTITUDE_FACTOR);
    const cloudMaterial = Factory.createPhongMaterial({
        map: textures.earthCloudsLow,
        transparent: true,
        opacity: 0.4,
        depthWrite: false
    });
    cloudMesh = Factory.createMesh(cloudGeometry, cloudMaterial);
    earthMesh.add(cloudMesh); // Attach clouds to Earth

    // Earth Atmosphere
    const atmosphereGeometry = Factory.createSphereGeometry(Config.EARTH_RADIUS * Config.ATMOSPHERE_ALTITUDE_FACTOR);
    const atmosphereMesh = Factory.createMesh(atmosphereGeometry, atmosphereMaterial); // Use pre-created material
    earthMesh.add(atmosphereMesh); // Attach atmosphere to Earth

    // Moon - Its physics relative to Earth isn't simulated here, only simple rotation
    moonOrbitAnchor = Factory.createOrbitAnchor(earthSystemAnchor); // Moon orbits Earth system anchor
    const moonRadius = Config.EARTH_RADIUS * Config.MOON_RADIUS_FACTOR;
    const moonGeometry = Factory.createSphereGeometry(moonRadius);
    const moonMaterial = Factory.createStandardMaterial(textures.moon);
    const moonMesh = Factory.createMesh(moonGeometry, moonMaterial);
    moonMesh.position.x = Config.MOON_ORBIT_RADIUS;
    moonOrbitAnchor.add(moonMesh);

    // --- Other Planets ---
    Config.PLANET_DATA.forEach(data => {
        // Skip Earth as it's handled above
        if (data.name === "Earth") return;

        const planetOrbitAnchor = Factory.createOrbitAnchor(scene);
        const planetRadius = Config.EARTH_RADIUS * data.sizeFactor;
        const planetGeometry = Factory.createSphereGeometry(planetRadius);
        // Ensure texture exists before creating material
        const planetTexture = textures[data.name];
        if (!planetTexture) {
            console.warn(`Texture not found for ${data.name}`);
            return; // Skip this planet if texture is missing
        }
        const planetMaterial = Factory.createStandardMaterial(planetTexture);
        const planetMesh = Factory.createMesh(planetGeometry, planetMaterial);

        // Set initial position based on orbit radius (along X axis for simplicity)
        planetOrbitAnchor.position.x = data.orbitRadius;
        planetOrbitAnchor.add(planetMesh); // Add planet mesh to its anchor

        // Special cases
        if (data.name === "Venus" && data.atmosphereTextureFile && textures.venusAtmosphere) {
            const venusAtmosGeometry = Factory.createSphereGeometry(planetRadius * Config.VENUS_ATMOSPHERE_ALTITUDE_FACTOR);
            const venusAtmosMaterial = Factory.createPhongMaterial({
                map: textures.venusAtmosphere,
                transparent: true,
                opacity: Config.VENUS_ATMOSPHERE_OPACITY,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const venusAtmosMesh = Factory.createMesh(venusAtmosGeometry, venusAtmosMaterial);
            planetMesh.add(venusAtmosMesh); // Attach atmosphere to Venus mesh
        }

        if (data.name === "Saturn" && data.hasRings) {
            const ringInnerRadius = planetRadius * Config.SATURN_RING_INNER_RADIUS_FACTOR;
            const ringOuterRadius = planetRadius * Config.SATURN_RING_OUTER_RADIUS_FACTOR;
            const ringGeometry = Factory.createRingGeometry(ringInnerRadius, ringOuterRadius);
            const ringMaterial = Factory.createStandardMaterial(null, { // No texture for now
                color: Config.SATURN_RING_COLOR,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: Config.SATURN_RING_OPACITY
            });
            const ringMesh = Factory.createMesh(ringGeometry, ringMaterial);
            planetMesh.add(ringMesh); // Attach rings to Saturn mesh
        }

        // Add planet anchor to physics bodies
        celestialBodies.push({
            name: data.name,
            mesh: planetOrbitAnchor, // The anchor moves due to physics
            mass: data.mass,
            position: new THREE.Vector3(planetOrbitAnchor.position.x, planetOrbitAnchor.position.y, planetOrbitAnchor.position.z),
            velocity: new THREE.Vector3(0, 0, 0) // Initial velocity calculated later
        });

        // Store for simple rotation (fallback)
        planetOrbits.push({ anchor: planetOrbitAnchor, speed: data.orbitSpeedFactor });
    });

    // --- Target Indicator ---
    const targetMaterial = new THREE.SpriteMaterial({
        color: 0x00ff00, // Green
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: false, // Keep constant screen size
        depthTest: false // Draw on top
    });
    targetIndicator = new THREE.Sprite(targetMaterial);
    targetIndicator.scale.set(0.03, 0.03, 1); // Adjust size as needed
    targetIndicator.visible = !cameraLockedToEarth; // Initially hidden if locked to Earth
    scene.add(targetIndicator);
}


function setupEventListeners() {
    window.addEventListener('resize', onWindowResize, false);
    // window.addEventListener('keydown', onKeyDown, false); // Replaced by UI buttons

    // Add UI Button Listeners
    const gravityBtn = document.getElementById('toggle-gravity-btn');
    const focusBtn = document.getElementById('toggle-focus-btn');
    const sunShaderBtn = document.getElementById('toggle-sun-shader-btn'); // Get new button

    if (gravityBtn) {
        // Set initial text based on default state
        gravityBtn.textContent = `Gravity: ${gravitySimulationEnabled ? 'On' : 'Off'}`;
        // Add click listener
        gravityBtn.addEventListener('click', () => {
            gravitySimulationEnabled = !gravitySimulationEnabled;
            console.log(`Gravity Simulation ${gravitySimulationEnabled ? 'Enabled' : 'Disabled'}`);
            gravityBtn.textContent = `Gravity: ${gravitySimulationEnabled ? 'On' : 'Off'}`;
            if (gravitySimulationEnabled) {
                // Initialize velocities for circular orbits when starting simulation
                initializeOrbitalVelocities();
            }
            // No need to reset positions when disabling, simple rotation takes over
        });
    } else {
        console.error("Gravity toggle button not found!");
    }

    if (focusBtn) {
        // Set initial text based on default state
        focusBtn.textContent = `Focus: ${cameraLockedToEarth ? 'Earth' : 'Sun'}`;
        // Add click listener
        focusBtn.addEventListener('click', () => {
            cameraLockedToEarth = !cameraLockedToEarth;
            console.log(`Camera Lock to Earth: ${cameraLockedToEarth}`);
            focusBtn.textContent = `Focus: ${cameraLockedToEarth ? 'Earth' : 'Sun'}`;
            if (!cameraLockedToEarth && controls) { // Check if controls exist
                // When unlocking (focusing Sun), immediately reset target to origin
                controls.target.set(0, 0, 0);
            }
            // If locking (focusing Earth), the target will be updated in the animate loop
        });
    } else {
        console.error("Focus toggle button not found!");
    }

    if (sunShaderBtn) {
        // Set initial text
        sunShaderBtn.textContent = `Sun Shader: ${sunShaderEnabled ? 'On' : 'Off'}`;
        // Add click listener
        sunShaderBtn.addEventListener('click', () => {
            if (!sunMesh) {
                console.error("Sun mesh not found for shader toggle!");
                return;
            }
            sunShaderEnabled = !sunShaderEnabled;
            console.log(`Sun Shader ${sunShaderEnabled ? 'Enabled' : 'Disabled'}`);
            sunMesh.material = sunShaderEnabled ? sunMaterialShader : sunMaterialBasic;
            sunShaderBtn.textContent = `Sun Shader: ${sunShaderEnabled ? 'On' : 'Off'}`;
        });
    } else {
        console.error("Sun shader toggle button not found!");
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function initializeOrbitalVelocities() {
    const sun = celestialBodies.find(b => b.name === "Sun");
    if (!sun) {
        console.error("Sun physics body not found for velocity initialization.");
        return;
    }

    celestialBodies.forEach(body => {
        if (body.name === "Sun") return; // Sun doesn't orbit itself

        const radius = body.position.length(); // Distance from Sun (origin)
        if (radius < 0.1) {
             console.warn(`Body ${body.name} too close to origin for velocity calculation.`);
             body.velocity.set(0,0,0); // Set velocity to zero if too close
             return;
        }

        // Calculate speed for circular orbit (v = sqrt(G*M/r))
        const speed = Math.sqrt(Config.GRAVITATIONAL_CONSTANT * sun.mass / radius);

        // Velocity is perpendicular to position vector (tangential)
        // Assuming initial position is along X axis, initial velocity is along Z axis
        // This is an approximation! Real orbits aren't perfectly aligned or circular.
        if (Math.abs(body.position.x) > 0.01 || Math.abs(body.position.y) > 0.01) {
             // If not perfectly on X axis, calculate tangent properly
             const tangent = new THREE.Vector3(-body.position.z, 0, body.position.x).normalize(); // Perpendicular in XZ plane
             body.velocity.copy(tangent).multiplyScalar(speed);
        } else {
             // If on (or very close to) X axis, use simple Z velocity
             body.velocity.set(0, 0, -speed); // Negative Z for counter-clockwise orbit
        }

    });
    console.log("Initialized orbital velocities for gravity simulation.");
}


function onKeyDown(event) {
    if (event.key === 'n' || event.key === 'N') {
        normalMappingEnabled = !normalMappingEnabled;
        console.log(`Normal Mapping ${normalMappingEnabled ? 'Enabled' : 'Disabled'}`);
        earthMaterial.uniforms.uNormalMappingEnabled.value = normalMappingEnabled ? 1.0 : 0.0;
    }
    /* // Replaced by UI button
    else if (event.key === 'c' || event.key === 'C') {
        cameraLockedToEarth = !cameraLockedToEarth;
        console.log(`Camera Lock to Earth: ${cameraLockedToEarth}`);
        if (!cameraLockedToEarth && controls) { // Check if controls exist
            // When unlocking, immediately reset target to origin
            controls.target.set(0, 0, 0);
        }
        // If locking, the target will be updated in the animate loop
    }
    */
    /* // Replaced by UI button
    else if (event.key === 'g' || event.key === 'G') {
        gravitySimulationEnabled = !gravitySimulationEnabled;
        console.log(`Gravity Simulation ${gravitySimulationEnabled ? 'Enabled' : 'Disabled'}`);
        if (gravitySimulationEnabled) {
            // Initialize velocities for circular orbits when starting simulation
            initializeOrbitalVelocities();
        }
        // No need to reset positions when disabling, simple rotation takes over
    }
    */
}

// --- Physics Calculation ---
function updatePhysics(delta) {
    // Limit delta to prevent instability with large steps
    const dt = Math.min(delta, 0.016); // Clamp delta time (e.g., max 60fps step)
    const bodiesToUpdate = celestialBodies.filter(b => b.name !== "Sun"); // Exclude Sun from being moved

    // Calculate forces
    bodiesToUpdate.forEach(bodyI => {
        forceVector.set(0, 0, 0); // Reset net force for bodyI

        celestialBodies.forEach(bodyJ => {
            if (bodyI === bodyJ) return; // Don't calculate force on self

            distanceVector.subVectors(bodyJ.position, bodyI.position);
            const distanceSq = distanceVector.lengthSq();

            // Avoid division by zero and extreme forces at close range
            // Use a small epsilon squared for the check
            const epsilonSq = 0.1 * 0.1;
            if (distanceSq < epsilonSq) return;

            const forceMagnitude = Config.GRAVITATIONAL_CONSTANT * bodyI.mass * bodyJ.mass / distanceSq;
            forceVector.add(distanceVector.normalize().multiplyScalar(forceMagnitude));
        });

        // Update velocity (Euler integration)
        accelerationVector.copy(forceVector).divideScalar(bodyI.mass);
        bodyI.velocity.add(accelerationVector.multiplyScalar(dt)); // Use clamped dt
    });

    // Update positions (Euler integration)
    bodiesToUpdate.forEach(body => {
        body.position.add(body.velocity.clone().multiplyScalar(dt)); // Use clamped dt
        body.mesh.position.copy(body.position); // Update the visual mesh position
    });
}


// --- Animation Loop ---

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    // Clamp delta to avoid large jumps if tab loses focus
    const dt = Math.min(delta, 0.016); // Use clamped delta for rotations too
    const elapsedTime = clock.getElapsedTime();

    // Update camera target based on lock state
    if (cameraLockedToEarth && earthMesh && controls) { // Check if objects exist
        earthMesh.getWorldPosition(earthWorldPosition); // Get Earth's current world position
        controls.target.copy(earthWorldPosition); // Set OrbitControls target
    }
    // Note: When unlocking, the target is reset in onKeyDown.

    // Update controls AFTER potentially changing the target
    controls.update();

    // Update target indicator position and visibility
    if (targetIndicator) {
        targetIndicator.position.copy(controls.target);
        targetIndicator.visible = !cameraLockedToEarth; // Only show when target might not be Earth
    }

    // Update uniforms
    earthMaterial.uniforms.uTime.value = elapsedTime;
    earthMaterial.uniforms.uCameraPosition.value.copy(camera.position);
    sunGlowMaterial.uniforms.uCameraPosition.value.copy(camera.position);
    atmosphereMaterial.uniforms.uCameraPosition.value.copy(camera.position);
    // Update Sun shader time uniform if active
    if (sunShaderEnabled && sunMaterialShader) {
        sunMaterialShader.uniforms.uTime.value = elapsedTime;
    }

    // LOD Check (Simplified - only for Earth currently)
    const currentDistance = controls.getDistance(); // Or distance to Earth specifically
    const isHighRes = (earthMaterial.uniforms.dayTexture.value === textures.earthDayHigh);
    let needsEarthMaterialUpdate = false;

    if (currentDistance < Config.LOD_ZOOM_THRESHOLD && !isHighRes) {
        // console.log("Switching Earth to High-Res Textures");
        earthMaterial.uniforms.dayTexture.value = textures.earthDayHigh;
        earthMaterial.uniforms.nightTexture.value = textures.earthNightHigh;
        earthMaterial.uniforms.specularMap.value = textures.earthSpecularHigh;
        earthMaterial.uniforms.uNormalMap.value = textures.earthNormalHigh;
        if (cloudMesh && cloudMesh.material) cloudMesh.material.map = textures.earthCloudsHigh; // Check existence
        needsEarthMaterialUpdate = true;
    } else if (currentDistance >= Config.LOD_ZOOM_THRESHOLD && isHighRes) {
        // console.log("Switching Earth to Low-Res Textures");
        earthMaterial.uniforms.dayTexture.value = textures.earthDayLow;
        earthMaterial.uniforms.nightTexture.value = textures.earthNightLow;
        earthMaterial.uniforms.specularMap.value = textures.earthSpecularLow;
        earthMaterial.uniforms.uNormalMap.value = textures.earthNormalLow;
         if (cloudMesh && cloudMesh.material) cloudMesh.material.map = textures.earthCloudsLow; // Check existence
        needsEarthMaterialUpdate = true;
    }

    if (needsEarthMaterialUpdate && cloudMesh && cloudMesh.material) { // Check existence
        cloudMesh.material.needsUpdate = true;
    }


    // --- Motion ---
    if (gravitySimulationEnabled) {
        updatePhysics(dt); // Update positions based on gravity
    }

    // Simple Rotations (always run, physics overrides position if enabled)
    if (earthMesh) earthMesh.rotation.y += Config.EARTH_ROTATION_SPEED * dt;
    if (cloudMesh) cloudMesh.rotation.y += (Config.CLOUD_ROTATION_SPEED - Config.EARTH_ROTATION_SPEED) * dt; // Rotate relative to Earth's rotation
    if (moonOrbitAnchor) moonOrbitAnchor.rotation.y += Config.MOON_ORBIT_SPEED * dt;

    // Rotate anchors for simple orbits (only visually effective if physics is off)
    if (!gravitySimulationEnabled) {
        if (earthSystemAnchor) earthSystemAnchor.rotation.y += Config.EARTH_ORBIT_SPEED * Config.SOLAR_SYSTEM_ORBIT_SPEED_FACTOR * dt;
        planetOrbits.forEach(orbit => {
            orbit.anchor.rotation.y += orbit.speed * Config.SOLAR_SYSTEM_ORBIT_SPEED_FACTOR * dt;
        });
    }


    // Render
    renderer.render(scene, camera);
}

// --- Start ---
init();
