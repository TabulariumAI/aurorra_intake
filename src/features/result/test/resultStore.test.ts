import { beforeEach, expect, it, vi } from "vitest";
import { resultStoreApi } from "../store/resultStore";
import type { ResultClient, ResultResource } from "../type/result.types";

beforeEach(() => resultStoreApi.getState().reset());

function pending() {
  let resolve!: (data: Record<string, unknown>) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Record<string, unknown>>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

it("publishes each resource independently without waiting for other downloads", async () => {
  const metadata = pending();
  const audit = pending();
  const iq = pending();
  const client: ResultClient = { load: vi.fn((_token: string, _session: string, resource: ResultResource) => ({ metadata, audit, iq })[resource].promise) };
  const requestId = resultStoreApi.getState().begin("session-1");
  const loads = ["metadata", "audit", "iq"].map(resource => resultStoreApi.getState().load(requestId, resource as "metadata" | "audit" | "iq", client, "token"));
  expect(client.load).toHaveBeenCalledTimes(3);
  iq.resolve({ iq_doc: 90 });
  await loads[2];
  expect(resultStoreApi.getState().iq).toMatchObject({ status: "success", data: { iq_doc: 90 } });
  expect(resultStoreApi.getState().metadata.status).toBe("loading");
  expect(resultStoreApi.getState().audit.status).toBe("loading");
  metadata.resolve({ indexes: [] });
  await loads[0];
  expect(resultStoreApi.getState().metadata.status).toBe("success");
  audit.resolve({ gaps: [] });
  await loads[1];
  expect(resultStoreApi.getState().audit.status).toBe("success");
});

it("deduplicates active and completed downloads for the same intake", async () => {
  const request = pending();
  const client: ResultClient = { load: vi.fn(() => request.promise) };
  const requestId = resultStoreApi.getState().begin("session");
  const first = resultStoreApi.getState().load(requestId, "iq", client, "token");
  await resultStoreApi.getState().load(requestId, "iq", client, "token");
  request.resolve({ iq_doc: 90 });
  await first;
  await resultStoreApi.getState().load(requestId, "iq", client, "token");
  expect(client.load).toHaveBeenCalledExactlyOnceWith("token", "session", "iq");
});

it("isolates a summary failure and preserves already loaded values", async () => {
  const client: ResultClient = { load: vi.fn(async (_token, _session, resource) => {
    if (resource === "audit") throw new Error("Audit unavailable");
    return { iq_doc: 90 };
  }) };
  const requestId = resultStoreApi.getState().begin("session");
  await resultStoreApi.getState().load(requestId, "iq", client, "token");
  await expect(resultStoreApi.getState().load(requestId, "audit", client, "token")).rejects.toThrow("Audit unavailable");
  expect(resultStoreApi.getState().iq).toMatchObject({ status: "success", data: { iq_doc: 90 } });
  expect(resultStoreApi.getState().audit).toMatchObject({ status: "error", error: "Audit unavailable", data: null });
});

it.each(["reset", "same", "different"])("ignores late success and failure after %s", async next => {
  const data = pending();
  const failure = pending();
  const client: ResultClient = { load: vi.fn((_token, _session, resource) => resource === "iq" ? data.promise : failure.promise) };
  const requestId = resultStoreApi.getState().begin("session");
  const first = resultStoreApi.getState().load(requestId, "iq", client, "token");
  const second = resultStoreApi.getState().load(requestId, "audit", client, "token");
  resultStoreApi.getState().reset();
  if (next !== "reset") resultStoreApi.getState().begin(next === "same" ? "session" : "next");
  const current = resultStoreApi.getState();
  data.resolve({ iq_doc: 1 });
  failure.reject(new Error("Old request"));
  await Promise.allSettled([first, second]);
  expect(resultStoreApi.getState()).toBe(current);
});

it.each(["session", "next"])("rejects an old request before dispatch after replacing it with %s", async session => {
  const client: ResultClient = { load: vi.fn(async () => ({ iq_doc: 90 })) };
  const requestId = resultStoreApi.getState().begin("session");
  resultStoreApi.getState().reset();
  resultStoreApi.getState().begin(session);
  const current = resultStoreApi.getState();
  await resultStoreApi.getState().load(requestId, "iq", client, "old-token");
  expect(client.load).not.toHaveBeenCalled();
  expect(resultStoreApi.getState()).toBe(current);
});
