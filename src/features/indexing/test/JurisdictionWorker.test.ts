import { afterEach, expect, it, vi } from "vitest";
import { IndexingWorker } from "../worker/IndexingWorker";

afterEach(() => vi.unstubAllGlobals());

it.each(["Texas, Harris County", null])("serializes jurisdiction %s separately from service choices", (jurisdiction) => {
  const request = new IndexingWorker().buildRequest({ type: "start", token: "token", apiBaseUrl: "https://gateway.test",
    session: "session", document: "document.pdf", choices: [{ service: "Recognition", level: 3 }], jurisdiction });
  expect(JSON.parse(request.body!)).toEqual({ doc_name: "document.pdf", choices: [{ service: "Recognition", level: 3 }], jurisdiction });
});
