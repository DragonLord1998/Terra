/**
 * Factory for creating customized spaceships
 */
import * as THREE from 'three';
import { palettes } from './config.js';

export class SpaceshipFactory {
    constructor() {
        this.pulsingMaterials = [];
        this.rotatingParts = [];
    }

    // Utility functions
    randomRange(min, max) { 
        return Math.random() * (max - min) + min; 
    }
    
    randomInt(min, max) { 
        return Math.floor(this.randomRange(min, max + 1)); 
    }
    
    getRadiusAtHeight(yPos, bodyLength, bottomRadius, topRadius) {
        bottomRadius = bottomRadius ?? 1;
        topRadius = topRadius ?? 1;
        const heightRatio = (yPos + bodyLength / 2) / bodyLength;
        const clampedRatio = Math.max(0, Math.min(1, heightRatio));
        return bottomRadius + (topRadius - bottomRadius) * clampedRatio;
    }

    // Component creation methods
    createBody(material) {
        const bodyGroup = new THREE.Group();
        const segments = 20;
        let bodyLength, bodyRadius, topRadius, bottomRadius;
        const useMultiSegment = Math.random() < 0.4;

        if (useMultiSegment) {
            const lowerLength = this.randomRange(3, 6);
            const upperLength = this.randomRange(2, 5);
            bodyLength = lowerLength + upperLength;
            const lowerRadius = this.randomRange(1.0, 1.8);
            const upperRadius = lowerRadius * this.randomRange(0.6, 1.4);
            const lowerGeom = new THREE.CylinderGeometry(lowerRadius, lowerRadius, lowerLength, segments);
            const upperGeom = new THREE.CylinderGeometry(upperRadius, lowerRadius, upperLength, segments);
            const lowerMesh = new THREE.Mesh(lowerGeom, material);
            const upperMesh = new THREE.Mesh(upperGeom, material);
            lowerMesh.position.y = -upperLength / 2;
            upperMesh.position.y = lowerLength / 2;
            lowerMesh.castShadow = true;
            lowerMesh.receiveShadow = true;
            upperMesh.castShadow = true;
            upperMesh.receiveShadow = true;
            bodyGroup.add(lowerMesh);
            bodyGroup.add(upperMesh);
            bodyRadius = Math.max(lowerRadius, upperRadius);
            topRadius = upperRadius;
            bottomRadius = lowerRadius;
        } else {
            bodyLength = this.randomRange(5, 9);
            bodyRadius = this.randomRange(1.0, 1.6);
            let bodyGeometry;
            if (Math.random() > 0.4) {
                topRadius = bodyRadius * this.randomRange(0.7, 1.0);
                bottomRadius = bodyRadius;
                bodyGeometry = new THREE.CylinderGeometry(topRadius, bottomRadius, bodyLength, segments);
            } else {
                const capsuleCylLength = bodyLength - 2 * bodyRadius;
                if (capsuleCylLength > 0.1) {
                    bodyGeometry = new THREE.CapsuleGeometry(bodyRadius, capsuleCylLength, 5, segments / 2);
                    topRadius = bottomRadius = bodyRadius;
                } else {
                    bodyGeometry = new THREE.SphereGeometry(bodyRadius, segments, segments / 2);
                    topRadius = bottomRadius = bodyRadius;
                    bodyLength = bodyRadius * 2;
                }
            }
            const bodyMesh = new THREE.Mesh(bodyGeometry, material);
            bodyMesh.castShadow = true;
            bodyMesh.receiveShadow = true;
            bodyGroup.add(bodyMesh);
            topRadius = topRadius ?? bodyRadius;
            bottomRadius = bottomRadius ?? bodyRadius;
        }
        
        bodyGroup.userData = {
            length: bodyLength || 5,
            radius: bodyRadius || 1,
            topRadius: topRadius || bodyRadius || 1,
            bottomRadius: bottomRadius || bodyRadius || 1
        };
        
        return bodyGroup;
    }

    createNoseCone(material, bodyTopRadius, bodyLength) {
        bodyTopRadius = Math.max(0.1, bodyTopRadius);
        const coneHeight = this.randomRange(bodyTopRadius * 1.5, bodyTopRadius * 3.5);
        const coneRadius = bodyTopRadius * this.randomRange(0.95, 1.05);
        const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 20, 1);
        const noseCone = new THREE.Mesh(coneGeometry, material);
        noseCone.castShadow = true; 
        noseCone.receiveShadow = true;
        noseCone.position.y = bodyLength / 2 + coneHeight / 2;
        return noseCone;
    }

    createWings(material, bodyRadius, bodyLength, bodyBottomRadius, bodyTopRadius) {
        const wingsGroup = new THREE.Group();
        let wingCount = this.randomInt(2, 4);
        if (wingCount === 3 && Math.random() > 0.5) wingCount = 4;
        
        const wingLength = this.randomRange(bodyRadius * 1.2, bodyRadius * 3.0);
        const wingWidth = this.randomRange(wingLength * 0.4, wingLength * 0.7);
        const wingThickness = this.randomRange(0.1, 0.25);
        const addWinglets = Math.random() < 0.35;
        
        const wingShape = new THREE.Shape();
        const wingType = Math.random();
        
        if (wingType < 0.4) {
            wingShape.moveTo(0, 0);
            wingShape.lineTo(wingLength, wingWidth * 0.1);
            wingShape.lineTo(wingLength * 0.7, wingWidth);
            wingShape.lineTo(0, wingWidth * 0.8);
            wingShape.lineTo(0, 0);
        }
        else if (wingType < 0.7) {
            wingShape.moveTo(0, 0);
            wingShape.lineTo(wingLength, wingWidth * 0.5);
            wingShape.lineTo(0, wingWidth);
            wingShape.lineTo(0, 0);
        }
        else {
            wingShape.moveTo(0, 0);
            wingShape.lineTo(wingLength * 0.3, wingWidth * 0.1);
            wingShape.lineTo(wingLength, wingWidth);
            wingShape.lineTo(0, wingWidth * 0.8);
            wingShape.lineTo(0, 0);
        }
        
        const extrudeSettings = {
            depth: wingThickness,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.02,
            bevelSegments: 1
        };
        
        const wingGeometry = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
        wingGeometry.center();
        const wingPositionY = this.randomRange(-bodyLength * 0.35, bodyLength * 0.15);

        for (let i = 0; i < wingCount; i++) {
            const wing = new THREE.Mesh(wingGeometry, material);
            wing.castShadow = true;
            wing.receiveShadow = true;
            
            const angle = (Math.PI * 2 / wingCount) * i;
            const attachRadius = this.getRadiusAtHeight(wingPositionY, bodyLength, bodyBottomRadius, bodyTopRadius);
            const radialPosition = attachRadius * 0.95;
            
            wing.position.x = Math.cos(angle) * radialPosition;
            wing.position.z = Math.sin(angle) * radialPosition;
            wing.position.y = wingPositionY;
            wing.rotation.y = -angle;
            wing.rotation.z = Math.PI / 2;
            wing.rotateX(this.randomRange(-Math.PI / 8, Math.PI / 8));
            
            if (addWinglets) {
                const wingletHeight = wingWidth * this.randomRange(0.2, 0.4);
                const wingletWidth = wingThickness * this.randomRange(1.5, 3);
                const wingletGeom = new THREE.BoxGeometry(wingletWidth, wingletHeight, wingThickness * 0.5);
                const winglet = new THREE.Mesh(wingletGeom, material);
                winglet.castShadow = true;
                winglet.receiveShadow = true;
                const tipX = wingLength / 2;
                winglet.position.x = tipX * 0.95;
                winglet.position.y = 0;
                winglet.rotation.z = this.randomRange(-Math.PI/6, Math.PI/6);
                wing.add(winglet);
            }
            
            wingsGroup.add(wing);
        }
        
        return wingsGroup;
    }

    createEngines(material, accentMaterial, bodyBottomRadius, bodyLength, nozzleColor) {
        const engineGroup = new THREE.Group();
        const engineCount = this.randomInt(1, 4);
        const baseEngineRadius = bodyBottomRadius * this.randomRange(0.3, 0.6);
        const addDetails = Math.random() < 0.6;
        
        const engineRadius = engineCount > 1 
            ? Math.min(baseEngineRadius / Math.sqrt(engineCount), bodyBottomRadius / engineCount * 0.85) 
            : baseEngineRadius * this.randomRange(0.8, 1.1);
            
        const finalEngineRadius = Math.max(0.15, engineRadius);
        const engineLength = this.randomRange(finalEngineRadius * 1.5, finalEngineRadius * 4.0);
        const engineGeom = new THREE.CylinderGeometry(finalEngineRadius * 0.8, finalEngineRadius, engineLength, 12);
        
        const nozzleRadius = finalEngineRadius * this.randomRange(1.1, 1.6);
        const nozzleHeight = engineLength * this.randomRange(0.4, 0.8);
        const nozzleGeom = new THREE.ConeGeometry(nozzleRadius, nozzleHeight, 12);
        
        const nozzleMaterial = new THREE.MeshStandardMaterial({ 
            color: nozzleColor, 
            emissive: nozzleColor, 
            emissiveIntensity: 0.5, 
            roughness: 0.7, 
            metalness: 0.3 
        });
        
        const enginePlacementRadius = bodyBottomRadius * 0.7;
        const engineAttachY = -bodyLength / 2 - engineLength / 2;

        for (let i = 0; i < engineCount; i++) {
            const singleEngineUnit = new THREE.Group();
            const engine = new THREE.Mesh(engineGeom, material);
            engine.castShadow = true;
            engine.receiveShadow = true;
            
            const nozzle = new THREE.Mesh(nozzleGeom, nozzleMaterial);
            nozzle.castShadow = true;
            nozzle.receiveShadow = false;
            nozzle.position.y = -engineLength / 2 - nozzleHeight / 2;
            
            singleEngineUnit.add(engine);
            singleEngineUnit.add(nozzle);
            this.pulsingMaterials.push(nozzleMaterial);

            if (addDetails) {
                const detailCount = this.randomInt(1, 3);
                for (let j = 0; j < detailCount; j++) {
                    const detailSize = finalEngineRadius * this.randomRange(0.1, 0.3);
                    const detailLength = engineLength * this.randomRange(0.2, 0.6);
                    const detailGeom = new THREE.BoxGeometry(detailSize, detailLength, detailSize);
                    const detail = new THREE.Mesh(detailGeom, accentMaterial);
                    detail.castShadow = true;
                    detail.receiveShadow = true;
                    const detailAngle = this.randomRange(0, Math.PI * 2);
                    const detailRadialPos = finalEngineRadius * 0.9;
                    
                    detail.position.set(
                        Math.cos(detailAngle) * detailRadialPos,
                        this.randomRange(-engineLength * 0.3, engineLength * 0.3),
                        Math.sin(detailAngle) * detailRadialPos
                    );
                    
                    detail.rotation.y = -detailAngle + Math.PI / 2;
                    singleEngineUnit.add(detail);
                }
            }
            
            if (engineCount === 1) {
                singleEngineUnit.position.y = engineAttachY;
            } else {
                const angle = (Math.PI * 2 / engineCount) * i;
                singleEngineUnit.position.x = Math.cos(angle) * enginePlacementRadius;
                singleEngineUnit.position.z = Math.sin(angle) * enginePlacementRadius;
                singleEngineUnit.position.y = engineAttachY;
            }
            
            engineGroup.add(singleEngineUnit);
        }
        
        return engineGroup;
    }

    createAntennas(material, accentMaterial, bodyLength, bodyBottomRadius, bodyTopRadius) {
        if (Math.random() < 0.4) return null; // 60% chance of having antennas

        const antennaGroup = new THREE.Group();
        const antennaCount = this.randomInt(1, 4);

        for (let i = 0; i < antennaCount; i++) {
            let antennaObject; // This will be the final object added (Mesh or Group)
            const antennaType = Math.random();

            // Calculate base position on the hull
            const antennaHeight = this.randomRange(-bodyLength * 0.4, bodyLength * 0.45);
            const surfaceRadius = this.getRadiusAtHeight(antennaHeight, bodyLength, bodyBottomRadius, bodyTopRadius);
            const antennaAngle = this.randomRange(0, Math.PI * 2);
            const basePosition = new THREE.Vector3(
                Math.cos(antennaAngle) * surfaceRadius,
                antennaHeight,
                Math.sin(antennaAngle) * surfaceRadius
            );

            if (antennaType < 0.5) {
                // --- Simple Rod Antenna ---
                const rodLength = this.randomRange(0.5, 2.0);
                const rodRadius = this.randomRange(0.02, 0.05);
                const rodGeom = new THREE.CylinderGeometry(rodRadius, rodRadius, rodLength, 6);
                const rodMesh = new THREE.Mesh(rodGeom, material);
                rodMesh.castShadow = true;
                rodMesh.receiveShadow = true;

                // Position base of rod at surface point
                rodMesh.position.copy(basePosition);
                // Point it outwards (away from Y axis)
                rodMesh.lookAt(basePosition.x * 2, antennaHeight, basePosition.z * 2);
                rodMesh.rotateX(Math.PI / 2); // Correct cylinder orientation
                rodMesh.translateY(rodLength / 2); // Move base to surface

                antennaObject = rodMesh; // Add the mesh directly

            } else {
                // --- Detailed Dish Antenna ---
                const dishGroup = new THREE.Group(); // Group for this specific dish assembly
                const dishRadius = this.randomRange(0.3, 0.6); // Slightly larger dishes
                const dishDepth = dishRadius * this.randomRange(0.2, 0.4);
                const baseHeight = dishRadius * this.randomRange(0.1, 0.3);
                const feedLength = dishRadius * this.randomRange(0.4, 0.6);
                const feedRadius = 0.03;

                // 1. Base (Mount) - small cylinder
                const baseGeom = new THREE.CylinderGeometry(dishRadius * 0.15, dishRadius * 0.2, baseHeight, 8);
                const baseMesh = new THREE.Mesh(baseGeom, material); // Use main material for base
                baseMesh.castShadow = true;
                baseMesh.receiveShadow = true;
                // Base is positioned at the group's origin (0,0,0) which will be placed on the hull

                // 2. Dish Reflector - shallow cone (open ended)
                const dishGeom = new THREE.ConeGeometry(dishRadius, dishDepth, 16, 1, true);
                const dishMesh = new THREE.Mesh(dishGeom, accentMaterial); // Use accent material for dish
                dishMesh.castShadow = true;
                dishMesh.receiveShadow = true;
                // Position dish slightly above the base
                dishMesh.position.y = baseHeight * 0.6;
                // Rotate dish to face upwards initially (will be tilted later)
                dishMesh.rotation.x = -Math.PI / 2;

                // 3. Feedhorn - thin cylinder
                const feedGeom = new THREE.CylinderGeometry(feedRadius, feedRadius, feedLength, 6);
                const feedMesh = new THREE.Mesh(feedGeom, material); // Main material
                feedMesh.castShadow = true;
                feedMesh.receiveShadow = true;
                // Position feedhorn in front of the dish center
                feedMesh.position.y = baseHeight * 0.6; // Align vertically with dish center
                feedMesh.position.z = dishRadius * 0.6; // Place in front along Z
                feedMesh.rotation.x = Math.PI / 2; // Orient vertically

                // Add parts to the dish group
                dishGroup.add(baseMesh);
                dishGroup.add(dishMesh);
                dishGroup.add(feedMesh);

                // Position the entire dish group onto the hull
                dishGroup.position.copy(basePosition);

                // Orient the group: Make its local +Y point outwards from the hull
                // First, look towards the center of the ship at the same height
                dishGroup.lookAt(0, antennaHeight, 0);
                // Then, rotate 180 degrees around Y so +Z points outwards
                dishGroup.rotateY(Math.PI);
                // Now rotate around the *local* X-axis to tilt the dish upwards
                dishGroup.rotateX(this.randomRange(-Math.PI / 6, -Math.PI / 12)); // Tilt between 15-30 deg up

                antennaObject = dishGroup; // Add the group

                // *** Store dish group for animation ***
                this.rotatingParts.push(dishGroup);
            }

            if (antennaObject) {
                antennaGroup.add(antennaObject);
            }
        }
        
        return antennaGroup.children.length > 0 ? antennaGroup : null;
    }

    createPods(material, bodyRadius, bodyLength, bodyBottomRadius, bodyTopRadius) {
        if (Math.random() < 0.5) return null;
        
        const podGroup = new THREE.Group();
        const podCount = (this.randomInt(1, 2)) * 2;
        const podLength = bodyLength * this.randomRange(0.3, 0.6);
        const podRadius = bodyRadius * this.randomRange(0.15, 0.3);
        const podShapeType = Math.random();
        let podGeom;
        
        if (podShapeType < 0.6) {
            podGeom = new THREE.CylinderGeometry(podRadius, podRadius, podLength, 12);
        } else {
            podGeom = new THREE.BoxGeometry(podRadius * 1.5, podLength, podRadius * 1.5);
        }
        
        const podPositionY = this.randomRange(-bodyLength * 0.2, bodyLength * 0.2);
        const attachRadius = this.getRadiusAtHeight(podPositionY, bodyLength, bodyBottomRadius, bodyTopRadius);
        const radialPosition = attachRadius + podRadius * 0.6;
        
        for (let i = 0; i < podCount; i++) {
            const pod = new THREE.Mesh(podGeom, material);
            pod.castShadow = true;
            pod.receiveShadow = true;
            const angle = (Math.PI * 2 / podCount) * i;
            pod.position.x = Math.cos(angle) * radialPosition;
            pod.position.z = Math.sin(angle) * radialPosition;
            pod.position.y = podPositionY;
            pod.rotation.y = -angle;
            podGroup.add(pod);
        }
        
        return podGroup.children.length > 0 ? podGroup : null;
    }

    createSpaceship() {
        const spaceship = new THREE.Group();
        
        // Reset animation arrays
        this.pulsingMaterials = [];
        this.rotatingParts = [];
        
        // Select a color palette
        const selectedPalette = palettes[this.randomInt(0, palettes.length - 1)];
        console.log("Using Palette:", selectedPalette.name);

        const primaryMaterial = new THREE.MeshStandardMaterial({
            color: selectedPalette.primary,
            roughness: this.randomRange(0.3, 0.6),
            metalness: selectedPalette.metallic === selectedPalette.primary ? 0.8 : 0.4
        });
        
        const secondaryMaterial = new THREE.MeshStandardMaterial({
            color: selectedPalette.secondary,
            roughness: this.randomRange(0.4, 0.7),
            metalness: selectedPalette.metallic === selectedPalette.secondary ? 0.7 : 0.3
        });
        
        const accentMaterial = new THREE.MeshStandardMaterial({
            color: selectedPalette.accent,
            roughness: this.randomRange(0.5, 0.8),
            metalness: selectedPalette.metallic === selectedPalette.accent ? 0.6 : 0.2
        });
        
        const metallicMaterial = new THREE.MeshStandardMaterial({
            color: selectedPalette.metallic,
            roughness: this.randomRange(0.2, 0.5),
            metalness: 0.8
        });

        // Create the main body using selected materials
        const bodyMat = Math.random() < 0.7 ? primaryMaterial : metallicMaterial;
        const bodyGroup = this.createBody(bodyMat);
        spaceship.add(bodyGroup);
        
        const { length: bodyLength, radius: bodyRadius, topRadius: bodyTopRadius, bottomRadius: bodyBottomRadius } = bodyGroup.userData;

        // Create the nose cone
        const noseConeMat = Math.random() < 0.6 ? secondaryMaterial : accentMaterial;
        const noseCone = this.createNoseCone(noseConeMat, bodyTopRadius, bodyLength);
        spaceship.add(noseCone);

        // Add wings (with chance to skip)
        if (Math.random() > 0.15) {
            const wingMat = Math.random() < 0.5 ? secondaryMaterial : primaryMaterial;
            const wings = this.createWings(wingMat, bodyRadius, bodyLength, bodyBottomRadius, bodyTopRadius);
            spaceship.add(wings);
        }

        // Add engines
        const engineMat = Math.random() < 0.5 ? metallicMaterial : accentMaterial;
        const engines = this.createEngines(engineMat, accentMaterial, bodyBottomRadius, bodyLength, selectedPalette.nozzle);
        spaceship.add(engines);

        // Add antennas (optional)
        const antennaMat = Math.random() < 0.5 ? accentMaterial : metallicMaterial;
        const antennas = this.createAntennas(antennaMat, accentMaterial, bodyLength, bodyBottomRadius, bodyTopRadius);
        if (antennas) spaceship.add(antennas);

        // Add pods (optional)
        const podMat = Math.random() < 0.5 ? secondaryMaterial : primaryMaterial;
        const pods = this.createPods(podMat, bodyRadius, bodyLength, bodyBottomRadius, bodyTopRadius);
        if (pods) spaceship.add(pods);

        // Add random details
        const detailCount = this.randomInt(0, 5);
        for (let i = 0; i < detailCount; i++) {
            const detailGeometry = Math.random() > 0.5 ?
                new THREE.BoxGeometry(
                    this.randomRange(0.1, 0.4), 
                    this.randomRange(0.2, 0.6), 
                    this.randomRange(0.1, 0.4)
                ) :
                new THREE.CylinderGeometry(
                    this.randomRange(0.05, 0.2), 
                    this.randomRange(0.05, 0.2), 
                    this.randomRange(0.1, 0.5), 8
                );
                
            const detail = new THREE.Mesh(detailGeometry, accentMaterial);
            const detailHeight = this.randomRange(-bodyLength * 0.45, bodyLength * 0.45);
            const surfaceRadius = this.getRadiusAtHeight(detailHeight, bodyLength, bodyBottomRadius, bodyTopRadius);
            const detailAngle = this.randomRange(0, Math.PI * 2);
            
            detail.position.set(
                Math.cos(detailAngle) * surfaceRadius,
                detailHeight,
                Math.sin(detailAngle) * surfaceRadius
            );
            
            detail.lookAt(0, detailHeight, 0);
            detail.rotateY(Math.PI/2 + this.randomRange(-0.5, 0.5));
            spaceship.add(detail);
        }

        // Set up all mesh properties
        spaceship.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.userData.parentShip = spaceship;
                child.userData.isCelestialBody = true;
                child.userData.name = spaceship.userData.name;
            }
        });
        
        spaceship.userData = { name: "Spaceship", isCelestialBody: true };
        spaceship.position.set(35, 5, 35);
        spaceship.scale.set(0.3, 0.3, 0.3);
        
        return {
            spaceship,
            pulsingMaterials: this.pulsingMaterials,
            rotatingParts: this.rotatingParts
        };
    }
}