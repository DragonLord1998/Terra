// src/SolarSystemBuilder.js
import * as THREE from 'three'; // Restored import
import * as Config from './config.js';
import * as Factory from './celestialFactory.js';

class SolarSystemBuilder {
    constructor(scene, textures, materials, physicsEngine) {
        this.scene = scene;
        this.textures = textures;
        this.materials = materials; // { earthMaterial, sunGlowMaterial, atmosphereMaterial, sunMaterialBasic, sunMaterialShader }
        this.physicsEngine = physicsEngine;
        this.planetOrbits = []; // For simple rotation fallback { anchor: Object3D, speed: number }
        this.asteroidGroupAnchors = {}; // Store refs to belt groups for removal: { 'BeltName': [anchor1, anchor2,...] }

        // Store references to key objects needed externally (e.g., for animation, camera focus)
        this.sunMesh = null;
        this.earthMesh = null;
        this.cloudMesh = null;
        this.moonOrbitAnchor = null;
        this.earthSystemAnchor = null;
    }

    buildInitialScene() {
        this.physicsEngine.clearBodies();
        this.planetOrbits = [];
        this.asteroidGroupAnchors = {};
        // Clear previous objects if necessary? For now, assume fresh build

        this._createSun();
        this._createEarthSystem();
        this._createOtherPlanets();
        this._createAllAsteroidBelts(); // Initial creation using config groupSize

        console.log("Solar system built. Total physics bodies:", this.physicsEngine.getAllBodies().length);
    }

    _createSun() {
        const sunGeometry = Factory.createSphereGeometry(Config.SUN_RADIUS);
        this.sunMesh = Factory.createMesh(sunGeometry, this.materials.sunMaterialBasic); // Start with basic
        this.sunMesh.position.set(0, 0, 0);
        this.scene.add(this.sunMesh);

        this.physicsEngine.addBody({
            name: "Sun",
            mesh: this.sunMesh,
            mass: Config.SUN_MASS,
            position: new THREE.Vector3(0, 0, 0),
            velocity: new THREE.Vector3(0, 0, 0)
        });

        // Sun Glow
        const sunGlowGeometry = Factory.createSphereGeometry(Config.SUN_RADIUS * Config.SUN_GLOW_RADIUS_FACTOR);
        const sunGlowMesh = Factory.createMesh(sunGlowGeometry, this.materials.sunGlowMaterial);
        sunGlowMesh.position.set(0, 0, 0);
        this.scene.add(sunGlowMesh);
    }

    _createEarthSystem() {
        this.earthSystemAnchor = Factory.createOrbitAnchor(this.scene);
        this.earthSystemAnchor.position.x = Config.EARTH_ORBIT_RADIUS;

        const earthData = Config.PLANET_DATA.find(p => p.name === "Earth");
        this.physicsEngine.addBody({
            name: "EarthSystem",
            mesh: this.earthSystemAnchor,
            mass: earthData.mass,
            position: new THREE.Vector3(this.earthSystemAnchor.position.x, this.earthSystemAnchor.position.y, this.earthSystemAnchor.position.z),
            velocity: new THREE.Vector3(0, 0, 0)
        });
        this.planetOrbits.push({ anchor: this.earthSystemAnchor, speed: Config.EARTH_ORBIT_SPEED });


        // Earth
        const earthGeometry = Factory.createSphereGeometry(Config.EARTH_RADIUS, 512, 512); // Increased segments further
        earthGeometry.computeTangents(); // Needed for custom shader TBN calculation
        this.earthMesh = Factory.createMesh(earthGeometry, this.materials.earthMaterial); // Restore custom material
        this.earthSystemAnchor.add(this.earthMesh);

        // Clouds
        const cloudGeometry = Factory.createSphereGeometry(Config.EARTH_RADIUS * Config.CLOUD_ALTITUDE_FACTOR);
        const cloudMaterial = Factory.createPhongMaterial({
            map: this.textures.earthCloudsLow, // Start with low-res
            transparent: true,
            opacity: 0.4,
            depthWrite: false
        });
        this.cloudMesh = Factory.createMesh(cloudGeometry, cloudMaterial);
        this.earthMesh.add(this.cloudMesh);

        // Earth Atmosphere
        const atmosphereGeometry = Factory.createSphereGeometry(Config.EARTH_RADIUS * Config.ATMOSPHERE_ALTITUDE_FACTOR);
        const atmosphereMesh = Factory.createMesh(atmosphereGeometry, this.materials.atmosphereMaterial);
        this.earthMesh.add(atmosphereMesh);

        // Moon
        this.moonOrbitAnchor = Factory.createOrbitAnchor(this.earthSystemAnchor);
        const moonRadius = Config.EARTH_RADIUS * Config.MOON_RADIUS_FACTOR;
        const moonGeometry = Factory.createSphereGeometry(moonRadius);
        const moonMaterial = Factory.createStandardMaterial(this.textures.moon);
        const moonMesh = Factory.createMesh(moonGeometry, moonMaterial);
        moonMesh.position.x = Config.MOON_ORBIT_RADIUS;
        this.moonOrbitAnchor.add(moonMesh);
        // Note: Moon's orbit around Earth is simple rotation, not physics based here
    }

    _createOtherPlanets() {
        Config.PLANET_DATA.forEach(data => {
            if (data.name === "Earth") return;

            const planetOrbitAnchor = Factory.createOrbitAnchor(this.scene);
            const planetRadius = Config.EARTH_RADIUS * data.sizeFactor;
            const planetGeometry = Factory.createSphereGeometry(planetRadius);

            const planetTexture = this.textures[data.name];
            if (!planetTexture) {
                console.warn(`Texture not found for ${data.name}`);
                return;
            }
            const planetMaterial = Factory.createStandardMaterial(planetTexture);
            const planetMesh = Factory.createMesh(planetGeometry, planetMaterial);

            planetOrbitAnchor.position.x = data.orbitRadius;
            planetOrbitAnchor.add(planetMesh);

            // Special cases (Venus Atmosphere, Saturn Rings)
            if (data.name === "Venus" && data.atmosphereTextureFile && this.textures.venusAtmosphere) {
                const venusAtmosGeometry = Factory.createSphereGeometry(planetRadius * Config.VENUS_ATMOSPHERE_ALTITUDE_FACTOR);
                const venusAtmosMaterial = Factory.createPhongMaterial({
                    map: this.textures.venusAtmosphere,
                    transparent: true,
                    opacity: Config.VENUS_ATMOSPHERE_OPACITY,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });
                const venusAtmosMesh = Factory.createMesh(venusAtmosGeometry, venusAtmosMaterial);
                planetMesh.add(venusAtmosMesh);
            }

            if (data.name === "Saturn" && data.hasRings) {
                const ringInnerRadius = planetRadius * Config.SATURN_RING_INNER_RADIUS_FACTOR;
                const ringOuterRadius = planetRadius * Config.SATURN_RING_OUTER_RADIUS_FACTOR;
                const ringGeometry = Factory.createRingGeometry(ringInnerRadius, ringOuterRadius);
                const ringMaterial = Factory.createStandardMaterial(null, {
                    color: Config.SATURN_RING_COLOR,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: Config.SATURN_RING_OPACITY
                });
                const ringMesh = Factory.createMesh(ringGeometry, ringMaterial);
                planetMesh.add(ringMesh);
            }

            // Add to physics and simple orbit list
            this.physicsEngine.addBody({
                name: data.name,
                mesh: planetOrbitAnchor,
                mass: data.mass,
                position: new THREE.Vector3(planetOrbitAnchor.position.x, planetOrbitAnchor.position.y, planetOrbitAnchor.position.z),
                velocity: new THREE.Vector3(0, 0, 0)
            });
            this.planetOrbits.push({ anchor: planetOrbitAnchor, speed: data.orbitSpeedFactor });
        });
    }

    _createAllAsteroidBelts() {
        Config.ASTEROID_BELT_DATA.forEach(beltData => {
            this._createAsteroidBeltGroups(beltData, beltData.groupSize);
        });
    }

    _createAsteroidBeltGroups(beltData, groupSize) {
        const beltName = beltData.name;
        this.asteroidGroupAnchors[beltName] = []; // Initialize/clear array for this belt

        const totalPoints = beltData.count;
        const numGroups = Math.ceil(totalPoints / groupSize);
        const groupMass = beltData.totalMass / numGroups; // Divide total mass among groups
        const innerRadius = beltData.innerRadius;
        const outerRadius = beltData.outerRadius;
        const thickness = beltData.thickness;

        // Shared material for all groups in this belt
        const groupMaterial = new THREE.PointsMaterial({
            color: beltData.color,
            size: beltData.particleSize,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.7
        });

        console.log(`Creating asteroid belt '${beltName}' with ${numGroups} groups of approx ${groupSize} points each.`);

        for (let g = 0; g < numGroups; g++) {
            const groupAnchor = Factory.createOrbitAnchor(this.scene); // Anchor for this specific group
            const groupName = `${beltName}_Group_${g}`;

            // Calculate initial position for this group's anchor
            const groupAngle = (g / numGroups) * Math.PI * 2;
            const groupRadius = (innerRadius + outerRadius) / 2; // Place anchor at average radius
            groupAnchor.position.set(
                Math.cos(groupAngle) * groupRadius,
                0,
                Math.sin(groupAngle) * groupRadius
            );

            const positions = [];
            const pointsInThisGroup = (g === numGroups - 1) ? (totalPoints - g * groupSize) : groupSize;

            for (let i = 0; i < pointsInThisGroup; i++) {
                // Generate points relative to the group's anchor position for better distribution
                const angle = Math.random() * Math.PI * 2;
                // Radius variation around the group's radius
                const radiusOffset = (Math.random() - 0.5) * (outerRadius - innerRadius);
                const currentRadius = groupRadius + radiusOffset; // Center points around anchor radius

                // Calculate position relative to origin first
                const absX = Math.cos(angle) * currentRadius;
                const absZ = Math.sin(angle) * currentRadius;
                const absY = (Math.random() - 0.5) * thickness;

                // Convert to position relative to the anchor
                positions.push(
                    absX - groupAnchor.position.x,
                    absY - groupAnchor.position.y,
                    absZ - groupAnchor.position.z
                );
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

            const points = new THREE.Points(geometry, groupMaterial);
            groupAnchor.add(points); // Add points mesh to the anchor

            // Store anchor reference before adding to physics/scene
            this.asteroidGroupAnchors[beltName].push(groupAnchor);

            // Add group anchor for simple rotation
            this.planetOrbits.push({ anchor: groupAnchor, speed: beltData.orbitSpeedFactor });

            // Add group anchor to physics bodies
            this.physicsEngine.addBody({
                name: groupName,
                mesh: groupAnchor,
                mass: groupMass,
                position: new THREE.Vector3(groupAnchor.position.x, groupAnchor.position.y, groupAnchor.position.z),
                velocity: new THREE.Vector3(0, 0, 0)
            });
        }
        console.log(`Finished creating ${numGroups} groups for belt '${beltName}'.`);
    }

    rebuildAsteroidBelt(beltName, newGroupSize) {
        const beltData = Config.ASTEROID_BELT_DATA.find(b => b.name === beltName);
        if (!beltData) {
            console.error(`Cannot rebuild belt: Belt data not found for name "${beltName}"`);
            return;
        }

        console.log(`Rebuilding asteroid belt '${beltName}' with group size ${newGroupSize}`);

        // 1. Remove existing groups for this belt
        if (this.asteroidGroupAnchors[beltName]) {
            this.asteroidGroupAnchors[beltName].forEach(anchor => {
                // Remove from physics
                this.physicsEngine.removeBodyByName(anchor.name); // Assuming anchor was named correctly

                // Remove from simple orbit list
                this.planetOrbits = this.planetOrbits.filter(orbit => orbit.anchor !== anchor);

                // Remove from scene
                this.scene.remove(anchor);
                // Dispose geometry/material if needed? For Points, maybe not critical yet.
                anchor.traverse(child => {
                     if (child instanceof THREE.Points) {
                         if (child.geometry) child.geometry.dispose();
                         // Material is shared, don't dispose here
                     }
                });
            });
            console.log(`Removed ${this.asteroidGroupAnchors[beltName].length} old groups for belt '${beltName}'.`);
        } else {
            console.log(`No existing groups found for belt '${beltName}' to remove.`);
        }


        // 2. Create new groups with the new size
        this._createAsteroidBeltGroups(beltData, newGroupSize);

        // 3. Optional: Re-initialize physics velocities if simulation is running
        // This should be handled externally after calling rebuild
    }

    // --- Getters for key objects ---
    getSunMesh() { return this.sunMesh; }
    getEarthMesh() { return this.earthMesh; }
    getCloudMesh() { return this.cloudMesh; }
    getMoonOrbitAnchor() { return this.moonOrbitAnchor; }
    getEarthSystemAnchor() { return this.earthSystemAnchor; }
    getPlanetOrbits() { return this.planetOrbits; } // For simple rotation
}

export default SolarSystemBuilder;
