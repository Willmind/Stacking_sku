import type { CartonOrientationId } from "./orientations";

export type LoadingStrategy = "multi-destination" | "same-destination";

export interface ContainerSpec {
  id?: string;
  name?: string;
  length: number;
  width: number;
  height: number;
}

export interface ContainerClearanceSpec {
  front?: number;
  rear?: number;
  left?: number;
  right?: number;
  top?: number;
}

export interface NormalizedContainerClearance {
  front: number;
  rear: number;
  left: number;
  right: number;
  top: number;
}

export interface CartonSpec {
  length: number;
  width: number;
  height: number;
}

export interface CornerBlockSpec {
  length: number;
  width: number;
  height: number;
}

export interface SkuInput extends CartonSpec {
  label: string;
  target: number;
  color: string;
  allowedOrientations?: CartonOrientationId[];
}

export interface BoxPosition {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  label?: string;
  orientationId?: string;
  orientation?: string;
  orientationLabel?: string;
  sequenceIndex?: number;
  faceIndex?: number;
  stackIndex?: number;
  skuLabel?: string;
  skuColor?: string;
  source?: string;
  sourceFootprint?: {
    x: number;
    y: number;
    dx: number;
    dy: number;
  };
  blocked?: boolean;
  adjustedForCorner?: boolean;
}

export interface SkuSummary {
  label: string;
  target: number;
  loaded: number;
  shortfall: number;
  color: string;
}

export interface PackingOptions {
  cornerBlock?: CornerBlockSpec;
  clearance?: ContainerClearanceSpec;
  strategy?: LoadingStrategy;
  allowedOrientations?: CartonOrientationId[];
}

export interface PackingLayer {
  index: number;
  z: number;
  boxCount: number;
  blockedByCorner: number;
}

export interface PackingPattern {
  family: string;
  name?: string;
  occupiedLength: number;
  occupiedWidth: number;
  floorPositions: BoxPosition[];
  [key: string]: unknown;
}

export interface PackingResult {
  container: Required<ContainerSpec>;
  effectiveContainer: Required<ContainerSpec>;
  clearance: NormalizedContainerClearance;
  carton: CartonSpec;
  cornerBlock: CornerBlockSpec;
  pattern: PackingPattern | null;
  layerPositions: BoxPosition[];
  orderedPositions: BoxPosition[];
  perLayerBoxCount: number;
  layers: PackingLayer[];
  totalBoxes: number;
  blockedByCornerTotal: number;
  usedHeight: number;
  utilizationRatio: number;
  mode?: "single" | "multi";
  strategy?: LoadingStrategy;
  skus?: SkuInput[];
  skuSummary?: SkuSummary[];
}

export interface PackingStrategyNote {
  id: string;
  label: string;
  detail: string;
  tone: "neutral" | "success" | "warning";
}
