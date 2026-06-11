# Vue 3 Migration Design

## Goal

Migrate the current static container packing calculator from hand-written HTML/CSS/JavaScript to a maintainable Vue 3 application without changing packing behavior.

This migration is version `2.1`: it is an architecture migration and parity release. The Vue version must calculate and render the same results as the current static version before any major UI redesign or new business feature work starts.

The later `3.0` release can redesign the visual system and interaction model on top of the Vue architecture.

## Why Migrate

The current app has grown beyond the point where a single static script is comfortable to maintain:

- `app.js` owns form state, SKU state, drag sorting, result rendering, 2D drawing, 3D drawing, progress behavior, and error handling.
- `styles.css` owns every visual rule globally.
- `index.html` contains a complete app shell that is becoming difficult to evolve.
- Future versions are expected to add more features, so the cost of changing UI state and interactions will continue to rise.

The migration should improve code ownership boundaries without changing the proven packing algorithm.

## Technology Choice

Use:

- Vue 3
- Vite
- TypeScript
- Pinia
- Vitest
- Playwright
- Three.js

Vue 3 is preferred over React for this project because the app is form-heavy, state-heavy, and template-heavy. Vue Single-File Components map cleanly from the current HTML structure, and `v-model` works well for the dense parameter forms.

Vite is the build tool. The production output remains static files in `dist/`, so the app is not tied to Vercel. The built output can be deployed to Nginx, OSS/COS + CDN, Cloudflare Pages, GitHub Pages, Netlify, or zipped for local/static hosting.

## Version Scope

### Version 2.1: Vue Parity Migration

Version `2.1` must preserve the current product behavior:

- Single-SKU maximum loading mode.
- Multi-SKU loading mode with 2-10 SKUs.
- SKU target quantities, colors, labels, and drag sorting.
- Multi-destination loading strategy.
- Same-destination full-face-first strategy.
- Corner-fitting avoidance.
- 2D plan rendering.
- 3D cargo rendering with SKU colors.
- Progress slider animation in loading order.
- Current regression results:
  - `40HQ + 488 x 380 x 291 = 1340`
  - `40HQ + 488 x 360 x 291 = 1403`

The visible UI can become slightly cleaner during migration, but no broad redesign should happen in `2.1`.

### Version 3.0: UI and UX Upgrade

Version `3.0` can change visual design and interaction patterns after parity is proven. It may introduce:

- New layout density.
- Better SKU editing.
- Improved empty states and error states.
- Better 2D/3D legends.
- Mobile and tablet layout improvements.
- Optional component library adoption for selected controls.

## Non-Goals

Version `2.1` must not:

- Rewrite the packing algorithm from scratch.
- Introduce a server runtime.
- Require Vercel or any specific hosting provider.
- Add user accounts, cloud storage, export reports, history, or quoting workflows.
- Replace Three.js with another 3D library.
- Change the confirmed business rules for SKU order, same-destination faces, or corner fittings.

## Architecture

The migrated app should separate four concerns:

1. Core packing domain logic.
2. Application state.
3. Vue UI components.
4. Canvas and Three.js rendering adapters.

Core packing logic must stay independent of Vue. Vue components call typed core APIs and render returned data. This keeps algorithm tests fast and prevents UI refactors from changing calculation results.

## Proposed File Structure

```text
src/
  main.ts
  App.vue
  core/
    packing/
      index.ts
      types.ts
      constants.ts
      geometry.ts
      candidates.ts
      positions.ts
      multiSku.ts
  stores/
    packingStore.ts
  components/
    controls/
      ContainerForm.vue
      PackingModeSwitch.vue
      SingleSkuForm.vue
      SkuEditor.vue
      SkuCard.vue
      ProgressControl.vue
    results/
      ResultSummary.vue
      SkuBreakdown.vue
    visualizations/
      Plan2DView.vue
      Cargo3DView.vue
  renderers/
    plan2d.ts
    cargo3d.ts
    labels.ts
  styles/
    tokens.css
    global.css
    components.css
  test/
    setup.ts
tests/
  packing-core.test.ts
  app-visuals.test.ts
  packing-e2e.spec.ts
```

`tests/` may stay at the repository root so existing Node-based tests remain easy to run. If Vitest becomes the only unit test runner, the tests can later move under `src/` or `tests/` consistently.

## Core Module Design

The current `packing-core.js` should be migrated to TypeScript with behavior preserved.

The public API should expose:

- `CONTAINERS`
- `LOADING_STRATEGIES`
- `calculatePacking(container, carton, options)`
- `calculateMultiSkuPacking(container, skus, options)`
- `generateBoxPositions(result, visibleCount)`
- `collidesCornerBlock(position, container, cornerBlock)`

The TypeScript module should define explicit types for:

- `Container`
- `Carton`
- `CornerBlock`
- `PackingOptions`
- `SkuInput`
- `PackingResult`
- `BoxPosition`
- `SkuSummary`
- `LoadingStrategy`

The migration should first port the existing implementation with minimal logic changes. Any algorithm improvement belongs in a later task after parity is locked.

## State Management

Use one Pinia store for the current calculator workflow:

- Container type and custom dimensions.
- Packing mode.
- Single SKU carton dimensions and color.
- Multi-SKU list, colors, targets, and order.
- Selected loading strategy.
- Calculation result.
- Progress visible count.
- Current UI status and validation error.

Derived values such as progress label, loaded total, SKU shortfall, and selected layer should be getters or computed values.

Pinia should not contain Three.js objects, canvas contexts, or DOM references. Rendering resources stay inside renderer modules or Vue component lifecycle hooks.

## Component Responsibilities

`App.vue` owns the top-level shell and imports global styles.

`PackingWorkbench.vue` is optional. If created, it should compose the control panel, result panel, 2D view, and 3D view.

`ContainerForm.vue` owns container type and dimension inputs.

`PackingModeSwitch.vue` owns single/multi SKU mode selection.

`SingleSkuForm.vue` owns single-SKU carton dimensions and color.

`SkuEditor.vue` owns SKU count, strategy selector, SKU list, and drag sorting.

`SkuCard.vue` owns one SKU's dimensions, target quantity, color, and drag handle.

`ResultSummary.vue` owns total boxes, layers, used height, utilization, pattern, occupied length/width, and corner-avoidance count.

`SkuBreakdown.vue` owns per-SKU loaded/target/shortfall rows.

`ProgressControl.vue` owns the progress slider and progress text.

`Plan2DView.vue` owns the 2D canvas lifecycle and calls `renderPlan2D`.

`Cargo3DView.vue` owns the Three.js canvas lifecycle and calls `createCargoScene`, `updateCargoScene`, and `disposeCargoScene`.

## Rendering Design

The 2D renderer should be a pure canvas adapter:

- Inputs: canvas, packing result, visible count, current colors, device pixel ratio.
- Output: drawn canvas only.
- No direct Pinia access.

The 3D renderer should be an imperative adapter:

- Initialize scene, camera, renderer, lights, labels, and controls.
- Update container shell, corner fittings, boxes, colors, door marker, and labels when result or visible count changes.
- Dispose geometries, materials, textures, and event listeners on component unmount.
- Keep the confirmed fix where cargo colors are not darkened by the container shell or wireframe.

The progress slider should continue to show boxes in the ordered loading sequence.

## UI Direction for 2.1

Version `2.1` should stay close to the current UI, but can improve polish where it naturally falls out of componentization:

- Keep an operational dashboard layout.
- Keep dense controls for repeated use.
- Keep dark technical visualization style.
- Improve alignment, spacing, and validation messages if low risk.
- Avoid a full landing-page or marketing-style redesign.

## Static Build and Deployment

The production build should output static assets:

```text
dist/
  index.html
  assets/
```

Required deployment modes:

- Static CDN or object storage deployment.
- Nginx static file deployment.
- Local preview with `npm run preview`.
- Optional zip delivery of `dist/`.

If a future offline one-file build is needed, it should be a separate build target using an explicit plugin. It should not replace the normal `dist/` output.

## Testing Strategy

### Unit Tests

Use Vitest for TypeScript unit tests.

Required core tests:

- Existing baseline packing tests.
- `40HQ + 488 x 380 x 291 = 1340`.
- `40HQ + 488 x 360 x 291 = 1403`.
- Generated positions include loading order metadata.
- Generated positions do not collide with corner fittings.
- Multi-destination SKU allocation loads earlier SKUs first.
- Same-destination allocation keeps full faces where possible.
- Invalid dimensions and invalid SKU targets throw useful errors.

### Visual Logic Tests

Keep or port the current `app-visuals` checks:

- Cargo face material uses direct color.
- Cargo wireframe does not overpower SKU colors.
- Container shell does not darken cargo colors.
- Door marker and corner fitting visual hooks remain present.

### Browser Tests

Use Playwright for end-to-end browser tests:

- App loads without console errors.
- Single-SKU mode hides target quantity.
- Multi-SKU mode shows dynamic SKU cards from 2 to 10.
- Drag sorting changes order and relabels as `A`, `B`, `C`.
- The two real 40HQ cases return `1340` and `1403`.
- 2D canvas is nonblank after calculation.
- 3D canvas is nonblank and shows SKU colors.
- Static build can be previewed locally.

## Migration Sequence

1. Create the Vite Vue TypeScript project structure.
2. Install dependencies and configure scripts.
3. Port `packing-core.js` to TypeScript with tests.
4. Build Pinia store and state types.
5. Build control components.
6. Build result components.
7. Port 2D renderer.
8. Port 3D renderer.
9. Add browser tests.
10. Replace old static entry with Vue build output flow after parity is proven.

## Risk Management

The highest risk is accidentally changing packing behavior while moving files. To control this:

- Port tests before changing algorithm internals.
- Keep commits small.
- Preserve the old static files until Vue parity is proven.
- Do not delete `packing-core.js`, `app.js`, `index.html`, or `styles.css` until the Vue app passes the parity checklist.
- Use browser screenshots during the 2D/3D migration.

## Acceptance Checklist

The migration is complete when:

- `npm run test:unit` passes.
- `npm run test:e2e` passes or the documented browser verification passes.
- `npm run build` produces `dist/`.
- `npm run preview` serves the built app.
- The Vue app returns `1340` and `1403` for the two real cases.
- Single-SKU and multi-SKU workflows match the current app.
- Door marker, corner fittings, and SKU colors are visible in 3D.
- The old static app can still be recovered from git history if rollback is needed.

