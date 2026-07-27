import { describe, expect, it, vi } from "vitest";
import { createIndexingService } from "../service/IndexingService";
import { CHOICESTRUCTURE, ChoiceData } from "../../choices/service/choicesData";
import type { IndexingRuntime } from "../type/indexing.types";
import type { StateKey, StoreAdapter, StoreValues } from "../../../store/type/store.types";

function createStore(seed: Partial<StoreValues> = {}): StoreAdapter {
  const values: StoreValues = {
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
  const onJobEvent = vi.fn();
  const runtime: IndexingRuntime = {
    alert: { format: vi.fn((message, args) => `formatted:${String((message as { args?: unknown })?.args ? args?.action : message)}`) },
    messages: {
      ERR_ACT: { args: { action: "action" } },
      REPORT_WAIT: "report wait",
      SESSION_REQ_INFO: "session required",
    },
    eventBus: { emit: vi.fn() },
    events: {
      reRoute: { detail: { stage: "stage" } },
      showAlert: { name: "showAlert" },
    },
    store: createStore(seed),
    choices: {
      getActualPages: vi.fn(() => 1),
      getIdentifyingIndexes: vi.fn(() => []),
      getIdEnh: vi.fn(() => []),
      getDefaultChoices: vi.fn(() => defaultChoices),
      normalizeChoices: vi.fn((choices) => new ChoiceData(CHOICESTRUCTURE).normalizeChoiceValues(choices)),
    },
    choiceStructure: CHOICESTRUCTURE,
    baseIntervalMs: 1,
    indexingWorkerClient: {
      start: vi.fn(async () => undefined),
      status: vi.fn(async () => ({ status: "completed", data: "" })),
    },
    onJobEvent,
    notify: vi.fn(async () => undefined),
    getAuthToken: vi.fn(() => "token-1"),
  };

  return { defaultChoices, onJobEvent, runtime };
}

describe("IndexingService", () => {
  it("starts indexing with normalized choices and emits metadata route when completed", async () => {
    const { defaultChoices, onJobEvent, runtime } = createRuntime({ indexChoices: "null" });
    runtime.indexingWorkerClient.status = vi.fn()
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "completed", data: "" });
    const service = createIndexingService(runtime, { setState: vi.fn() });

    await service.process();

    expect(runtime.store.set).toHaveBeenCalledWith("indexChoices", defaultChoices);
    expect(runtime.indexingWorkerClient.start).toHaveBeenCalledWith("token-1", "session-1", "session-1.pdf", defaultChoices);
    expect(runtime.notify).toHaveBeenCalledWith("src/assets/notify.wav");
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "metadata" },
    );
    expect(onJobEvent.mock.calls.map(([event]) => event.phase)).toEqual(["started", "started", "completed", "completed"]);
    expect(onJobEvent.mock.calls[0][0].jobId).toBe(onJobEvent.mock.calls[3][0].jobId);
    expect(onJobEvent.mock.calls[1][0].jobId).toBe(onJobEvent.mock.calls[2][0].jobId);
  });

  it("returns true only for completed status", async () => {
    const { runtime } = createRuntime();
    runtime.indexingWorkerClient.status = vi.fn()
      .mockResolvedValueOnce({ status: "processing", data: "" })
      .mockResolvedValueOnce({ status: "completed", data: "" });
    const service = createIndexingService(runtime, { setState: vi.fn() });

    await expect(service.checkStatus("session-1", "session-1.pdf")).resolves.toBe(false);
    await expect(service.checkStatus("session-1", "session-1.pdf")).resolves.toBe(true);
  });

  it("rejects worker error statuses with formatted context", async () => {
    const { runtime } = createRuntime();
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "error", data: "worker failed" }));
    const service = createIndexingService(runtime, { setState: vi.fn() });

    await expect(service.checkStatus("session-1", "session-1.pdf")).rejects.toThrow("worker failed");
  });

  it("does not route to metadata when indexing fails", async () => {
    const { runtime } = createRuntime();
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "error", data: "worker failed" }));
    const service = createIndexingService(runtime, { setState: vi.fn() });

    await expect(service.process()).rejects.toThrow("worker failed");

    expect(runtime.eventBus.emit).not.toHaveBeenCalledWith(runtime.events.reRoute, { stage: "metadata" });
  });

  it("does not start when indexing is already in process", async () => {
    const { runtime } = createRuntime({ indexingStepStatus: true });
    const service = createIndexingService(runtime, { setState: vi.fn() });

    await service.process();

    expect(runtime.indexingWorkerClient.status).not.toHaveBeenCalled();
    expect(runtime.indexingWorkerClient.start).not.toHaveBeenCalled();
  });
});
