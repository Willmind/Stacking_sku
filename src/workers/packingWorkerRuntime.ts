import { calculateBatchPackingAsync, type BatchPackingProgress } from "../core/batchImport";
import { calculateMultiSkuPacking, calculatePacking } from "../core/packing";
import { assertMultiSkuPackingWorkload, assertPackingWorkload } from "../core/packingWorkload";
import type { PackingWorkerPayload, PackingWorkerResult } from "./packingWorkerProtocol";

export async function executePackingWorkerPayload(
  payload: PackingWorkerPayload,
  onProgress?: (progress: BatchPackingProgress) => void,
): Promise<PackingWorkerResult> {
  if (payload.kind === "single") {
    assertPackingWorkload(payload.container, payload.carton, payload.options);
    return calculatePacking(payload.container, payload.carton, payload.options);
  }

  if (payload.kind === "multi") {
    assertMultiSkuPackingWorkload(payload.container, payload.skus, payload.options);
    return calculateMultiSkuPacking(payload.container, payload.skus, payload.options);
  }

  return calculateBatchPackingAsync(payload.rows, {
    clearance: payload.options?.clearance,
    batchSize: payload.batchSize,
    onProgress,
  });
}
