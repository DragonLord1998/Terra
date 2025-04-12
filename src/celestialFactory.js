// src/celestialFactory.js
import * as THREE from 'three';

/**
 * Creates and adds an empty Object3D to the scene to serve as an orbit anchor.
 * @param {THREE.Scene} scene - The main scene object.
 * @returns {THREE.Object3D} The created orbit anchor.
 */
export function createOrbitAnchor(scene) {
    const anchor = new THREE.Object3D();
    scene.add(anchor);
    return anchor;
}

/**
 * Creates a sphere geometry.
 * @param {number} radius - The radius of the sphere.
 * @param {number} [widthSegments=64] - Number of horizontal segments.
 * @param {number} [heightSegments=64] - Number of vertical segments.
 * @returns {THREE.SphereGeometry} The created sphere geometry.
 */
export function createSphereGeometry(radius, widthSegments = 64, heightSegments = 64) {
    return new THREE.SphereGeometry(radius, widthSegments, heightSegments);
}

/**
 * Creates a ring geometry.
 * @param {number} innerRadius - The inner radius of the ring.
 * @param {number} outerRadius - The outer radius of the ring.
 * @param {number} [thetaSegments=64] - Number of segments.
 * @returns {THREE.RingGeometry} The created ring geometry.
 */
export function createRingGeometry(innerRadius, outerRadius, thetaSegments = 64) {
    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, thetaSegments);
    geometry.rotateX(-Math.PI / 2); // Rotate to align with XZ plane
    return geometry;
}

/**
 * Creates a standard physically based material with a texture map.
 * @param {THREE.Texture} texture - The texture to map to the material.
 * @param {object} [additionalProps={}] - Optional additional properties for MeshStandardMaterial.
 * @returns {THREE.MeshStandardMaterial} The created material.
 */
export function createStandardMaterial(texture, additionalProps = {}) {
    return new THREE.MeshStandardMaterial({ map: texture, ...additionalProps });
}

/**
 * Creates a basic material with a texture map (unlit).
 * @param {THREE.Texture} texture - The texture to map to the material.
 * @returns {THREE.MeshBasicMaterial} The created material.
 */
export function createBasicMaterial(texture) {
    return new THREE.MeshBasicMaterial({ map: texture });
}

/**
 * Creates a Phong material (for effects like atmosphere).
 * @param {object} options - Configuration options for MeshPhongMaterial (e.g., map, color, opacity, transparent).
 * @returns {THREE.MeshPhongMaterial} The created material.
 */
export function createPhongMaterial(options) {
    return new THREE.MeshPhongMaterial(options);
}

/**
 * Creates a custom ShaderMaterial.
 * @param {string} vertexShader - GLSL vertex shader code.
 * @param {string} fragmentShader - GLSL fragment shader code.
 * @param {object} uniforms - Uniforms object for the shader.
 * @param {object} [additionalProps={}] - Optional additional properties for ShaderMaterial.
 * @returns {THREE.ShaderMaterial} The created shader material.
 */
export function createShaderMaterial(vertexShader, fragmentShader, uniforms, additionalProps = {}) {
    return new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        ...additionalProps
    });
}

/**
 * Creates a mesh object.
 * @param {THREE.BufferGeometry} geometry - The geometry for the mesh.
 * @param {THREE.Material} material - The material for the mesh.
 * @returns {THREE.Mesh} The created mesh.
 */
export function createMesh(geometry, material) {
    return new THREE.Mesh(geometry, material);
}

/**
 * Creates the specific ShaderMaterial for Earth.
 * @param {object} shaders - Object containing shader strings (EARTH_VERTEX_SHADER, EARTH_FRAGMENT_SHADER).
 * @param {object} uniforms - The uniforms object for the Earth shader.
 * @returns {THREE.ShaderMaterial} The Earth material.
 */
export function createEarthMaterial(shaders, uniforms) {
    const material = createShaderMaterial(
        shaders.EARTH_VERTEX_SHADER,
        shaders.EARTH_FRAGMENT_SHADER,
        uniforms
    );
    // Earth geometry needs tangents for normal mapping in the shader
    // Ensure geometry has tangents computed *before* creating the mesh
    return material;
}

/**
 * Creates the specific ShaderMaterial for atmospheric glow effects.
 * @param {object} shaders - Object containing shader strings (GLOW_VERTEX_SHADER, GLOW_FRAGMENT_SHADER).
 * @param {object} uniforms - The uniforms object for the glow shader.
 * @returns {THREE.ShaderMaterial} The glow material.
 */
export function createGlowMaterial(shaders, uniforms) {
    return createShaderMaterial(
        shaders.GLOW_VERTEX_SHADER,
        shaders.GLOW_FRAGMENT_SHADER,
        uniforms,
        {
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false
        }
    );
}
