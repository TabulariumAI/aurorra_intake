import type { SessionWorkerClient, SessionWorkerCommand, SessionWorkerConfig, SessionWorkerResult } from "../type/session.types";

type SessionWorkerError = Error & {
  code?: string;
  status?: number;
  details?: unknown;
};

function runWorker<T>(command: SessionWorkerCommand, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Source download canceled.", "AbortError"));
      return;
    }
    const worker = new Worker(new URL("./SessionWorker.ts", import.meta.url), { type: "module" });
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException("Source download canceled.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });

    worker.onmessage = (event) => {
      if (settled) return;
      settled = true;
      cleanup();

      const payload = event.data as SessionWorkerResult<T>;
      if (payload.ok) {
        resolve(payload.data);
        return;
      }

      const error = new Error(payload.error) as SessionWorkerError;
      if (payload.code !== undefined) error.code = payload.code;
      if (payload.status !== undefined) error.status = payload.status;
      if ("details" in payload) error.details = payload.details;
      reject(error);
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

export type { SessionWorkerClient };

export function createSessionWorkerClient(config: SessionWorkerConfig): SessionWorkerClient {
  const { apiBaseUrl } = config;
  return {
    downloadSource(source, sasToken, signal) {
      return runWorker({ type: "downloadSource", source, sasToken }, signal);
    },
    newSession(token) {
      return runWorker({ type: "newSession", token, apiBaseUrl });
    },
    summary(token, session, document) {
      return runWorker({ type: "summary", token, apiBaseUrl, session, document });
    },
    setTags(token, session, tags) {
      return runWorker({ type: "setTags", token, apiBaseUrl, session, tags });
    },
    sessionData(token, session) {
      return runWorker({ type: "sessionData", token, apiBaseUrl, session });
    },
  };
}
