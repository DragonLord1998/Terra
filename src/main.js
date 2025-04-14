/**
 * Main application file for the Solar System Simulation
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CelestialFactory } from './celestialFactory.js';
import { SpaceshipFactory } from './spaceshipFactory.js';
import { CameraController } from './cameraController.js';
import { InputController } from './inputController.js';
// Import shipSettings from config
import { textureFiles, baseURL, shipSettings } from './config.js';

// --- Helper Function to Create Text Sprites ---
function createTextSprite(text, options = {}) {
    const {
        fontsize = 48, // Larger font size for better texture quality
        fontface = 'Arial',
        textColor = { r: 255, g: 255, b: 255, a: 1.0 },
        backgroundColor = { r: 0, g: 0, b: 0, a: 0.4 }, // Semi-transparent background
        borderColor = { r: 150, g: 150, b: 150, a: 1.0 },
        borderThickness = 3,
        scale = 1.0 // Initial scale of the sprite
    } = options;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `Bold ${fontsize}px ${fontface}`;

    // Measure text width
    const metrics = context.measureText(text);
    const textWidth = metrics.width;

    // Set canvas size with padding
    canvas.width = textWidth + borderThickness * 2 + 20; // Add padding
    canvas.height = fontsize * 1.4 + borderThickness * 2; // Adjust height based on font size

    // Re-apply font after resizing canvas
    context.font = `Bold ${fontsize}px ${fontface}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Background
    context.fillStyle = `rgba(${backgroundColor.r},${backgroundColor.g},${backgroundColor.b},${backgroundColor.a})`;
    context.strokeStyle = `rgba(${borderColor.r},${borderColor.g},${borderColor.b},${borderColor.a})`;
    context.lineWidth = borderThickness;
    // Simple rounded rect function
    const roundRect = (ctx, x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    };
    roundRect(context, borderThickness / 2, borderThickness / 2, canvas.width - borderThickness, canvas.height - borderThickness, 10);

    // Text
    context.fillStyle = `rgba(${textColor.r},${textColor.g},${textColor.b},${textColor.a})`;
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Create sprite material
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });

    // Create sprite
    const sprite = new THREE.Sprite(spriteMaterial);
    // Scale sprite based on canvas aspect ratio and desired size
    sprite.scale.set(scale * canvas.width / canvas.height, scale, 1.0);

    return sprite;
}

class SolarSystemSimulation {
    constructor() {
        // Core Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null; // OrbitControls

        // Timing and animation
        this.clock = new THREE.Clock();

        // Game objects
        this.planets = [];
        this.clickableObjects = [];
        this.moonMesh = null;
        this.asteroidBelt = null;
        this.texturesMap = new Map();

        // Spaceship state
        this.currentSpaceship = null;
        this.pulsingMaterials = [];
        this.rotatingParts = [];
        // Spaceship physics state
        this.shipVelocity = new THREE.Vector3();
        this.shipRotation = new THREE.Quaternion(); // Use Quaternion for reliable rotation
        this.shipAngularVelocity = new THREE.Vector3(); // Stores pitch/yaw/roll rates

        // --- Ship Label Sprites ---
        this.frontLabelSprite = null;
        this.backLabelSprite = null;

        // --- Edit Mode State ---
        this.isEditMode = false;

        // Controllers
        this.cameraController = null;
        this.inputController = null;

        // Status
        this.isInitialized = false;
        this.loadingSphere = null;
        this.loadingMaterial = null;

        // Bind event handlers
        this.onWindowResize = this.onWindowResize.bind(this);
        this.animate = this.animate.bind(this);
        this.onFocusPlanet = this.onFocusPlanet.bind(this); // Keep for planet focus via UI
        this.onGenerateShip = this.onGenerateShip.bind(this); // Keep for button/event
        this.handleKeyDown = this.handleKeyDown.bind(this); // Bind keydown handler

        // Initialize the application
        this.init();
    }

    async init() {
        // Set up scene
        this.scene = new THREE.Scene();

        // Set up camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        this.camera.position.set(0, 30, 80);

        // Set up renderer
        const canvas = document.getElementById('webgl-canvas');
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true 
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

        // Set up controls (OrbitControls)
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 400;
        this.controls.enablePan = true; // Keep pan enabled for OrbitControls mode

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const sunLight = new THREE.PointLight(0xffffff, 6.0);
        this.scene.add(sunLight);

        // Create loading indicator
        this.createLoadingIndicator();

        // Load textures
        await this.loadTextures();

        // Remove loading indicator
        this.removeLoadingIndicator();

        // --- Create Labels (before controllers) ---
        this.frontLabelSprite = createTextSprite("Front", { scale: 1.5 });
        this.backLabelSprite = createTextSprite("Back", { scale: 1.5 });
        this.frontLabelSprite.visible = false;
        this.backLabelSprite.visible = false;
        this.scene.add(this.frontLabelSprite); // Add to scene initially detached
        this.scene.add(this.backLabelSprite);

        // Initialize controllers (Pass sprites to CameraController)
        this.cameraController = new CameraController(
            this.camera,
            this.controls,
            this.frontLabelSprite, // Pass reference
            this.backLabelSprite   // Pass reference
        );
        this.inputController = new InputController(this.camera, this.controls, this.cameraController);
        this.inputController.initialize(); // Initialize listeners AFTER DOM is ready and instance exists

        // Create solar system
        const celestialFactory = new CelestialFactory(this.texturesMap);
        const solarSystem = celestialFactory.createSolarSystem(this.scene);
        this.planets = solarSystem.planets;
        this.clickableObjects = solarSystem.clickableObjects;
        this.moonMesh = solarSystem.moonMesh;
        this.asteroidBelt = solarSystem.asteroidBelt;
        this.inputController.setClickableObjects(this.clickableObjects); // Set clickables

        // Populate planet list dropdown
        this.populatePlanetDropdown();

        // Generate initial spaceship
        this.generateNewSpaceship(); // This now also resets physics state

        // Set up event listeners
        window.addEventListener('resize', this.onWindowResize);
        document.addEventListener('focus-planet', this.onFocusPlanet); // Listen for UI focus events
        document.addEventListener('generate-ship', this.onGenerateShip); // Listen for generate event
        window.addEventListener('keydown', this.handleKeyDown); // Add keydown listener

        // Attach button event listener (redundant if using event, but safe)
        const generateShipBtn = document.getElementById('generateShipBtn');
        if (generateShipBtn) {
            generateShipBtn.addEventListener('click', this.onGenerateShip);
        }

        this.isInitialized = true;
        this.animate();
    }

    createLoadingIndicator() {
        const loadingGeo = new THREE.TorusKnotGeometry(0.8, 0.25, 100, 16);
        this.loadingMaterial = new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            emissive: 0x00aaff,
            emissiveIntensity: 0,
            roughness: 0.5,
            metalness: 0.1
        });
        this.loadingSphere = new THREE.Mesh(loadingGeo, this.loadingMaterial);
        this.loadingSphere.position.set(0, 1, 0);
        this.scene.add(this.loadingSphere);
        console.log("Loading indicator added.");
    }

    removeLoadingIndicator() {
        if (this.loadingSphere) {
            console.log("Removing loading indicator.");
            this.scene.remove(this.loadingSphere);
            this.loadingSphere.geometry.dispose();
            if (this.loadingMaterial) this.loadingMaterial.dispose();
            this.loadingSphere = null;
            this.loadingMaterial = null;
        }
    }

    async loadTextures() {
        console.log("Starting texture loading...");
        const textureLoader = new THREE.TextureLoader();
        const textureLoadPromises = [];
        const textureKeys = Object.keys(textureFiles);

        for (const key of textureKeys) {
            const url = baseURL + textureFiles[key];
            const isColorData = !(key === 'saturnRing'); // Handle alpha textures differently
            
            textureLoadPromises.push(
                textureLoader.loadAsync(url)
                    .then(texture => {
                        if (isColorData) { 
                            texture.colorSpace = THREE.SRGBColorSpace; 
                        }
                        this.texturesMap.set(key, texture);
                        console.log(`Texture loaded: ${key}`);
                    })
                    .catch(error => {
                        console.error(`Failed to load texture: ${key} (${url})`, error);
                        this.texturesMap.set(key, null);
                    })
            );
        }
        
        await Promise.all(textureLoadPromises);
        console.log("Texture loading finished.");
    }

    populatePlanetDropdown() {
        const dropdownContent = document.getElementById('planetListDropdown');
        if (!dropdownContent) return;
        
        // Clear existing content
        dropdownContent.innerHTML = '<button data-name="Background">Reset Focus</button>';
        
        // Add Sun button
        const sunButton = document.createElement('button');
        sunButton.textContent = "Sun";
        sunButton.dataset.name = "Sun";
        dropdownContent.appendChild(sunButton);
        
        // Add planet buttons
        this.planets.forEach(planet => {
            const button = document.createElement('button');
            button.textContent = planet.name;
            button.dataset.name = planet.name;
            dropdownContent.appendChild(button);
        });
        
        // Add Moon button if Moon exists
        if (this.moonMesh) {
            const moonButton = document.createElement('button');
            moonButton.textContent = "Moon";
            moonButton.dataset.name = "Moon";
            dropdownContent.appendChild(moonButton);
        }
    }

    generateNewSpaceship() {
        // --- Cleanup existing ship ---
        this.pulsingMaterials = [];
        this.rotatingParts = [];
        if (this.currentSpaceship) {
            this.scene.remove(this.currentSpaceship);
            // Remove ship and its parts from clickable objects
            this.clickableObjects = this.clickableObjects.filter(
                obj => obj !== this.currentSpaceship &&
                      obj.userData?.parentShip !== this.currentSpaceship
            );
            // Dispose geometry/materials
            this.currentSpaceship.traverse(object => {
                if (object.isMesh) {
                    if (object.geometry) object.geometry.dispose();
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else if (object.material) {
                        object.material.dispose();
                    }
                }
            });
            console.log("Previous spaceship removed and disposed.");

            // Detach labels if they were attached
            if (this.frontLabelSprite.parent === this.currentSpaceship) {
                this.currentSpaceship.remove(this.frontLabelSprite);
            }
            if (this.backLabelSprite.parent === this.currentSpaceship) {
                this.currentSpaceship.remove(this.backLabelSprite);
            }
        }

        // --- Exit edit mode if active ---
        if (this.isEditMode) {
            this.toggleEditMode(); // Turn off edit mode before generating new ship
        }

        // --- Create new ship ---
        try {
            const spaceshipFactory = new SpaceshipFactory();
            const result = spaceshipFactory.createSpaceship(); // Factory sets initial position/scale

            this.currentSpaceship = result.spaceship;
            this.pulsingMaterials = result.pulsingMaterials;
            this.rotatingParts = result.rotatingParts;

            // --- Reset physics state ---
            this.shipVelocity.set(0, 0, 0);
            // Start with the ship's initial orientation from the factory
            this.shipRotation.copy(this.currentSpaceship.quaternion);
            this.shipAngularVelocity.set(0, 0, 0);

            this.scene.add(this.currentSpaceship);
            this.clickableObjects.push(this.currentSpaceship); // Add base ship group
            // Add child meshes to clickable objects as well? Maybe not needed if base group is clicked.
            this.inputController.setClickableObjects(this.clickableObjects); // Update clickables

            // --- Attach Labels to New Ship ---
            // Position relative to the ship's origin
            this.frontLabelSprite.position.set(0, 6.0, 0); // Updated Front Position (+Y)
            this.backLabelSprite.position.set(0, -6.0, 0); // Updated Back Position (-Y)
            this.currentSpaceship.add(this.frontLabelSprite);
            this.currentSpaceship.add(this.backLabelSprite);
            // Visibility will be controlled by CameraController

            console.log("New spaceship generated.");

            // --- Focus camera on the new ship ---
            this.cameraController.focusOnObject(this.currentSpaceship);

        } catch (error) {
            console.error("Error generating spaceship:", error);
            this.currentSpaceship = null; // Ensure it's null on error
        }
    }

    onWindowResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    onFocusPlanet(event) { // Handles focus requests from UI dropdown
        const planetName = event.detail.planetName;
        let objectToFocus = null;

        if (planetName === 'Background') {
            this.cameraController.resetFocus();
            return;
        } else if (planetName === 'Sun') {
            objectToFocus = this.scene.children.find(obj => obj.userData?.name === 'Sun');
        } else if (planetName === 'Moon') {
            objectToFocus = this.moonMesh;
        } else {
            const foundPlanetData = this.planets.find(p => p.name === planetName);
            if (foundPlanetData) objectToFocus = foundPlanetData.mesh;
        }

        if (objectToFocus) {
            this.cameraController.focusOnObject(objectToFocus);
        } else {
            console.warn(`Could not find mesh for ${planetName} to focus.`);
        }
    }

    onGenerateShip() { // Handles generate request from button/event
        this.generateNewSpaceship();
    }

    // --- Updated: Keydown Handler ---
    handleKeyDown(event) {
        // Handle Edit Mode Toggle ('P')
        if (event.key.toUpperCase() === 'P') {
            this.toggleEditMode(); // This function handles ship focus check
        }
        // Let InputController handle 'R', 'W', 'S' etc.
    }

    // --- Updated: Toggle Edit Mode Logic ---
    toggleEditMode() {
        if (!this.currentSpaceship || this.cameraController.targetObject !== this.currentSpaceship) {
            console.log("Edit mode only available when focused on the spaceship.");
            return; // Only allow edit mode when focused on the ship
        }

        // --- Disable Ship Navigation Mode when entering Edit Mode ---
        if (!this.isEditMode && this.inputController.shipNavigationModeActive) {
            this.inputController.toggleShipNavigationMode(); // Turn off mouse steering
        }

        this.isEditMode = !this.isEditMode;
        console.log("Edit Mode:", this.isEditMode ? "ON" : "OFF");

        if (this.isEditMode) {
            this.cameraController.enterEditMode(this.currentSpaceship);
        } else {
            this.cameraController.exitEditMode();
            this.cameraController.focusOnObject(this.currentSpaceship);
            // Note: Exiting edit mode defaults to UI interaction mode (ship nav mode remains off)
        }
    }

    animate() {
        requestAnimationFrame(this.animate);

        const delta = Math.min(this.clock.getDelta(), 0.1);
        const elapsed = this.clock.getElapsedTime();

        // --- Get Input ---
        // getShipControls now handles prioritization based on active modes
        const shipControls = this.inputController.getShipControls(delta);

        // --- Update Spaceship Physics (if ship exists AND not in edit mode) ---
        if (this.currentSpaceship && !this.isEditMode) {
            // Use the controls returned by getShipControls
            let effectiveControls = shipControls || { thrust: 0, pitch: 0, yaw: 0, roll: 0 };

            // 1. Calculate Force/Acceleration based on thrust
            const forwardVector = new THREE.Vector3(0, 1, 0).applyQuaternion(this.shipRotation);
            let acceleration = new THREE.Vector3();
            if (effectiveControls.thrust > 0) {
                acceleration.addScaledVector(forwardVector, effectiveControls.thrust * shipSettings.THRUST_FORCE);
            } else if (effectiveControls.thrust < 0) {
                acceleration.addScaledVector(forwardVector, effectiveControls.thrust * shipSettings.DECELERATION_FORCE);
            }

            // 2. Update Velocity
            this.shipVelocity.addScaledVector(acceleration, delta);
            this.shipVelocity.multiplyScalar(Math.pow(shipSettings.LINEAR_DAMPING, delta * 60));

            // 3. Clamp Velocity
            const currentSpeed = this.shipVelocity.length();
            const direction = this.shipVelocity.clone().normalize();
            if (currentSpeed > shipSettings.MAX_SPEED && acceleration.dot(direction) > 0) {
                this.shipVelocity.copy(direction.multiplyScalar(shipSettings.MAX_SPEED));
            } else if (currentSpeed > Math.abs(shipSettings.MIN_SPEED) && acceleration.dot(direction) < 0) {
                this.shipVelocity.copy(direction.multiplyScalar(Math.abs(shipSettings.MIN_SPEED)));
            }

            // 4. Calculate Angular Velocity based on stick/tilt input
            this.shipAngularVelocity.set(
                effectiveControls.pitch * shipSettings.PITCH_SPEED,
                effectiveControls.roll * shipSettings.ROLL_SPEED,
                effectiveControls.yaw * shipSettings.YAW_SPEED
            );

            // 5. Update Rotation
            const deltaRotation = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(
                    this.shipAngularVelocity.x * delta,
                    this.shipAngularVelocity.y * delta,
                    this.shipAngularVelocity.z * delta,
                    'YXZ'
                )
            );
            this.shipRotation.premultiply(deltaRotation);
            this.shipRotation.normalize();

            // 6. Update Ship Position
            this.currentSpaceship.position.addScaledVector(this.shipVelocity, delta);

            // 7. Apply Ship Orientation
            this.currentSpaceship.quaternion.copy(this.shipRotation);

            // Animate spaceship components
            const pulseIntensity = 0.75 + Math.sin(elapsed * Math.PI * 2.0) * 0.25;
            this.pulsingMaterials.forEach(material => {
                material.emissiveIntensity = pulseIntensity;
            });
            const rotationSpeed = delta * 0.8;
            this.rotatingParts.forEach(part => {
                part.rotation.y += rotationSpeed;
            });

        } else if (this.currentSpaceship && this.isEditMode) {
            const pulseIntensity = 0.75 + Math.sin(elapsed * Math.PI * 2.0) * 0.25;
            this.pulsingMaterials.forEach(material => {
                material.emissiveIntensity = pulseIntensity;
            });
            const rotationSpeed = delta * 0.8;
            this.rotatingParts.forEach(part => {
                part.rotation.y += rotationSpeed;
            });
        }

        // --- Update Camera ---
        this.cameraController.update(delta, this.isEditMode);

        // --- Update Planets ---
        if (this.isInitialized) {
            this.planets.forEach(planet => {
                if (planet.pivot) planet.pivot.rotation.y += planet.orbitSpeed * delta * 10;
                if (planet.mesh) planet.mesh.rotateY(planet.rotationSpeed * delta * 10);
                if (planet.cloudMesh) planet.cloudMesh.rotateY(planet.rotationSpeed * 1.1 * delta * 10);
                if (planet.moonPivot) {
                    planet.moonPivot.rotation.y += planet.moonOrbitSpeed * delta * 10;
                    if (this.moonMesh) this.moonMesh.rotateY(planet.rotationSpeed * delta * 5);
                }
            });
            if (this.asteroidBelt) {
                this.asteroidBelt.rotation.y += 0.0001 * delta * 60;
            }
        }

        // --- Update OrbitControls ---
        if (this.controls && (this.cameraController.orbitControlsEnabled || this.isEditMode)) {
            this.controls.update();
        }

        // --- Render ---
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    new SolarSystemSimulation();
});