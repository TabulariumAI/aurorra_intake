import { afterEach, expect, it, vi } from "vitest";
import { IqWorker } from "../worker/IqWorker";

const command = { apiBaseUrl: "https://gateway.test/", session: "session /1", token: "token" };
const reportUrl = "https://storage.test/iq.json?sig=token";
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

it.each([
  { stage: "api", status: 200 },
  { stage: "api", status: 503 },
  { stage: "report", status: 503 },
])("posts a failure when the $stage response body disconnects with status $status", async ({ stage, status }) => {
  const fetch = vi.fn();
  if (stage === "report") fetch.mockResolvedValueOnce(json({ status: "completed", data: reportUrl }));
  fetch.mockResolvedValueOnce(new Response(new ReadableStream({
    start(controller) { controller.error(new Error("Connection closed")); },
  }), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  const post = vi.spyOn(self, "postMessage").mockImplementation(() => undefined);
  try {
    await self.onmessage!({ data: command } as MessageEvent);
    expect(post).toHaveBeenCalledExactlyOnceWith({ ok: false, error: "Connection closed", status });
  } finally {
    post.mockRestore();
  }
});

it.each(["api", "report"])("preserves supported HTTP error bodies from the %s", async stage => {
  for (const response of [
    { body: JSON.stringify({ message: "Unavailable" }), type: "application/json", error: "Unavailable", details: { message: "Unavailable" } },
    { body: "Unavailable", type: "text/plain", error: "Unavailable", details: undefined },
    { body: "", type: "text/plain", error: "HTTP 503", details: undefined },
  ]) {
    const fetch = vi.fn();
    if (stage === "report") fetch.mockResolvedValueOnce(json({ status: "completed", data: reportUrl }));
    fetch.mockResolvedValueOnce(new Response(response.body, { status: 503, headers: { "Content-Type": response.type } }));
    vi.stubGlobal("fetch", fetch);
    expect(await new IqWorker().run(command)).toEqual({ ok: false, error: response.error, details: response.details, code: undefined, status: 503 });
  }
});

it("waits for generation and the downloaded report with an encoded session and no metadata etag", async () => {
  let generated!: (response: Response) => void;
  let downloaded!: (response: Response) => void;
  const fetch = vi.fn()
    .mockImplementationOnce(() => new Promise<Response>(resolve => { generated = resolve; }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { downloaded = resolve; }));
  vi.stubGlobal("fetch", fetch);
  const done = vi.fn();
  const pending = new IqWorker().run(command).then(done);
  expect(fetch).toHaveBeenCalledExactlyOnceWith("https://gateway.test/v1/iq/session%20%2F1/data", {
    cache: "no-store", headers: { Authorization: "Bearer token" }, method: "GET",
  });
  expect(done).not.toHaveBeenCalled();
  generated(json({ status: "completed", data: reportUrl }));
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(fetch).toHaveBeenLastCalledWith(reportUrl);
  expect(done).not.toHaveBeenCalled();
  downloaded(json({ iq_doc: 98 }));
  await pending;
  expect(done).toHaveBeenCalledExactlyOnceWith({ ok: true, data: { iq_doc: 98 } });
});

it.each([
  { input: { ...command, token: "" }, code: "missing_auth_token" },
  { input: { ...command, apiBaseUrl: "" }, code: "missing_api_base_url" },
  { input: { ...command, session: " " }, code: "invalid_session" },
])("rejects $code without a request", async ({ input, code }) => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(await new IqWorker().run(input)).toMatchObject({ ok: false, code });
  expect(fetch).not.toHaveBeenCalled();
});

it.each(["pending", "processing", "completed"])("rejects a %s envelope without a report address", async status => {
  const fetch = vi.fn(async () => json({ status, data: null }));
  vi.stubGlobal("fetch", fetch);
  expect(await new IqWorker().run(command)).toMatchObject({ ok: false, code: "validation_error" });
  expect(fetch).toHaveBeenCalledOnce();
});

it("propagates generation failure without downloading", async () => {
  const payload = { status: "error", data: "IQ failed" };
  const fetch = vi.fn(async () => json(payload));
  vi.stubGlobal("fetch", fetch);
  expect(await new IqWorker().run(command)).toEqual({ ok: false, code: "iq_error", details: payload, error: "IQ failed" });
  expect(fetch).toHaveBeenCalledOnce();
});

it("rejects an invalid error envelope without inventing a fallback message", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => json({ status: "error", data: null, error: "fallback" })));
  expect(await new IqWorker().run(command)).toEqual({ ok: false, code: "validation_error", error: "Response is not a valid IQ report." });
});

it.each(["api", "report"])("preserves HTTP errors from the %s without retrying generation", async stage => {
  const fetch = vi.fn();
  if (stage === "report") fetch.mockResolvedValueOnce(json({ status: "completed", data: reportUrl }));
  fetch.mockResolvedValueOnce(json({ code: "denied", error: "Access denied" }, 403));
  vi.stubGlobal("fetch", fetch);
  expect(await new IqWorker().run(command)).toEqual({ ok: false, status: 403, code: "denied", details: { code: "denied", error: "Access denied" }, error: "Access denied" });
  expect(fetch).toHaveBeenCalledTimes(stage === "api" ? 1 : 2);
});

it.each(["api", "report"])("preserves network errors from the %s", async stage => {
  const fetch = vi.fn();
  if (stage === "report") fetch.mockResolvedValueOnce(json({ status: "completed", data: reportUrl }));
  fetch.mockRejectedValueOnce(new Error("Network unavailable"));
  vi.stubGlobal("fetch", fetch);
  expect(await new IqWorker().run(command)).toEqual({ ok: false, error: "Network unavailable" });
});

it.each(["api", "report"])("rejects invalid JSON from the %s", async stage => {
  const fetch = vi.fn();
  if (stage === "report") fetch.mockResolvedValueOnce(json({ status: "completed", data: reportUrl }));
  fetch.mockResolvedValueOnce(new Response("{", { headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  expect(await new IqWorker().run(command)).toMatchObject({ ok: false, code: "invalid_json", status: 200 });
});

it("rejects a non-JSON API response", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { headers: { "Content-Type": "text/plain" } })));
  expect(await new IqWorker().run(command)).toMatchObject({ ok: false, code: "non_json_response" });
});

it.each([null, [], "invalid"])("rejects an invalid downloaded report: %j", async report => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(json({ status: "completed", data: reportUrl }))
    .mockResolvedValueOnce(json(report)));
  expect(await new IqWorker().run(command)).toMatchObject({ ok: false, code: "validation_error" });
});

it("posts the final result from the actual worker message handler", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(json({ status: "completed", data: reportUrl }))
    .mockResolvedValueOnce(json({ iq_doc: 98 })));
  const post = vi.spyOn(self, "postMessage").mockImplementation(() => undefined);
  await self.onmessage!({ data: command } as MessageEvent);
  expect(post).toHaveBeenCalledExactlyOnceWith({ ok: true, data: { iq_doc: 98 } });
  post.mockRestore();
});
