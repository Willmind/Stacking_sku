import assert from "node:assert/strict";
import { describe, it } from "vitest";

describe("cargo scene model", () => {
  it("maps packing positions to Three/Tres scene coordinates", async () => {
    const module = await import("../src/renderers/cargoSceneModel");
    const box = module.toSceneBox(
      {
        x: 0,
        y: 0,
        z: 0,
        dx: 500,
        dy: 400,
        dz: 300,
        sequenceIndex: 0,
        skuLabel: "SKU-1",
        skuColor: "#d8923a",
      },
      { length: 12000, width: 2400, height: 2600 },
    );

    assert.deepEqual(box.position, [-5.75, -1.15, -1]);
    assert.deepEqual(box.scale, [0.496, 0.298, 0.397]);
    assert.equal(box.label, "SKU-1");
    assert.equal(box.color, "#d8923a");
    assert.equal(box.loadingSequence, 1);
  });

  it("maps container context to Three/Tres scene coordinates", async () => {
    const module = await import("../src/renderers/cargoSceneModel");
    const container = module.toSceneContainer({
      container: { length: 12000, width: 2400, height: 2600 },
      effectiveContainer: { length: 11900, width: 2350, height: 2550 },
      clearance: { front: 50, rear: 50, left: 20, right: 30, top: 50 },
      cornerBlock: { length: 500, width: 250, height: 300 },
    });

    assert.deepEqual(container.scale, [12, 2.6, 2.4]);
    assert.deepEqual(container.floorSize, [12, 2.4]);
    assert.deepEqual(container.floorPosition, [0, -1.3, 0]);
    assert.deepEqual(container.effectiveFrame?.scale, [11.9, 2.55, 2.35]);
    assert.deepEqual(container.effectiveFrame?.position, [0, -0.025, -0.005]);
    assert.equal(container.cornerBlocks.length, 2);
    assert.deepEqual(container.cornerBlocks[0].position, [-5.75, 1.15, -1.075]);
    assert.deepEqual(container.cornerBlocks[0].scale, [0.5, 0.3, 0.25]);
    assert.deepEqual(container.cornerBlocks[1].position, [-5.75, 1.15, 1.075]);
    assert.deepEqual(
      container.endpointSurfaces.map((surface: { key: string; label: string; color: string; position: [number, number, number] }) => ({
        key: surface.key,
        label: surface.label,
        color: surface.color,
        position: surface.position,
      })),
      [
        { key: "inner-end-surface", label: "角件端", color: "#ffb24a", position: [-6.004, 0, 0] },
        { key: "door-end-surface", label: "柜门", color: "#42d6a4", position: [6.004, 0, 0] },
      ],
    );
    assert.deepEqual(container.endpointLegend, [
      { key: "door-end", label: "柜门", color: "#42d6a4" },
      { key: "inner-end", label: "角件端", color: "#ffb24a" },
    ]);
    assert.deepEqual(
      container.endpointLabels.map((label: { key: string; text: string; position: [number, number, number] }) => ({
        key: label.key,
        text: label.text,
        position: label.position,
      })),
      [
        { key: "inner-end-label", text: "角件端", position: [-7.05, 1.748, 0] },
        { key: "door-end-label", text: "柜门", position: [7.05, 1.748, 0] },
      ],
    );
  });

  it("maps selected carton coordinate target points to Three/Tres scene coordinates", async () => {
    const module = await import("../src/renderers/cargoSceneModel");
    const points = module.toSceneCoordinatePoints(
      {
        x: 0,
        y: 0,
        z: 0,
        dx: 500,
        dy: 400,
        dz: 300,
        sequenceIndex: 0,
        skuLabel: "SKU-1",
        skuColor: "#d8923a",
      },
      { length: 12000, width: 2400, height: 2600 },
    );

    assert.deepEqual(points, [
      {
        key: "door-face-center",
        label: "柜门面",
        color: "#42d6a4",
        position: [-5.5, -1.15, -1],
      },
      {
        key: "top-face-center",
        label: "上表面",
        color: "#68a6ff",
        position: [-5.75, -1, -1],
      },
    ]);
  });
});
