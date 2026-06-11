# Multi-SKU Container Packing Optimization Design

## Goal

Upgrade the static container packing calculator so it supports both single-SKU maximum loading and multi-SKU ordered loading, while matching the real 40HQ packing cases provided by the user.

The implementation should keep the current no-build static app shape:

- `index.html`
- `styles.css`
- `app.js`
- `packing-core.js`
- `tests/packing-core.test.js`

The main complexity belongs in `packing-core.js`, where the packing result can be tested without browser state.

## Confirmed Container Coordinate Model

The existing coordinate direction should be preserved and made explicit:

- `x = 0`: the far inner end of the container.
- `x = container.length`: the container door end.
- `y = 0` and `y = container.width`: the left and right side walls.
- `z = 0`: floor.
- `z = container.height`: ceiling.

The two corner fittings sit at the far inner top end of the container, one on each side:

- Length intrusion: `110 mm`
- Width intrusion from each side wall: `110 mm`
- Height intrusion downward from ceiling: `80 mm`

Cartons must not intersect these fittings. Cartons only need to avoid the fittings; in the affected top area they do not need to align vertically with cartons below.

## User Experience

### Single-SKU Mode

Single-SKU mode is for maximum loading calculation:

- Show one carton dimension input group.
- Do not show or require target loading quantity.
- Calculate the maximum legal loading quantity for the selected container and carton size.
- Use one carton color in 2D and 3D.

### Multi-SKU Mode

Multi-SKU mode is for target-based ordered loading:

- Show a SKU count slider from `2` to `10`.
- Generate SKU input groups named `A`, `B`, `C`, and so on.
- Each SKU input group has:
  - Length, width, height
  - Target loading quantity
  - Color
- Every SKU target quantity is required.
- The SKU list supports drag sorting.
- After sorting, the displayed names are reassigned as `A`, `B`, `C`, and so on.
- The displayed order is the loading order.

Multi-SKU mode also shows a loading strategy selector:

- Multi-customer / multi-destination
- Same-customer / same-destination

The result area should add a SKU breakdown:

- SKU label
- Target quantity
- Actual loaded quantity
- Shortfall
- Color swatch

## Loading Strategies

### Multi-Customer / Multi-Destination

This mode keeps unloading boundaries clear:

- Load SKU `A` first, then `B`, then `C`.
- `A` is placed from the far inner end of the container.
- Later SKUs move progressively toward the door end.
- A later SKU does not start until the previous SKU reaches its target or available space runs out.
- If the container cannot fit all targets, later SKUs take the shortfall.

### Same-Customer / Same-Destination

This mode prioritizes complete vertical faces while still keeping SKU areas readable:

- Allocate as many full vertical faces as possible to each SKU in order.
- Each full face should stay single-SKU where possible.
- SKU remainders that cannot form a complete face are placed in the final door-side remainder area.
- The remainder area may contain multiple SKUs in loading order.

A "full face" means one packing step along the container length that includes the available width positions and all legal vertical positions for that step.

## Packing Algorithm

The current layer-copy model should be replaced by a position-sequence model.

The optimizer should first generate candidate floor patterns. For the business cases currently in scope, it should continue to evaluate explainable orthogonal strip patterns such as "four horizontal plus one vertical" instead of introducing an opaque general 3D bin-packing solver.

For each candidate, generate a sequence of loading faces from `x = 0` toward the door. Within each face, generate carton positions from bottom to top. This sequence drives:

- Total count calculation
- SKU allocation
- 2D display
- 3D animation

The animation and allocation order is:

1. Start at the far inner bottom area, opposite the door.
2. Fill the current face from bottom to top.
3. Move one face toward the door.
4. Repeat until the requested visible count or available space is exhausted.

## Corner-Fitting Avoidance

The affected top area cannot be handled by only deleting positions from a repeated full layer.

For each candidate face near the far inner end:

- Detect whether carton volume intersects either corner fitting.
- Reject intersecting positions.
- For top positions affected by the corner fittings, allow local horizontal adjustment inside the legal remaining space.
- Maximize the count in the affected face or top band without requiring alignment to lower cartons.

The algorithm must match these real 40HQ cases using the current preset `40HQ = 12032 x 2352 x 2698 mm`:

- `488 x 380 x 291`: actual loading quantity `1340`
  - Four horizontal: `4 x 9 x 30 = 1080`
  - One vertical: `1 x 9 x 24 = 216`
  - Final vertical remainder: `1 x 9 x 5 = 45`
  - Theoretical `1341`, actual `1340` because one carton is removed at the far-inner corner-fitting interference area.
- `488 x 360 x 291`: actual loading quantity `1403`
  - Four horizontal: `4 x 9 x 33 = 1188`
  - One vertical: `1 x 9 x 24 = 216`
  - Theoretical `1404`, actual `1403` because one carton is removed at the far-inner corner-fitting interference area.

For these cases, the far-inner affected area should allow four horizontal cartons where physically possible, not fall back to three just because the top cartons are not aligned to the lower layer.

## 2D and 3D Rendering

Rendering should consume the final generated carton position sequence.

3D view:

- Continue using Three.js.
- Color each carton by SKU.
- Mark the two corner fittings as translucent red blocks.
- Label `柜门` at the door end.
- Label the far inner corner-fitting end clearly.
- The progress slider shows cartons in actual loading sequence.

2D plan view:

- Show the corner-fitting avoidance areas.
- Show cartons by SKU color.
- Reflect the currently visible progress state.
- Add or preserve labels that explain inner end and door direction.

## Data Shape

The core calculation should return enough structured data for the UI without making the UI infer business rules:

- Container dimensions
- Corner fitting dimensions
- SKU inputs
- Selected strategy
- Chosen packing pattern
- Ordered carton positions
- Per-SKU loaded count
- Per-SKU target and shortfall
- Total loaded count
- Used height or occupied extent metrics
- Any blocked or avoided positions used for diagnostics

Each generated carton position should include:

- `x`, `y`, `z`
- `dx`, `dy`, `dz`
- SKU label
- SKU color
- Orientation id or label
- Loading sequence index
- Face index

## Testing

Keep algorithm coverage centered on `packing-core.js`.

Required automated tests:

- Existing single-SKU baseline tests still pass.
- `40HQ + 488 x 380 x 291` returns `1340`.
- `40HQ + 488 x 360 x 291` returns `1403`.
- Multi-customer multi-SKU allocation loads `A` to target before `B`, and `B` before `C`.
- If the container cannot fit all multi-SKU targets, later SKUs show the shortfall.
- Same-customer multi-SKU allocation gives full faces to SKUs before placing remainders.
- Generated position order starts at the inner end, fills a face bottom-to-top, then moves toward the door.
- Generated positions never intersect the corner fittings.

Manual browser verification:

- Single-SKU mode hides target quantity and calculates maximum loading.
- Multi-SKU mode shows the SKU count slider and dynamic SKU groups.
- Drag sorting changes SKU order and relabels as `A`, `B`, `C`.
- Both multi-SKU strategies produce understandable SKU breakdowns.
- 3D progress slider animates in the confirmed loading order.
- Different SKUs render with different colors.
- Door and inner corner-fitting labels are visible.

## Non-Goals

This iteration should not migrate the app to Vue or introduce a build system.

This iteration should not implement a fully general mixed-size 3D bin-packing solver. The goal is an explainable logistics-oriented algorithm that matches the provided real packing cases and supports the confirmed SKU workflows.
