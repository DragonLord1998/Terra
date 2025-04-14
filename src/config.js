/**
 * Configuration file for the Solar System Simulation
 */

// --- Base URL for textures ---
export const baseURL = "https://raw.githubusercontent.com/DragonLord1998/Terra/main/";

// --- Texture Files ---
// Define all texture files needed, mapping keys to filenames
export const textureFiles = {
    starfield: "8k_stars_milky_way.jpg",
    saturnRing: "8k_saturn_ring_alpha.png",
    sun: "8k_sun.jpg",
    mercury: "8k_mercury.jpg",
    venus: "8k_venus_surface.jpg",
    earth: "earth_day.jpg",
    earthClouds: "earth_clouds.jpg",
    mars: "8k_mars.jpg",
    jupiter: "8k_jupiter.jpg",
    saturn: "8k_saturn.jpg",
    uranus: "2k_uranus.jpg",
    neptune: "2k_neptune.jpg",
    moon: "8k_moon.jpg"
};

// --- Planet Data (References textureFiles keys) ---
export const solarSystemData = [
    { name: "Venus", textureKey: "venus", radius: 0.95, distance: 9, orbitSpeed: 0.02, rotationSpeed: 0.005, tilt: 177.4, fallbackColor: 0xD4BF9A },
    { name: "Earth", textureKey: "earth", radius: 1.0, distance: 13, orbitSpeed: 0.01, rotationSpeed: 0.02, tilt: 23.4, moon: true, cloudsKey: "earthClouds", fallbackColor: 0x4B91E3 },
    { name: "Mars", textureKey: "mars", radius: 0.53, distance: 18, orbitSpeed: 0.008, rotationSpeed: 0.018, tilt: 25.2, fallbackColor: 0xC1440E },
    { name: "Jupiter", textureKey: "jupiter", radius: 3.5, distance: 28, orbitSpeed: 0.004, rotationSpeed: 0.04, tilt: 3.1, fallbackColor: 0xD8CAAD },
    { name: "Saturn", textureKey: "saturn", radius: 3.0, distance: 40, orbitSpeed: 0.003, rotationSpeed: 0.038, tilt: 26.7, rings: true, ringsTextureKey: "saturnRing", fallbackColor: 0xE0D8C0 },
    { name: "Uranus", textureKey: "uranus", radius: 2.0, distance: 55, orbitSpeed: 0.002, rotationSpeed: 0.03, tilt: 97.8, fallbackColor: 0xAFDBF5 },
    { name: "Neptune", textureKey: "neptune", radius: 1.9, distance: 70, orbitSpeed: 0.001, rotationSpeed: 0.028, tilt: 28.3, fallbackColor: 0x5B5DDF }
];

export const sunData = { name: "Sun", textureKey: "sun", radius: 3.5, fallbackColor: 0xFFFF00 };
export const moonData = { name: "Moon", textureKey: "moon", fallbackColor: 0xCCCCCC, tilt: 6.7 };

// --- Spaceship Color Palettes ---
export const palettes = [
    { name: "Military", primary: 0x556b2f, secondary: 0x8fbc8f, accent: 0xcd853f, metallic: 0xaaaaaa, nozzle: 0xffa500 },
    { name: "Civilian", primary: 0xf0f8ff, secondary: 0x4682b4, accent: 0xffa500, metallic: 0xdcdcdc, nozzle: 0xffa500 },
    { name: "Industrial", primary: 0x708090, secondary: 0xffd700, accent: 0xb22222, metallic: 0x808080, nozzle: 0xff8c00 },
    { name: "Alien", primary: 0x4b0082, secondary: 0x00ff7f, accent: 0x9400d3, metallic: 0x8a2be2, nozzle: 0x00ffff },
    { name: "Classic SciFi", primary: 0xc0c0c0, secondary: 0xff0000, accent: 0x0000ff, metallic: 0xe0e0e0, nozzle: 0xffff00 },
    { name: "Stealth", primary: 0x2f4f4f, secondary: 0x778899, accent: 0x00ffff, metallic: 0x696969, nozzle: 0x00ced1 }
];

// --- Gamepad Settings ---
export const gamepadSettings = {
    AXIS_THRESHOLD: 0.15 // Dead zone for sticks and triggers
};

// --- Mobile Control Settings ---
export const mobileControlSettings = {
    TILT_THRESHOLD: 2.0,      // Degrees of tilt before input registers
    PITCH_SENSITIVITY: 0.05,  // Multiplier for pitch tilt (adjust for desired responsiveness)
    ROLL_SENSITIVITY: 0.06,   // Multiplier for roll tilt (adjust for desired responsiveness)
    // YAW_SENSITIVITY: 0.05, // If you decide to map alpha or another axis to yaw
};

// --- Keyboard & Mouse Settings ---
export const keyboardMouseSettings = {
    PITCH_SENSITIVITY: 0.0025, // Adjust for desired responsiveness
    YAW_SENSITIVITY: 0.0020,   // Adjust for desired responsiveness
    MOUSE_DEADZONE_RADIUS: 30, // Pixels from center before mouse input registers
};

// --- Spaceship Physics Settings ---
export const shipSettings = {
    THRUST_FORCE: 15.0,       // How much force the main engine provides
    DECELERATION_FORCE: 10.0, // How much force braking/reverse provides
    MAX_SPEED: 20.0,          // Maximum forward speed
    MIN_SPEED: -5.0,          // Maximum reverse speed (set to 0 if no reverse desired)
    PITCH_SPEED: 1.5,         // Sensitivity for pitching up/down (radians/sec at full stick)
    YAW_SPEED: 1.0,           // Sensitivity for turning left/right (radians/sec at full stick)
    ROLL_SPEED: 2.0,          // Sensitivity for rolling (radians/sec at full stick)
    LINEAR_DAMPING: 0.98,     // Simulates drag, slows down ship over time (1 = no drag, 0 = instant stop)
    ANGULAR_DAMPING: 0.95     // Simulates rotational drag (1 = no drag)
};