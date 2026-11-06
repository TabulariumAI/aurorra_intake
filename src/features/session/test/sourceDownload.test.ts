import { afterEach, expect, it, vi } from "vitest";
import { SessionWorker } from "../worker/SessionWorker";
import { createSessionWorkerClient } from "../worker/sessionWorkerClient";

const command = { type: "downloadSource", source: "https://storage.test/sub/source%20file.tif", sasToken: "sig=current" } as const;
afterEach(() => vi.unstubAllGlobals());

it("downloads the saved source as bytes with storage authentication and its original file name", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("original bytes")));
  const result = await new SessionWorker().run<{ blob: Blob; name: string }>(command);
  expect(fetch).toHaveBeenCalledExactlyOnceWith("https://storage.test/sub/source%20file.tif?sig=current", { method: "GET", headers: {}, body: null });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  expect(result.data.name).toBe("source file.tif");
  expect(await result.data.blob.text()).toBe("original bytes");
});

it("preserves HTTP download failures without exposing the signed URL", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 })));
  expect(await new SessionWorker().run(command)).toMatchObject({ ok: false, status: 403, error: "Forbidden" });
});

it.each(["fetch", "body"])("settles interrupted %s reads instead of leaving the worker pending", async stage => {
  vi.stubGlobal("fetch", stage === "fetch" ? vi.fn().mockRejectedValue(new Error("Connection interrupted")) : vi.fn().mockResolvedValue({ ok: true, blob: async () => { throw new Error("Connection interrupted"); } }));
  expect(await new SessionWorker().run(command)).toMatchObject({ ok: false, error: "Connection interrupted" });
});

it("settles source request construction errors through the worker failure contract", async () => {
  const result = await new SessionWorker().run({ ...command, source: "invalid URL" });
  expect(result).toMatchObject({ ok: false, error: expect.any(String) });
});

it("terminates the source worker on cancellation and ignores a late response", async () => {
  const workers: TestWorker[] = [];
  class TestWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor() { workers.push(this); }
  }
  vi.stubGlobal("Worker", TestWorker);
  const controller = new AbortController();
  const client = createSessionWorkerClient({ apiBaseUrl: "https://gateway.test" });
  const pending = client.downloadSource(command.source, command.sasToken, controller.signal);
  expect(workers[0].postMessage).toHaveBeenCalledExactlyOnceWith(command);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  workers[0].onmessage!({ data: { ok: true, data: { name: "late.tif", blob: new Blob() } } });
  expect(workers[0].terminate).toHaveBeenCalledOnce();
});

it("does not fabricate optional failure fields or retain an abort listener after settlement", async () => {
  let worker!: TestWorker;
  class TestWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor() { worker = this; }
  }
  vi.stubGlobal("Worker", TestWorker);
  const controller = new AbortController();
  const client = createSessionWorkerClient({ apiBaseUrl: "https://gateway.test" });
  const pending = client.downloadSource(command.source, command.sasToken, controller.signal);
  worker.onmessage!({ data: { ok: false, error: "Rejected" } });
  const failure = await pending.catch(error => error);
  expect(failure.message).toBe("Rejected");
  for (const key of ["code", "status", "details"]) expect(failure).not.toHaveProperty(key);
  controller.abort();
  expect(worker.terminate).toHaveBeenCalledOnce();
});
