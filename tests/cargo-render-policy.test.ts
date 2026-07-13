import { describe, expect, it } from "vitest";
import { DETAILED_CARGO_EDGE_LIMIT, getCargoRenderPolicy } from "../src/renderers/cargoRenderPolicy";

describe("cargo render policy", () => {
  it("常规数量保留箱体边框", () => {
    expect(getCargoRenderPolicy(DETAILED_CARGO_EDGE_LIMIT)).toEqual({
      mode: "detailed",
      showEdges: true,
      notice: "",
    });
  });

  it("大数量只降级边框且明确显示完整箱数", () => {
    expect(getCargoRenderPolicy(5_280)).toEqual({
      mode: "simplified",
      showEdges: false,
      notice: "大数量模式：完整显示 5,280 箱，已简化箱体边框",
    });
  });
});
