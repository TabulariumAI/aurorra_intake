import { afterEach, expect, it, vi } from "vitest";
import { createImageWorkerClient } from "../worker/imageWorkerClient";

afterEach(() => vi.unstubAllGlobals());

it.each(["success", "failure", "crash"])("terminates its standalone worker on %s and preserves the result", async outcome => {
  let worker!: WorkerMock;
  class WorkerMock {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor(readonly url: URL) { worker = this; }
  }
  vi.stubGlobal("Worker", WorkerMock);
  const result = createImageWorkerClient({ apiBaseUrl: "https://gateway.test" }).generatePackage("token", "session");
  expect(worker.url.pathname).toContain("/image/worker/ImageWorker.ts");
  expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith({ apiBaseUrl: "https://gateway.test", token: "token", session: "session" });
  expect(worker.terminate).not.toHaveBeenCalled();
  if (outcome === "crash") {
    const event = new ErrorEvent("error", { message: "Image startup failed" });
    const rejected = expect(result).rejects.toBe(event);
    worker.onerror!(event);
    await rejected;
  } else if (outcome === "failure") {
    const rejected = expect(result).rejects.toMatchObject({ message: "Denied", code: "denied", status: 403, details: { error: "Denied" } });
    worker.onmessage!({ data: { ok: false, error: "Denied", code: "denied", status: 403, details: { error: "Denied" } } } as MessageEvent);
    await rejected;
  } else {
    worker.onmessage!({ data: { ok: true, data: { status: "completed", data: { tiff: "https://storage.test/image.tiff", data: "https://storage.test/image.json" } } } } as MessageEvent);
    await expect(result).resolves.toEqual({ status: "completed", data: { tiff: "https://storage.test/image.tiff", data: "https://storage.test/image.json" } });
  }
  expect(worker.terminate).toHaveBeenCalledOnce();
  worker.onmessage!({ data: { ok: true, data: {} } } as MessageEvent);
  worker.onerror!(new ErrorEvent("error", { message: "Late failure" }));
  expect(worker.terminate).toHaveBeenCalledOnce();
});
