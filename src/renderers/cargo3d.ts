import type { BoxPosition, PackingResult } from "../core/packing";

export interface CargoCoordinateAxis {
  label: "X" | "Y" | "Z";
  start: [number, number, number];
  end: [number, number, number];
  labelPosition: [number, number, number];
  color: string;
  colorHex: number;
}

const AXIS_MIN_LENGTH = 0.7;
const AXIS_MAX_LENGTH = 2.4;
const AXIS_LENGTH_RATIO = 0.36;

export function getSelectedCargoPosition<T extends Pick<BoxPosition, "sequenceIndex">>(
  positions: T[],
  selectedLoadingSequence?: number | null,
): T | null {
  if (!Number.isFinite(selectedLoadingSequence)) return null;
  return (
    positions.find((position) => {
      if (!Number.isFinite(position.sequenceIndex)) return false;
      return (position.sequenceIndex ?? -1) + 1 === selectedLoadingSequence;
    }) ?? null
  );
}

function roundSceneUnit(value: number) {
  return Math.round(value * 1000) / 1000;
}

function visibleAxisLength(sizeMm: number) {
  return roundSceneUnit(Math.min(AXIS_MAX_LENGTH, Math.max(AXIS_MIN_LENGTH, sizeMm * 0.001 * AXIS_LENGTH_RATIO)));
}

export function getCargoCoordinateAxes(container: Pick<PackingResult["container"], "length" | "width" | "height">): CargoCoordinateAxis[] {
  const origin: [number, number, number] = [
    roundSceneUnit(-container.length * 0.0005),
    roundSceneUnit(-container.height * 0.0005),
    roundSceneUnit(container.width * 0.0005),
  ];
  const xLength = visibleAxisLength(container.width);
  const yLength = visibleAxisLength(container.length);
  const zLength = visibleAxisLength(container.height);

  return [
    {
      label: "X",
      start: origin,
      end: [origin[0], origin[1], roundSceneUnit(origin[2] - xLength)],
      labelPosition: [origin[0], origin[1], roundSceneUnit(origin[2] - xLength - 0.18)],
      color: "#ff5b5b",
      colorHex: 0xff5b5b,
    },
    {
      label: "Y",
      start: origin,
      end: [roundSceneUnit(origin[0] + yLength), origin[1], origin[2]],
      labelPosition: [roundSceneUnit(origin[0] + yLength + 0.18), origin[1], origin[2]],
      color: "#42d6a4",
      colorHex: 0x42d6a4,
    },
    {
      label: "Z",
      start: origin,
      end: [origin[0], roundSceneUnit(origin[1] + zLength), origin[2]],
      labelPosition: [origin[0], roundSceneUnit(origin[1] + zLength + 0.18), origin[2]],
      color: "#68a6ff",
      colorHex: 0x68a6ff,
    },
  ];
}
