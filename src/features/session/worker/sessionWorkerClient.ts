import type { SessionWorkerClient, SessionWorkerConfig } from "../type/session.types";

type SessionWorkerError = Error & {
  code?: string;
  status?: number;
  details?: unknown;
};

const workerUrl = new URL("./SessionWorker.ts", import.meta.url);

function resolveError(message: string, error: unknown): SessionWorkerError {
  const err = new Error(message) as SessionWorkerError;
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
      worker.terminate();
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

      const message = typeof payload?.error === "string" ? payload.error : "Session worker request failed";
      const err = resolveError(message, payload);
      reject(err);
    };

    worker.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Session worker failed"));
    };

    worker.postMessage(command);
  });
}

export type { SessionWorkerClient };

export function createSessionWorkerClient(config: SessionWorkerConfig): SessionWorkerClient {
  const { apiBaseUrl } = config;
  return {
    async newSession(token) {
      return runWorker({ type: "newSession", token, apiBaseUrl });
    },
    async summary(token, session, document) {
      return runWorker({ type: "summary", token, apiBaseUrl, session, document });
    },
    async setTags(token, session, tags) {
      return runWorker({ type: "setTags", token, apiBaseUrl, session, tags });
    },
    async sessionData(token, session) {
      return runWorker({ type: "sessionData", token, apiBaseUrl, session });
    },
  };
}
