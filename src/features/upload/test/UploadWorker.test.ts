import { afterEach, expect, it, vi } from "vitest";
import { UploadWorker } from "../worker/UploadWorker";
import { createUploadWorkerClient } from "../worker/uploadWorkerClient";
import type { UploadWorkerCommand } from "../type/upload.types";

afterEach(() => vi.unstubAllGlobals());

it.each([12, 20])("uploads a %s MB document with the configured 20 MB limit", async (sizeMb) => {
  const fetch = vi.fn(async () => ({ ok: true }));
  vi.stubGlobal("fetch", fetch);
  const result = await new UploadWorker().run({ type: "upload", baseUrl: "https://storage.test", sasToken: "sas", path: "doc.pdf", file: { name: "doc.pdf", size: sizeMb * 1024 * 1024 }, maxFileSizeBytes: 20 * 1024 * 1024 });
  expect(result.ok).toBe(true);
  expect(fetch).toHaveBeenCalledOnce();
});

it.each([5, 20])("rejects one byte over the configured %s MB limit before uploading", async (limitMb) => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const result = await new UploadWorker().run({ type: "upload", baseUrl: "https://storage.test", sasToken: "sas", path: "doc.pdf", file: { name: "doc.pdf", size: limitMb * 1024 * 1024 + 1 }, maxFileSizeBytes: limitMb * 1024 * 1024 });
  expect(result).toMatchObject({ ok: false, error: "File size exceeds the " + limitMb + " MB limit.", details: { maxSize: limitMb + " MB" } });
  expect(fetch).not.toHaveBeenCalled();
});

it("passes the host limit from the client to the worker", async () => {
  const fetch = vi.fn(async () => ({ ok: true }));
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("Worker", class {
    onmessage?: (event: { data: unknown }) => void;
    terminate() {}
    async postMessage(command: UploadWorkerCommand) {
      this.onmessage?.({ data: await new UploadWorker().run(command) });
    }
  });
  const client = createUploadWorkerClient(20 * 1024 * 1024);
  const command = { baseUrl: "https://storage.test", sasToken: "sas", path: "doc.pdf", file: { name: "doc.pdf", size: 20 * 1024 * 1024 } };
  await expect(client.upload(command)).resolves.toMatchObject({ isComplete: true });
  await expect(client.upload({ ...command, file: { ...command.file, size: command.file.size + 1 } })).rejects.toThrow("File size exceeds the 20 MB limit.");
  expect(fetch).toHaveBeenCalledOnce();
});
