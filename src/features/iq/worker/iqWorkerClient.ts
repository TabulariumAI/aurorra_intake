import type { IqReport, IqWorkerClient, IqWorkerConfig, IqWorkerResult } from "../type/iq.types";

export function createIqWorkerClient({ apiBaseUrl }: IqWorkerConfig): IqWorkerClient {
  return {
    generateReport(token, session) {
      return new Promise((resolve, reject) => {
        const worker = new Worker(new URL("./IqWorker.ts", import.meta.url), { type: "module" });
        let settled = false;
        worker.onmessage = event => {
          if (settled) return;
          settled = true;
          worker.terminate();
          const payload = event.data as IqWorkerResult<IqReport>;
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
        worker.onerror = () => {
          if (settled) return;
          settled = true;
          worker.terminate();
          reject(new Error("IQ worker failed"));
        };
        worker.postMessage({ apiBaseUrl, session, token });
      });
    },
  };
}
