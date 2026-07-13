export const DETAILED_CARGO_EDGE_LIMIT = 2_000;

export interface CargoRenderPolicy {
  mode: "detailed" | "simplified";
  showEdges: boolean;
  notice: string;
}

export function getCargoRenderPolicy(boxCount: number): CargoRenderPolicy {
  if (boxCount <= DETAILED_CARGO_EDGE_LIMIT) {
    return {
      mode: "detailed",
      showEdges: true,
      notice: "",
    };
  }

  return {
    mode: "simplified",
    showEdges: false,
    notice: `大数量模式：完整显示 ${boxCount.toLocaleString("zh-CN")} 箱，已简化箱体边框`,
  };
}
