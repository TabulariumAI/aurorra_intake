import { afterEach, expect, it, vi } from "vitest";
import { createSessionWorkerClient } from "../worker/sessionWorkerClient";
import { createIndexingWorkerClient } from "../../indexing/worker/indexingWorkerClient";
import { createIqWorkerClient } from "../../iq/worker/iqWorkerClient";
import { createProvisionWorkerClient } from "../../provision/worker/provisionWorkerClient";
import { createUploadWorkerClient } from "../../upload/worker/uploadWorkerClient";

afterEach(() => vi.unstubAllGlobals());

it.each([
  ["Session", () => createSessionWorkerClient({ apiBaseUrl: "https://gateway" }).newSession("token")],
  ["Indexing", () => createIndexingWorkerClient({ apiBaseUrl: "https://gateway" }).status("token", "session")],
  ["IQ", () => createIqWorkerClient({ apiBaseUrl: "https://gateway" }).generateReport("token", "session")],
  ["Provision", () => createProvisionWorkerClient({ apiBaseUrl: "https://gateway" }).provision("token", "session", "document.pdf", "county")],
  ["Upload", () => createUploadWorkerClient(1024).upload({ baseUrl: "https://storage", sasToken: "sas", path: "document.pdf", file: new File(["pdf"], "document.pdf") })],
] as const)("%s bubbles the original runtime event and cause", async (_name, request) => {
  const cause = new Error("Module import failed");
  const error = new Error("Worker startup failed", { cause });
  const event = new ErrorEvent("error", { message: error.message, error, filename: "worker.js", lineno: 8, colno: 3 });
  const terminate = vi.fn();
  class WorkerMock {
    onerror: ((event: ErrorEvent) => void) | null = null;
    postMessage() { this.onerror?.(event); }
    terminate = terminate;
  }
  vi.stubGlobal("Worker", WorkerMock);
  await expect(request()).rejects.toBe(event);
  expect(event.error.cause).toBe(cause);
  expect(terminate).toHaveBeenCalledTimes(1);
});
