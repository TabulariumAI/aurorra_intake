import { describe, expect, it, vi } from "vitest";
import { createIndexingService } from "../service/IndexingService";
import { CHOICESTRUCTURE, ChoiceData } from "../../choices/service/choicesData";
import type { IndexingRuntime } from "../type/indexing.types";
import type { StateKey, StoreAdapter, StoreValues } from "../../../store/type/store.types";

function createStore(seed: Partial<StoreValues> = {}): StoreAdapter {
  const values: StoreValues = {
    settingsOpen: false,
    selectionResetVersion: 0,
    sessionRequest: null,
    isSessionInProcess: false,
    uploadingStepStatus: false,
    documentSelected: false,
    provisionStepStatus: false,
    indexingStepStatus: false,
    userToken: null,
    session: "session-1",
    sasToken: null,
    baseUrl: null,
    document: "session-1.pdf",
    numOfPages: 1,
    indexChoices: new ChoiceData(CHOICESTRUCTURE).generateDefaultJson(),
    choicesBySession: {},
    workflow: null,
    ...seed,
  };

  return {
    clearStorage: vi.fn(),
    get: vi.fn((key: StateKey) => values[key]),
    getStoredInformation: vi.fn(),
    reset: vi.fn(),
    set: vi.fn(<Key extends StateKey>(key: Key, value: StoreValues[Key]) => {
      values[key] = value;
    }),
  } as unknown as StoreAdapter;
}

function createRuntime(seed: Partial<StoreValues> = {}) {
  const defaultChoices = new ChoiceData(CHOICESTRUCTURE).generateDefaultJson();
  const receive = vi.fn();
  const runtime: IndexingRuntime = {
    alert: { format: vi.fn((message, args) => `formatted:${String((message as { args?: unknown })?.args ? args?.action : message)}`) },
    messages: {
      ERR_ACT: { args: { action: "action" } },
      SESSION_REQ_INFO: "session required",
    },
    eventBus: { emit: vi.fn() },
    events: {
      reRoute: { detail: { stage: "stage" } },
    },
    store: createStore(seed),
    choices: {
      getActualPages: vi.fn(() => 1),
      normalizeChoices: vi.fn((choices) => new ChoiceData(CHOICESTRUCTURE).normalizeChoiceValues(choices)),
    },
    choiceStructure: CHOICESTRUCTURE,
    baseIntervalMs: 1,
    indexingWorkerClient: {
      start: vi.fn(async () => undefined),
      status: vi.fn(async () => ({ status: "completed", data: "" })),
    },
    progress: { receive, reset: vi.fn() },
    getAuthToken: vi.fn(() => "token-1"),
  };

  return { defaultChoices, receive, runtime };
}

describe("IndexingService", () => {
  it("shows the required indexing and enabled enrichment sequence", async () => {
    const { defaultChoices, receive, runtime } = createRuntime({ indexChoices: "null" });
    runtime.choices.getActualPages = vi.fn(() => 2);
    runtime.baseIntervalMs = 7;
    runtime.indexingWorkerClient.status = vi.fn()
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "processing", data: "" })
      .mockResolvedValueOnce({ status: "processing", data: "" })
      .mockResolvedValueOnce({ status: "processing", data: "" })
      .mockResolvedValueOnce({ status: "processing", data: "" })
      .mockResolvedValueOnce({ status: "processing", data: "" })
      .mockResolvedValueOnce({ status: "completed", data: "" });
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    const service = createIndexingService(runtime);

    await service.process();

    expect(runtime.store.set).toHaveBeenCalledWith("indexChoices", defaultChoices);
    expect(runtime.store.set).toHaveBeenCalledWith("choicesBySession", {
      "session-1": defaultChoices,
    });
    expect(runtime.indexingWorkerClient.start).toHaveBeenCalledWith("token-1", "session-1", "session-1.pdf", defaultChoices);
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "metadata" },
    );
    expect(receive.mock.calls.map(([event]) => [event.message, event.phase])).toEqual([
      ["Identifying pages", "started"],
      ["Refining document", "started"],
      ["Recognizing document", "started"],
      ["Processing page 1 of 2", "started"],
      ["Processing page 2 of 2", "started"],
      ["Enriching legal descriptions", "started"],
      ["Enriching party information", "started"],
      ["Validating document data", "started"],
      ["Analyzing Index Quality", "started"],
      ["Retrieving processed data...", "started"],
      ["Retrieving processed data...", "completed"],
    ]);
    expect(setTimeoutSpy.mock.calls.map(([, ms]) => ms)).toEqual([7, 7, 7, 357, 357, 7, 7, 7, 7, 7]);
    setTimeoutSpy.mockRestore();
  });

  it("shows only supported enabled enrichment updates and uses the calculated page interval", async () => {
    const choices = new ChoiceData(CHOICESTRUCTURE).generateDefaultJson().map((choice) => ({
      ...choice,
      level: [
        "ConfidentialIndexing",
        "TransactionIndexing",
        "LegalEnrichment",
        "PartyEnrichment",
        "Validation",
        "ChainEnrichment",
        "HistoryEnrichment",
        "FeeComputation",
      ].includes(choice.service) ? 1 : 0,
    }));
    const { receive, runtime } = createRuntime({ indexChoices: choices });
    runtime.baseIntervalMs = 7;
    runtime.choices.getActualPages = vi.fn(() => 1);
    runtime.indexingWorkerClient.status = vi.fn()
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "completed", data: "" });
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");

    await createIndexingService(runtime).process();

    expect(receive.mock.calls.map(([event]) => event.message)).toEqual([
      "Identifying pages",
      "Refining document",
      "Recognizing document",
      "Processing page 1 of 1",
      "Enriching legal descriptions",
      "Enriching party information",
      "Validating document data",
      "Analyzing Index Quality",
      "Retrieving processed data...",
      "Retrieving processed data...",
    ]);
    expect(setTimeoutSpy.mock.calls.map(([, ms]) => ms)).toEqual([7, 7, 7, 107, 7, 7, 7, 7, 7]);
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(8);
    setTimeoutSpy.mockRestore();
  });

  it("omits disabled enrichment updates", async () => {
    const choices = new ChoiceData(CHOICESTRUCTURE).generateDefaultJson().map((choice) => ({
      ...choice,
      level: ["LegalEnrichment", "PartyEnrichment", "Validation", "ChainEnrichment", "HistoryEnrichment", "FeeComputation"].includes(choice.service) ? 0 : choice.level,
    }));
    const { receive, runtime } = createRuntime({ indexChoices: choices });
    runtime.choices.getActualPages = vi.fn(() => 1);
    runtime.indexingWorkerClient.status = vi.fn()
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "completed", data: "" });

    await createIndexingService(runtime).process();

    expect(receive.mock.calls.map(([event]) => event.message)).not.toContain("Enriching legal descriptions");
    expect(receive.mock.calls.map(([event]) => event.message)).not.toContain("Enriching party information");
    expect(receive.mock.calls.map(([event]) => event.message)).not.toContain("Validating document data");
    expect(receive.mock.calls.map(([event]) => event.message)).not.toContain("Building the title chain");
    expect(receive.mock.calls.map(([event]) => event.message)).not.toContain("Reviewing title history");
    expect(receive.mock.calls.map(([event]) => event.message)).not.toContain("Calculating fees");
  });

  it("stops after eleven retrieval attempts with a neutral delay message", async () => {
    const { receive, runtime } = createRuntime();
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "pending", data: "" }));
    const service = createIndexingService(runtime);

    await service.process();

    const retrievals = receive.mock.calls.filter(([event]) => (
      event.message === "Retrieving processed data..." && event.phase === "started"
    ));
    const lastRetrieval = retrievals.at(-1)?.[0];
    expect(retrievals).toHaveLength(1);
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({
      message: "Processing is taking longer than expected.",
      phase: "info",
      actions: [{ label: "View metadata", requireConfirmation: false, variant: "primary", onConfirm: expect.any(Function) }],
    }));
    expect(receive.mock.calls.at(-1)?.[0].jobId).not.toBe(lastRetrieval?.jobId);
    expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    await receive.mock.calls.at(-1)?.[0].actions[0].onConfirm();
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(runtime.events.reRoute, { stage: "metadata" });
  });

  it("returns true only for completed status", async () => {
    const { runtime } = createRuntime();
    runtime.indexingWorkerClient.status = vi.fn()
      .mockResolvedValueOnce({ status: "processing", data: "" })
      .mockResolvedValueOnce({ status: "completed", data: "" });
    const service = createIndexingService(runtime);

    await expect(service.checkStatus("session-1")).resolves.toBe(false);
    await expect(service.checkStatus("session-1")).resolves.toBe(true);
  });

  it("rejects worker error statuses without adding progress context", async () => {
    const { runtime } = createRuntime();
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "error", data: "worker failed" }));
    const service = createIndexingService(runtime);

    await expect(service.checkStatus("session-1")).rejects.toThrow("worker failed");
  });

  it("uses a status fallback once when a worker provides no error detail", async () => {
    const { runtime } = createRuntime();
    runtime.indexingWorkerClient.status = vi.fn(async () => { throw {}; });
    const service = createIndexingService(runtime);

    await expect(service.checkStatus("session-1")).rejects.toThrow(/^formatted:document processing$/);
  });

  it("does not route to metadata when indexing fails", async () => {
    const { receive, runtime } = createRuntime();
    runtime.choices.getActualPages = vi.fn(() => 1);
    runtime.indexingWorkerClient.status = vi.fn()
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "error", data: "worker failed" });
    const service = createIndexingService(runtime);

    await expect(service.process()).resolves.toBeUndefined();

    expect(runtime.eventBus.emit).not.toHaveBeenCalledWith(runtime.events.reRoute, { stage: "metadata" });
    const retrieve = receive.mock.calls.find(([event]) => event.message === "Retrieving processed data..." && event.phase === "started")?.[0];
    expect(receive).toHaveBeenLastCalledWith({
      error: "formatted:document processing worker failed",
      jobId: retrieve?.jobId,
      message: "Retrieving processed data...",
      phase: "failed",
    });
    expect(runtime.eventBus.emit).not.toHaveBeenCalled();
  });

  it("does not start when indexing is already in process", async () => {
    const { runtime } = createRuntime({ indexingStepStatus: true });
    const service = createIndexingService(runtime);

    await service.process();

    expect(runtime.indexingWorkerClient.status).not.toHaveBeenCalled();
    expect(runtime.indexingWorkerClient.start).not.toHaveBeenCalled();
  });
});
