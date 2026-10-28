import { expect, it, vi } from "vitest";
import { createIndexingService } from "../service/IndexingService";
import type { IndexingRuntime } from "../type/indexing.types";
import { createStoreAdapter } from "../../../store/adapter/storeAdapter";
import { storeApi } from "../../../store/state/store";

it("indexes the supplied config without storing or defaulting choices", async () => {
  storeApi.getState().resetAllState();
  storeApi.getState().setValue("session", "new");
  storeApi.getState().setValue("document", "document.pdf");
  const choices = [{ service: "Recognition", level: 2 }, { service: "PartyClauseIndexing", level: 0 }];
  const runtime: IndexingRuntime = {
    config: { review: false, iq: false, document: false, choices, jurisdiction: "Texas, Harris County", scope: { first: 2, last: 1 } },
    store: createStoreAdapter(),
    getAuthToken: () => "token",
    alert: { format: () => "failed" },
    messages: { ERR_ACT: { args: { action: "action" } }, SESSION_REQ_INFO: "missing" },
    events: { reRoute: { detail: { stage: "stage" } } },
    eventBus: { emit: vi.fn() },
    progress: { receive: vi.fn(), reset: vi.fn() },
    onIndexed: vi.fn(),
    baseIntervalMs: 1,
    intervalPageMs: 1,
    indexingWorkerClient: { start: vi.fn().mockResolvedValue(undefined), status: vi.fn().mockResolvedValueOnce({ status: "pending", data: "" }).mockResolvedValue({ status: "completed", data: "", etag: "version" }) },
    iqWorkerClient: { generateReport: vi.fn() },
    imageWorkerClient: { generatePackage: vi.fn() },
  };
  await createIndexingService(runtime).process();
  expect(runtime.indexingWorkerClient.start).toHaveBeenCalledWith("token", "new", "document.pdf", choices, "Texas, Harris County");
  expect(runtime.onIndexed).toHaveBeenCalledWith({ session: "new", document: "document.pdf", etag: "version" });
  expect(choices).toEqual([{ service: "Recognition", level: 2 }, { service: "PartyClauseIndexing", level: 0 }]);
  for (const key of ["indexChoices", "choicesBySession", "jurisdiction", "config", "choices"]) expect(storeApi.getState()).not.toHaveProperty(key);
});
