import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIndexingService } from "../service/IndexingService";
import { useProgress } from "../../progressview/hook/useProgress";
import { CHOICESTRUCTURE, ChoiceData, Choices, DEFAULT_WORKFLOW_SETTINGS, createIndexingPayload } from "../../choices/service/choicesData";
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
    intervalPageMs: 500,
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
      ["Refining document", "started"],
      ["Refining document", "started"],
      ["Refining document", "completed"],
      ["Recognizing document", "started"],
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
    expect(setTimeoutSpy.mock.calls.map(([, ms]) => ms)).toEqual([500, 500, 500, 500, 500, 500, 500, 500, 7, 7, 7, 7, 7]);
    setTimeoutSpy.mockRestore();
    const events = receive.mock.calls.map(([event]) => event);
    for (const stage of ["Refining document", "Recognizing document", "Identifying document", "Indexing document"]) {
      const jobs = events.filter(event => event.message === stage);
      expect(new Set(jobs.map(event => event.jobId)).size).toBe(1);
      expect(jobs.filter(event => event.phase === "started" && event.progress).map(event => event.progress)).toEqual([
        { completed: 1, total: 2, unit: "pages" }, { completed: 2, total: 2, unit: "pages" },
      ]);
      expect(jobs.at(-1)).toMatchObject({ phase: "completed", progress: { completed: 2, total: 2, unit: "pages" } });
    }
    expect(new Set(events.map((event) => event.jobId)).size).toBe(9);
  });

  const stages = ["Refining document", "Recognizing document", "Identifying document", "Indexing document"];

  it.each(stages.flatMap(stage => [1, 2, 7].flatMap(page => ["completed", "error"].map(status => ({ stage, page, status })))))
  ("stops $stage at page $page when status returns $status", async ({ stage, page, status }) => {
    const { receive, runtime } = createRuntime();
    runtime.choices.getActualPages = vi.fn(() => 7);
    const stageIndex = stages.indexOf(stage);
    const lastCheck = 1 + stageIndex * 7 + page;
    let checks = 0;
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: ++checks === lastCheck ? status : "pending", data: status === "error" ? "worker failed" : "" }));
    const run = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await run;
    const events = receive.mock.calls.map(([event]) => event);
    for (const [index, message] of stages.entries()) {
      const jobs = events.filter(event => event.message === message);
      if (index > stageIndex) {
        expect(jobs).toEqual([]);
        continue;
      }
      expect(jobs.filter(event => event.phase === "started" && event.progress).map(event => event.progress)).toEqual(
        Array.from({ length: index === stageIndex ? page : 7 }, (_, i) => ({ completed: i + 1, total: 7, unit: "pages" })),
      );
      expect(new Set(jobs.map(event => event.jobId)).size).toBe(1);
      expect(jobs.at(-1)).toMatchObject({ phase: index === stageIndex && status === "error" ? "failed" : "completed" });
    }
    expect(events.at(-1)).toMatchObject({ message: stage, phase: status === "error" ? "failed" : "completed", progress: { completed: page, total: 7, unit: "pages" } });
    expect(runtime.indexingWorkerClient.start).toHaveBeenCalledOnce();
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(lastCheck);
    expect(runtime.store.get("indexingStepStatus")).toBe(false);
    if (status === "completed") {
      expect(runtime.onIndexed).toHaveBeenCalledOnce();
      expect(runtime.eventBus.emit).toHaveBeenCalledExactlyOnceWith(runtime.events.reRoute, { stage: "metadata" });
    } else {
      expect(events.at(-1).error).toBe("formatted:document processing worker failed");
      expect(runtime.onIndexed).not.toHaveBeenCalled();
      expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    }
  });

  it.each(["completed", "error"])("keeps refining visible while start is pending and handles %s", async status => {
    const { receive, runtime } = createRuntime();
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    runtime.indexingWorkerClient.start = vi.fn(() => new Promise<void>((ready, fail) => { resolve = ready; reject = fail; }));
    runtime.indexingWorkerClient.status = vi.fn().mockResolvedValueOnce({ status: "pending", data: "" }).mockResolvedValue({ status: "completed", data: "" });
    const run = createIndexingService(runtime).process();
    await vi.advanceTimersByTimeAsync(5000);
    expect(receive).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "Refining document", phase: "started" }));
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledOnce();
    const jobId = receive.mock.calls[0][0].jobId;
    if (status === "error") reject(new Error("Start unavailable"));
    else resolve();
    await vi.runAllTimersAsync();
    await run;
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ jobId, message: "Refining document", phase: status === "error" ? "failed" : "completed" }));
    expect(runtime.store.get("indexingStepStatus")).toBe(false);
    if (status === "error") {
      expect(receive.mock.calls.at(-1)?.[0].error).toContain("Start unavailable");
      expect(runtime.onIndexed).not.toHaveBeenCalled();
    }
  });

  it.each([1, 2, 3, 4, 5, 0])("uses the recognition page limit for all stages at level %i", async level => {
    const choices = new ChoiceData(CHOICESTRUCTURE).generateDefaultJson().map(choice => choice.service === "Recognition" ? { ...choice, level } : choice);
    const { receive, runtime } = createRuntime({ numOfPages: 24, indexChoices: choices });
    runtime.choices.getActualPages = (values, pages) => Choices.getActualPages(values, Number(pages));
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "pending", data: "" }));
    const run = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await run;
    const total = [24, 1, 3, 8, 13, 20][level];
    for (const stage of stages) {
      const events = receive.mock.calls.map(([event]) => event).filter(event => event.message === stage && event.phase === "started" && event.progress);
      expect(events).toHaveLength(total);
      expect(events.at(-1).progress).toEqual({ completed: total, total, unit: "pages" });
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

  it("advances each page only after the configured delay and keeps one row per stage", async () => {
    const { result } = renderHook(() => useProgress());
    const { runtime } = createRuntime();
    runtime.intervalPageMs = 137;
    runtime.choices.getActualPages = vi.fn(() => 2);
    runtime.progress = result.current;
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "pending", data: "" }));
    let run!: Promise<void>;
    await act(async () => { run = createIndexingService(runtime).process(); });
    for (const [index, message] of stages.entries()) {
      for (const page of [1, 2]) {
        expect(result.current.jobs).toHaveLength(index + 1);
        expect(result.current.jobs.at(-1)).toMatchObject({ message, phase: "started", progress: { completed: page, total: 2, unit: "pages" } });
        await act(async () => { await vi.advanceTimersByTimeAsync(136); });
        expect(result.current.jobs.at(-1)).toMatchObject({ message, phase: "started", progress: { completed: page, total: 2, unit: "pages" } });
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      }
      expect(result.current.jobs[index]).toMatchObject({ message, phase: "completed" });
    }
    await act(async () => { await vi.runAllTimersAsync(); await run; });
  });

  it.each(stages)("keeps %s active while its status response is outstanding", async stage => {
    const { receive, runtime } = createRuntime();
    let resolve!: (value: unknown) => void;
    let checks = 0;
    runtime.indexingWorkerClient.status = vi.fn(() => ++checks === stages.indexOf(stage) + 2
      ? new Promise(ready => { resolve = ready; })
      : Promise.resolve({ status: "pending", data: "" }));
    const run = createIndexingService(runtime).process();
    await vi.advanceTimersByTimeAsync((stages.indexOf(stage) + 1) * 500);
    const event = { message: stage, phase: "started", progress: { completed: 1, total: 1, unit: "pages" } };
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining(event));
    const calls = receive.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(receive).toHaveBeenCalledTimes(calls);
    resolve({ status: "completed", data: "" });
    await run;
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ ...event, phase: "completed" }));
    expect(runtime.onIndexed).toHaveBeenCalledOnce();
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

  it("shows only supported enabled enrichment updates and uses the configured page interval independently of enabled services", async () => {
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
    expect(setTimeoutSpy.mock.calls.map(([, ms]) => ms)).toEqual([500, 500, 500, 500, 7, 7, 7, 7, 7]);
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
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "pending", data: "" }));

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
    expect(receive.mock.calls.at(-2)?.[0]).toEqual({
      jobId: lastRetrieval?.jobId,
      message: "Retrieving processed data...",
      phase: "info",
      progress: null,
    });
    expect(runtime.store.get("indexingStepStatus")).toBe(false);
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(20);
    await vi.advanceTimersByTimeAsync(35000);
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(20);
    expect(receive.mock.calls.at(-1)?.[0].jobId).not.toBe(lastRetrieval?.jobId);
    expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    await receive.mock.calls.at(-1)?.[0].actions[0].onConfirm();
    expect(runtime.onIndexed).not.toHaveBeenCalled();
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(runtime.events.reRoute, { stage: "metadata" });
  });

  it.each(["pending", "processing", "completed", "error"] as const)("handles %s on the final retrieval attempt", async status => {
    const { receive, runtime } = createRuntime();
    let checks = 0;
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: ++checks === 20 ? status : "pending", data: status === "error" ? "Retrieval failed" : "" }));
    const run = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await run;
    const events = receive.mock.calls.map(([event]) => event);
    const retrieval = events.filter(event => event.message === "Retrieving processed data...");
    expect(new Set(retrieval.map(event => event.jobId)).size).toBe(1);
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(20);
    expect(runtime.store.get("indexingStepStatus")).toBe(false);
    if (status === "completed" || status === "error") {
      expect(retrieval.at(-1)).toMatchObject({ phase: status === "completed" ? "completed" : "failed", progress: { completed: 11, total: 11, unit: "steps" } });
      expect(events.some(event => event.phase === "info")).toBe(false);
    } else {
      expect(retrieval.at(-1)).toMatchObject({ phase: "info", progress: null });
      expect(events.at(-1)).toMatchObject({ message: "Processing is taking longer than expected.", phase: "info" });
    }
    if (status === "completed") {
      expect(runtime.onIndexed).toHaveBeenCalledOnce();
      expect(runtime.eventBus.emit).toHaveBeenCalledExactlyOnceWith(runtime.events.reRoute, { stage: "metadata" });
    } else {
      expect(runtime.onIndexed).not.toHaveBeenCalled();
      expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    }
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
