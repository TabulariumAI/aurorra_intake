import { afterEach, expect, it, vi } from "vitest";
import { IndexingWorker } from "../worker/IndexingWorker";
import { ChoicesWorker } from "../../choices/worker/ChoicesWorker";

afterEach(() => vi.unstubAllGlobals());

it.each(["Texas, Harris County", null])("serializes jurisdiction %s separately from service choices", (jurisdiction) => {
  const request = new IndexingWorker().buildRequest({ type: "start", token: "token", apiBaseUrl: "https://gateway.test",
    session: "session", document: "document.pdf", choices: [{ service: "Recognition", level: 3 }], jurisdiction });
  expect(JSON.parse(request.body!)).toEqual({ doc_name: "document.pdf", choices: [{ service: "Recognition", level: 3 }], jurisdiction });
});

it("reads the gateway completed response without losing choices or jurisdiction", async () => {
  const data = { items: [{ service: "Recognition", level: 3 }], jurisdiction: "Texas, Harris County" };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "completed", data: JSON.stringify(data) }), {
    headers: { "Content-Type": "application/json" },
  })));
  const result = await new ChoicesWorker().run({ type: "load", token: "token", session: "session", config: { apiBaseUrl: "https://gateway.test" } });
  expect(result).toEqual({ ok: true, data });
});

it.each(["pending", "processing", "error"])("does not fabricate settings from a %s response", async (status) => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status, data: "" }), {
    headers: { "Content-Type": "application/json" },
  })));
  const result = await new ChoicesWorker().run({ type: "load", token: "token", session: "session", config: { apiBaseUrl: "https://gateway.test" } });
  expect(result).toEqual({ ok: true, data: null });
});
