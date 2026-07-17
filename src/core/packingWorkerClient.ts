import type { BatchPackingItem, BatchPackingProgress, BatchPackingRow } from "./batchImport";
import type { CartonSpec, ContainerSpec, PackingOptions, PackingResult, SkuInput } from "./packing";
import type {
  PackingWorkerPayload,
  PackingWorkerRequest,
  PackingWorkerResponse,
  PackingWorkerResult,
} from "../workers/packingWorkerProtocol";

export const DEFAULT_PACKING_TIMEOUT_MS = 15_000;

export class PackingWorkerCancelledError extends Error {
  constructor() {
    super("已取消计算");
    this.name = "PackingWorkerCancelledError";
  }
}

export class PackingWorkerTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`计算超过 ${Math.ceil(timeoutMs / 1000)} 秒，已自动停止，请检查输入尺寸`);
    this.name = "PackingWorkerTimeoutError";
  }
}

interface WorkerLike {
  onmessage: ((event: MessageEvent<PackingWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: PackingWorkerRequest): void;
  terminate(): void;
}

type WorkerFactory = () => WorkerLike;

export interface PackingWorkerRunOptions {
  signal?: AbortSignal;
  timeoutMs?: number | null;
  onProgress?: (progress: BatchPackingProgress) => void;
  workerFactory?: WorkerFactory;
}

let nextRequestId = 0;

function createPackingWorker(): WorkerLike {
  return new Worker(new URL("../workers/packing.worker.ts", import.meta.url), { type: "module" });
}

function restoreWorkerError(error: { name: string; message: string }) {
  const restored = new Error(error.message);
  restored.name = error.name;
  return restored;
}

export function runPackingWorker(payload: PackingWorkerPayload, options: PackingWorkerRunOptions = {}) {
  return new Promise<PackingWorkerResult>((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new PackingWorkerCancelledError());
      return;
    }

    const requestId = ++nextRequestId;
    const worker = (options.workerFactory ?? createPackingWorker)();
    const timeoutMs = options.timeoutMs === null ? null : Math.max(1, options.timeoutMs ?? DEFAULT_PACKING_TIMEOUT_MS);
    let settled = false;

    const cleanup = () => {
      worker.terminate();
      options.signal?.removeEventListener("abort", handleAbort);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const handleAbort = () => finish(() => reject(new PackingWorkerCancelledError()));
    const timeoutId =
      timeoutMs === null
        ? null
        : window.setTimeout(() => {
            finish(() => reject(new PackingWorkerTimeoutError(timeoutMs)));
          }, timeoutMs);

    options.signal?.addEventListener("abort", handleAbort, { once: true });

    worker.onmessage = (event) => {
      const response = event.data;
      if (response.requestId !== requestId || settled) return;
      if (response.type === "progress") {
        options.onProgress?.(response.progress);
        return;
      }
      if (response.type === "success") {
        finish(() => resolve(response.result));
        return;
      }
      finish(() => reject(restoreWorkerError(response.error)));
    };

    worker.onerror = (event) => {
      finish(() => reject(new Error(event.message || "后台计算线程运行失败")));
    };

    try {
      worker.postMessage({ requestId, payload });
    } catch (caught) {
      finish(() => reject(caught instanceof Error ? caught : new Error("无法启动后台计算线程")));
    }
  });
}

export async function calculatePackingInWorker(
  container: ContainerSpec,
  carton: CartonSpec,
  packingOptions: PackingOptions = {},
  runOptions: PackingWorkerRunOptions = {},
) {
  return (await runPackingWorker({ kind: "single", container, carton, options: packingOptions }, runOptions)) as PackingResult;
}

export async function calculateMultiSkuPackingInWorker(
  container: ContainerSpec,
  skus: SkuInput[],
  packingOptions: PackingOptions = {},
  runOptions: PackingWorkerRunOptions = {},
) {
  return (await runPackingWorker({ kind: "multi", container, skus, options: packingOptions }, runOptions)) as PackingResult;
}

export async function calculateBatchPackingInWorker(
  rows: BatchPackingRow[],
  packingOptions: Pick<PackingOptions, "clearance"> = {},
  runOptions: PackingWorkerRunOptions = {},
) {
  return (await runPackingWorker(
    { kind: "batch", rows, options: packingOptions, batchSize: 20 },
    { ...runOptions, timeoutMs: runOptions.timeoutMs ?? null },
  )) as BatchPackingItem[];
}
