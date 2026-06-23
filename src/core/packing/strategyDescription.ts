import type { PackingResult, PackingStrategyNote } from "./types";

interface PatternGroup {
  label?: string;
  orientationId?: string;
  count?: number;
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("zh-CN");
}

function getPatternGroups(result: PackingResult): PatternGroup[] {
  const groups = result.pattern?.groups;
  return Array.isArray(groups) ? (groups as PatternGroup[]) : [];
}

function getOrientationNote(result: PackingResult): PackingStrategyNote {
  const groups = getPatternGroups(result);
  const orientationLabels = Array.from(new Set(groups.map((group) => group.label).filter(Boolean)));
  const hasHorizontalRotation =
    result.pattern?.family === "heterogeneous-zones"
      ? result.orderedPositions.some((position) => position.dx !== result.carton.length || position.dy !== result.carton.width)
      : orientationLabels.length > 1;

  if (hasHorizontalRotation) {
    return {
      id: "orientation",
      label: "水平旋转",
      detail: orientationLabels.length > 0 ? `已组合 ${orientationLabels.join("、")} 朝向` : "已按各 SKU 尝试长宽两种水平朝向",
      tone: "success",
    };
  }

  return {
    id: "orientation",
    label: "水平旋转",
    detail: orientationLabels[0] ? `仅使用 ${orientationLabels[0]} 朝向` : "仅使用当前纸箱朝向",
    tone: "neutral",
  };
}

function getCornerAvoidanceNote(result: PackingResult): PackingStrategyNote {
  if (result.blockedByCornerTotal > 0) {
    return {
      id: "corner",
      label: "角件避让",
      detail: `顶部角件区域已避让 ${formatNumber(result.blockedByCornerTotal)} 箱`,
      tone: "warning",
    };
  }

  return {
    id: "corner",
    label: "角件避让",
    detail: "本次排布未触发角件干涉",
    tone: "neutral",
  };
}

function getBackfillNote(result: PackingResult): PackingStrategyNote {
  const hasHeterogeneousFloorReuse = (() => {
    if (result.pattern?.family !== "heterogeneous-zones" || !result.skus?.length) return false;
    let previousMaxX = 0;

    for (const sku of result.skus) {
      const skuFootprints = result.layerPositions.filter((position) => position.skuLabel === sku.label);
      if (!skuFootprints.length) continue;
      const minX = Math.min(...skuFootprints.map((position) => position.x));
      if (previousMaxX > 0 && minX < previousMaxX) return true;
      previousMaxX = Math.max(previousMaxX, ...skuFootprints.map((position) => position.x + position.dx));
    }

    return false;
  })();
  const hasBackfill = result.orderedPositions.some(
    (position) => position.source === "heterogeneous-backfill" || position.source === "door-remainder",
  ) || hasHeterogeneousFloorReuse;

  if (hasBackfill) {
    return {
      id: "backfill",
      label: "空位回填",
      detail: "已尝试复用前序分区或柜门侧剩余空间",
      tone: "success",
    };
  }

  return {
    id: "backfill",
    label: "空位回填",
    detail: "未发现可安全回填的剩余空间",
    tone: "neutral",
  };
}

function getSkuNote(result: PackingResult): PackingStrategyNote {
  if (result.mode !== "multi") {
    return {
      id: "sku",
      label: "SKU 策略",
      detail: "单 SKU 按最大装载量优先计算",
      tone: "neutral",
    };
  }

  const shortfallItems = result.skuSummary?.filter((summary) => summary.shortfall > 0) ?? [];
  if (shortfallItems.length > 0) {
    return {
      id: "sku",
      label: "SKU 策略",
      detail: `${shortfallItems.map((item) => item.label).join("、")} 未达到目标数量`,
      tone: "warning",
    };
  }

  const strategyText = result.strategy === "same-destination" ? "同客户/同卸货地" : "分客户/多卸货地";
  const dimensionText = result.pattern?.family === "heterogeneous-zones" ? "异尺寸按 SKU 顺序分区" : "同尺寸按装载策略分配";

  return {
    id: "sku",
    label: "SKU 策略",
    detail: `${strategyText}，${dimensionText}`,
    tone: "success",
  };
}

function getClearanceNote(result: PackingResult): PackingStrategyNote {
  const clearance = result.clearance;
  const hasClearance = Boolean(
    clearance &&
      (clearance.front > 0 || clearance.rear > 0 || clearance.left > 0 || clearance.right > 0 || clearance.top > 0),
  );

  if (!hasClearance) {
    return {
      id: "clearance",
      label: "车厢公差",
      detail: "未启用额外间隙扣减",
      tone: "neutral",
    };
  }

  return {
    id: "clearance",
    label: "车厢公差",
    detail: `有效空间 ${formatNumber(result.effectiveContainer.length)} × ${formatNumber(result.effectiveContainer.width)} × ${formatNumber(result.effectiveContainer.height)} mm`,
    tone: "warning",
  };
}

export function describePackingStrategy(result: PackingResult | null): PackingStrategyNote[] {
  if (!result?.pattern) return [];

  return [
    getOrientationNote(result),
    getClearanceNote(result),
    getCornerAvoidanceNote(result),
    getBackfillNote(result),
    getSkuNote(result),
  ];
}
