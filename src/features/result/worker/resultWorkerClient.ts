import type { ResultData, ResultClient, ResultConfig, ResultResponse } from "../type/result.types";

export function createResultClient({ apiBaseUrl }: ResultConfig): ResultClient {
  return {
    load(token, session, resource) {
      return new Promise((resolve, reject) => {
        const worker = new Worker(new URL("./ResultWorker.ts", import.meta.url), { type: "module" });
        let settled = false;
        worker.onmessage = event => {
          if (settled) return;
          settled = true;
          worker.terminate();
          const payload = event.data as ResultResponse<ResultData>;
          if (payload.ok) {
            resolve(payload.data);
            return;
          }
          const error = new Error(payload.error) as Error & { code?: string; status?: number; details?: unknown };
          if (typeof payload.code === "string") error.code = payload.code;
          if (typeof payload.status === "number") error.status = payload.status;
          if (Object.prototype.hasOwnProperty.call(payload, "details")) error.details = payload.details;
          reject(error);
        };
        worker.onerror = (event) => {
          if (settled) return;
          settled = true;
          worker.terminate();
          reject(event);
        };
        worker.postMessage({ apiBaseUrl, session, token, resource });
      });
    },
  };
}
