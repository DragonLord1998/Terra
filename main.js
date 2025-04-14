import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Global Variables ---
let scene, camera, renderer, controls;
let spaceship; // Declare spaceship globally
let spaceshipSpeed = 0.1;
let spaceshipRollSpeed = 0.05;
let initialDistance = 80;

// --- Spaceship Movement Flags ---
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let rollLeft = false;
let rollRight = false;

const textureLoader = new THREE.TextureLoader();
const clock = new THREE.Clock();
const planets = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let clickableObjects = [];
let moonMesh; // Keep separate ref for potential specific logic
let targetObject = null;
const targetPositionVec = new THREE.Vector3();
const cameraOffsetDir = new THREE.Vector3();
let desiredDistance = 10.0;
const desiredCameraPosition = new THREE.Vector3();
const texturesMap = new Map(); // --- Store loaded textures ---
let asteroidBelt; // Declare asteroid belt globally or within init scope
let sunFlares = [];


// --- UI Elements ---
const choosePlanetBtn = document.getElementById('choosePlanetBtn');
const planetListDropdown = document.getElementById('planetListDropdown');
const distanceControl = document.getElementById('distanceControl');
const distanceSlider = document.getElementById('distanceSlider');
const distanceValueLabel = document.getElementById('distanceValue');

// --- Base URL for textures ---
const baseURL = "https://raw.githubusercontent.com/DragonLord1998/Terra/main/";

// --- Texture Files ---
// Define all texture files needed, mapping keys to filenames
const textureFiles = {
    starfield: "8k_stars_milky_way.jpg",
    saturnRing: "8k_saturn_ring_alpha.png",
    sun: "8k_sun.jpg",
    mercury: "8k_mercury.jpg",
    venus: "8k_venus_surface.jpg",
    earth: "earth_day.jpg",
    earthClouds: "earth_clouds.jpg",
    mars: "8k_mars.jpg",
    jupiter: "8k_jupiter.jpg",
    saturn: "8k_saturn.jpg",
    uranus: "2k_uranus.jpg",
    neptune: "2k_neptune.jpg",
    moon: "8k_moon.jpg"
    // Add other maps here if needed later (normal, specular etc.)

};

// --- Planet Data (References textureFiles keys) ---
const solarSystemData = [
    { name: "Venus", textureKey: "venus", radius: 0.95, distance: 9, orbitSpeed: 0.02, rotationSpeed: 0.005, tilt: 177.4, fallbackColor: 0xD4BF9A },
    { name: "Earth", textureKey: "earth", radius: 1.0, distance: 13, orbitSpeed: 0.01, rotationSpeed: 0.02, tilt: 23.4, moon: true, cloudsKey: "earthClouds", fallbackColor: 0x4B91E3 },
    { name: "Mars", textureKey: "mars", radius: 0.53, distance: 18, orbitSpeed: 0.008, rotationSpeed: 0.018, tilt: 25.2, fallbackColor: 0xC1440E },
    { name: "Jupiter", textureKey: "jupiter", radius: 3.5, distance: 28, orbitSpeed: 0.004, rotationSpeed: 0.04, tilt: 3.1, fallbackColor: 0xD8CAAD },
    { name: "Saturn", textureKey: "saturn", radius: 3.0, distance: 40, orbitSpeed: 0.003, rotationSpeed: 0.038, tilt: 26.7, rings: true, ringsTextureKey: "saturnRing", fallbackColor: 0xE0D8C0 },
    { name: "Uranus", textureKey: "uranus", radius: 2.0, distance: 55, orbitSpeed: 0.002, rotationSpeed: 0.03, tilt: 97.8, fallbackColor: 0xAFDBF5 },
    { name: "Neptune", textureKey: "neptune", radius: 1.9, distance: 70, orbitSpeed: 0.001, rotationSpeed: 0.028, tilt: 28.3, fallbackColor: 0x5B5DDF }
];
const sunData = { name: "Sun", textureKey: "sun", radius: 3.5, fallbackColor: 0xFFFF00 };
const moonData = { name: "Moon", textureKey: "moon", fallbackColor: 0xCCCCCC, tilt: 6.7 };


// --- Focus Function ---
function focusOnObject(objectMesh) {
    if (!objectMesh || !controls || !camera) return;
    console.log("Focusing on:", objectMesh.userData.name);
    targetObject = objectMesh;
    targetObject.getWorldPosition(targetPositionVec);
    cameraOffsetDir.subVectors(camera.position, targetPositionVec).normalize();
    desiredDistance = initialDistance;
    console.log("Set target direction:", cameraOffsetDir);
    console.log("Set initial distance:", initialDistance);
    distanceSlider.value = desiredDistance;
    distanceSlider.min = (objectMesh.geometry?.parameters?.radius || 1) * 2.5;
    distanceSlider.max = Math.max(50, initialDistance * 2);
    distanceValueLabel.textContent = desiredDistance.toFixed(1);
    distanceControl.style.display = 'block';
    controls.target.copy(targetPositionVec);
}

// --- Reset Focus Function ---
function resetFocus() {
     console.log("Resetting focus");
     targetObject = null;
     controls.target.set(0, 0, 0);
     distanceControl.style.display = 'none';
}

 // --- Window Resize Handler ---
function onWindowResize() {
     if (camera && renderer) {
         camera.aspect = window.innerWidth / window.innerHeight;
         camera.updateProjectionMatrix();
         renderer.setSize(window.innerWidth, window.innerHeight);
     }
}

/**
 * Creates planets in the solar system, including their meshes, pivots, moons, and rings.
 * @param {THREE.Scene} scene - The Three.js scene to add the planets to.
 * @param {Map<string, THREE.Texture>} texturesMap - A map of loaded textures.
 * @param {Array<THREE.Object3D>} clickableObjects - An array to add clickable objects to.
 * @param {Array<Object>} solarSystemData - An array of data for creating the planets.
 * @param {Object} moonData - Data for creating the moon.
 * @returns {Array<Object>} - An array of planet objects, each containing mesh, pivot, and other properties.
 */
function createPlanets(scene, texturesMap, clickableObjects, solarSystemData, moonData) {
    const planets = [];
    const dropdownContent = planetListDropdown;
    dropdownContent.innerHTML = '<button data-name="Background">Reset Focus</button>';
    const sunButton = document.createElement('button');
    sunButton.textContent = sunData.name; sunButton.dataset.name = sunData.name;
    dropdownContent.appendChild(sunButton);

    for (const data of solarSystemData) {
        const planetTexture = texturesMap.get(data.textureKey); // Get from Map
        const planetGeometry = new THREE.SphereGeometry(data.radius, 64, 32); // Use 64x32 segments
        let planetMaterial;
        if (planetTexture) { planetMaterial = new THREE.MeshStandardMaterial({ map: planetTexture, roughness: 0.8, metalness: 0.1 }); }
        else { console.warn(`Using fallback color for ${data.name}`); planetMaterial = new THREE.MeshStandardMaterial({ color: data.fallbackColor, roughness: 0.8, metalness: 0.1 }); }
        const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
        planetMesh.userData = { name: data.name, isCelestialBody: true };

        if (data.tilt !== undefined) { planetMesh.rotation.z = THREE.MathUtils.degToRad(data.tilt); }

        clickableObjects.push(planetMesh);
        const pivot = new THREE.Object3D(); scene.add(pivot); pivot.add(planetMesh);
        planetMesh.position.set(data.distance, 0, 0);

        // --- Make sure planetData includes pivot ---
        const planetData = {
            name: data.name,
            mesh: planetMesh,
            pivot: pivot, // Ensure pivot is included
            orbitSpeed: data.orbitSpeed,
            rotationSpeed: data.rotationSpeed
        };

        // Add clouds
        if (data.cloudsKey) {
            const cloudTexture = texturesMap.get(data.cloudsKey); // Get from Map
            if (cloudTexture) {
                const cloudGeometry = new THREE.SphereGeometry(data.radius * 1.01, 64, 32);
                const cloudMaterial = new THREE.MeshBasicMaterial({ map: cloudTexture, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending });
                const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
                planetMesh.add(cloudMesh);
                planetData.cloudMesh = cloudMesh;
            } else { console.warn(`Skipping clouds for ${data.name}...`); }
        }
        // Add Moon
        if (data.moon) {
            const moonTexture = texturesMap.get(moonData.textureKey); // Get from Map
            const moonRadius = data.radius * 0.27; const moonDistance = data.radius + 1.0;
            const moonGeometry = new THREE.SphereGeometry(moonRadius, 32, 16);                 
            let moonMaterial;
            if (moonTexture) { moonMaterial = new THREE.MeshStandardMaterial({ map: moonTexture, roughness: 0.9 }); }
            else { console.warn(`Using fallback color for Moon`); moonMaterial = new THREE.MeshStandardMaterial({ color: moonData.fallbackColor, roughness: 0.9 }); }                 
            moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
            moonMesh.userData = { name: "Moon", isCelestialBody: true };
            if (moonData.tilt !== undefined) { moonMesh.rotation.z = THREE.MathUtils.degToRad(moonData.tilt); }               
            clickableObjects.push(moonMesh);
            const moonPivot = new THREE.Object3D(); planetMesh.add(moonPivot); moonPivot.add(moonMesh);
            moonMesh.position.set(moonDistance, 0, 0);
            planetData.moonPivot = moonPivot;                
            planetData.moonOrbitSpeed = data.orbitSpeed * 10;
        }
        // Add Rings
        if (data.rings) {
            const ringTexture = texturesMap.get(data.ringsTextureKey); // Get from Map
            const innerRadius = data.radius * 1.2; const outerRadius = data.radius * 2.2;
            const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
            // Correct UV mapping for RingGeometry
            const pos = ringGeometry.attributes.position;
            const v3 = new THREE.Vector3();
            for (let i = 0; i < pos.count; i++) {
                v3.fromBufferAttribute(pos, i);
                // Set Z to 0, map original Y to Z for planar ring
                pos.setXYZ(i, v3.x, v3.y, 0);
            }
            ringGeometry.attributes.position.needsUpdate = true;
            ringGeometry.computeVertexNormals(); // Recalculate normals after moving vertices
            let ringMaterial;
            if (ringTexture) {
                ringMaterial = new THREE.MeshBasicMaterial({ map: ringTexture, side: THREE.DoubleSide, transparent: true, alphaTest: 0.01 });
            } else {
                ringMaterial = new THREE.MeshBasicMaterial({ color: 0xAAAAAA, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
            }
            const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
            ringMesh.rotation.x = Math.PI * 0.5;
            planetMesh.add(ringMesh);                 
         }    
        planets.push(planetData);
    

        // Add button to Dropdown
        const button = document.createElement('button');
        button.textContent = data.name; button.dataset.name = data.name;
        dropdownContent.appendChild(button);
     }
     // Add Moon button to dropdown
     if (moonMesh) {
          const button = document.createElement('button');
          button.textContent = moonData.name; button.dataset.name = moonData.name;
          dropdownContent.appendChild(button);
     }

    // Add Spaceship button to dropdown
    const spaceshipButton = document.createElement('button');
    spaceshipButton.textContent = 'Spaceship'; spaceshipButton.dataset.name = 'Spaceship';
    dropdownContent.appendChild(spaceshipButton);
    return planets;
}


// --- Initialization Function ---
async function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();

    // 2. Camera Setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 30, 80);

    // 3. Renderer Setup
    const canvas = document.getElementById('webgl-canvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    // 4. Orbit Controls Setup
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.maxDistance = 400;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const sunLight = new THREE.PointLight(0xffffff, 6.0);
    scene.add(sunLight);



    // --- Load ALL Textures Upfront ---
    console.log("Starting texture loading...");
    const textureLoadPromises = [];
    const textureKeys = Object.keys(textureFiles);

    for (const key of textureKeys) {
        const url = baseURL + textureFiles[key];
        const isColorData = !(key === 'saturnRing'); // Treat only ring alpha as non-color for now
        textureLoadPromises.push(
            textureLoader.loadAsync(url)
            .then(texture => {
                if (isColorData) { texture.colorSpace = THREE.SRGBColorSpace; }
                texturesMap.set(key, texture); // Store in Map
                console.log(`Texture loaded: ${key}`);
            })
            .catch(error => {
                console.error(`Failed to load texture: ${key} (${url})`, error);
                texturesMap.set(key, null); // Store null on failure
            })
        );
    }
    await Promise.all(textureLoadPromises);
    console.log("Texture loading finished.");

    const loadingAnimation = document.querySelector('.loading-animation-container');
    if (loadingAnimation) {
        loadingAnimation.style.display = 'none';
    }
    // --- Show UI ---
    
    const spaceshipGeometry = new THREE.ConeGeometry(0.5, 2, 32);
    const spaceshipMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    spaceship = new THREE.Mesh(spaceshipGeometry, spaceshipMaterial);
    spaceship.position.set(0, 0, 10); // Start near the sun
    spaceship.rotation.x = -Math.PI / 2; // Point the ship forward
    scene.add(spaceship);

    
    // --- Show UI ---
    const uiContainer = document.querySelector('.ui-container');
    uiContainer.classList.remove('hidden');
    
    

    // --- End Texture Loading ---


    // --- Create Starfield Background ---
    const starfieldTexture = texturesMap.get('starfield');
    if (starfieldTexture) {
         const starfieldGeometry = new THREE.SphereGeometry(500, 64, 32);
         const starfieldMaterial = new THREE.MeshBasicMaterial({ map: starfieldTexture, side: THREE.BackSide });
         const starfieldMesh = new THREE.Mesh(starfieldGeometry, starfieldMaterial);
         scene.add(starfieldMesh);
     } else { scene.background = new THREE.Color(0x000000); }


    // --- Create Sun ---
    const sunTexture = texturesMap.get(sunData.textureKey); // Get from Map
    const sunGeometry = new THREE.SphereGeometry(sunData.radius, 64, 32);
    let sunMaterial;
    if (sunTexture) { sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture, emissive: 0xFFFFDD, emissiveIntensity: 1.1 }); }
    else { console.warn(`Using fallback color for Sun`); sunMaterial = new THREE.MeshBasicMaterial({ color: sunData.fallbackColor }); }
    const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    sunMesh.userData = { name: "Sun", isCelestialBody: true };
    scene.add(sunMesh);
    clickableObjects.push(sunMesh);
    // --- Add Sun Corona ---
    const coronaGeometry = new THREE.SphereGeometry(sunData.radius * 1.15, 64, 32);
    const coronaMaterial = new THREE.MeshBasicMaterial({ color: 0xffccaa, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
    const coronaMesh = new THREE.Mesh(coronaGeometry, coronaMaterial);
    scene.add(coronaMesh);
     // --- Add Solar Flares ---
     console.log("Adding solar flares...");
     const flareCount = THREE.MathUtils.randInt(50, 100); // Number of flares (50-100)
     const flareGeometry = new THREE.ConeGeometry(0.1, 0.5, 16); // Smaller cones
     flareGeometry.translate(0,0.25,0);
     const flareMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc88, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
     for (let i = 0; i < flareCount; i++) {
        const flare = new THREE.Mesh(flareGeometry, flareMaterial.clone()); // Clone for each instance

        // Randomize scale (size)
        const scale = THREE.MathUtils.randFloat(0.5, 2.0);
        flare.scale.set(scale, scale, scale);
        
        // Randomize intensity (opacity)
        flare.material.opacity = THREE.MathUtils.randFloat(0.3, 0.8);

        // Randomize position on the sun's surface
        const radius = sunData.radius;
        const angle = Math.random() * Math.PI * 2; // Random angle around the sun
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        flare.position.set(x, 0, z);
        flare.lookAt(0,0,0);
        flare.rotateX(THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(-15,15)));
        flare.rotateZ(THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(-15,15)));
        sunFlares.push(flare);
        sunMesh.add(flare); // Attach to the sun
    }
    console.log("Solar flares added.");

    // --- Create Planets ---
    planets.push(...createPlanets(scene, texturesMap, clickableObjects, solarSystemData, moonData));


    // --- Create Asteroid Belt ---
        console.log("Creating asteroid belt...");
    const asteroidCount = 1500;
        const beltInnerRadius = 21; // Between Mars (18) and Jupiter (28)
        const beltOuterRadius = 26; // Between Mars (18) and Jupiter (28)
        const beltThickness = 1.5;     // How thick the belt is vertically
    
    // Create a simple, low-poly geometry for asteroids.
    // Using IcosahedronGeometry(radius, detail=0) is efficient.
    // We can also add variety by having a few different geometries later.
   
    const asteroidGeometry = new THREE.IcosahedronGeometry(0.05, 0); // Smaller, simple geometry
    const asteroidMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 });

    asteroidBelt = new THREE.InstancedMesh(asteroidGeometry, asteroidMaterial, asteroidCount);

    const dummy = new THREE.Object3D(); // Used to set matrix for each instance

    for (let i = 0; i < asteroidCount; i++) {
        // Calculate random position within the belt torus
        const radius = THREE.MathUtils.randFloat(beltInnerRadius, beltOuterRadius);
        const angle = Math.random() * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = THREE.MathUtils.randFloatSpread(beltThickness); // Random vertical position

        dummy.position.set(x, y, z);

        // Add slight random rotation

        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

        // Apply random scaling
        const scale = THREE.MathUtils.randFloat(0.5, 1.5);
        dummy.scale.set(scale, scale, scale);

        dummy.updateMatrix();
        asteroidBelt.setMatrixAt(i, dummy.matrix);
    }
    asteroidBelt.instanceMatrix.needsUpdate = true; // Important!
    scene.add(asteroidBelt); // Add the belt to the scene
    console.log("Asteroid belt created.");
    // --- End Asteroid Belt ---


    // --- Add Event Listeners ---
    renderer.domElement.addEventListener('pointerdown', onPointerDownViaRaycast, false);
    choosePlanetBtn.addEventListener('click', (event) => {
         event.stopPropagation();
         planetListDropdown.style.display = planetListDropdown.style.display === 'block' ? 'none' : 'block';
    });
    planetListDropdown.addEventListener('click', onUIPanelClick);
    distanceSlider.addEventListener('input', (event) => {
         desiredDistance = parseFloat(event.target.value);
         distanceValueLabel.textContent = desiredDistance.toFixed(1);
    });
    document.addEventListener('click', (event) => {
         if (!choosePlanetBtn.parentElement.contains(event.target)) {
            planetListDropdown.style.display = 'none';
        }
    });


    // Handle Window Resizing
    window.addEventListener('resize', onWindowResize);
}


// --- Spaceship Controls ---
document.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'w':
            moveForward = true;
            break;
        case 's':
            moveBackward = true;
            break;
        case 'a':
            moveLeft = true;
            break;
        case 'd':
            moveRight = true;
            break;
        case 'q':
            rollLeft = true;
            break;
        case 'e':
            rollRight = true;
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.key) {
        case 'w':
            moveForward = false;
            break;
        case 's':
            moveBackward = false;
            break;
        case 'a':
            moveLeft = false;
            break;
        case 'd':
            moveRight = false;
            break;
        case 'q':
            rollLeft = false;
            break;
        case 'e':
            rollRight = false;
            break;
    }
});

// --- Pointer Down Handler (Raycasting) ---
function onPointerDownViaRaycast(event) {
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects(clickableObjects, true); // Check all clickable objects

    if (intersects.length > 0) {
        // Get the first intersected object (closest one)
        const intersectedObject = intersects[0].object;

        // Check if it has a name (our celestial bodies should)
        if (intersectedObject.userData && intersectedObject.userData.isCelestialBody) {
            console.log("Clicked on:", intersectedObject.userData.name);
            focusOnObject(intersectedObject);
        } else {
            console.log("Clicked on unnamed or non-celestial object", intersectedObject);
        }
    } else {
         console.log("Clicked on background");
         // Optional: reset focus when clicking background, but dropdown is better UX
         // resetFocus();
    }
}

// --- UI Panel Click Handler ---
function onUIPanelClick(event) {
    if (event.target.tagName === 'BUTTON') {
        const planetName = event.target.dataset.name;
        planetListDropdown.style.display = 'none'; // Close dropdown

        if (planetName === 'Background') {
             resetFocus();
             return;
        }

        let objectToFocus = null;
        if (planetName === 'Sun') {
             objectToFocus = scene.children.find(obj => obj.userData && obj.userData.name === 'Sun');
        } else if (planetName === 'Moon') {
            objectToFocus = moonMesh; // Use direct reference
        } else if (planetName === 'Spaceship'){
            objectToFocus = spaceship;

         } else {
            const foundPlanetData = planets.find(p => p.name === planetName);
            if (foundPlanetData) {
                objectToFocus = foundPlanetData.mesh;
            }
        }

        if (objectToFocus) {
            focusOnObject(objectToFocus);
        } else {
            console.warn(`Could not find mesh for ${planetName}`);
        }
    }
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (planets.length > 0) {
        planets.forEach(p => {
            if (p.pivot) {
                p.pivot.rotation.y += p.orbitSpeed * delta * 10; // Orbit
            }
            if (p.mesh) {
                 p.mesh.rotateY(p.rotationSpeed * delta * 10); // Self-rotation on local Y
            }
            if (p.cloudMesh) { p.cloudMesh.rotateY(p.rotationSpeed * 1.1 * delta * 10); }
            if (p.moonPivot) {
                p.moonPivot.rotation.y += p.moonOrbitSpeed * delta * 10; // Moon orbit
                if (moonMesh) { moonMesh.rotateY(p.rotationSpeed * delta * 5); } // Moon self-rotation
            }
        });

        // --- Rotate the entire asteroid belt slowly ---
        if (asteroidBelt) {
            // A slow, constant rotation for the whole belt
            asteroidBelt.rotation.y += 0.0001; // Adjust speed as desired
        }
        // --- Animate solar flares ---
        for(let i = 0; i < sunFlares.length; i++){
            const flare = sunFlares[i];
            flare.material.opacity = Math.abs(Math.sin(clock.elapsedTime*0.5 + i*0.02) * flare.material.opacity +0.1 );
            flare.rotateZ(delta * 0.1);
        }

        // --- Camera follow logic ---
        if (targetObject) {
            targetObject.getWorldPosition(targetPositionVec);
            controls.target.copy(targetPositionVec);
            desiredCameraPosition.copy(targetPositionVec).addScaledVector(cameraOffsetDir, desiredDistance);
            // Smooth camera movement (lerp)
            camera.position.lerp(desiredCameraPosition, 0.08); // Adjust lerp factor for speed
        } else {
             //If no object is selected make the camera follow the spaceship
            if (spaceship) { controls.target.copy(spaceship.position); }
            if (spaceship) {
                // Move spaceship forward/backward
                const moveDir = new THREE.Vector3(0, 0, 1); // Use positive Z-axis as forward
                moveDir.applyQuaternion(spaceship.quaternion); 
                if (moveForward) {
                   spaceship.position.add(moveDir.multiplyScalar(spaceshipSpeed)); // Move forward
                }
                if (moveBackward) {
                    spaceship.position.sub(moveDir.multiplyScalar(spaceshipSpeed)); // Move backward
                }
                
                // Rotate spaceship left/right (yaw)
                const yawAxis = new THREE.Vector3(0, 1, 0); // Local Y-axis for yaw
                if (moveLeft) {
                    spaceship.rotateOnAxis(yawAxis, spaceshipRollSpeed); // Rotate on its Y-axis
                }
                if (moveRight) {
                    spaceship.rotateOnAxis(yawAxis, -spaceshipRollSpeed);
                }

                // Strafe spaceship left/right
                const strafeDir = new THREE.Vector3(1, 0, 0);
                strafeDir.applyQuaternion(spaceship.quaternion);
                if (moveLeft) {
                    spaceship.position.sub(strafeDir.multiplyScalar(spaceshipSpeed));
                }
                if (moveRight) {
                    spaceship.position.add(strafeDir.multiplyScalar(spaceshipSpeed));
                }

                // Roll spaceship left/right
                const rollAxis = new THREE.Vector3(0, 0, 1);
                if (rollLeft) {
                    spaceship.rotateOnAxis(rollAxis, spaceshipRollSpeed);
                } if (rollRight) { spaceship.rotateOnAxis(rollAxis, -spaceshipRollSpeed); }
                }
             }
    }

    if (controls) { controls.update(); }
    if (renderer && scene && camera) { renderer.render(scene, camera); }
}

// --- Then start async initialization ---

document.addEventListener('DOMContentLoaded', () => {
    init()
      .then(() => animate()) // Start animation AFTER init() is done // Added missing parenthesis
      .catch(error => { console.error("Initialization failed:", error); });
});