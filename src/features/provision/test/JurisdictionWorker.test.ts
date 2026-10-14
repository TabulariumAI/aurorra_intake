import { expect, it } from "vitest";
import { ProvisionWorker } from "../worker/ProvisionWorker";

it.each(["Texas, Harris County", null])("serializes provision jurisdiction %s", (jurisdiction) => {
  const request = new ProvisionWorker().buildRequest({ type: "provision", token: "token", apiBaseUrl: "https://api.test", session: "session", document: "source.pdf", jurisdiction });
  expect(request.url).toBe("https://api.test/v1/session/session/provision");
  expect(JSON.parse(request.body)).toEqual({ doc_name: "source.pdf", jurisdiction });
});
