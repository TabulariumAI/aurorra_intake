import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionWorkerClient } from "../worker/sessionWorkerClient";
import { createUploadWorkerClient } from "../../upload/worker/uploadWorkerClient";

const instances: TestWorker[] = [];

class TestWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor(readonly url: URL, readonly options: WorkerOptions) {
    instances.push(this);
  }
}

beforeEach(() => {
  instances.length = 0;
  vi.stubGlobal("Worker", TestWorker);
});
afterEach(() => vi.unstubAllGlobals());

const session = createSessionWorkerClient({ apiBaseUrl: "https://gateway.test" });
const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });
const upload = { baseUrl: "https://storage.test", sasToken: "sas", path: "document.pdf", file };

describe.each([
  { name: "Session", request: () => session.sessionData("token", "session-1"), command: { type: "sessionData", token: "token", apiBaseUrl: "https://gateway.test", session: "session-1" } },
  { name: "Upload", request: () => createUploadWorkerClient(1024).upload(upload), command: { type: "upload", ...upload, maxFileSizeBytes: 1024 } },
])("$name worker client", ({ name, request, command }) => {
  it("uses a module worker, forwards the command and terminates on success", async () => {
    const result = request();
    const worker = instances[0];
    expect(worker.url.pathname).toMatch(new RegExp(`/${name}Worker\\.ts$`));
    expect(worker.options).toEqual({ type: "module" });
    expect(worker.postMessage).toHaveBeenCalledExactlyOnceWith(command);
    worker.onmessage!({ data: { ok: true, data: { value: "loaded" } } });
    await expect(result).resolves.toEqual({ value: "loaded" });
    expect(worker.terminate).toHaveBeenCalledOnce();
    worker.onmessage!({ data: { ok: false, error: "late message" } });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("preserves structured failures and terminates the worker", async () => {
    const result = request();
    const failure = { ok: false, error: "Service unavailable", status: 503, code: "service_error", details: { source: "service" } };
    instances[0].onmessage!({ data: failure });
    await expect(result).rejects.toMatchObject({ message: failure.error, status: 503, code: failure.code, details: failure.details });
    expect(instances[0].terminate).toHaveBeenCalledOnce();
  });

  it("rejects worker startup failures and uses a fresh worker on the next request", async () => {
    const first = request();
    const event = new ErrorEvent("error", { message: `${name} startup failed` });
    instances[0].onerror!(event);
    await expect(first).rejects.toBe(event);
    expect(instances[0].terminate).toHaveBeenCalledOnce();
    const second = request();
    expect(instances).toHaveLength(2);
    instances[1].onmessage!({ data: { ok: true, data: "recovered" } });
    await expect(second).resolves.toBe("recovered");
    expect(instances[1].terminate).toHaveBeenCalledOnce();
  });
});

it("preserves all session operation commands", async () => {
  const requests = [session.newSession("token"), session.summary("token", "session-1", "document.pdf"), session.setTags("token", "session-1", ["deed"])];
  expect(instances.map(worker => worker.postMessage.mock.calls[0][0])).toEqual([
    { type: "newSession", token: "token", apiBaseUrl: "https://gateway.test" },
    { type: "summary", token: "token", apiBaseUrl: "https://gateway.test", session: "session-1", document: "document.pdf" },
    { type: "setTags", token: "token", apiBaseUrl: "https://gateway.test", session: "session-1", tags: ["deed"] },
  ]);
  instances.forEach(worker => worker.onmessage!({ data: { ok: true, data: "done" } }));
  await expect(Promise.all(requests)).resolves.toEqual(["done", "done", "done"]);
});
