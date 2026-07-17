import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateBatchPacking } from "../src/core/batchImport";
import { calculateMultiSkuPacking, calculatePacking } from "../src/core/packing";
import {
  PackingWorkerCancelledError,
  PackingWorkerTimeoutError,
  calculateBatchPackingInWorker,
  runPackingWorker,
} from "../src/core/packingWorkerClient";
import { executePackingWorkerPayload } from "../src/workers/packingWorkerRuntime";
import type { PackingWorkerRequest, PackingWorkerResponse } from "../src/workers/packingWorkerProtocol";

class FakeWorker {
  onmessage: ((event: MessageEvent<PackingWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  request: PackingWorkerRequest | null = null;
  terminated = false;

  postMessage(request: PackingWorkerRequest) {
    this.request = request;
  }

  terminate() {
    this.terminated = true;
  }

  emit(response: PackingWorkerResponse) {
    this.onmessage?.({ data: response } as MessageEvent<PackingWorkerResponse>);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("packing worker", () => {
  it("保持 Worker 与直接调用的单 SKU 结果完全一致", async () => {
    const payload = {
      kind: "single" as const,
      container: { id: "40HQ", name: "40HQ", length: 12_032, width: 2_352, height: 2_698 },
      carton: { length: 488, width: 380, height: 291 },
      options: { clearance: { front: 20, rear: 10, left: 5, right: 5, top: 10 } },
    };

    const direct = calculatePacking(payload.container, payload.carton, payload.options);
    const workerResult = await executePackingWorkerPayload(payload);

    expect(workerResult).toEqual(direct);
  });

  it("保持 Worker 与直接调用的异尺寸多 SKU 非对称公差结果完全一致", async () => {
    const payload = {
      kind: "multi" as const,
      container: { id: "WORKER-MULTI", name: "Worker multi", length: 900, width: 430, height: 360 },
      skus: [
        { label: "A", length: 215, width: 134, height: 146, target: 50, color: "#d8923a" },
        { label: "B", length: 139, width: 91, height: 68, target: 54, color: "#42d6a4" },
      ],
      options: {
        cornerBlock: { length: 110, width: 110, height: 80 },
        clearance: { left: 139, right: 50 },
      },
    };

    const direct = calculateMultiSkuPacking(payload.container, payload.skus, payload.options);
    const workerResult = await executePackingWorkerPayload(payload);

    expect(workerResult).toEqual(direct);
  });

  it("转发批量进度并只接收当前请求结果", async () => {
    const worker = new FakeWorker();
    const onProgress = vi.fn();
    const promise = runPackingWorker({ kind: "batch", rows: [] }, { workerFactory: () => worker, onProgress, timeoutMs: 1_000 });
    const requestId = worker.request?.requestId;
    expect(requestId).toBeTypeOf("number");

    worker.emit({
      type: "progress",
      requestId: requestId as number,
      progress: { processed: 1, total: 2, progress: 0.5 },
    });
    worker.emit({ type: "success", requestId: (requestId as number) + 1, result: [] });
    worker.emit({ type: "success", requestId: requestId as number, result: [] });

    await expect(promise).resolves.toEqual([]);
    expect(onProgress).toHaveBeenCalledWith({ processed: 1, total: 2, progress: 0.5 });
    expect(worker.terminated).toBe(true);
  });

  it("透传批量计算的朝向和车厢公差", async () => {
    const rows = [{ "人工码垛数量（原始）": 1, "尺寸（长宽高 mm）": "2000*1000*2500", 柜型: "20GP" }];
    const options = {
      clearance: { front: 100 },
      allowedOrientations: ["height-width-length" as const],
    };
    const direct = calculateBatchPacking(rows, options);
    const workerResult = await executePackingWorkerPayload({ kind: "batch", rows, options });

    expect(workerResult).toEqual(direct);
  });

  it("把批量弹框配置写入 Worker 请求", async () => {
    const worker = new FakeWorker();
    const options = {
      clearance: { left: 15, right: 15 },
      allowedOrientations: ["length-width-height" as const],
    };
    const promise = calculateBatchPackingInWorker([], options, { workerFactory: () => worker });
    const requestId = worker.request?.requestId;

    expect(worker.request?.payload).toMatchObject({ kind: "batch", options });
    worker.emit({ type: "success", requestId: requestId as number, result: [] });
    await expect(promise).resolves.toEqual([]);
  });

  it("取消时终止 Worker 且不返回部分结果", async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    const promise = runPackingWorker(
      { kind: "batch", rows: [] },
      { workerFactory: () => worker, signal: controller.signal, timeoutMs: 1_000 },
    );

    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(PackingWorkerCancelledError);
    expect(worker.terminated).toBe(true);
  });

  it("批量计算默认不再因超过 60 秒而自动停止", async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const promise = calculateBatchPackingInWorker([], {}, { workerFactory: () => worker });
    const requestId = worker.request?.requestId;

    await vi.advanceTimersByTimeAsync(120_000);

    expect(worker.terminated).toBe(false);
    worker.emit({ type: "success", requestId: requestId as number, result: [] });
    await expect(promise).resolves.toEqual([]);
    expect(worker.terminated).toBe(true);
  });

  it("超时后终止 Worker", async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const promise = runPackingWorker({ kind: "batch", rows: [] }, { workerFactory: () => worker, timeoutMs: 25 });
    const rejection = expect(promise).rejects.toBeInstanceOf(PackingWorkerTimeoutError);

    await vi.advanceTimersByTimeAsync(25);

    await rejection;
    expect(worker.terminated).toBe(true);
  });
});
