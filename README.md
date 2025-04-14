# Terra - Solar System Simulation

A simple interactive 3D simulation of a solar system built with Three.js. Fly a spaceship between planets, view celestial bodies, and experiment with different control schemes.

## Features

*   Basic solar system model (Sun, planets, Moon, asteroid belt).
*   Flyable spaceship with physics-based movement.
*   Multiple control options:
    *   Keyboard & Mouse
    *   Gamepad (Xbox controller layout assumed)
    *   Mobile Touch & Gyroscope
*   Camera system with focus switching (planets, ship, reset).
*   Follow-camera mode for the spaceship.
*   Edit Mode for adjusting camera offset and sprite positions relative to the ship.

## Controls

### General UI

*   **Mouse Click:** Click on planets, Sun, Moon, or the spaceship to focus the camera.
*   **Focus Button:** Open dropdown to select a celestial body or reset focus.
*   **Generate Ship Button:** Creates a new spaceship at the origin.

### Spaceship Navigation (Select one method)

**1. Keyboard & Mouse Mode:**

*   **R Key:** Toggle Ship Navigation Mode ON/OFF.
    *   **Mode ON:** Mouse cursor hidden, mouse controls ship direction, UI interaction disabled.
    *   **Mode OFF:** Mouse cursor visible, UI interaction enabled.
*   **Mouse Movement (Mode ON):** Steer the ship (Pitch/Yaw).
*   **W Key (Mode ON):** Accelerate forward.
*   **S Key (Mode ON):** Decelerate / Reverse thrust.

**2. Gamepad (Xbox Layout):**

*   **Right Trigger:** Accelerate forward.
*   **Left Trigger:** Decelerate / Reverse thrust.
*   **Left Stick:** Pitch (Up/Down) & Yaw (Left/Right).
*   **Right Stick:** Roll (Left/Right).
*   **Y Button:** Generate new spaceship.
*   **B Button:** Reset camera focus.
*   *(Gamepad icon 🎮 appears top-right when connected)*

**3. Mobile (Touch & Gyroscope):**

*   **(Requires enabling motion controls via button first)**
*   **Tilt Device Forward/Backward:** Pitch ship Up/Down.
*   **Tilt Device Left/Right:** Roll ship Left/Right.
*   **Right On-Screen Button:** Accelerate forward.
*   **Left On-Screen Button:** Decelerate / Reverse thrust.
*   *(Buttons only appear on touch devices)*

### Edit Mode (Spaceship Focused)

*   **P Key:** Toggle Edit Mode ON/OFF (only when spaceship is the camera focus).
    *   **Mode ON:** Ship movement paused, OrbitControls enabled around the ship, editors appear.
    *   **Mode OFF:** Resumes follow-camera and ship movement.
*   **Camera Offset Editor (Top-Left):** Adjust the X, Y, Z values for the follow-camera position relative to the ship.
*   **Sprite Position Editor (Top-Left):** Adjust the local X, Y, Z position of the "Front" and "Back" labels relative to the ship.

## Running the Project

1.  You need a local web server to run this project due to browser security restrictions (CORS) when loading textures and modules.
2.  Navigate to the project directory (`/home/philipmathew/Github/Terra/`) in your terminal.
3.  Start a simple web server. Examples:
    *   **Using Python 3:** `python -m http.server`
    *   **Using Node.js (with `http-server` package):** `npx http-server`
    *   **Using VS Code Live Server extension.**
4.  Open your web browser and navigate to the local address provided by the server (e.g., `http://localhost:8000` or `http://127.0.0.1:8080`).
