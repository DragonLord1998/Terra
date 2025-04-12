// src/config.js

// --- Constants ---
export const EARTH_RADIUS = 1; // Base unit
export const SUN_RADIUS = 25; // Increased visual size
export const SUN_GLOW_RADIUS_FACTOR = 1.3; // Adjusted glow size relative to new sun radius
export const MOON_RADIUS_FACTOR = 0.27; // Moon size relative to Earth
export const MOON_ORBIT_RADIUS = 2.5; // Moon distance from Earth
export const CLOUD_ALTITUDE_FACTOR = 1.02; // Cloud layer height relative to Earth radius
export const ATMOSPHERE_ALTITUDE_FACTOR = 1.04; // Atmosphere height relative to Earth radius
export const LOD_ZOOM_THRESHOLD = 2.5; // Camera distance to switch Earth textures
export const EARTH_DISPLACEMENT_SCALE = 0.02; // How much height map affects geometry
export const EARTH_ORBIT_RADIUS = 100; // Earth's distance from Sun (Increased)
export const EARTH_ORBIT_SPEED = 1.0; // Base orbit speed (Keep this as 1, SOLAR_SYSTEM_ORBIT_SPEED_FACTOR controls overall speed)
export const MOON_ORBIT_SPEED = 0.05; // Moon orbit speed around Earth (Slowed down x10)
export const EARTH_ROTATION_SPEED = 0.01; // Slowed down x10
export const CLOUD_ROTATION_SPEED = 0.012; // Slowed down x10
export const SOLAR_SYSTEM_ORBIT_SPEED_FACTOR = 0.01; // General speed multiplier for all planet orbits (Slowed down x10)
export const GRAVITATIONAL_CONSTANT = 0.005; // Needs tuning!
export const SUN_MASS = 333000; // Relative to Earth=1 (very large!)

// --- Planet Data ---
// Sizes relative to Earth Radius (1)
// Orbit Radii relative to Sun (origin)
// Orbit Speeds relative to Earth's speed (1)
// Mass relative to Earth=1
export const PLANET_DATA = [
    { name: "Mercury", textureFile: "8k_mercury.jpg", sizeFactor: 0.38, orbitRadius: 40, orbitSpeedFactor: 1.6, mass: 0.055 }, // Increased orbitRadius
    { name: "Venus", textureFile: "8k_venus_surface.jpg", atmosphereTextureFile: "4k_venus_atmosphere.jpg", sizeFactor: 0.95, orbitRadius: 70, orbitSpeedFactor: 1.17, mass: 0.815 }, // Increased orbitRadius
    // Earth data added here for consistency in physics simulation
    { name: "Earth", textureFile: null, sizeFactor: 1.0, orbitRadius: EARTH_ORBIT_RADIUS, orbitSpeedFactor: EARTH_ORBIT_SPEED, mass: 1.0 }, // Uses EARTH_ORBIT_RADIUS constant
    { name: "Mars", textureFile: "8k_mars.jpg", sizeFactor: 0.53, orbitRadius: 150, orbitSpeedFactor: 0.8, mass: 0.107 }, // Increased orbitRadius
    { name: "Jupiter", textureFile: "8k_jupiter.jpg", sizeFactor: 11.2, orbitRadius: 520, orbitSpeedFactor: 0.43, mass: 317.8 }, // Increased orbitRadius
    { name: "Saturn", textureFile: "8k_saturn.jpg", sizeFactor: 9.45, orbitRadius: 950, orbitSpeedFactor: 0.32, hasRings: true, mass: 95.2 }, // Increased orbitRadius
    { name: "Uranus", textureFile: "2k_uranus.jpg", sizeFactor: 4.0, orbitRadius: 1920, orbitSpeedFactor: 0.23, mass: 14.5 }, // Increased orbitRadius
    { name: "Neptune", textureFile: "2k_neptune.jpg", sizeFactor: 3.88, orbitRadius: 3010, orbitSpeedFactor: 0.18, mass: 17.1 } // Increased orbitRadius
];

// --- Saturn Ring Config ---
export const SATURN_RING_INNER_RADIUS_FACTOR = 1.2; // Relative to Saturn's radius
export const SATURN_RING_OUTER_RADIUS_FACTOR = 2.2; // Relative to Saturn's radius
export const SATURN_RING_OPACITY = 0.8;
export const SATURN_RING_COLOR = 0xaaaaaa;

// --- Venus Atmosphere Config ---
export const VENUS_ATMOSPHERE_ALTITUDE_FACTOR = 1.02; // Relative to Venus' radius
export const VENUS_ATMOSPHERE_OPACITY = 0.3;

// --- Camera Config ---
export const CAMERA_FAR_PLANE = 5000; // Increased further
export const CAMERA_INITIAL_POS_Z = 400; // Increased further
export const CAMERA_INITIAL_POS_Y = 50; // Increased further
export const CONTROLS_MAX_DISTANCE = 5000; // Match far plane

// --- Light Config ---
export const SUN_LIGHT_INTENSITY = 3.0;
export const SUN_LIGHT_POSITION = { x: 5, y: 3, z: 5 }; // Keep original offset for lighting direction
export const AMBIENT_LIGHT_INTENSITY = 0.1;

// --- Earth Shader Config ---
export const EARTH_NORMAL_MAP_TOGGLE_DEFAULT = false; // Start with normal mapping off
export const EARTH_SHADER_AMBIENT_FACTOR_BASE = 0.3;
export const EARTH_SHADER_AMBIENT_FACTOR_NORMAL_MAP = 0.25;
export const EARTH_SHADER_DIRECT_FACTOR_BASE = 0.7;
export const EARTH_SHADER_DIRECT_FACTOR_NORMAL_MAP = 0.6;
export const EARTH_NIGHT_BLEND_FACTOR = 0.3;

// --- Glow Shader Config ---
export const EARTH_ATMOSPHERE_COLOR = { r: 0.3, g: 0.6, b: 1.0 };
export const SUN_GLOW_COLOR = { r: 1.0, g: 0.7, b: 0.2 };
export const GLOW_INTENSITY_MULTIPLIER = 0.8;
export const GLOW_FALLOFF_EXPONENT = 3.0;
