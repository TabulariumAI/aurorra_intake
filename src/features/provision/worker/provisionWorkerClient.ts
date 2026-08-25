import type { ProvisionWorkerClient, ProvisionWorkerConfig } from "../type/provision.types";

type ProvisionWorkerError = Error & {
  code?: string;
  status?: number;
  details?: unknown;
};

function resolveError(message: string, error: unknown): ProvisionWorkerError {
  const err = new Error(message) as ProvisionWorkerError;
  if (typeof error === "object" && error !== null) {
    const candidate = error as { code?: unknown; status?: unknown; details?: unknown };
    if (typeof candidate.code === "string") {
      err.code = candidate.code;
    }
    if (typeof candidate.status === "number") {
      err.status = candidate.status;
    }
    if (Object.prototype.hasOwnProperty.call(candidate, "details")) {
      err.details = candidate.details;
    }
  }
  return err;
}

async function runWorker<T>(command: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const worker = new Worker(new URL("./ProvisionWorker.ts", import.meta.url), { type: "module" });
    let settled = false;
    const cleanup = () => {
      try {
        worker.terminate();
      } catch {
        // no-op
      }
    };

    worker.onmessage = (event) => {
      if (settled) return;
      settled = true;
      cleanup();

      const payload = event?.data as { ok?: boolean; error?: string; code?: string; status?: number; details?: unknown; data?: T };
      if (payload && payload.ok === true) {
        resolve(payload.data as T);
        return;
      }

      const message = typeof payload?.error === "string" ? payload.error : "Provision worker request failed";
      const err = resolveError(message, payload);
      reject(err);
    };

    worker.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Provision worker failed"));
    };

    worker.postMessage(command);
  });
}

export function createProvisionWorkerClient(config: ProvisionWorkerConfig): ProvisionWorkerClient {
  const { apiBaseUrl } = config;
  return {
    async provision(token, session, document) {
      return runWorker({ type: "provision", token, apiBaseUrl, session, document });
    },
  };
}
