import { describe, expect, it } from "vitest";
import {
  calculateMultiSkuPacking,
  calculatePacking,
  calculatePackingSummary,
  calculatePackingTotalBoxes,
  collidesCornerBlock,
  generateBoxPositions,
  type BoxPosition,
  type CartonSpec,
  type ContainerSpec,
  type PackingOptions,
  type PackingResult,
} from "../src/core/packing";

function boxesOverlap3d(first: BoxPosition, second: BoxPosition) {
  return (
    first.x < second.x + second.dx &&
    first.x + first.dx > second.x &&
    first.y < second.y + second.dy &&
    first.y + first.dy > second.y &&
    first.z < second.z + second.dz &&
    first.z + first.dz > second.z
  );
}

function assertPositionsAreSafe(result: PackingResult, positions: BoxPosition[]) {
  const { clearance, container, cornerBlock } = result;

  expect(positions).toHaveLength(result.totalBoxes);
  for (const [index, position] of positions.entries()) {
    expect(position.x, `position ${index} should respect front clearance`).toBeGreaterThanOrEqual(clearance.front);
    expect(position.y, `position ${index} should respect left clearance`).toBeGreaterThanOrEqual(clearance.left);
    expect(position.z, `position ${index} should stay above the floor`).toBeGreaterThanOrEqual(0);
    expect(position.x + position.dx, `position ${index} should respect rear clearance`).toBeLessThanOrEqual(
      container.length - clearance.rear,
    );
    expect(position.y + position.dy, `position ${index} should respect right clearance`).toBeLessThanOrEqual(
      container.width - clearance.right,
    );
    expect(position.z + position.dz, `position ${index} should respect top clearance`).toBeLessThanOrEqual(
      container.height - clearance.top,
    );
    expect(collidesCornerBlock(position, container, cornerBlock), `position ${index} should not collide with a physical corner block`).toBe(
      false,
    );
  }

  for (let firstIndex = 0; firstIndex < positions.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < positions.length; secondIndex += 1) {
      expect(
        boxesOverlap3d(positions[firstIndex], positions[secondIndex]),
        `positions ${firstIndex} and ${secondIndex} should not overlap in 3D`,
      ).toBe(false);
    }
  }
}

function calculateAndAssertConsistent(container: ContainerSpec, carton: CartonSpec, options: PackingOptions) {
  const result = calculatePacking(container, carton, options);
  const summary = calculatePackingSummary(container, carton, options);
  const totalBoxes = calculatePackingTotalBoxes(container, carton, options);
  const positions = generateBoxPositions(result, result.totalBoxes);

  expect(summary.totalBoxes).toBe(result.totalBoxes);
  expect(totalBoxes).toBe(result.totalBoxes);
  assertPositionsAreSafe(result, positions);

  return { result, positions };
}

describe("packing safety regressions", () => {
  it("拒绝角件挪位后与已接收箱体发生真实 3D 重叠的候选", () => {
    const result = calculateAndAssertConsistent(
      { length: 141, width: 221, height: 120 },
      { length: 60, width: 141, height: 119 },
      {
        cornerBlock: { length: 1, width: 39, height: 20 },
        clearance: { right: 39 },
        allowedOrientations: ["width-length-height", "width-height-length"],
      },
    ).result;

    expect(result.totalBoxes).toBe(2);
  });

  it("左右间隙镜像时保持相同安全容量", () => {
    const container = { length: 342, width: 235, height: 212 };
    const carton = { length: 22, width: 116, height: 18 };
    const commonOptions: PackingOptions = {
      cornerBlock: { length: 56, width: 23, height: 87 },
      allowedOrientations: ["length-width-height", "width-length-height"],
    };
    const left = calculateAndAssertConsistent(container, carton, {
      ...commonOptions,
      clearance: { left: 13, right: 0, top: 42 },
    });
    const right = calculateAndAssertConsistent(container, carton, {
      ...commonOptions,
      clearance: { left: 0, right: 13, top: 42 },
    });

    expect(left.result.totalBoxes).toBe(234);
    expect(right.result.totalBoxes).toBe(234);
    expect(left.result.totalBoxes).toBe(right.result.totalBoxes);
  });

  it("异尺寸多 SKU 在左右间隙镜像时保持相同数量与 SKU 分配", () => {
    const container = { length: 900, width: 430, height: 360 };
    const skus = [
      { label: "A", length: 215, width: 134, height: 146, target: 50, color: "#d8923a" },
      { label: "B", length: 139, width: 91, height: 68, target: 54, color: "#42d6a4" },
    ];
    const commonOptions: PackingOptions = {
      strategy: "multi-destination",
      cornerBlock: { length: 110, width: 110, height: 80 },
    };
    const leftResult = calculateMultiSkuPacking(container, skus, {
      ...commonOptions,
      clearance: { left: 139, right: 50 },
    });
    const rightResult = calculateMultiSkuPacking(container, skus, {
      ...commonOptions,
      clearance: { left: 50, right: 139 },
    });
    const leftPositions = generateBoxPositions(leftResult, leftResult.totalBoxes);
    const rightPositions = generateBoxPositions(rightResult, rightResult.totalBoxes);

    assertPositionsAreSafe(leftResult, leftPositions);
    assertPositionsAreSafe(rightResult, rightPositions);
    expect(leftResult.totalBoxes).toBe(rightResult.totalBoxes);
    expect(leftResult.skuSummary?.map(({ label, loaded, shortfall }) => [label, loaded, shortfall])).toEqual(
      rightResult.skuSummary?.map(({ label, loaded, shortfall }) => [label, loaded, shortfall]),
    );
  });
});
