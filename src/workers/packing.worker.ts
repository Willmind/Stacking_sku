/// <reference lib="webworker" />

import { executePackingWorkerPayload } from "./packingWorkerRuntime";
import type { PackingWorkerRequest, PackingWorkerResponse } from "./packingWorkerProtocol";

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = async (event: MessageEvent<PackingWorkerRequest>) => {
  const { requestId, payload } = event.data;

  try {
    const result = await executePackingWorkerPayload(payload, (progress) => {
      const response: PackingWorkerResponse = { type: "progress", requestId, progress };
      workerScope.postMessage(response);
    });
    const response: PackingWorkerResponse = { type: "success", requestId, result };
    workerScope.postMessage(response);
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error("计算失败");
    const response: PackingWorkerResponse = {
      type: "error",
      requestId,
      error: { name: error.name, message: error.message },
    };
    workerScope.postMessage(response);
  }
};

export {};
