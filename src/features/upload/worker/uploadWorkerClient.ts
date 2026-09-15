import type { UploadWorkerClient } from "../type/upload.types";

type UploadWorkerError = Error & {
  code?: string;
  status?: number;
  details?: unknown;
};

const workerUrl = new URL("./UploadWorker.ts", import.meta.url);

function resolveError(message: string, error: unknown): UploadWorkerError {
  const err = new Error(message) as UploadWorkerError;
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
    const worker = new Worker(workerUrl, { type: "module" });
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

      const message = typeof payload?.error === "string" ? payload.error : "Upload worker request failed";
      reject(resolveError(message, payload));
    };

    worker.onerror = (event) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(resolveError(event.message || "Upload worker failed", {
        details: { filename: event.filename, lineno: event.lineno, colno: event.colno, error: event.error },
      }));
    };

    worker.postMessage(command);
  });
}

export function createUploadWorkerClient(): UploadWorkerClient {
  return {
    async upload(command) {
      return runWorker({ type: "upload", ...command });
    },
  };
}
