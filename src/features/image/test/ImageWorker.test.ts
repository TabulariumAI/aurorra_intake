import { afterEach, expect, it, vi } from "vitest";
import { ImageWorker } from "../worker/ImageWorker";

const command = { apiBaseUrl: "https://gateway/", session: "session 1", token: "token" };
const packageData = { status: "completed", data: { tiff: "https://storage.test/image.tiff", data: "https://storage.test/image.json" } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
afterEach(() => vi.unstubAllGlobals());

it("posts the first request without an ETag and leaves orchestration and downloads to their owners", async () => {
  const fetch = vi.fn(async () => json(packageData));
  vi.stubGlobal("fetch", fetch);
  await expect(new ImageWorker().run(command)).resolves.toEqual({ ok: true, data: packageData });
  expect(fetch).toHaveBeenCalledExactlyOnceWith("https://gateway/v1/image/session%201/generate", {
    method: "POST", body: "{}", headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
  });
});

it.each([
  [{ status: "error", data: "Generation failed" }, "image_package_error"],
  [{ status: "processing", data: "" }, "validation_error"],
  [{ status: "completed", data: { tiff: "https://storage.test/image.tiff" } }, "validation_error"],
  [{ status: "completed", data: { tiff: "file://image.tiff", data: "https://storage.test/image.json" } }, "validation_error"],
  [null, "validation_error"],
])("rejects unsuccessful or invalid image envelopes %j", async (body, code) => {
  vi.stubGlobal("fetch", vi.fn(async () => json(body)));
  await expect(new ImageWorker().run(command)).resolves.toMatchObject({ ok: false, code });
});

it("preserves structured service errors", async () => {
  const body = { code: "image_timeout", error: "Images were not ready" };
  vi.stubGlobal("fetch", vi.fn(async () => json(body, 503)));
  await expect(new ImageWorker().run(command)).resolves.toEqual({ ok: false, code: body.code, error: body.error, status: 503, details: body });
});

it.each([
  [new Response("invalid", { headers: { "content-type": "application/json" } }), "invalid_json"],
  [new Response("<html>error</html>"), "non_json_response"],
])("rejects malformed responses", async (response, code) => {
  vi.stubGlobal("fetch", vi.fn(async () => response));
  await expect(new ImageWorker().run(command)).resolves.toMatchObject({ ok: false, code });
});

it("returns network failures", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network unavailable")));
  await expect(new ImageWorker().run(command)).resolves.toMatchObject({ ok: false, error: "Network unavailable" });
});

it.each([
  [{ ...command, token: "" }, "missing_auth_token"],
  [{ ...command, apiBaseUrl: "" }, "missing_api_base_url"],
  [{ ...command, session: " " }, "invalid_session"],
])("validates required command data", async (input, code) => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(new ImageWorker().run(input)).resolves.toMatchObject({ ok: false, code });
  expect(fetch).not.toHaveBeenCalled();
});


it("returns an interrupted response body as a worker failure", async () => {
  const response = new Response("body");
  vi.spyOn(response, "text").mockRejectedValue(new Error("Connection interrupted"));
  vi.stubGlobal("fetch", vi.fn(async () => response));
  await expect(new ImageWorker().run(command)).resolves.toMatchObject({ ok: false, error: "Connection interrupted", status: 200 });
});
