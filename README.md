# Interactive 3D Solar System Simulation with Three.js

This project displays an interactive 3D model of our solar system, rendered using the Three.js library. It showcases various celestial bodies, visual effects, and an optional N-body gravity simulation.

## Features

*   **Solar System Representation:** Includes the Sun, Mercury, Venus, Earth (with Moon), Mars, Jupiter, Saturn (with rings), Uranus, and Neptune.
*   **Realistic Textures:** Uses high-resolution textures for planets where available.
*   **Earth Details:**
    *   Day/Night textures blended based on Sun position.
    *   Specular map for oceans/water bodies.
    *   Normal mapping for surface detail (toggleable via shader uniform, though no UI control currently).
    *   Cloud layer rotating independently.
    *   Atmospheric glow effect.
*   **Saturn's Rings:** Basic ring geometry around Saturn.
*   **Asteroid Belt:** A procedurally generated asteroid belt (using `THREE.Points`) located between Mars and Jupiter.
*   **Optional N-Body Gravity:**
    *   Toggleable simple N-body gravity simulation using Euler integration.
    *   When enabled, planets and asteroid belt groups orbit based on gravitational forces.
    *   When disabled, objects follow simple circular orbits.
*   **Asteroid Belt Physics Grouping:**
    *   The asteroid belt is simulated in groups for performance.
    *   A UI slider allows adjusting the number of asteroids per physics group, dynamically rebuilding the belt.
*   **Camera Controls:**
    *   Standard OrbitControls (rotate, zoom, pan).
    *   Toggleable focus lock between the Sun (origin) and Earth.
*   **Visual Effects:**
    *   Glow effects for the Sun and Earth's atmosphere.
    *   Toggleable custom shader effect for the Sun.
*   **Texture Level-of-Detail (LOD):** Automatically switches Earth textures based on camera distance.
*   **Code Structure:** Refactored into modules for better organization (`PhysicsEngine`, `SolarSystemBuilder`).

## Demo

To view the demo, simply open the `index.html` file in a modern web browser that supports WebGL and ES modules.

## Technical Details

*   **Engine:** Built with [Three.js](https://threejs.org/) (r163).
*   **Modules:** Uses ES module imports via an import map. Code is organized into:
    *   `main.js`: Main application loop, setup, event handling.
    *   `config.js`: Constants and data for celestial bodies and simulation parameters.
    *   `celestialFactory.js`: Helper functions for creating geometries and basic materials.
    *   `shaders.js`: GLSL shader code for Earth, Sun effect, and glows.
    *   `PhysicsEngine.js`: Class managing celestial bodies and N-body simulation logic.
    *   `SolarSystemBuilder.js`: Class responsible for creating and managing all scene objects based on config.
*   **Physics:** Implements a basic N-body simulation using Euler integration when toggled on. The asteroid belt is simulated as multiple groups, each treated as a single body in the simulation.
*   **Asteroids:** Represented using `THREE.Points` for performance, generated procedurally within a torus volume.

## Controls

*   **Rotate View:** Click and drag the left mouse button.
*   **Zoom:** Use the mouse scroll wheel.
*   **Pan View:** Click and drag the right mouse button (or Ctrl + left-click/drag).
*   **UI Buttons (Bottom Left):**
    *   **Gravity:** Toggles the N-body physics simulation On/Off.
    *   **Focus:** Switches the camera's orbit target between Earth and the Sun.
    *   **Sun Shader:** Toggles a custom visual effect on the Sun.
*   **UI Slider (Bottom Left):**
    *   **Asteroid Group Size:** Adjusts how many asteroids are grouped into a single object for the physics simulation (lower values = more groups, potentially slower physics). The belt rebuilds when the slider value changes.

## License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
