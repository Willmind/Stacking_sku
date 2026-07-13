import type { BatchPackingItem, BatchPackingProgress, BatchPackingRow } from "../core/batchImport";
import type { CartonSpec, ContainerSpec, PackingOptions, PackingResult, SkuInput } from "../core/packing";

export type PackingWorkerPayload =
  | {
      kind: "single";
      container: ContainerSpec;
      carton: CartonSpec;
      options?: PackingOptions;
    }
  | {
      kind: "multi";
      container: ContainerSpec;
      skus: SkuInput[];
      options?: PackingOptions;
    }
  | {
      kind: "batch";
      rows: BatchPackingRow[];
      options?: Pick<PackingOptions, "clearance">;
      batchSize?: number;
    };

export type PackingWorkerResult = PackingResult | BatchPackingItem[];

export interface PackingWorkerRequest {
  requestId: number;
  payload: PackingWorkerPayload;
}

export type PackingWorkerResponse =
  | {
      type: "progress";
      requestId: number;
      progress: BatchPackingProgress;
    }
  | {
      type: "success";
      requestId: number;
      result: PackingWorkerResult;
    }
  | {
      type: "error";
      requestId: number;
      error: {
        name: string;
        message: string;
      };
    };
