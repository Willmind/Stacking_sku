import type { BoxPosition, PackingResult } from "../core/packing";

export interface SceneBoxModel {
  key: string;
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  label: string;
  loadingSequence: number;
}

function roundSceneUnit(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function toSceneBox(
  box: BoxPosition,
  container: Pick<PackingResult["container"], "length" | "width" | "height">,
): SceneBoxModel {
  return {
    key: `${box.sequenceIndex ?? 0}-${box.x}-${box.y}-${box.z}`,
    position: [
      roundSceneUnit((box.x + box.dx / 2 - container.length / 2) * 0.001),
      roundSceneUnit((box.z + box.dz / 2 - container.height / 2) * 0.001),
      roundSceneUnit((box.y + box.dy / 2 - container.width / 2) * 0.001),
    ],
    scale: [
      roundSceneUnit(Math.max(box.dx * 0.001 * 0.992, 0.001)),
      roundSceneUnit(Math.max(box.dz * 0.001 * 0.992, 0.001)),
      roundSceneUnit(Math.max(box.dy * 0.001 * 0.992, 0.001)),
    ],
    color: box.skuColor || "#d8923a",
    label: box.skuLabel || "",
    loadingSequence: (box.sequenceIndex ?? 0) + 1,
  };
}
