import type { BoxPosition, ContainerSpec, CornerBlockSpec } from "./types";

export interface FloorRect {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

interface SpatialBox extends FloorRect {
  z: number;
  dz: number;
}

export function intersects(aStart: number, aSize: number, bStart: number, bSize: number): boolean {
  return aStart < bStart + bSize && aStart + aSize > bStart;
}

export function rectanglesOverlap(a: FloorRect, b: FloorRect): boolean {
  return intersects(a.x, a.dx, b.x, b.dx) && intersects(a.y, a.dy, b.y, b.dy);
}

export function floorRectFromPosition(position: FloorRect): FloorRect {
  return {
    x: position.x,
    y: position.y,
    dx: position.dx,
    dy: position.dy,
  };
}

export function positionFitsFloor(
  position: FloorRect,
  container: Pick<ContainerSpec, "length" | "width">,
): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x + position.dx <= container.length &&
    position.y + position.dy <= container.width
  );
}

export function hasDoorSideRemainderClearance(
  position: FloorRect,
  container: Pick<ContainerSpec, "length">,
  minClearance: number,
): boolean {
  return container.length - (position.x + position.dx) >= minClearance;
}

export function overlapsAnyFloorRect(position: FloorRect, occupiedRects: FloorRect[]): boolean {
  const rect = floorRectFromPosition(position);
  return occupiedRects.some((occupied) => rectanglesOverlap(rect, occupied));
}

export function collidesCornerBlock(
  box: SpatialBox,
  container: Pick<ContainerSpec, "length" | "width" | "height">,
  cornerBlock: CornerBlockSpec,
): boolean {
  const entersTopBand = intersects(
    box.z,
    box.dz,
    container.height - cornerBlock.height,
    cornerBlock.height,
  );
  if (!entersTopBand) return false;

  const entersInnerLength = intersects(box.x, box.dx, 0, cornerBlock.length);
  if (!entersInnerLength) return false;

  const leftCorner = intersects(box.y, box.dy, 0, cornerBlock.width);
  const rightCorner = intersects(
    box.y,
    box.dy,
    container.width - cornerBlock.width,
    cornerBlock.width,
  );

  return leftCorner || rightCorner;
}

export function boxesOverlap3d(a: BoxPosition, b: BoxPosition): boolean {
  return (
    intersects(a.x, a.dx, b.x, b.dx) &&
    intersects(a.y, a.dy, b.y, b.dy) &&
    intersects(a.z, a.dz, b.z, b.dz)
  );
}
