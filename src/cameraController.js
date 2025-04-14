/**
 * Camera controller for managing focus and view controls
 */
import * as THREE from 'three';

export class CameraController {
    // --- Pass sprite references to constructor ---
    constructor(camera, controls, frontLabelSprite, backLabelSprite) {
        this.camera = camera;
        this.controls = controls;
        this.targetObject = null;
        this.targetPositionVec = new THREE.Vector3();

        // --- Store Sprite References ---
        this.frontLabelSprite = frontLabelSprite;
        this.backLabelSprite = backLabelSprite;

        // Camera Offset for behind-thrusters view
        // Adjust Y for height, Z negative and far enough back
        this.followOffset = new THREE.Vector3(0.6, -23.0, -4.5); // Centered, slightly above, behind thrusters

        this.desiredCameraPosition = new THREE.Vector3();
        this.currentCameraPosition = new THREE.Vector3(); // Store current position for lerping
        this.lookAtPosition = new THREE.Vector3();
        this.currentLookAt = new THREE.Vector3(); // Store current lookAt for lerping

        // Smoothing factors (lower = smoother/slower)
        this.positionLerpFactor = 0.07; // Slightly smoother
        this.lookAtLerpFactor = 0.09;   // Slightly smoother

        // Store OrbitControls state
        this.orbitControlsEnabled = true;
        this.isCurrentlyInEditMode = false; // Track internal edit mode state

        // UI elements (less relevant for ship view)
        this.distanceControl = document.getElementById('distanceControl');
        this.distanceSlider = document.getElementById('distanceSlider');
        this.distanceValueLabel = document.getElementById('distanceValue');
        this.initialDistance = 10.0; // Default distance for OrbitControls focus
        this.desiredDistance = this.initialDistance;

        // --- New Editor UI Elements ---
        this.editorContainer = document.getElementById('camera-offset-editor');
        this.offsetXInput = document.getElementById('offsetX');
        this.offsetYInput = document.getElementById('offsetY');
        this.offsetZInput = document.getElementById('offsetZ');
        this.currentOffsetDisplay = document.getElementById('currentOffsetDisplay');

        // --- New Sprite Position Editor UI Elements ---
        this.spriteEditorContainer = document.getElementById('sprite-position-editor');
        this.frontXInput = document.getElementById('frontX');
        this.frontYInput = document.getElementById('frontY');
        this.frontZInput = document.getElementById('frontZ');
        this.backXInput = document.getElementById('backX');
        this.backYInput = document.getElementById('backY');
        this.backZInput = document.getElementById('backZ');

        // --- Add Event Listeners for Editor Inputs ---
        this.offsetXInput.addEventListener('input', this.handleOffsetChange.bind(this));
        this.offsetYInput.addEventListener('input', this.handleOffsetChange.bind(this));
        this.offsetZInput.addEventListener('input', this.handleOffsetChange.bind(this));

        // --- Add Event Listeners for Sprite Position Editor Inputs ---
        this.frontXInput.addEventListener('input', () => this.handleSpritePositionChange('front'));
        this.frontYInput.addEventListener('input', () => this.handleSpritePositionChange('front'));
        this.frontZInput.addEventListener('input', () => this.handleSpritePositionChange('front'));
        this.backXInput.addEventListener('input', () => this.handleSpritePositionChange('back'));
        this.backYInput.addEventListener('input', () => this.handleSpritePositionChange('back'));
        this.backZInput.addEventListener('input', () => this.handleSpritePositionChange('back'));
    }

    // --- New Method to Handle Offset Input Changes ---
    handleOffsetChange() {
        const x = parseFloat(this.offsetXInput.value) || 0;
        const y = parseFloat(this.offsetYInput.value) || 0;
        const z = parseFloat(this.offsetZInput.value) || 0;

        this.followOffset.set(x, y, z);
        this.updateOffsetDisplay(); // Update the display span
        console.log("Camera Offset Updated:", this.followOffset.toArray().map(v => v.toFixed(1)).join(', '));
    }

    // --- New Method to Update Offset Display ---
    updateOffsetDisplay() {
        this.currentOffsetDisplay.textContent = `(${this.followOffset.x.toFixed(1)}, ${this.followOffset.y.toFixed(1)}, ${this.followOffset.z.toFixed(1)})`;
    }

    // --- New Method to Handle Sprite Position Input Changes ---
    handleSpritePositionChange(spriteName) {
        let targetSprite;
        let xInput, yInput, zInput;

        if (spriteName === 'front' && this.frontLabelSprite) {
            targetSprite = this.frontLabelSprite;
            xInput = this.frontXInput;
            yInput = this.frontYInput;
            zInput = this.frontZInput;
        } else if (spriteName === 'back' && this.backLabelSprite) {
            targetSprite = this.backLabelSprite;
            xInput = this.backXInput;
            yInput = this.backYInput;
            zInput = this.backZInput;
        } else {
            return; // Invalid sprite name or sprite doesn't exist
        }

        const x = parseFloat(xInput.value) || 0;
        const y = parseFloat(yInput.value) || 0;
        const z = parseFloat(zInput.value) || 0;

        targetSprite.position.set(x, y, z);

        console.log(`${spriteName.charAt(0).toUpperCase() + spriteName.slice(1)} Sprite Position Updated:`,
            `(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`
        );
    }

    // --- New Method to Update Sprite Position Editor Inputs ---
    updateSpriteEditorInputs() {
        if (this.frontLabelSprite) {
            this.frontXInput.value = this.frontLabelSprite.position.x.toFixed(1);
            this.frontYInput.value = this.frontLabelSprite.position.y.toFixed(1);
            this.frontZInput.value = this.frontLabelSprite.position.z.toFixed(1);
        }
        if (this.backLabelSprite) {
            this.backXInput.value = this.backLabelSprite.position.x.toFixed(1);
            this.backYInput.value = this.backLabelSprite.position.y.toFixed(1);
            this.backZInput.value = this.backLabelSprite.position.z.toFixed(1);
        }
    }

    // --- Updated: Enter Edit Mode ---
    enterEditMode(target) {
        if (!target) return;
        this.isCurrentlyInEditMode = true;
        this.controls.enabled = true; // Ensure OrbitControls are enabled
        this.orbitControlsEnabled = true; // Keep this consistent for logic elsewhere if needed
        target.getWorldPosition(this.targetPositionVec);
        this.controls.target.copy(this.targetPositionVec); // Set OrbitControls target to the ship

        // --- Show Editors and Labels ---
        this.editorContainer.style.display = 'block';
        this.spriteEditorContainer.style.display = 'block';
        if (this.frontLabelSprite) this.frontLabelSprite.visible = true;
        if (this.backLabelSprite) this.backLabelSprite.visible = true;

        // Update input values when entering edit mode
        this.updateOffsetDisplay();
        this.updateSpriteEditorInputs();

        console.log("CameraController entered edit mode.");
    }

    // --- Updated: Exit Edit Mode ---
    exitEditMode() {
        this.isCurrentlyInEditMode = false;

        // --- Hide Editors and Labels ---
        this.editorContainer.style.display = 'none';
        this.spriteEditorContainer.style.display = 'none';
        if (this.frontLabelSprite) this.frontLabelSprite.visible = false;
        if (this.backLabelSprite) this.backLabelSprite.visible = false;

        console.log("CameraController exited edit mode.");
    }

    focusOnObject(objectMesh) {
        if (!objectMesh || !this.controls || !this.camera) return;

        const objectName = objectMesh.userData?.name || "Unknown Object";
        console.log("Focusing on:", objectName);

        this.targetObject = objectMesh;
        this.targetObject.getWorldPosition(this.targetPositionVec); // Get initial position

        // --- Exit Edit Mode if focusing on something else ---
        if (objectName !== "Spaceship" && this.isCurrentlyInEditMode) {
            this.exitEditMode(); // This call will also hide editors/sprites
        }

        if (objectName === "Spaceship") {
            // --- Spaceship Focus ---
            // Disable OrbitControls ONLY if NOT in edit mode
            if (!this.isCurrentlyInEditMode) {
                if (this.orbitControlsEnabled) {
                    this.controls.enabled = false;
                    this.orbitControlsEnabled = false;
                    console.log("OrbitControls Disabled for Spaceship focus (Follow Cam).");
                }

                // --- Hide Editors and Labels (if not in edit mode) ---
                this.editorContainer.style.display = 'none';
                this.spriteEditorContainer.style.display = 'none';
                if (this.frontLabelSprite) this.frontLabelSprite.visible = false;
                if (this.backLabelSprite) this.backLabelSprite.visible = false;

            } else { // If already in edit mode when focus is called
                this.controls.enabled = true;
                this.orbitControlsEnabled = true;

                // Ensure editors/labels remain visible
                this.editorContainer.style.display = 'block';
                this.spriteEditorContainer.style.display = 'block';
                if (this.frontLabelSprite) this.frontLabelSprite.visible = true;
                if (this.backLabelSprite) this.backLabelSprite.visible = true;
                console.log("OrbitControls remain Enabled for Spaceship focus (Edit Mode).");
            }

            this.distanceControl.style.display = 'none';

            // Calculate initial desired positions only if NOT in edit mode
            if (!this.isCurrentlyInEditMode) {
                const worldOffset = this.followOffset.clone().applyMatrix4(this.targetObject.matrixWorld);
                this.desiredCameraPosition.copy(worldOffset);
                this.currentCameraPosition.copy(this.desiredCameraPosition);

                const lookAheadOffset = new THREE.Vector3(0, 0.5, 0);
                const worldLookAhead = lookAheadOffset.clone().applyMatrix4(this.targetObject.matrixWorld);
                this.lookAtPosition.copy(worldLookAhead);
                this.currentLookAt.copy(this.lookAtPosition);

                this.camera.position.copy(this.currentCameraPosition);
                this.camera.lookAt(this.currentLookAt);
            } else {
                // If entering edit mode, set OrbitControls target
                this.targetObject.getWorldPosition(this.targetPositionVec);
                this.controls.target.copy(this.targetPositionVec);

                // Ensure input values are up-to-date
                this.updateOffsetDisplay();
                this.updateSpriteEditorInputs();
            }

        } else {
            // --- Planet/Sun/Moon Focus ---
            if (!this.orbitControlsEnabled) {
                this.controls.enabled = true;
                this.orbitControlsEnabled = true;
                console.log("OrbitControls Enabled for Celestial focus.");
            }

            // --- Ensure Editors and Labels are Hidden ---
            this.editorContainer.style.display = 'none';
            this.spriteEditorContainer.style.display = 'none';
            if (this.frontLabelSprite) this.frontLabelSprite.visible = false;
            if (this.backLabelSprite) this.backLabelSprite.visible = false;

            // Calculate direction for OrbitControls focus
            const cameraOffsetDir = new THREE.Vector3().subVectors(this.camera.position, this.targetPositionVec).normalize();
            this.desiredDistance = this.initialDistance; // Reset distance

            // Adjust slider range based on object type
            let minFocusDist = 3;
            let maxFocusDist = 50;
            if (objectMesh.geometry?.parameters?.radius) {
                minFocusDist = objectMesh.geometry.parameters.radius * 2.5;
                maxFocusDist = Math.max(50, this.initialDistance * 2);
            }
            this.distanceSlider.min = minFocusDist;
            this.distanceSlider.max = maxFocusDist;
            this.distanceSlider.value = this.desiredDistance;
            this.distanceValueLabel.textContent = this.desiredDistance.toFixed(1);
            this.distanceControl.style.display = 'flex';

            // Set OrbitControls target (it will handle movement)
            this.controls.target.copy(this.targetPositionVec);
        }
    }

    resetFocus() {
        console.log("Resetting focus to origin");
        this.targetObject = null;

        // --- Exit Edit Mode if active ---
        if (this.isCurrentlyInEditMode) {
            this.exitEditMode(); // This hides editors/sprites
        } else {
            // Ensure hidden if not exiting edit mode explicitly
            this.editorContainer.style.display = 'none';
            this.spriteEditorContainer.style.display = 'none';
            if (this.frontLabelSprite) this.frontLabelSprite.visible = false;
            if (this.backLabelSprite) this.backLabelSprite.visible = false;
        }

        if (!this.orbitControlsEnabled) {
            this.controls.enabled = true; // Re-enable OrbitControls
            this.orbitControlsEnabled = true;
            console.log("OrbitControls Enabled on Reset Focus.");
        }

        this.controls.target.set(0, 0, 0); // Reset OrbitControls target
        this.distanceControl.style.display = 'none';
    }

    setDistance(distance) { // Used by OrbitControls mode via slider
        this.desiredDistance = distance;
        if (this.orbitControlsEnabled) {
            this.distanceValueLabel.textContent = this.desiredDistance.toFixed(1);
        }
    }

    update(delta, isEditModeGlobal) { // Accept global edit mode state
        // Sync internal state if needed (e.g., if toggled externally)
        this.isCurrentlyInEditMode = isEditModeGlobal;

        if (this.targetObject && !this.orbitControlsEnabled && !this.isCurrentlyInEditMode) {
            // --- Update Follow Camera (Only when NOT in edit mode) ---
            const worldOffset = this.followOffset.clone().applyMatrix4(this.targetObject.matrixWorld);
            this.desiredCameraPosition.copy(worldOffset);

            const lookAheadOffset = new THREE.Vector3(0, 0.5, 0);
            const worldLookAhead = lookAheadOffset.clone().applyMatrix4(this.targetObject.matrixWorld);
            this.lookAtPosition.copy(worldLookAhead);

            this.currentCameraPosition.lerp(this.desiredCameraPosition, this.positionLerpFactor);
            this.currentLookAt.lerp(this.lookAtPosition, this.lookAtLerpFactor);

            this.camera.position.copy(this.currentCameraPosition);
            this.camera.lookAt(this.currentLookAt);

        } else if (this.orbitControlsEnabled && !this.isCurrentlyInEditMode) {
            // --- Update OrbitControls Target (Planet/Sun focus, NOT edit mode) ---
            if (this.targetObject) {
                this.targetObject.getWorldPosition(this.targetPositionVec);
                this.controls.target.lerp(this.targetPositionVec, this.lookAtLerpFactor);
            } else {
                this.controls.target.lerp(new THREE.Vector3(0, 0, 0), this.lookAtLerpFactor);
            }
        }
    }
}