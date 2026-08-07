import type { ChoicesBackendData, ChoicesWorkerClient, ChoicesWorkerConfig } from "../type/choices.types";

type ChoicesWorkerError = Error & {
  code?: string;
  status?: number;
  details?: unknown;
};

function resolveError(message: string, error: unknown): ChoicesWorkerError {
  const err = new Error(message) as ChoicesWorkerError;
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
    const worker = new Worker(new URL("./ChoicesWorker.ts", import.meta.url), { type: "module" });
    let settled = false;

    const cleanup = () => {
      worker.terminate();
    };

    worker.onmessage = (event) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      const payload = event?.data as { ok?: boolean; error?: string; code?: string; status?: number; details?: unknown; data?: T };
      if (payload && payload.ok === true) {
        resolve(payload.data as T);
        return;
      }

      const message = typeof payload?.error === "string" ? payload.error : "Choices worker request failed";
      reject(resolveError(message, payload));
    };

    worker.onerror = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error("Choices worker failed"));
    };

    worker.postMessage(command);
  });
}

export function createSessionDataWorkerClient(config: ChoicesWorkerConfig): ChoicesWorkerClient {
  return {
    async load(token: string, session: string): Promise<ChoicesBackendData> {
      return runWorker<ChoicesBackendData>({
        type: "load",
        token,
        session,
        config,
      });
    },
  };
}
