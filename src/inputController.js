/**
 * Input controller for handling mouse, touch, gamepad, and device orientation inputs
 */
import * as THREE from 'three';
import { gamepadSettings, mobileControlSettings, keyboardMouseSettings } from './config.js'; // Import new settings

export class InputController {
    constructor(camera, controls, cameraController) {
        this.camera = camera;
        this.controls = controls;
        this.cameraController = cameraController;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(); // Normalized device coordinates
        this.clickableObjects = [];

        // Gamepad state
        this.gamepadConnected = false;
        this.gamepad = null;
        this.previousButtonStates = {};
        this.debounceTimeout = null;

        // Mobile Control State
        this.isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        this.orientationPermissionGranted = false;
        this.deviceOrientationData = { alpha: 0, beta: 0, gamma: 0 };
        this.initialOrientation = null; // Store initial orientation for calibration
        this.thrustButtonPressed = false;
        this.brakeButtonPressed = false;
        this.motionControlsEnabled = false; // Flag to track if motion controls are active

        // --- Keyboard & Mouse State ---
        this.keysPressed = {}; // Store state of relevant keys
        this.mousePosition = { x: 0, y: 0 }; // Store raw mouse position
        this.shipNavigationModeActive = false; // Mode for mouse steering

        // UI elements - Initialize as null
        this.uiContainer = null;
        this.focusBtn = null;
        this.planetListDropdown = null;
        this.distanceSlider = null;
        this.generateShipBtn = null;
        this.thrustBtn = null;
        this.brakeBtn = null;
        this.enableMotionBtn = null;
        this.mouseIndicator = null;
    }

    initialize() {
        this.initEventListeners();
    }

    initEventListeners() {
        console.log("Attempting to initialize input event listeners...");

        // --- Fetch UI Elements ---
        // Fetch elements here, ensuring DOM is ready
        this.uiContainer = document.querySelector('.ui-container');
        this.focusBtn = document.getElementById('focusBtn');
        this.planetListDropdown = document.getElementById('planetListDropdown');
        this.distanceSlider = document.getElementById('distanceSlider');
        this.generateShipBtn = document.getElementById('generateShipBtn');
        this.thrustBtn = document.getElementById('thrustBtn');
        this.brakeBtn = document.getElementById('brakeBtn');
        this.enableMotionBtn = document.getElementById('enableMotionBtn'); // Assuming you add this button
        this.mouseIndicator = document.getElementById('mouse-indicator'); // Get indicator element

        // Add checks here to see if elements were found immediately
        if (!this.thrustBtn) console.error("INITLISTENERS: Element with ID 'thrustBtn' NOT FOUND.");
        if (!this.brakeBtn) console.error("INITLISTENERS: Element with ID 'brakeBtn' NOT FOUND.");
        if (!this.enableMotionBtn) console.warn("INITLISTENERS: Element with ID 'enableMotionBtn' not found (optional).");
        if (!this.mouseIndicator) console.error("INITLISTENERS: Element with ID 'mouse-indicator' NOT FOUND.");
        if (!this.focusBtn) console.warn("Focus button (#focusBtn) not found.");
        if (!this.planetListDropdown) console.warn("Planet list dropdown (#planetListDropdown) not found.");

        // Raycasting Listener (conditionally disable later)
        this.pointerDownListener = this.onPointerDown.bind(this);
        window.addEventListener('pointerdown', this.pointerDownListener);

        // UI Control Listeners
        const canvas = document.getElementById('webgl-canvas');
        canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));

        if (this.focusBtn) {
            this.focusBtn.addEventListener('click', (event) => {
                // Check if planetListDropdown exists *before* trying to use it
                if (this.planetListDropdown) {
                    event.stopPropagation();
                    this.planetListDropdown.classList.toggle('show');
                } else {
                    console.error("Cannot toggle dropdown, planetListDropdown element not found.");
                }
            });
        }
        if (this.planetListDropdown) {
            this.planetListDropdown.addEventListener('click', this.onPlanetListClick.bind(this));
        }

        window.addEventListener('click', (event) => {
            // Use optional chaining and check focusBtn existence
            if (this.planetListDropdown?.classList.contains('show') && !this.focusBtn?.contains(event.target)) {
                this.planetListDropdown.classList.remove('show');
            }
        });

        this.distanceSlider.addEventListener('input', (event) => {
            this.cameraController.setDistance(parseFloat(event.target.value));
        });

        // Gamepad Listeners
        window.addEventListener('gamepadconnected', this.onGamepadConnected.bind(this));
        window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected.bind(this));

        // Mobile Control Listeners & Visibility
        if (this.isTouchDevice) {
            console.log("Touch device detected, attempting to add mobile listeners.");

            // Check thrustBtn before adding listeners
            console.log("INITLISTENERS: Checking thrustBtn:", this.thrustBtn); // Log the element
            if (this.thrustBtn) {
                try {
                    this.thrustBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.thrustButtonPressed = true; }, { passive: false });
                    this.thrustBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.thrustButtonPressed = false; }, { passive: false });
                    this.thrustBtn.addEventListener('touchcancel', (e) => { e.preventDefault(); this.thrustButtonPressed = false; }, { passive: false });
                    this.thrustBtn.style.display = 'flex';
                } catch (error) {
                    console.error("INITLISTENERS: Error adding listeners to thrustBtn:", error, this.thrustBtn);
                }
            } else {
                console.error("INITLISTENERS: Cannot add listeners to 'thrustBtn' - element was null or undefined.");
            }

            // Check brakeBtn before adding listeners
            console.log("INITLISTENERS: Checking brakeBtn:", this.brakeBtn); // Log the element
            if (this.brakeBtn) {
                try {
                    this.brakeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.brakeButtonPressed = true; }, { passive: false });
                    this.brakeBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.brakeButtonPressed = false; }, { passive: false });
                    this.brakeBtn.addEventListener('touchcancel', (e) => { e.preventDefault(); this.brakeButtonPressed = false; }, { passive: false });
                    this.brakeBtn.style.display = 'flex';
                } catch (error) {
                    console.error("INITLISTENERS: Error adding listeners to brakeBtn:", error, this.brakeBtn);
                }
            } else {
                console.error("INITLISTENERS: Cannot add listeners to 'brakeBtn' - element was null or undefined.");
            }

            // Check enableMotionBtn before adding listener
            console.log("INITLISTENERS: Checking enableMotionBtn:", this.enableMotionBtn); // Log the element
            if (this.enableMotionBtn) {
                try {
                    this.enableMotionBtn.addEventListener('click', this.requestOrientationPermission.bind(this));
                    this.enableMotionBtn.style.display = 'block';
                } catch (error) {
                    console.error("INITLISTENERS: Error adding listener to enableMotionBtn:", error, this.enableMotionBtn);
                }
            } else {
                console.warn("INITLISTENERS: Motion enable button not found, cannot add permission request listener.");
            }

        } else {
            console.log("Non-touch device detected, hiding mobile controls.");
            // Hide mobile buttons if not a touch device (check existence first)
            if (this.thrustBtn) this.thrustBtn.style.display = 'none';
            if (this.brakeBtn) this.brakeBtn.style.display = 'none';
            if (this.enableMotionBtn) this.enableMotionBtn.style.display = 'none';
        }

        // --- Keyboard Listeners ---
        this.keyDownListener = this.handleKeyDown.bind(this);
        this.keyUpListener = this.handleKeyUp.bind(this);
        window.addEventListener('keydown', this.keyDownListener);
        window.addEventListener('keyup', this.keyUpListener);

        // --- Mouse Move Listener ---
        this.mouseMoveListener = this.handleMouseMove.bind(this);
        window.addEventListener('mousemove', this.mouseMoveListener);

        // --- Initial UI State ---
        // Show mouse indicator by default on non-touch devices if KBM is the fallback
        if (!this.isTouchDevice && this.mouseIndicator) { // Check if indicator exists
            this.mouseIndicator.style.display = 'block';
        } else if (this.mouseIndicator) { // Ensure it's hidden on touch devices initially
            this.mouseIndicator.style.display = 'none';
        }

        console.log("Input event listeners initialized.");
    }

    // --- Keyboard Handlers ---
    handleKeyDown(event) {
        if (event.key.toUpperCase() === 'R') {
            if (!this.cameraController.isCurrentlyInEditMode) {
                this.toggleShipNavigationMode();
            } else {
                console.log("Cannot toggle navigation mode while in Edit Mode (P).");
            }
        }

        this.keysPressed[event.key.toUpperCase()] = true;
    }

    handleKeyUp(event) {
        this.keysPressed[event.key.toUpperCase()] = false;
    }

    // --- Mouse Move Handler ---
    handleMouseMove(event) {
        this.mousePosition.x = event.clientX;
        this.mousePosition.y = event.clientY;

        if (!this.shipNavigationModeActive) {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        }
    }

    // --- Toggle Ship Navigation Mode ---
    toggleShipNavigationMode() {
        this.shipNavigationModeActive = !this.shipNavigationModeActive;
        console.log("Ship Navigation Mode:", this.shipNavigationModeActive ? "ON" : "OFF");

        if (this.shipNavigationModeActive) {
            window.removeEventListener('pointerdown', this.pointerDownListener);
            document.body.style.cursor = 'none';
            if (this.mouseIndicator) this.mouseIndicator.style.display = 'none'; // Check existence
        } else {
            window.addEventListener('pointerdown', this.pointerDownListener);
            document.body.style.cursor = 'default';
            if (!this.isTouchDevice && this.mouseIndicator) { // Check existence
                this.mouseIndicator.style.display = 'block';
            }
            this.mouse.x = (this.mousePosition.x / window.innerWidth) * 2 - 1;
            this.mouse.y = -(this.mousePosition.y / window.innerHeight) * 2 + 1;
        }
    }

    async requestOrientationPermission() {
        if (this.motionControlsEnabled) return;

        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permissionState = await DeviceOrientationEvent.requestPermission();
                if (permissionState === 'granted') {
                    this.orientationPermissionGranted = true;
                    this.startOrientationListener();
                    console.log("Device orientation permission granted.");
                    this.motionControlsEnabled = true;
                    if (this.enableMotionBtn) this.enableMotionBtn.style.display = 'none';
                } else {
                    console.warn("Device orientation permission denied.");
                    this.orientationPermissionGranted = false;
                }
            } catch (error) {
                console.error("Error requesting device orientation permission:", error);
                this.orientationPermissionGranted = false;
            }
        } else {
            console.log("Device orientation does not require explicit permission or is not supported.");
            this.orientationPermissionGranted = true;
            this.startOrientationListener();
            this.motionControlsEnabled = true;
            if (this.enableMotionBtn) this.enableMotionBtn.style.display = 'none';
        }
    }

    startOrientationListener() {
        if (!this.orientationPermissionGranted) return;
        console.log("Starting device orientation listener.");
        const handleInitialOrientation = (event) => {
            if (event.beta !== null && event.gamma !== null) {
                this.initialOrientation = { beta: event.beta, gamma: event.gamma };
                console.log("Initial orientation captured:", this.initialOrientation);
                window.removeEventListener('deviceorientation', handleInitialOrientation);
                window.addEventListener('deviceorientation', this.onDeviceOrientation.bind(this));
            }
        };
        window.addEventListener('deviceorientation', handleInitialOrientation);
    }

    onDeviceOrientation(event) {
        this.deviceOrientationData.alpha = event.alpha ?? 0;
        this.deviceOrientationData.beta = event.beta ?? 0;
        this.deviceOrientationData.gamma = event.gamma ?? 0;
    }

    setClickableObjects(objects) {
        this.clickableObjects = objects;
    }

    onPointerDown(event) {
        if (event.button !== 0) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.clickableObjects, true);

        if (intersects.length > 0) {
            let clickedObject = intersects[0].object;
            while (clickedObject.parent && !this.clickableObjects.includes(clickedObject)) {
                if (clickedObject.userData?.clickableParent) {
                    clickedObject = clickedObject.parent;
                    break;
                }
                clickedObject = clickedObject.parent;
            }

            if (this.clickableObjects.includes(clickedObject)) {
                console.log("Clicked on:", clickedObject.userData?.name || clickedObject.uuid);
                this.cameraController.focusOnObject(clickedObject);
            }
        }
    }

    onPlanetListClick(event) {
        if (event.target.tagName === 'BUTTON') {
            const planetName = event.target.dataset.name;
            this.planetListDropdown.style.display = 'none';

            if (planetName === 'Background') {
                this.cameraController.resetFocus();
                return;
            }

            const focusEvent = new CustomEvent('focus-planet', { 
                detail: { planetName: planetName }
            });
            document.dispatchEvent(focusEvent);
        }
    }

    onGamepadConnected(event) {
        console.log('Gamepad connected:', event.gamepad.id);
        this.gamepad = event.gamepad;
        this.gamepadConnected = true;
        this.previousButtonStates = {};
        document.getElementById('controller-status').style.opacity = '1';
        if (!this.shipNavigationModeActive && this.mouseIndicator) { // Check existence
            this.mouseIndicator.style.display = 'none';
        }
    }

    onGamepadDisconnected(event) {
        console.log('Gamepad disconnected:', event.gamepad.id);
        if (this.gamepad && this.gamepad.index === event.gamepad.index) {
            this.gamepadConnected = false;
            this.gamepad = null;
            this.previousButtonStates = {};
        }
        document.getElementById('controller-status').style.opacity = '0.3';
        if (!this.shipNavigationModeActive && !this.isTouchDevice && this.mouseIndicator) { // Check existence
            this.mouseIndicator.style.display = 'block';
        }
    }

    isButtonPressed(buttonIndex, currentGamepad) {
        const button = currentGamepad.buttons[buttonIndex];
        const wasPressed = this.previousButtonStates[buttonIndex] || false;
        const isPressed = button?.pressed || false;
        this.previousButtonStates[buttonIndex] = isPressed;
        return isPressed && !wasPressed;
    }

    getShipControls(delta) {
        if (this.shipNavigationModeActive) {
            const keyboardMouseControls = this.getKeyboardMouseControls();
            return keyboardMouseControls;
        }

        if (this.isTouchDevice && this.motionControlsEnabled && this.initialOrientation) {
            const mobileControls = this.getMobileControls();
            if (mobileControls) return mobileControls;
        }

        if (this.gamepadConnected && this.gamepad) {
            const gamepadControls = this.getGamepadControls();
            if (gamepadControls) return gamepadControls;
        }

        return { thrust: 0, pitch: 0, yaw: 0, roll: 0, actions: {} };
    }

    getKeyboardMouseControls() {
        let thrust = 0;
        let pitch = 0;
        let yaw = 0;
        const roll = 0;

        if (this.keysPressed['W']) {
            thrust = 1.0;
        } else if (this.keysPressed['S']) {
            thrust = -1.0;
        }

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const deltaX = this.mousePosition.x - centerX;
        const deltaY = this.mousePosition.y - centerY;

        yaw = -THREE.MathUtils.clamp(deltaX * keyboardMouseSettings.YAW_SENSITIVITY, -1, 1);
        pitch = -THREE.MathUtils.clamp(deltaY * keyboardMouseSettings.PITCH_SENSITIVITY, -1, 1);

        if (Math.abs(deltaX) < keyboardMouseSettings.MOUSE_DEADZONE_RADIUS) {
            yaw = 0;
        }
        if (Math.abs(deltaY) < keyboardMouseSettings.MOUSE_DEADZONE_RADIUS) {
            pitch = 0;
        }

        return {
            thrust,
            pitch,
            yaw,
            roll,
            actions: {}
        };
    }

    getMobileControls() {
        if (!this.initialOrientation) return null;

        let thrust = 0;
        let pitch = 0;
        let yaw = 0;
        let roll = 0;

        const relativeBeta = this.deviceOrientationData.beta - this.initialOrientation.beta;
        const relativeGamma = this.deviceOrientationData.gamma - this.initialOrientation.gamma;

        const pitchInput = -relativeBeta;
        if (Math.abs(pitchInput) > mobileControlSettings.TILT_THRESHOLD) {
            pitch = THREE.MathUtils.clamp(pitchInput * mobileControlSettings.PITCH_SENSITIVITY, -1, 1);
        }

        const rollInput = relativeGamma;
        if (Math.abs(rollInput) > mobileControlSettings.TILT_THRESHOLD) {
            roll = THREE.MathUtils.clamp(rollInput * mobileControlSettings.ROLL_SENSITIVITY, -1, 1);
        }

        if (this.thrustButtonPressed) {
            thrust = 1.0;
        } else if (this.brakeButtonPressed) {
            thrust = -1.0;
        }

        return {
            thrust,
            pitch,
            yaw,
            roll,
            actions: {}
        };
    }

    getGamepadControls() {
        if (!this.gamepadConnected || !this.gamepad) return null;

        const currentGamepad = navigator.getGamepads()[this.gamepad.index];
        if (!currentGamepad) {
            this.previousButtonStates = {};
            return null;
        }

        const leftStickX = currentGamepad.axes[0];
        const leftStickY = currentGamepad.axes[1];
        const rightStickX = currentGamepad.axes[2];
        const leftTrigger = currentGamepad.buttons[6]?.value || 0;
        const rightTrigger = currentGamepad.buttons[7]?.value || 0;

        let thrust = 0;
        let pitch = 0;
        let yaw = 0;
        let roll = 0;

        if (rightTrigger > gamepadSettings.AXIS_THRESHOLD) {
            thrust = rightTrigger;
        } else if (leftTrigger > gamepadSettings.AXIS_THRESHOLD) {
            thrust = -leftTrigger;
        }

        if (Math.abs(leftStickY) > gamepadSettings.AXIS_THRESHOLD) {
            pitch = -leftStickY;
        }
        if (Math.abs(leftStickX) > gamepadSettings.AXIS_THRESHOLD) {
            yaw = -leftStickX;
        }

        if (Math.abs(rightStickX) > gamepadSettings.AXIS_THRESHOLD) {
            roll = -rightStickX;
        }

        let generateShip = this.isButtonPressed(3, currentGamepad);
        let resetFocus = this.isButtonPressed(1, currentGamepad);

        if (generateShip) {
            document.dispatchEvent(new CustomEvent('generate-ship'));
        }
        if (resetFocus) {
            this.cameraController.resetFocus();
        }

        return {
            thrust, pitch, yaw, roll,
            actions: { generateShip, resetFocus }
        };
    }
}