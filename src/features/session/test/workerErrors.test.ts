import { afterEach, expect, it, vi } from "vitest";
import { createSessionWorkerClient } from "../worker/sessionWorkerClient";
import { createIndexingWorkerClient } from "../../indexing/worker/indexingWorkerClient";
import { createResultClient } from "../../result/worker/resultWorkerClient";
import { createProvisionWorkerClient } from "../../provision/worker/provisionWorkerClient";
import { createUploadWorkerClient } from "../../upload/worker/uploadWorkerClient";

afterEach(() => vi.unstubAllGlobals());

it.each([
  ["Session", () => createSessionWorkerClient({ apiBaseUrl: "https://gateway" }).newSession("token")],
  ["Indexing", () => createIndexingWorkerClient({ apiBaseUrl: "https://gateway" }).status("token", "session")],
  ["IQ", () => createResultClient({ apiBaseUrl: "https://gateway" }).load("token", "session", "iq")],
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

it.each([
  ["Session", () => createSessionWorkerClient({ apiBaseUrl: "https://gateway" }).newSession("token")],
  ["Indexing", () => createIndexingWorkerClient({ apiBaseUrl: "https://gateway" }).status("token", "session")],
  ["IQ", () => createResultClient({ apiBaseUrl: "https://gateway" }).load("token", "session", "iq")],
  ["Provision", () => createProvisionWorkerClient({ apiBaseUrl: "https://gateway" }).provision("token", "session", "document.pdf", "county")],
] as const)("%s retains retry metadata across its worker boundary without replay", async (_name, request) => {
  const post = vi.fn();
  class WorkerMock {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    postMessage() { post(); this.onmessage?.({ data: { ok: false, status: 429, error: "Unavailable. Retry after 12:00.", retryAfter: "30", retryAt: 123456 } }); }
    terminate() {}
  }
  vi.stubGlobal("Worker", WorkerMock);
  await expect(request()).rejects.toMatchObject({ status: 429, retryAfter: "30", retryAt: 123456, message: "Unavailable. Retry after 12:00." });
  expect(post).toHaveBeenCalledOnce();
});
