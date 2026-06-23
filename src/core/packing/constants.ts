import type { ContainerSpec, CornerBlockSpec, LoadingStrategy } from "./types";

export type ContainerType = "20GP" | "40GP" | "40HQ";

export const CONTAINERS: Record<ContainerType, Required<ContainerSpec>> = {
  "20GP": {
    id: "20GP",
    name: "20GP",
    length: 5898,
    width: 2352,
    height: 2393,
  },
  "40GP": {
    id: "40GP",
    name: "40GP",
    length: 12032,
    width: 2352,
    height: 2393,
  },
  "40HQ": {
    id: "40HQ",
    name: "40HQ",
    length: 12032,
    width: 2352,
    height: 2698,
  },
};

export const DEFAULT_CORNER_BLOCK: CornerBlockSpec = {
  length: 110,
  width: 110,
  height: 80,
};

export const LOADING_STRATEGIES = {
  MULTI_DESTINATION: "multi-destination",
  SAME_DESTINATION: "same-destination",
} as const satisfies Record<string, LoadingStrategy>;

export const MIN_DOOR_SIDE_REMAINDER_CLEARANCE = DEFAULT_CORNER_BLOCK.length;

export const POSITIVE_NUMBER_LABELS = {
  "container length": "柜体长度",
  "container width": "柜体宽度",
  "container height": "柜体高度",
  "effective container length": "公差扣减后的有效柜体长度",
  "effective container width": "公差扣减后的有效柜体宽度",
  "effective container height": "公差扣减后的有效柜体高度",
  "carton length": "纸箱长度",
  "carton width": "纸箱宽度",
  "carton height": "纸箱高度",
  "target quantity": "目标数量",
  "front clearance": "前公差",
  "rear clearance": "后公差",
  "left clearance": "左公差",
  "right clearance": "右公差",
  "top clearance": "顶部公差",
} as const;
