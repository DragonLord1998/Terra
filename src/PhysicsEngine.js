// src/PhysicsEngine.js
import * as THREE from 'three'; // Restored import
import * as Config from './config.js'; // Assuming config holds constants like GRAVITATIONAL_CONSTANT

class PhysicsEngine {
    constructor() {
        this.celestialBodies = []; // Array to hold { name: string, mesh: Object3D, mass: number, position: Vector3, velocity: Vector3 }
        this.forceVector = new THREE.Vector3(); // Reusable vector for force calculations
        this.accelerationVector = new THREE.Vector3(); // Reusable vector
        this.distanceVector = new THREE.Vector3(); // Reusable vector
        this.gravityConstant = Config.GRAVITATIONAL_CONSTANT;
        this.simulationEnabled = false; // Controlled externally
    }

    addBody(body) {
        // Validate body structure?
        if (body && body.name && body.mesh && body.mass !== undefined && body.position && body.velocity) {
            this.celestialBodies.push(body);
        } else {
            console.error("Invalid body structure provided to PhysicsEngine:", body);
        }
    }

    removeBodyByName(name) {
        this.celestialBodies = this.celestialBodies.filter(body => body.name !== name);
    }

    removeBodiesByPrefix(prefix) {
        this.celestialBodies = this.celestialBodies.filter(body => !body.name.startsWith(prefix));
    }

    getBodyByName(name) {
        return this.celestialBodies.find(body => body.name === name);
    }

    getAllBodies() {
        return this.celestialBodies;
    }

    clearBodies() {
        this.celestialBodies = [];
    }

    initializeOrbitalVelocities() {
        const sun = this.getBodyByName("Sun");
        if (!sun) {
            console.error("Sun physics body not found for velocity initialization.");
            return;
        }

        this.celestialBodies.forEach(body => {
            if (body.name === "Sun") return; // Sun doesn't orbit itself

            const radius = body.position.length(); // Distance from Sun (origin)
            if (radius < 0.1) {
                console.warn(`Body ${body.name} too close to origin for velocity calculation.`);
                body.velocity.set(0, 0, 0); // Set velocity to zero if too close
                return;
            }

            // Calculate speed for circular orbit (v = sqrt(G*M/r))
            const speed = Math.sqrt(this.gravityConstant * sun.mass / radius);

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

    update(delta) {
        if (!this.simulationEnabled) return;

        // Limit delta to prevent instability with large steps
        const dt = Math.min(delta, 0.016); // Clamp delta time (e.g., max 60fps step)
        const bodiesToUpdate = this.celestialBodies.filter(b => b.name !== "Sun"); // Exclude Sun from being moved

        // Calculate forces
        bodiesToUpdate.forEach(bodyI => {
            this.forceVector.set(0, 0, 0); // Reset net force for bodyI

            this.celestialBodies.forEach(bodyJ => {
                if (bodyI === bodyJ) return; // Don't calculate force on self

                this.distanceVector.subVectors(bodyJ.position, bodyI.position);
                const distanceSq = this.distanceVector.lengthSq();

                // Avoid division by zero and extreme forces at close range
                const epsilonSq = 0.1 * 0.1;
                if (distanceSq < epsilonSq) return;

                const forceMagnitude = this.gravityConstant * bodyI.mass * bodyJ.mass / distanceSq;
                this.forceVector.add(this.distanceVector.normalize().multiplyScalar(forceMagnitude));
            });

            // Update velocity (Euler integration)
            // Check if mass is zero or undefined to prevent division by zero
            if (bodyI.mass === undefined || bodyI.mass === 0) {
                 console.warn(`Body ${bodyI.name} has zero or undefined mass. Skipping velocity update.`);
                 return; // Skip velocity update for this body
            }
            this.accelerationVector.copy(this.forceVector).divideScalar(bodyI.mass);
            bodyI.velocity.add(this.accelerationVector.multiplyScalar(dt)); // Use clamped dt
        });

        // Update positions (Euler integration)
        bodiesToUpdate.forEach(body => {
            body.position.add(body.velocity.clone().multiplyScalar(dt)); // Use clamped dt
            body.mesh.position.copy(body.position); // Update the visual mesh position
        });
    }
}

export default PhysicsEngine;
