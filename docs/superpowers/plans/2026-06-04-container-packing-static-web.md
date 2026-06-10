# Container Packing Static Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a no-build static web app that calculates and visualizes container carton loading for 20GP, 40GP, and 40HQ containers.

**Architecture:** Keep calculation in a pure UMD-style module so it can run in both the browser and Node tests. Keep rendering and DOM wiring in `app.js`, with 2D canvas drawing and native 3D canvas rendering consuming the same generated carton positions.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node built-in `assert` tests, native Canvas rendering.

---

### Task 1: Core Optimizer

**Files:**
- Create: `packing-core.js`
- Create: `tests/packing-core.test.js`

- [ ] **Step 1: Write tests for preset dimensions, mixed-lane optimization, and top-corner avoidance.**
- [ ] **Step 2: Run `node tests/packing-core.test.js` and confirm it fails because `packing-core.js` is not implemented.**
- [ ] **Step 3: Implement container presets, candidate enumeration, obstacle filtering, and carton position generation in `packing-core.js`.**
- [ ] **Step 4: Run `node tests/packing-core.test.js` and confirm the tests pass.**

### Task 2: Static UI

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `app.js`
- Copy: `assets/loading-yard-bg.png`

- [ ] **Step 1: Add the HTML form, summary metrics, 2D canvas, 3D panel, and progress slider.**
- [ ] **Step 2: Style the tool as a dense logistics operations interface with the generated loading-yard background.**
- [ ] **Step 3: Wire input changes to the optimizer and summary rendering.**
- [ ] **Step 4: Draw the 2D footprint with group labels and corner-block markers.**

### Task 3: 3D Rendering

**Files:**
- Modify: `app.js`
- Modify: `styles.css`

- [ ] **Step 1: Initialize the 3D canvas projection, container wireframe, and corner blocks.**
- [ ] **Step 2: Render cartons as projected cuboids with the selected RGB color and black edges.**
- [ ] **Step 3: Implement wheel zoom, left-button pan, and middle-button 360-degree rotation.**
- [ ] **Step 4: Use the progress slider to update the visible carton count.**

### Task 4: Browser Verification

**Files:**
- Verify: `index.html`
- Verify: `app.js`
- Verify: `styles.css`

- [ ] **Step 1: Run `node tests/packing-core.test.js`.**
- [ ] **Step 2: Serve the static folder locally and open it in the browser.**
- [ ] **Step 3: Check that the page loads without console errors, the calculation changes when inputs change, and both 2D and 3D views are visible.**
- [ ] **Step 4: Capture a screenshot for final review.**
