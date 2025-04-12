// src/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as Config from './config.js';
import * as Shaders from './shaders.js';
import * as Factory from './celestialFactory.js';
import PhysicsEngine from './PhysicsEngine.js';
import SolarSystemBuilder from './SolarSystemBuilder.js';
import FlareSystem from './FlareSystem.js'; // Import FlareSystem

// --- Global Variables ---
let scene, camera, renderer, controls, clock, textureLoader;
let sunLight, ambientLight;
let physicsEngine;
let solarSystemBuilder;
let flareSystem; // Add flare system instance

// Materials (created once, passed to builder)
let earthMaterial, sunGlowMaterial, atmosphereMaterial, sunMaterialBasic, sunMaterialShader;

// State variables
let sunShaderEnabled = false;
let cameraLockedToEarth = true;
let normalMappingEnabled = Config.EARTH_NORMAL_MAP_TOGGLE_DEFAULT;
let axialTiltEnabled = false; // New state for axial tilt
let enhancedNightLightsEnabled = false; // New state for enhanced night lights

// Helper variables
const earthWorldPosition = new THREE.Vector3();
let targetIndicator; // For visualizing the camera target
let textures = {}; // Declare textures in a higher scope

// --- Constants ---
const EARTH_AXIAL_TILT = THREE.MathUtils.degToRad(23.5); // Earth's axial tilt

// --- Initialization ---

async function init() {
    setupBaseScene();
    setupLighting();
    setupControls();

    physicsEngine = new PhysicsEngine(); // Instantiate physics engine
    flareSystem = new FlareSystem(scene, 200); // Instantiate flare system (e.g., 200 particles)

    try {
        textures = await loadTextures(); // Assign to the higher-scoped variable
        createSharedMaterials(textures); // Create materials needed by the builder

        // Instantiate builder and build the scene
        solarSystemBuilder = new SolarSystemBuilder(scene, textures, {
            earthMaterial, sunGlowMaterial, atmosphereMaterial, sunMaterialBasic, sunMaterialShader
        }, physicsEngine);
        solarSystemBuilder.buildInitialScene();

        createTargetIndicator(); // Create the indicator after the scene is built
        setupEventListeners(); // Setup UI listeners after builder is ready
        updateEarthTilt(); // Set initial tilt state
        animate(); // Start the animation loop
    } catch (error) {
        console.error("Initialization failed:", error);
    }
}

function setupBaseScene() {
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
    renderer.outputEncoding = THREE.sRGBEncoding; // Correct encoding for textures
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();
    textureLoader = new THREE.TextureLoader();
}

function setupLighting() {
    ambientLight = new THREE.AmbientLight(0xffffff, Config.AMBIENT_LIGHT_INTENSITY);
    scene.add(ambientLight);

    // Revert back to DirectionalLight for debugging Earth lighting
    sunLight = new THREE.DirectionalLight(0xffffff, Config.SUN_LIGHT_INTENSITY);
    sunLight.position.set(
        Config.SUN_LIGHT_POSITION.x,
        Config.SUN_LIGHT_POSITION.y,
        Config.SUN_LIGHT_POSITION.z
    ).normalize(); // Ensure direction is normalized if needed by shader
    scene.add(sunLight);


    // Keep a directional light for consistent directionality if needed, maybe lower intensity
    // const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    // directionalLight.position.set(5, 3, 5); // Example direction
    // scene.add(directionalLight);
}

function setupControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.1;
    controls.maxDistance = Config.CONTROLS_MAX_DISTANCE;
}

async function loadTextures() {
    // (Texture loading logic remains largely the same as before)
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
        // Other Planets
        ...Config.PLANET_DATA.filter(p => p.name !== "Earth").map(p =>
             p.textureFile ? textureLoader.loadAsync(p.textureFile).then(t => ({ key: p.name, texture: t })) : Promise.resolve(null)
        ),
        // Venus Atmosphere
        Config.PLANET_DATA.find(p => p.name === "Venus")?.atmosphereTextureFile
            ? textureLoader.loadAsync(Config.PLANET_DATA.find(p => p.name === "Venus").atmosphereTextureFile).then(t => ({ key: 'venusAtmosphere', texture: t }))
            : Promise.resolve(null)
    ];

    const loadedTextures = await Promise.all(texturePromises);
    const textureMap = {};

    loadedTextures.filter(item => item !== null).forEach(item => {
        const { key, texture } = item;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        if (key && !key.toLowerCase().includes('specular') && !key.toLowerCase().includes('height') && !key.toLowerCase().includes('normal') && key !== 'venusAtmosphere') {
             texture.encoding = THREE.sRGBEncoding;
        }
        textureMap[key] = texture;
    });

    console.log("Textures loaded:", Object.keys(textureMap));
    return textureMap; // Return the map
}

function createSharedMaterials(textures) {
    // Earth Material
    const earthUniforms = {
        dayTexture: { value: textures.earthDayLow },
        nightTexture: { value: textures.earthNightLow },
        specularMap: { value: textures.earthSpecularLow },
        uHeightMap: { value: textures.earthHeight },
        uNormalMap: { value: textures.earthNormalLow },
        // Use directional light's position (treated as direction)
        sunDirection: { value: sunLight.position },
        uTime: { value: 0.0 },
        uDisplacementScale: { value: Config.EARTH_DISPLACEMENT_SCALE },
        uCameraPosition: { value: camera.position },
        uNormalMappingEnabled: { value: normalMappingEnabled ? 1.0 : 0.0 },
        uNightBlendFactor: { value: Config.EARTH_NIGHT_BLEND_FACTOR },
        uAmbientFactorBase: { value: Config.EARTH_SHADER_AMBIENT_FACTOR_BASE },
        uAmbientFactorNormalMap: { value: Config.EARTH_SHADER_AMBIENT_FACTOR_NORMAL_MAP },
        uDirectFactorBase: { value: Config.EARTH_SHADER_DIRECT_FACTOR_BASE },
        uDirectFactorNormalMap: { value: Config.EARTH_SHADER_DIRECT_FACTOR_NORMAL_MAP },
        uEnableEnhancedNightLights: { value: enhancedNightLightsEnabled ? 1.0 : 0.0 } // New uniform
    };
    earthMaterial = Factory.createEarthMaterial(Shaders, earthUniforms);

    // Sun Glow Material
    const sunGlowUniforms = {
        uCameraPosition: { value: camera.position },
        uGlowColor: { value: new THREE.Color(Config.SUN_GLOW_COLOR.r, Config.SUN_GLOW_COLOR.g, Config.SUN_GLOW_COLOR.b) },
        uGlowIntensity: { value: Config.GLOW_INTENSITY_MULTIPLIER },
        uTime: { value: 0.0 }, // Add missing uTime uniform for glow noise animation
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

    // Sun Materials
    sunMaterialBasic = Factory.createBasicMaterial(textures.sun);
    const sunShaderUniforms = { uTime: { value: 0.0 } };
    sunMaterialShader = Factory.createShaderMaterial(
        Shaders.SUN_VERTEX_SHADER,
        Shaders.SUN_FRAGMENT_SHADER,
        sunShaderUniforms
    );
}

function createTargetIndicator() {
    const targetMaterial = new THREE.SpriteMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: false,
        depthTest: false
    });
    targetIndicator = new THREE.Sprite(targetMaterial);
    targetIndicator.scale.set(0.03, 0.03, 1);
    targetIndicator.visible = !cameraLockedToEarth;
    scene.add(targetIndicator);
}

function setupEventListeners() {
    window.addEventListener('resize', onWindowResize, false);

    // --- UI Button Listeners ---
    const gravityBtn = document.getElementById('toggle-gravity-btn');
    const focusBtn = document.getElementById('toggle-focus-btn');
    const sunShaderBtn = document.getElementById('toggle-sun-shader-btn');
    const tiltBtn = document.getElementById('toggle-tilt-btn'); // New tilt button
    const nightLightsBtn = document.getElementById('toggle-night-lights-btn'); // New night lights button
    const asteroidSlider = document.getElementById('asteroid-group-slider'); // Get slider
    const asteroidLabel = document.getElementById('asteroid-group-label'); // Get label

    if (gravityBtn) {
        gravityBtn.textContent = `Gravity: ${physicsEngine.simulationEnabled ? 'On' : 'Off'}`;
        gravityBtn.addEventListener('click', () => {
            physicsEngine.simulationEnabled = !physicsEngine.simulationEnabled;
            console.log(`Gravity Simulation ${physicsEngine.simulationEnabled ? 'Enabled' : 'Disabled'}`);
            gravityBtn.textContent = `Gravity: ${physicsEngine.simulationEnabled ? 'On' : 'Off'}`;
            if (physicsEngine.simulationEnabled) {
                physicsEngine.initializeOrbitalVelocities();
            }
        });
    } else { console.error("Gravity toggle button not found!"); }

    if (focusBtn) {
        focusBtn.textContent = `Focus: ${cameraLockedToEarth ? 'Earth' : 'Sun'}`;
        focusBtn.addEventListener('click', () => {
            if (cameraLockedToEarth && controls) {
                controls.minDistance = 0.1;
                controls.maxDistance = Config.CONTROLS_MAX_DISTANCE;
            }
            cameraLockedToEarth = !cameraLockedToEarth;
            console.log(`Camera Lock to Earth: ${cameraLockedToEarth}`);
            focusBtn.textContent = `Focus: ${cameraLockedToEarth ? 'Earth' : 'Sun'}`;
            if (controls) {
                if (cameraLockedToEarth) {
                    controls.minDistance = Config.EARTH_RADIUS;
                    controls.maxDistance = Config.EARTH_RADIUS * 10;
                } else {
                    controls.target.set(0, 0, 0);
                }
            }
        });
    } else { console.error("Focus toggle button not found!"); }

    if (sunShaderBtn) {
        const sunMesh = solarSystemBuilder.getSunMesh(); // Get sun mesh from builder
        sunShaderBtn.textContent = `Sun Shader: ${sunShaderEnabled ? 'On' : 'Off'}`;
        sunShaderBtn.addEventListener('click', () => {
            if (!sunMesh) {
                console.error("Sun mesh not found for shader toggle!"); return;
            }
            sunShaderEnabled = !sunShaderEnabled;
            console.log(`Sun Shader ${sunShaderEnabled ? 'Enabled' : 'Disabled'}`);
            sunMesh.material = sunShaderEnabled ? sunMaterialShader : sunMaterialBasic;
            sunShaderBtn.textContent = `Sun Shader: ${sunShaderEnabled ? 'On' : 'Off'}`;
        });
    } else { console.error("Sun shader toggle button not found!"); }

    // --- New Tilt Button Listener ---
    if (tiltBtn) {
        tiltBtn.textContent = `Axial Tilt: ${axialTiltEnabled ? 'On' : 'Off'}`;
        tiltBtn.addEventListener('click', () => {
            axialTiltEnabled = !axialTiltEnabled;
            tiltBtn.textContent = `Axial Tilt: ${axialTiltEnabled ? 'On' : 'Off'}`;
            updateEarthTilt(); // Call function to apply the tilt
            if (Config.DEBUG_MODE) {
                console.log(`Axial Tilt ${axialTiltEnabled ? 'Enabled' : 'Disabled'}`);
            }
        });
    } else { console.error("Tilt toggle button not found!"); }

    // --- New Night Lights Button Listener ---
    if (nightLightsBtn) {
        nightLightsBtn.textContent = `Night Lights: ${enhancedNightLightsEnabled ? 'Enhanced' : 'Normal'}`;
        nightLightsBtn.addEventListener('click', () => {
            enhancedNightLightsEnabled = !enhancedNightLightsEnabled;
            nightLightsBtn.textContent = `Night Lights: ${enhancedNightLightsEnabled ? 'Enhanced' : 'Normal'}`;
            // Update the shader uniform directly
            if (earthMaterial) {
                earthMaterial.uniforms.uEnableEnhancedNightLights.value = enhancedNightLightsEnabled ? 1.0 : 0.0;
            }
            if (Config.DEBUG_MODE) {
                console.log(`Enhanced Night Lights ${enhancedNightLightsEnabled ? 'Enabled' : 'Disabled'}`);
                console.log(`Shader uniform uEnableEnhancedNightLights set to: ${enhancedNightLightsEnabled ? 1.0 : 0.0}`);
            }
        });
    } else { console.error("Night lights toggle button not found!"); }


    // --- Asteroid Slider Listener ---
    if (asteroidSlider && asteroidLabel) {
        // Set initial label value based on config (assuming one belt for now)
        const initialGroupSize = Config.ASTEROID_BELT_DATA[0]?.groupSize || 50;
        asteroidSlider.value = initialGroupSize;
        asteroidLabel.textContent = `Asteroid Group Size: ${initialGroupSize}`;

        asteroidSlider.addEventListener('input', () => { // 'input' for live updates
            const newGroupSize = parseInt(asteroidSlider.value, 10);
            asteroidLabel.textContent = `Asteroid Group Size: ${newGroupSize}`;
        });

        asteroidSlider.addEventListener('change', () => { // 'change' after release
            const newGroupSize = parseInt(asteroidSlider.value, 10);
            console.log("Slider changed, rebuilding asteroid belt...");
            // Assuming only one belt named "MainBelt" for now
            solarSystemBuilder.rebuildAsteroidBelt("MainBelt", newGroupSize);
            // Re-initialize physics if it's running
            if (physicsEngine.simulationEnabled) {
                console.log("Re-initializing physics velocities after belt rebuild.");
                physicsEngine.initializeOrbitalVelocities();
            }
        });
    } else {
        console.error("Asteroid slider or label not found!");
    }
}

// --- Helper Functions ---

function updateEarthTilt() {
    const earthSystemAnchor = solarSystemBuilder?.getEarthSystemAnchor(); // Use optional chaining
    if (earthSystemAnchor) {
        earthSystemAnchor.rotation.x = axialTiltEnabled ? EARTH_AXIAL_TILT : 0;
        if (Config.DEBUG_MODE) {
            console.log(`Applied Earth tilt: ${axialTiltEnabled ? THREE.MathUtils.radToDeg(EARTH_AXIAL_TILT).toFixed(1) : 0} degrees`);
        }
    } else if (Config.DEBUG_MODE) {
        // Log only if the builder should exist but the anchor doesn't
        if (solarSystemBuilder) {
            console.warn("updateEarthTilt called, but earthSystemAnchor not found yet.");
        }
    }
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Removed: onKeyDown (can be added back if needed)
// Removed: initializeOrbitalVelocities (moved to PhysicsEngine)
// Removed: updatePhysics (moved to PhysicsEngine)
// Removed: createSolarSystem (moved to SolarSystemBuilder)

// --- Animation Loop ---

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const dt = Math.min(delta, 0.016); // Clamped delta time
    const elapsedTime = clock.getElapsedTime();

    // --- Get dynamic objects from builder ---
    const sunMesh = solarSystemBuilder.getSunMesh(); // Get sun mesh for flare origin & shader toggle
    const earthMesh = solarSystemBuilder.getEarthMesh();
    const cloudMesh = solarSystemBuilder.getCloudMesh();
    const moonOrbitAnchor = solarSystemBuilder.getMoonOrbitAnchor();
    const earthSystemAnchor = solarSystemBuilder.getEarthSystemAnchor();
    const planetOrbits = solarSystemBuilder.getPlanetOrbits(); // Includes asteroid groups now

    // --- Update Camera ---
    if (cameraLockedToEarth && earthMesh && controls) {
        earthMesh.getWorldPosition(earthWorldPosition);
        controls.target.copy(earthWorldPosition);
    }
    controls.update(); // Update controls AFTER potentially changing target

    // --- Clamp Camera Distance (if locked) ---
    if (cameraLockedToEarth && controls) {
        const currentDistance = controls.getDistance();
        const minLimit = controls.minDistance;
        const maxLimit = controls.maxDistance;
        if (currentDistance > maxLimit || currentDistance < minLimit) {
            const targetDistance = THREE.MathUtils.clamp(currentDistance, minLimit, maxLimit);
            const direction = new THREE.Vector3().subVectors(controls.object.position, controls.target).normalize();
            controls.object.position.copy(controls.target).add(direction.multiplyScalar(targetDistance));
        }
    }

    // --- Update Target Indicator ---
    if (targetIndicator) {
        targetIndicator.position.copy(controls.target);
        targetIndicator.visible = !cameraLockedToEarth;
    }

    // --- Trigger Flares (Example: Randomly) ---
    if (sunMesh && flareSystem && Math.random() < 0.01) { // Low probability each frame
        const surfacePoint = new THREE.Vector3();
        // Get a random point on the sphere surface
        surfacePoint.setFromSphericalCoords(
            Config.SUN_RADIUS + 0.1, // Start slightly above surface
            Math.acos(2 * Math.random() - 1), // Random phi (latitude)
            Math.random() * Math.PI * 2 // Random theta (longitude)
        );
        const direction = surfacePoint.clone().normalize(); // Flare direction is outward from surface point
        flareSystem.createFlare(surfacePoint, direction);
    }

    // --- Update Flare System ---
    if (flareSystem) {
        flareSystem.update(dt);
    }

    // --- Update Shader Uniforms ---
    earthMaterial.uniforms.uTime.value = elapsedTime;
    earthMaterial.uniforms.uCameraPosition.value.copy(camera.position);
    // Update sun direction based on point light position (it's fixed at origin)
    // earthMaterial.uniforms.sunDirection.value.copy(sunLight.position); // Already set?
    sunGlowMaterial.uniforms.uCameraPosition.value.copy(camera.position);
    sunGlowMaterial.uniforms.uTime.value = elapsedTime; // Add time update for glow noise
    atmosphereMaterial.uniforms.uCameraPosition.value.copy(camera.position);
    // atmosphereMaterial.uniforms.uTime.value = elapsedTime; // Add if needed for atmosphere effects later
    if (sunShaderEnabled && sunMaterialShader) {
        sunMaterialShader.uniforms.uTime.value = elapsedTime;
    }

    // --- LOD Check (Earth only for now) ---
    // Access the higher-scoped textures variable
    if (earthMesh && cloudMesh && textures.earthDayHigh) {
        const currentDistance = controls.getDistance(); // Or distance to Earth specifically
        const isHighRes = (earthMaterial.uniforms.dayTexture.value === textures.earthDayHigh);
        let needsEarthMaterialUpdate = false;

        if (currentDistance < Config.LOD_ZOOM_THRESHOLD && !isHighRes) {
            earthMaterial.uniforms.dayTexture.value = textures.earthDayHigh;
            earthMaterial.uniforms.nightTexture.value = textures.earthNightHigh;
            earthMaterial.uniforms.specularMap.value = textures.earthSpecularHigh;
            earthMaterial.uniforms.uNormalMap.value = textures.earthNormalHigh;
            if (cloudMesh.material) cloudMesh.material.map = textures.earthCloudsHigh;
            needsEarthMaterialUpdate = true;
        } else if (currentDistance >= Config.LOD_ZOOM_THRESHOLD && isHighRes) {
            earthMaterial.uniforms.dayTexture.value = textures.earthDayLow;
            earthMaterial.uniforms.nightTexture.value = textures.earthNightLow;
            earthMaterial.uniforms.specularMap.value = textures.earthSpecularLow;
            earthMaterial.uniforms.uNormalMap.value = textures.earthNormalLow;
            if (cloudMesh.material) cloudMesh.material.map = textures.earthCloudsLow;
            needsEarthMaterialUpdate = true;
        }
        if (needsEarthMaterialUpdate && cloudMesh.material) {
            cloudMesh.material.needsUpdate = true;
        }
    }


    // --- Motion ---
    // Update physics simulation
    physicsEngine.update(dt);

    // Simple Rotations (always run for visual effect, physics overrides position if enabled)
    if (earthMesh) earthMesh.rotation.y += Config.EARTH_ROTATION_SPEED * dt;
    if (cloudMesh) cloudMesh.rotation.y += (Config.CLOUD_ROTATION_SPEED - Config.EARTH_ROTATION_SPEED) * dt;
    if (moonOrbitAnchor) moonOrbitAnchor.rotation.y += Config.MOON_ORBIT_SPEED * dt;

    // Rotate anchors for simple orbits (only visually effective if physics is off)
    if (!physicsEngine.simulationEnabled) {
        // Note: planetOrbits now includes asteroid group anchors as well
        planetOrbits.forEach(orbit => {
            orbit.anchor.rotation.y += orbit.speed * Config.SOLAR_SYSTEM_ORBIT_SPEED_FACTOR * dt;
        });
    }

    // Render the scene
    renderer.render(scene, camera);
}

// --- Start ---
init();
