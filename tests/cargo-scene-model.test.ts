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
});
