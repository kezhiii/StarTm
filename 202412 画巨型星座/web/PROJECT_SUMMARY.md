# Project Summary: Giant Constellation Visualization

## Overall Goal
Develop and refine a 3D satellite constellation visualization system with a modular architecture, supporting real-time WebSocket (WS) and static CSV data modes, accurate Earth/Moon dynamics, and interactive multi-view perspectives.

## Key Knowledge
*   **Tech Stack**: Three.js (Frontend), Python (Backend).
*   **Coordinate Systems**:
    *   **Scene Units**: The Earth has a radius of `RE_3D = 50` units.
    *   **Data Units (ECI)**: Raw satellite and moon data are in **Meters**.
    *   **Conversion Factor**: `SCALE = RE_KM * 1000 / 50` (~127,562.74).
*   **Architecture**:
    *   `managers/`: Handle logic (Input, Playback, Mode Switching, UI, CSV).
    *   `core/`: Low-level utilities (App Context, Scene Utils, Transitions).
    *   `modules/views/`: Handle rendering updates for specific cameras.
    *   `app.js`: Entry point (~450 lines, heavily refactored).
*   **State Management**: `appState` is the Single Source of Truth.
*   **Star Field**: Uses `modules/star-field.js` to render a background sphere (8K texture or particles). It is preserved across view switches by checking `userData.isStarField` and resetting `scene.background`.

## Recent Changes (2026-04-13) - Refactoring & Starfield

### Architecture Refactoring
- **App Context (`core/app-context.js`)**: Encapsulated global Three.js objects (`scene`, `camera`, `renderer`, `controls`) to reduce global scope pollution.
- **Texture Loader (`modules/texture-loader.js`)**: Extracted asynchronous texture loading logic.
- **CSV Manager (`managers/csv-manager.js`)**: Centralized CSV data parsing and WS connection cleanup logic.
- **Cleanup**: Removed unused imports and simplified `app.js` significantly.
- **Server Stability**: Updated `start.py` to use a **Threaded HTTP Server** (`ThreadingMixIn`) and disable caching, resolving issues where page refreshes caused 404s or connection drops.

### Star Field Implementation
- **Module**: Created `modules/star-field.js`.
- **Hyrend Rendering**: Attempts to load an 8K Milky Way texture (via CORS proxy or local file). If it fails, falls back to a high-fidelity particle system (15,000 stars with soft glow).
- **Persistence Fix**: Fixed the bug where the starfield disappeared when switching views. Added logic in `switchView` to restore the starfield texture as `scene.background` after initialization.
- **First-Person Ground**: Added a generated grid texture to the ground plane in First-Person view (`first-person.js`) to differentiate the floor from the sky.

### Bug Fixes
- **Center View Earth Rotation**: Fixed an issue where Earth would rotate unexpectedly when switching to Center view while CSV playback was paused. Added a check for `csvState.isPlaying` before setting rotation parameters.
- **Azimuth Smoothing**: Fixed the "flashing" issue in WS mode caused by averaging azimuth angles across the 360°/0° boundary using vector averaging.

## Recent Changes (2026-04-12)

### Satellite Light Control System
- **Light Manager Module** (`modules/light-manager.js`):
    - Manages per-satellite light states (On/Off) and applies visual updates.
    - Uses `emissive` property for glowing effect: Satellites glow **Yellow** (`#ffdd44`) when On, revert to Green/Red when Off.
    - Requires `MeshPhongMaterial` (updated in `modules/config.js`).
- **Constellation Panel** (`modules/ui/constellation-panel.js`):
    - Interactive 2D Canvas visualization of the satellite formation.
    - **Projection**: Calculates real-time **Azimuth/Elevation** relative to observer.
    - **Interaction**: Clicking a satellite in the panel toggles its light state.
- **Integration**: Integrated into rendering loop (`interpolation.js`) to apply light states every frame.

### Playback Fixes
- **WS Playback Stability**: Fixed data queue accumulation issues and accumulator resetting to prevent "jumping" satellites.
- **CSV Loop Sync**: Fixed Earth rotation synchronization when CSV playback loops back to the start.

## Architecture
```
├── app.js                    # Entry point, scene setup, view switching
├── core/
│   ├── app-context.js        # Three.js objects encapsulation (NEW)
│   ├── engine.js
│   ├── scene-utils.js        # clearSceneObjects, updateOrbitRings
│   ├── transition.js         # View transition animations
│   ├── view-update.js        # updateCurrentView, updateCurrentViewWs
│   └── ws-utils.js           # WebSocket utilities
├── managers/
│   ├── csv-manager.js        # CSV parsing and loading (NEW)
│   ├── input-manager.js      # Mouse/keyboard controls
│   ├── mode-manager.js       # WS/CSV mode switching
│   ├── playback-manager.js   # CSV/WS playback, speed, seeking
│   ├── ui-manager.js         # UI initialization, event listeners
│   └── view-manager.js
└── modules/
    ├── config.js             # Constants, shared resources
    ├── earth-rotation.js     # Earth rotation updates
    ├── interpolation.js      # Satellite position interpolation
    ├── math-utils.js         # ECI→ECEF→Local coordinate transforms
    ├── moon-orbit.js         # Moon orbit calculations
    ├── star-field.js         # Background starfield (Texture/Particles) (NEW)
    ├── texture-loader.js     # Async texture loading (NEW)
    ├── state.js              # Global state management
    ├── views/
    │   ├── first-person.js   # First-person camera, satellite & moon rendering
    │   ├── third-person.js   # Third-person camera
    │   └── center-person.js  # Center satellite view
    └── ui/
        ├── location-controls.js
        ├── stats-panel.js
        └── tooltip-system.js
```

## Summary Metadata
**Update time**: 2026-04-13T14:00:00.000Z
