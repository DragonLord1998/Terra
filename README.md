# Interactive 3D Earth with Three.js

This project displays an interactive 3D model of the Earth rendered using the Three.js library. It showcases several visual features including dynamic lighting, textures, and atmospheric effects.

## Features

*   **Realistic Earth Rendering:** Uses day and night textures for the Earth's surface.
*   **Day/Night Cycle:** Simulates the effect of sunlight on the Earth based on a light source position.
*   **Animated Water:** Custom shader provides a basic animated water effect using noise functions.
*   **Cloud Layer:** A semi-transparent cloud layer rotates independently above the Earth's surface.
*   **Atmospheric Glow:** A shader creates a soft blue glow around the edge of the Earth, simulating the atmosphere.
*   **Texture Level-of-Detail (LOD):** Automatically switches between low-resolution and high-resolution textures based on the camera's zoom level for performance optimization.
*   **Orbit Controls:** Allows users to rotate the Earth and zoom in/out using the mouse.

## Demo

To view the demo, simply open the `index.html` file in a modern web browser that supports WebGL and ES modules.

## Technical Details

*   **Engine:** Built with [Three.js](https://threejs.org/) (r163).
*   **Shaders:**
    *   Custom GLSL vertex and fragment shaders are used for rendering the Earth's surface, blending day/night textures, and creating the animated water effect based on a specular map mask.
    *   A separate shader pair creates the atmospheric glow effect based on the viewing angle.
*   **Textures:** Utilizes various texture maps for day, night, clouds, and specular (water mask) information, provided in both low (2k) and high (8k) resolutions.
*   **Modules:** Uses ES module imports via an import map defined in `index.html`.

## Controls

*   **Rotate:** Click and drag the left mouse button.
*   **Zoom:** Use the mouse scroll wheel.
*   **Pan:** Click and drag the right mouse button (or Ctrl + left-click/drag).

## License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
