# Container Packing Static Web App Design

## Goal

Build a static browser-based calculator for loading cartons into 20GP, 40GP, and 40HQ containers. The user enters carton length, width, and height in millimeters, picks a carton color, and sees the maximum loading quantity plus 2D and 3D placement views.

## User Experience

The first screen is the usable packing tool, not a landing page. A logistics-yard background image sits behind a dense operations-style interface. The left side holds inputs, summary metrics, and a stacking progress slider. The main work area shows a 2D top view and a 3D container view.

The page is a no-build static site. Users can open `index.html` directly as long as the project files remain in the same folder. 3D rendering uses a native Canvas projection so the tool does not depend on Vue, a build step, or an external CDN.

## Container Presets

- 20GP: 5898 x 2352 x 2393 mm
- 40GP: 12032 x 2352 x 2393 mm
- 40HQ: 12032 x 2352 x 2698 mm

Preset dimensions are editable in the UI so users can adjust for a specific carrier or container.

## Packing Rules

Cartons can only stand on their length-width face, so carton height is always vertical. The length and width directions may rotate on the floor plane.

The optimizer evaluates two strip-based placement families:

- Length segments: columns along the container length. A column may place cartons with carton length along container length, or carton width along container length.
- Width lanes: lanes across the container width. A lane may place cartons with carton length along container length, or carton width along container length.

The app enumerates mixed counts for both families and chooses the candidate with the largest valid total after corner-block avoidance.

## Corner Avoidance

Two top inner corner blocks are modeled at the far inner end of the container:

- 110 mm along container length
- 110 mm inward from the left and right side walls
- 80 mm downward from the ceiling

Any carton whose volume intersects those blocks is skipped on affected top layers.

## Outputs

The app displays:

- Maximum loaded cartons
- Full layer count and used height
- Per-layer carton count
- Space utilization estimate
- Selected pattern name
- Counts for length-facing and width-facing placements
- Occupied length and width
- Corner-block avoidance count

The 2D canvas labels group counts and occupied dimensions. The 3D Canvas view supports wheel zoom, left-button panning, and middle-button rotation. The progress slider controls how many cartons are drawn from empty to full.

## Files

- `packing-core.js`: pure calculation logic and position generation.
- `app.js`: UI state, 2D canvas drawing, native 3D canvas rendering, and interaction wiring.
- `styles.css`: operations dashboard styling and responsive layout.
- `index.html`: static page shell.
- `tests/packing-core.test.js`: Node assertions for calculation behavior.

## Verification

Run `node tests/packing-core.test.js` to verify the optimizer and corner avoidance. Open `index.html` in a browser to verify static loading and visual interaction.
