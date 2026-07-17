import { describe, expect, it } from "vitest";
import {
  calculatePacking,
  calculatePackingSummary,
  calculatePackingTotalBoxes,
  calculateMultiSkuPacking,
  collidesCornerBlock,
  generateBoxPositions,
  type BoxPosition,
  type PackingOptions,
  type PackingResult,
} from "../src/core/packing";

const CONTAINER = {
  id: "ASYMMETRIC-CLEARANCE",
  name: "Asymmetric clearance regression",
  length: 200,
  width: 300,
  height: 100,
};

const CARTON = {
  length: 100,
  width: 60,
  height: 100,
};

const CORNER_BLOCK = {
  length: 100,
  width: 100,
  height: 100,
};

function assertPositionRespectsPhysicalGeometry(position: BoxPosition, result: PackingResult) {
  const { clearance, container, cornerBlock } = result;

  expect(position.x).toBeGreaterThanOrEqual(clearance.front);
  expect(position.y).toBeGreaterThanOrEqual(clearance.left);
  expect(position.x + position.dx).toBeLessThanOrEqual(container.length - clearance.rear);
  expect(position.y + position.dy).toBeLessThanOrEqual(container.width - clearance.right);
  expect(position.z + position.dz).toBeLessThanOrEqual(container.height - clearance.top);
  expect(collidesCornerBlock(position, container, cornerBlock)).toBe(false);
}

function calculateClearanceCase(left: number, right: number) {
  const options: PackingOptions = {
    cornerBlock: CORNER_BLOCK,
    clearance: { left, right },
    allowedOrientations: ["length-width-height"],
  };
  const result = calculatePacking(CONTAINER, CARTON, options);
  const summary = calculatePackingSummary(CONTAINER, CARTON, options);
  const totalBoxes = calculatePackingTotalBoxes(CONTAINER, CARTON, options);
  const positions = generateBoxPositions(result, result.totalBoxes);

  expect(positions).toHaveLength(result.totalBoxes);
  expect(summary.totalBoxes).toBe(result.totalBoxes);
  expect(totalBoxes).toBe(result.totalBoxes);
  for (const position of positions) {
    assertPositionRespectsPhysicalGeometry(position, result);
  }

  return { result, summary, totalBoxes, positions };
}

function countPositionsInsideCornerLengthBand(positions: BoxPosition[]) {
  return positions.filter((position) => position.x < CORNER_BLOCK.length).length;
}

describe("packing asymmetric side clearance", () => {
  it("左右间隙互换后保持相同装载量，并分别使用左右角件的有效宽度", () => {
    const leftHeavy = calculateClearanceCase(80, 20);
    const rightHeavy = calculateClearanceCase(20, 80);

    expect(leftHeavy.result.effectiveContainer.width).toBe(200);
    expect(rightHeavy.result.effectiveContainer.width).toBe(200);
    expect(leftHeavy.result.totalBoxes).toBe(4);
    expect(rightHeavy.result.totalBoxes).toBe(4);
    expect(leftHeavy.result.totalBoxes).toBe(rightHeavy.result.totalBoxes);
    expect(countPositionsInsideCornerLengthBand(leftHeavy.positions)).toBe(1);
    expect(countPositionsInsideCornerLengthBand(rightHeavy.positions)).toBe(1);
  });

  it("单侧间隙大于角件宽度时将该侧有效角件宽度归零", () => {
    const leftCovered = calculateClearanceCase(120, 20);
    const rightCovered = calculateClearanceCase(20, 120);

    expect(leftCovered.result.effectiveContainer.width).toBe(160);
    expect(rightCovered.result.effectiveContainer.width).toBe(160);
    expect(leftCovered.result.totalBoxes).toBe(3);
    expect(rightCovered.result.totalBoxes).toBe(3);
    expect(leftCovered.result.totalBoxes).toBe(rightCovered.result.totalBoxes);
    expect(countPositionsInsideCornerLengthBand(leftCovered.positions)).toBe(1);
    expect(countPositionsInsideCornerLengthBand(rightCovered.positions)).toBe(1);
  });

  it("单侧间隙等于角件宽度时允许箱体与角件边界相切", () => {
    const leftExact = calculateClearanceCase(CORNER_BLOCK.width, 20);
    const rightExact = calculateClearanceCase(20, CORNER_BLOCK.width);

    expect(leftExact.result.effectiveContainer.width).toBe(180);
    expect(rightExact.result.effectiveContainer.width).toBe(180);
    expect(leftExact.result.totalBoxes).toBe(4);
    expect(rightExact.result.totalBoxes).toBe(4);
    expect(leftExact.result.totalBoxes).toBe(rightExact.result.totalBoxes);
    expect(leftExact.positions.some((position) => position.x < CORNER_BLOCK.length && position.y === CORNER_BLOCK.width)).toBe(true);
    expect(
      collidesCornerBlock(
        { x: 0, y: CONTAINER.width - CORNER_BLOCK.width - CARTON.width, z: 0, dx: CARTON.length, dy: CARTON.width, dz: CARTON.height },
        CONTAINER,
        CORNER_BLOCK,
      ),
    ).toBe(false);
  });

  it("异尺寸多 SKU 只扣减一次间隙并只回移一次物理坐标", () => {
    const clearance = { front: 20, rear: 20, left: 20, right: 20, top: 40 };
    const container = { id: "MULTI-SKU", name: "Multi SKU clearance", length: 360, width: 240, height: 240 };
    const result = calculateMultiSkuPacking(
      container,
      [
        {
          label: "A",
          length: 100,
          width: 100,
          height: 100,
          target: 4,
          color: "#d8923a",
          allowedOrientations: ["length-width-height"],
        },
        {
          label: "B",
          length: 220,
          width: 100,
          height: 100,
          target: 4,
          color: "#42d6a4",
          allowedOrientations: ["length-width-height"],
        },
      ],
      {
        strategy: "multi-destination",
        cornerBlock: { length: 0, width: 0, height: 0 },
        clearance,
      },
    );
    const positions = generateBoxPositions(result, result.totalBoxes);

    expect(result.pattern?.family).toBe("heterogeneous-zones");
    expect(result.clearance).toEqual(clearance);
    expect(result.cornerBlock).toEqual({ length: 0, width: 0, height: 0 });
    expect(result.effectiveContainer).toMatchObject({ length: 320, width: 200, height: 200 });
    expect(result.pattern).toMatchObject({ occupiedLength: 320, occupiedWidth: 200 });
    expect(result.totalBoxes).toBe(8);
    expect(positions).toHaveLength(8);
    expect(result.skuSummary?.map(({ label, loaded }) => [label, loaded])).toEqual([
      ["A", 4],
      ["B", 4],
    ]);

    for (const position of positions) {
      assertPositionRespectsPhysicalGeometry(position, result);
    }

    expect(Math.min(...positions.map((position) => position.x))).toBe(clearance.front);
    expect(Math.min(...positions.map((position) => position.y))).toBe(clearance.left);
    expect(Math.max(...positions.map((position) => position.x + position.dx))).toBe(container.length - clearance.rear);
    expect(Math.max(...positions.map((position) => position.y + position.dy))).toBe(container.width - clearance.right);
    expect(Math.max(...positions.map((position) => position.z + position.dz))).toBe(container.height - clearance.top);
  });
});
