import type { IndexingWorkerClient, IndexingWorkerConfig } from "../type/indexing.types";

type IndexingWorkerError = Error & {
  code?: string;
  status?: number;
  details?: unknown;
};

function resolveError(message: string, error: unknown): IndexingWorkerError {
  const err = new Error(message) as IndexingWorkerError;
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
    const worker = new Worker(new URL("./IndexingWorker.ts", import.meta.url), { type: "module" });
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

      const message = typeof payload?.error === "string" ? payload.error : "Indexing worker request failed";
      const err = resolveError(message, payload);
      reject(err);
    };

    worker.onerror = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error("Indexing worker failed"));
    };

    worker.postMessage(command);
  });
}

export function createIndexingWorkerClient(config: IndexingWorkerConfig): IndexingWorkerClient {
  const { apiBaseUrl } = config;
  return {
    async start(token, session, document, choices) {
      return runWorker({ type: "start", token, apiBaseUrl, session, document, choices });
    },
    async status(token, session) {
      return runWorker({ type: "status", token, apiBaseUrl, session });
    },
  };
}
