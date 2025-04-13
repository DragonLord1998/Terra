// src/FlareSystem.js
import * as THREE from 'three'; // Restored import

class FlareParticle {
    constructor(mesh) {
        this.mesh = mesh; // The THREE.Sprite or THREE.Points mesh
        this.velocity = new THREE.Vector3();
        this.lifetime = 0;
        this.age = 0;
        this.initialScale = 1;
        this.isActive = false;
    }

    activate(position, velocity, lifetime, scale) {
        this.mesh.position.copy(position);
        this.velocity.copy(velocity);
        this.lifetime = lifetime;
        this.age = 0;
        this.initialScale = scale;
        this.mesh.scale.set(scale, scale, scale);
        this.mesh.material.opacity = 1.0; // Start fully opaque
        this.mesh.visible = true;
        this.isActive = true;
    }

    update(delta) {
        if (!this.isActive) return;

        this.age += delta;
        if (this.age >= this.lifetime) {
            this.deactivate();
            return;
        }

        // Update position
        this.mesh.position.addScaledVector(this.velocity, delta);

        // Update scale (e.g., expand then shrink)
        // const scaleFactor = Math.sin((this.age / this.lifetime) * Math.PI); // Simple sine curve for scale
        // this.mesh.scale.setScalar(this.initialScale * scaleFactor);

        // Update opacity (fade out)
        this.mesh.material.opacity = 1.0 - (this.age / this.lifetime);

        // Optional: Add some simple physics like gravity pull back towards sun?
        // vec3 pull = this.mesh.position.clone().negate().normalize().multiplyScalar(0.1 * delta);
        // this.velocity.add(pull);
    }

    deactivate() {
        this.mesh.visible = false;
        this.isActive = false;
    }
}

class FlareSystem {
    constructor(scene, count = 100) {
        this.scene = scene;
        this.pool = [];
        this.particleMaterial = new THREE.SpriteMaterial({
            map: this._createFlareTexture(), // Simple white circle texture
            color: 0xffddaa, // Orangey-yellow
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 1.0,
            depthWrite: false, // Don't write to depth buffer
            sizeAttenuation: true,
        });

        for (let i = 0; i < count; i++) {
            const sprite = new THREE.Sprite(this.particleMaterial);
            sprite.visible = false;
            this.scene.add(sprite);
            this.pool.push(new FlareParticle(sprite));
        }
    }

    _createFlareTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, canvas.width / 2
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 220, 180, 1)');
        gradient.addColorStop(0.6, 'rgba(255, 180, 50, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');

        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);

        return new THREE.CanvasTexture(canvas);
    }

    createFlare(originPosition, baseDirection, lifetimeMin = 1, lifetimeMax = 3, scaleMin = 0.5, scaleMax = 2, speedMin = 5, speedMax = 15, spread = 0.3) {
        const particle = this.pool.find(p => !p.isActive);
        if (!particle) {
            // console.warn("Flare particle pool exhausted");
            return;
        }

        // Add randomness to direction
        const direction = baseDirection.clone()
            .add(new THREE.Vector3(
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread
            ))
            .normalize();

        const lifetime = lifetimeMin + Math.random() * (lifetimeMax - lifetimeMin);
        const scale = (scaleMin + Math.random() * (scaleMax - scaleMin)) * 0.5; // Smaller base scale for sprites
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        const velocity = direction.multiplyScalar(speed);

        particle.activate(originPosition, velocity, lifetime, scale);
    }

    update(delta) {
        this.pool.forEach(particle => {
            if (particle.isActive) {
                particle.update(delta);
            }
        });
    }
}

export default FlareSystem;
