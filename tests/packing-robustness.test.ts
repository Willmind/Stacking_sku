import { describe, expect, it } from "vitest";
import { calculatePacking, type BoxPosition } from "../src/core/packing";
import {
  MAX_ESTIMATED_PACKING_POSITIONS,
  PackingWorkloadLimitError,
  assertPackingWorkload,
  estimatePackingPositions,
} from "../src/core/packingWorkload";

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function overlaps(first: BoxPosition, second: BoxPosition) {
  return (
    first.x < second.x + second.dx &&
    first.x + first.dx > second.x &&
    first.y < second.y + second.dy &&
    first.y + first.dy > second.y &&
    first.z < second.z + second.dz &&
    first.z + first.dz > second.z
  );
}

describe("packing robustness", () => {
  it("接受正常基准输入并拒绝会生成失控坐标数量的极端输入", () => {
    const container = { id: "40HQ", name: "40HQ", length: 12_032, width: 2_352, height: 2_698 };

    expect(estimatePackingPositions(container, { length: 488, width: 380, height: 291 })).toBeLessThan(MAX_ESTIMATED_PACKING_POSITIONS);
    expect(() => assertPackingWorkload(container, { length: 488, width: 380, height: 291 })).not.toThrow();
    expect(() => assertPackingWorkload(container, { length: 1, width: 1, height: 1 })).toThrow(PackingWorkloadLimitError);
  });

  it("固定种子的随机尺寸始终生成容器内且互不重叠的完整结果", () => {
    const random = createRandom(0x5eed_0713);
    const container = { id: "RANDOM", name: "Random", length: 1_100, width: 680, height: 620 };

    for (let caseIndex = 0; caseIndex < 18; caseIndex += 1) {
      const carton = {
        length: 110 + Math.floor(random() * 230),
        width: 90 + Math.floor(random() * 180),
        height: 80 + Math.floor(random() * 170),
      };
      const result = calculatePacking(container, carton, { cornerBlock: { length: 0, width: 0, height: 0 } });
      expect(result.orderedPositions).toHaveLength(result.totalBoxes);

      for (const box of result.orderedPositions) {
        const fitsContainer =
          box.x >= 0 &&
          box.y >= 0 &&
          box.z >= 0 &&
          box.x + box.dx <= container.length &&
          box.y + box.dy <= container.width &&
          box.z + box.dz <= container.height;
        if (!fitsContainer) {
          throw new Error(`随机用例 ${caseIndex + 1} 生成了越界箱体`);
        }
      }

      for (let firstIndex = 0; firstIndex < result.orderedPositions.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < result.orderedPositions.length; secondIndex += 1) {
          if (overlaps(result.orderedPositions[firstIndex], result.orderedPositions[secondIndex])) {
            throw new Error(`随机用例 ${caseIndex + 1} 的箱体 ${firstIndex + 1} 与 ${secondIndex + 1} 重叠`);
          }
        }
      }
    }
  });
});
