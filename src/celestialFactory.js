/**
 * Factory for creating celestial bodies like planets, moons, and the sun
 */
import * as THREE from 'three';
import { solarSystemData, sunData, moonData } from './config.js';

export class CelestialFactory {
    constructor(texturesMap) {
        this.texturesMap = texturesMap;
        this.planets = [];
        this.clickableObjects = [];
        this.moonMesh = null;
    }

    createSun() {
        const sunTexture = this.texturesMap.get(sunData.textureKey);
        const sunGeometry = new THREE.SphereGeometry(sunData.radius, 64, 32);
        let sunMaterial;
        
        if (sunTexture) {
            sunMaterial = new THREE.MeshBasicMaterial({ 
                map: sunTexture, 
                emissive: 0xFFFFDD, 
                emissiveIntensity: 1.1 
            });
        } else {
            console.warn(`Using fallback color for Sun`);
            sunMaterial = new THREE.MeshBasicMaterial({ color: sunData.fallbackColor });
        }
        
        const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
        sunMesh.userData = { name: "Sun", isCelestialBody: true };
        
        const coronaGeometry = new THREE.SphereGeometry(sunData.radius * 1.15, 64, 32);
        const coronaMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffccaa, 
            transparent: true, 
            opacity: 0.25, 
            blending: THREE.AdditiveBlending, 
            depthWrite: false 
        });
        const coronaMesh = new THREE.Mesh(coronaGeometry, coronaMaterial);
        
        return { sunMesh, coronaMesh };
    }

    createPlanet(planetData, scene) {
        const planetTexture = this.texturesMap.get(planetData.textureKey);
        const planetGeometry = new THREE.SphereGeometry(planetData.radius, 64, 32);
        let planetMaterial;
        
        if (planetTexture) {
            planetMaterial = new THREE.MeshStandardMaterial({ 
                map: planetTexture, 
                roughness: 0.8, 
                metalness: 0.1 
            });
        } else {
            console.warn(`Using fallback color for ${planetData.name}`);
            planetMaterial = new THREE.MeshStandardMaterial({ 
                color: planetData.fallbackColor, 
                roughness: 0.8, 
                metalness: 0.1 
            });
        }
        
        const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
        planetMesh.userData = { name: planetData.name, isCelestialBody: true };

        if (planetData.tilt !== undefined) {
            planetMesh.rotation.z = THREE.MathUtils.degToRad(planetData.tilt);
        }

        this.clickableObjects.push(planetMesh);
        
        const pivot = new THREE.Object3D();
        scene.add(pivot);
        pivot.add(planetMesh);
        planetMesh.position.set(planetData.distance, 0, 0);

        const planet = {
            name: planetData.name,
            mesh: planetMesh,
            pivot: pivot,
            orbitSpeed: planetData.orbitSpeed,
            rotationSpeed: planetData.rotationSpeed
        };

        // Add clouds if the planet has them
        if (planetData.cloudsKey) {
            const cloudTexture = this.texturesMap.get(planetData.cloudsKey);
            if (cloudTexture) {
                const cloudGeometry = new THREE.SphereGeometry(planetData.radius * 1.01, 64, 32);
                const cloudMaterial = new THREE.MeshBasicMaterial({ 
                    map: cloudTexture, 
                    transparent: true, 
                    opacity: 0.4, 
                    blending: THREE.AdditiveBlending 
                });
                const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
                planetMesh.add(cloudMesh);
                planet.cloudMesh = cloudMesh;
            } else {
                console.warn(`Skipping clouds for ${planetData.name}...`);
            }
        }

        // Add moon if the planet has one
        if (planetData.moon) {
            const moonTexture = this.texturesMap.get(moonData.textureKey);
            const moonRadius = planetData.radius * 0.27;
            const moonDistance = planetData.radius + 1.0;
            const moonGeometry = new THREE.SphereGeometry(moonRadius, 32, 16);
            
            let moonMaterial;
            if (moonTexture) {
                moonMaterial = new THREE.MeshStandardMaterial({ 
                    map: moonTexture, 
                    roughness: 0.9 
                });
            } else {
                console.warn(`Using fallback color for Moon`);
                moonMaterial = new THREE.MeshStandardMaterial({ 
                    color: moonData.fallbackColor, 
                    roughness: 0.9 
                });
            }
            
            this.moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
            this.moonMesh.userData = { name: "Moon", isCelestialBody: true };
            
            if (moonData.tilt !== undefined) {
                this.moonMesh.rotation.z = THREE.MathUtils.degToRad(moonData.tilt);
            }
            
            this.clickableObjects.push(this.moonMesh);
            
            const moonPivot = new THREE.Object3D();
            planetMesh.add(moonPivot);
            moonPivot.add(this.moonMesh);
            this.moonMesh.position.set(moonDistance, 0, 0);
            
            planet.moonPivot = moonPivot;
            planet.moonOrbitSpeed = planetData.orbitSpeed * 10;
        }

        // Add rings if the planet has them
        if (planetData.rings) {
            const ringTexture = this.texturesMap.get(planetData.ringsTextureKey);
            const innerRadius = planetData.radius * 1.2;
            const outerRadius = planetData.radius * 2.2;
            const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
            
            // Adjust ring geometry for proper 3D positioning
            const pos = ringGeometry.attributes.position;
            const v3 = new THREE.Vector3();
            for (let i = 0; i < pos.count; i++) {
                v3.fromBufferAttribute(pos, i);
                pos.setXYZ(i, v3.x, v3.y, 0);
            }
            ringGeometry.attributes.position.needsUpdate = true;
            ringGeometry.computeVertexNormals();
            
            let ringMaterial;
            if (ringTexture) {
                ringMaterial = new THREE.MeshBasicMaterial({ 
                    map: ringTexture, 
                    side: THREE.DoubleSide, 
                    transparent: true, 
                    alphaTest: 0.01 
                });
            } else {
                ringMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xAAAAAA, 
                    side: THREE.DoubleSide, 
                    transparent: true, 
                    opacity: 0.6 
                });
            }
            
            const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
            ringMesh.rotation.x = Math.PI * 0.5;
            planetMesh.add(ringMesh);
        }

        this.planets.push(planet);
        return planet;
    }

    createAsteroidBelt(innerRadius, outerRadius, thickness, count) {
        console.log("Creating asteroid belt...");
        
        const asteroidGeometry = new THREE.IcosahedronGeometry(0.05, 0);
        const asteroidMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x888888, 
            roughness: 0.8 
        });

        const asteroidBelt = new THREE.InstancedMesh(asteroidGeometry, asteroidMaterial, count);
        const dummy = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
            const radius = THREE.MathUtils.randFloat(innerRadius, outerRadius);
            const angle = Math.random() * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = THREE.MathUtils.randFloatSpread(thickness);

            dummy.position.set(x, y, z);
            dummy.rotation.set(
                Math.random() * Math.PI, 
                Math.random() * Math.PI, 
                Math.random() * Math.PI
            );

            const scale = THREE.MathUtils.randFloat(0.5, 1.5);
            dummy.scale.set(scale, scale, scale);

            dummy.updateMatrix();
            asteroidBelt.setMatrixAt(i, dummy.matrix);
        }
        
        asteroidBelt.instanceMatrix.needsUpdate = true;
        console.log("Asteroid belt created.");
        
        return asteroidBelt;
    }

    createStarfield() {
        const starfieldTexture = this.texturesMap.get('starfield');
        
        if (starfieldTexture) {
            const starfieldGeometry = new THREE.SphereGeometry(500, 64, 32);
            const starfieldMaterial = new THREE.MeshBasicMaterial({ 
                map: starfieldTexture, 
                side: THREE.BackSide 
            });
            return new THREE.Mesh(starfieldGeometry, starfieldMaterial);
        }
        
        return null;
    }

    createSolarSystem(scene) {
        const { sunMesh, coronaMesh } = this.createSun();
        scene.add(sunMesh);
        scene.add(coronaMesh);
        this.clickableObjects.push(sunMesh);

        // Create all planets from the solar system data
        solarSystemData.forEach(planetData => {
            this.createPlanet(planetData, scene);
        });

        // Create asteroid belt
        const asteroidBelt = this.createAsteroidBelt(21, 26, 1.5, 1500);
        scene.add(asteroidBelt);

        // Create starfield
        const starfield = this.createStarfield();
        if (starfield) {
            scene.add(starfield);
        } else {
            scene.background = new THREE.Color(0x000000);
        }

        return {
            planets: this.planets,
            clickableObjects: this.clickableObjects,
            moonMesh: this.moonMesh,
            asteroidBelt
        };
    }
}