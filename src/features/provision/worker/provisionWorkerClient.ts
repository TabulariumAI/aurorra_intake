import type { ProvisionWorkerClient, ProvisionWorkerConfig } from "../type/provision.types";

type ProvisionWorkerError = Error & {
  code?: string;
  status?: number;
  retryAfter?: string;
  retryAt?: number;
  details?: unknown;
};

function resolveError(message: string, error: unknown): ProvisionWorkerError {
  const err = new Error(message) as ProvisionWorkerError;
  if (typeof error === "object" && error !== null) {
    const candidate = error as { code?: unknown; retryAfter?: unknown; retryAt?: unknown; status?: unknown; details?: unknown };
    if (typeof candidate.code === "string") {
      err.code = candidate.code;
    }
    if (typeof candidate.status === "number") {
      err.status = candidate.status;
    }
    if (typeof candidate.retryAfter === "string") err.retryAfter = candidate.retryAfter;
    if (typeof candidate.retryAt === "number") err.retryAt = candidate.retryAt;
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

      const payload = event?.data as { ok?: boolean; error?: string; code?: string; status?: number; retryAfter?: string; retryAt?: number; details?: unknown; data?: T };
      if (payload && payload.ok === true) {
        resolve(payload.data as T);
        return;
      }

      const message = typeof payload?.error === "string" ? payload.error : "Provision worker request failed";
      const err = resolveError(message, payload);
      reject(err);
    };

    worker.onerror = (event) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(event);
    };

    worker.postMessage(command);
  });
}

export function createProvisionWorkerClient(config: ProvisionWorkerConfig): ProvisionWorkerClient {
  const { apiBaseUrl } = config;
  return {
    async provision(token, session, document, jurisdiction) {
      return runWorker({ type: "provision", token, apiBaseUrl, session, document, jurisdiction });
    },
  };
}
