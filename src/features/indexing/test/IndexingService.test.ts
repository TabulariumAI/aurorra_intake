import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIndexingService } from "../service/IndexingService";
import { useProgress } from "../../progressview/hook/useProgress";
import { CHOICESTRUCTURE, ChoiceData, DEFAULT_WORKFLOW_SETTINGS, createIndexingPayload } from "../../choices/service/choicesData";
import type { IndexingRuntime } from "../type/indexing.types";
import type { StateKey, StoreAdapter, StoreValues } from "../../../store/type/store.types";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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
    workflow: DEFAULT_WORKFLOW_SETTINGS,
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
  const runtime: IndexingRuntime = { onIndexed: vi.fn(),
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
      .mockResolvedValueOnce({ status: "processing", data: "" })
      .mockResolvedValueOnce({ status: "processing", data: "" })
      .mockResolvedValueOnce({ status: "processing", data: "" })
      .mockResolvedValueOnce({ status: "completed", data: "" });
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    const service = createIndexingService(runtime);

    const processing = service.process();
    await vi.runAllTimersAsync();
    await processing;

    expect(runtime.store.set).toHaveBeenCalledWith("indexChoices", defaultChoices);
    expect(runtime.onIndexed).toHaveBeenCalledExactlyOnceWith({ session: "session-1", document: "session-1.pdf" });
    expect(runtime.store.set).toHaveBeenCalledWith("choicesBySession", {
      "session-1": defaultChoices,
    });
    expect(runtime.indexingWorkerClient.start).toHaveBeenCalledWith(
      "token-1",
      "session-1",
      "session-1.pdf",
      createIndexingPayload(defaultChoices),
    );
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "metadata" },
    );
    expect(receive.mock.calls.map(([event]) => [event.message, event.phase])).toEqual([
      ["Refining document", "started"],
      ["Refining document", "completed"],
      ["Recognizing document", "started"],
      ["Recognizing document", "completed"],
      ["Identifying document", "started"],
      ["Identifying document", "started"],
      ["Identifying document", "completed"],
      ["Indexing document", "started"],
      ["Indexing document", "started"],
      ["Indexing document", "completed"],
      ["Enriching legal descriptions", "started"],
      ["Enriching legal descriptions", "completed"],
      ["Enriching party information", "started"],
      ["Enriching party information", "completed"],
      ["Validating document data", "started"],
      ["Validating document data", "completed"],
      ["Analyzing Index Quality", "started"],
      ["Analyzing Index Quality", "completed"],
      ["Retrieving processed data...", "started"],
      ["Retrieving processed data...", "started"],
      ["Retrieving processed data...", "completed"],
    ]);
    expect(setTimeoutSpy.mock.calls.map(([, ms]) => ms)).toEqual([7, 7, 357, 357, 357, 357, 7, 7, 7, 7, 7]);
    setTimeoutSpy.mockRestore();
    const events = receive.mock.calls.map(([event]) => event);
    expect(events[5].jobId).toBe(events[4].jobId);
    expect(events[6].jobId).toBe(events[4].jobId);
    expect(events[8].jobId).toBe(events[7].jobId);
    expect(events[9].jobId).toBe(events[7].jobId);
    expect(events[4].jobId).not.toBe(events[7].jobId);
    expect(new Set(events.map((event) => event.jobId)).size).toBe(9);
  });

  it.each([
    ["Identifying document", 1, "completed"],
    ["Identifying document", 2, "completed"],
    ["Identifying document", 7, "completed"],
    ["Identifying document", 2, "error"],
    ["Identifying document", 7, "error"],
    ["Indexing document", 1, "completed"],
    ["Indexing document", 2, "completed"],
    ["Indexing document", 7, "completed"],
    ["Indexing document", 2, "error"],
    ["Indexing document", 7, "error"],
  ] as const)("stops %s at page %i when status returns %s", async (stage, lastPage, status) => {
    const { receive, runtime } = createRuntime();
    runtime.choices.getActualPages = vi.fn(() => 7);
    const lastCheck = 3 + (stage === "Indexing document" ? 7 : 0) + lastPage;
    let checks = 0;
    runtime.indexingWorkerClient.status = vi.fn(async () => ({
      status: ++checks === lastCheck ? status : "pending",
      data: status === "error" ? "worker failed" : "",
    }));

    const run = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await run;

    const events = receive.mock.calls.map(([event]) => event);
    const identifying = events.filter((event) => event.message === "Identifying document");
    const indexing = events.filter((event) => event.message === "Indexing document");
    expect(identifying.filter((event) => event.phase === "started").map((event) => event.progress)).toEqual(
      Array.from({ length: stage === "Indexing document" ? 7 : lastPage }, (_, index) => ({ completed: index + 1, total: 7, unit: "pages" })),
    );
    expect(new Set(identifying.map((event) => event.jobId)).size).toBe(1);
    if (stage === "Indexing document") {
      expect(identifying.at(-1)).toMatchObject({ message: "Identifying document", phase: "completed", progress: { completed: 7, total: 7, unit: "pages" } });
      expect(indexing.filter((event) => event.phase === "started").map((event) => event.progress)).toEqual(
        Array.from({ length: lastPage }, (_, index) => ({ completed: index + 1, total: 7, unit: "pages" })),
      );
      expect(new Set(indexing.map((event) => event.jobId)).size).toBe(1);
      expect(identifying[0].jobId).not.toBe(indexing[0].jobId);
      expect(events.indexOf(identifying.at(-1))).toBeLessThan(events.indexOf(indexing[0]));
    } else {
      expect(indexing).toEqual([]);
    }
    expect(events.at(-1)).toMatchObject({
      message: stage,
      phase: status === "completed" ? "completed" : "failed",
      progress: { completed: lastPage, total: 7, unit: "pages" },
      ...(status === "error" ? { error: "formatted:document processing worker failed" } : {}),
    });
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(lastCheck);
    expect(runtime.store.get("indexingStepStatus")).toBe(false);
    if (status === "completed") {
      expect(runtime.eventBus.emit).toHaveBeenCalledWith(runtime.events.reRoute, { stage: "metadata" });
    } else {
      expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    }
  });

  it("checks status immediately after upload and starts refining without a polling delay", async () => {
    const { result } = renderHook(() => useProgress());
    const { runtime } = createRuntime();
    runtime.baseIntervalMs = 6500;
    runtime.progress = result.current;
    runtime.indexingWorkerClient.status = vi.fn()
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValue({ status: "completed", data: "" });

    act(() => result.current.receive({ jobId: "upload", message: "Uploading your document", phase: "completed" }));
    const service = createIndexingService(runtime);
    let run: Promise<void>;
    await act(async () => {
      run = service.process();
      expect(runtime.indexingWorkerClient.status).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.jobs).toEqual([
      { jobId: "upload", message: "Uploading your document", phase: "completed" },
      expect.objectContaining({ message: "Refining document", phase: "started" }),
    ]);
    expect(runtime.indexingWorkerClient.start).toHaveBeenCalledOnce();
    await act(async () => {
      await vi.runAllTimersAsync();
      await run;
    });
    expect(result.current.jobs[1].phase).toBe("completed");
  });

  it("keeps identification active across polling and finishes every page before processing", async () => {
    const { result } = renderHook(() => useProgress());
    const { runtime } = createRuntime();
    runtime.baseIntervalMs = 6500;
    runtime.choices.getActualPages = vi.fn(() => 2);
    runtime.progress = result.current;
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "pending", data: "" }));
    const run = createIndexingService(runtime).process();
    await act(async () => { await vi.advanceTimersByTimeAsync(13000); });
    expect(result.current.jobs.at(-1)).toMatchObject({ message: "Identifying document", phase: "started", progress: { completed: 1, total: 2, unit: "pages" } });
    expect(result.current.jobs.some((job) => job.message === "Indexing document")).toBe(false);

    await act(async () => { await vi.advanceTimersByTimeAsync(6849); });
    expect(result.current.jobs.at(-1)).toMatchObject({ message: "Identifying document", phase: "started", progress: { completed: 1, total: 2, unit: "pages" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.jobs.at(-1)).toMatchObject({ message: "Identifying document", phase: "started", progress: { completed: 2, total: 2, unit: "pages" } });
    expect(result.current.jobs.some((job) => job.message === "Indexing document")).toBe(false);

    await act(async () => { await vi.advanceTimersByTimeAsync(6850); });
    expect(result.current.jobs.slice(-2)).toEqual([
      expect.objectContaining({ message: "Identifying document", phase: "completed", progress: { completed: 2, total: 2, unit: "pages" } }),
      expect.objectContaining({ message: "Indexing document", phase: "started", progress: { completed: 1, total: 2, unit: "pages" } }),
    ]);
    await act(async () => { await vi.advanceTimersByTimeAsync(6850); });
    expect(result.current.jobs.slice(-2)).toEqual([
      expect.objectContaining({ message: "Identifying document", phase: "completed", progress: { completed: 2, total: 2, unit: "pages" } }),
      expect.objectContaining({ message: "Indexing document", phase: "started", progress: { completed: 2, total: 2, unit: "pages" } }),
    ]);
    await act(async () => {
      await vi.runAllTimersAsync();
      await run;
    });
    expect(result.current.jobs.filter((job) => job.message === "Identifying document")).toHaveLength(1);
    expect(result.current.jobs.filter((job) => job.message === "Indexing document")).toHaveLength(1);
  });

  it("keeps the current page active while a status response is outstanding", async () => {
    const { receive, runtime } = createRuntime();
    let resolveStatus!: (value: unknown) => void;
    runtime.indexingWorkerClient.status = vi.fn()
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveStatus = resolve; }));
    const run = createIndexingService(runtime).process();
    await vi.advanceTimersByTimeAsync(353);
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ message: "Identifying document", phase: "started", progress: { completed: 1, total: 1, unit: "pages" } }));
    await vi.advanceTimersByTimeAsync(6500);
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ message: "Identifying document", phase: "started", progress: { completed: 1, total: 1, unit: "pages" } }));
    resolveStatus({ status: "completed", data: "" });
    await run;
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ message: "Identifying document", phase: "completed", progress: { completed: 1, total: 1, unit: "pages" } }));
    expect(receive.mock.calls.some(([event]) => event.message === "Indexing document")).toBe(false);
  });

  it("reports an initial status failure in progress", async () => {
    const { receive, runtime } = createRuntime();
    runtime.indexingWorkerClient.status = vi.fn(async () => { throw new Error("Status unavailable"); });
    const run = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await run;
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "failed", error: "formatted:document processing Status unavailable" }));
    expect(runtime.indexingWorkerClient.start).not.toHaveBeenCalled();
    expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    expect(runtime.store.get("indexingStepStatus")).toBe(false);
  });

  it("does not emit identifying events when indexing already completed", async () => {
    const { receive, runtime } = createRuntime();
    const processing = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await processing;
    expect(receive).not.toHaveBeenCalled();
    expect(runtime.indexingWorkerClient.start).not.toHaveBeenCalled();
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
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "completed", data: "" });
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");

    const processing = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await processing;

    expect(receive.mock.calls.map(([event]) => event.message)).toEqual([
      "Refining document",
      "Refining document",
      "Recognizing document",
      "Recognizing document",
      "Identifying document",
      "Identifying document",
      "Indexing document",
      "Indexing document",
      "Enriching legal descriptions",
      "Enriching legal descriptions",
      "Enriching party information",
      "Enriching party information",
      "Validating document data",
      "Validating document data",
      "Analyzing Index Quality",
      "Analyzing Index Quality",
      "Retrieving processed data...",
      "Retrieving processed data...",
      "Retrieving processed data...",
    ]);
    expect(setTimeoutSpy.mock.calls.map(([, ms]) => ms)).toEqual([7, 7, 107, 107, 7, 7, 7, 7, 7]);
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(10);
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

    const processing = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await processing;

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

    const processing = service.process();
    await vi.runAllTimersAsync();
    await processing;

    const retrievals = receive.mock.calls.filter(([event]) => (
      event.message === "Retrieving processed data..." && event.phase === "started"
    ));
    const lastRetrieval = retrievals.at(-1)?.[0];
    expect(retrievals).toHaveLength(12);
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({
      message: "Processing is taking longer than expected.",
      phase: "info",
      actions: [{ label: "View metadata", requireConfirmation: false, variant: "primary", onConfirm: expect.any(Function) }],
    }));
    expect(lastRetrieval).toMatchObject({
      message: "Retrieving processed data...",
      phase: "started",
      progress: { completed: 11, total: 11, unit: "steps" },
    });
    expect(receive.mock.calls.at(-1)?.[0].jobId).not.toBe(lastRetrieval?.jobId);
    expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    await receive.mock.calls.at(-1)?.[0].actions[0].onConfirm();
    expect(runtime.onIndexed).not.toHaveBeenCalled();
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
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "pending", data: "" })
      .mockResolvedValueOnce({ status: "error", data: "worker failed" });
    const service = createIndexingService(runtime);

    const processing = service.process();
    await vi.runAllTimersAsync();
    await expect(processing).resolves.toBeUndefined();

    expect(runtime.eventBus.emit).not.toHaveBeenCalledWith(runtime.events.reRoute, { stage: "metadata" });
    const retrieve = receive.mock.calls.find(([event]) => event.message === "Retrieving processed data..." && event.phase === "started")?.[0];
    expect(receive).toHaveBeenLastCalledWith({
      error: "formatted:document processing worker failed",
      jobId: retrieve?.jobId,
      message: "Retrieving processed data...",
      phase: "failed",
      progress: { completed: 1, total: 11, unit: "steps" },
    });
    expect(runtime.eventBus.emit).not.toHaveBeenCalled();
  });

  it("does not start when indexing is already in process", async () => {
    const { runtime } = createRuntime({ indexingStepStatus: true });
    const service = createIndexingService(runtime);

    const processing = service.process();
    await vi.runAllTimersAsync();
    await processing;

    expect(runtime.indexingWorkerClient.status).not.toHaveBeenCalled();
    expect(runtime.indexingWorkerClient.start).not.toHaveBeenCalled();
  });
});

it.each(["completed", "processing", "error"] as const)("publishes only confirmed indexing completion: %s", async (status) => {
  const { runtime } = createRuntime();
  runtime.indexingWorkerClient.status = vi.fn(async () => ({ status, data: "" }));
  const processing = createIndexingService(runtime).process();
  await vi.runAllTimersAsync();
  await processing;
  if (status === "completed") {
    expect(runtime.onIndexed).toHaveBeenCalledExactlyOnceWith({ session: "session-1", document: "session-1.pdf" });
  } else {
    expect(runtime.onIndexed).not.toHaveBeenCalled();
  }
});

it("publishes the indexing session captured before polling", async () => {
  const { runtime } = createRuntime();
  let finish!: (value: { status: "completed"; data: string }) => void;
  runtime.indexingWorkerClient.status = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
  const processing = createIndexingService(runtime).process();
  runtime.store.set("session", "session-2");
  finish({ status: "completed", data: "" });
  await processing;
  expect(runtime.onIndexed).toHaveBeenCalledExactlyOnceWith({ session: "session-1", document: "session-1.pdf" });
});
