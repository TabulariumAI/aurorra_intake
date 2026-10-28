import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIndexingService } from "../service/IndexingService";
import { useProgress } from "../../progressview/hook/useProgress";
import { intakeConfig } from "../../../test/intakeConfig";
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

function createRuntime(seed: Partial<StoreValues> = {}, config = { review: false, iq: true, document: false }) {
  const defaultChoices = structuredClone(intakeConfig.choices);
  const receive = vi.fn();
  const runtime: IndexingRuntime = { config: { ...intakeConfig, choices: defaultChoices, ...config }, onIndexed: vi.fn(),
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
    baseIntervalMs: 500,
    intervalPageMs: 500,
    indexingWorkerClient: {
      start: vi.fn(async () => undefined),
      status: vi.fn(async () => ({ status: "completed", data: "", etag: "metadata-etag" })),
    },
    imageWorkerClient: { generatePackage: vi.fn(async () => ({ status: "completed" as const, data: { tiff: "https://storage.test/image.tiff", data: "https://storage.test/image.json" } })) },
    iqWorkerClient: { generateReport: vi.fn(async () => ({ iq_doc: 98 })) },
    progress: { receive, reset: vi.fn() },
    getAuthToken: vi.fn(() => "token-1"),
  };

  return { defaultChoices, receive, runtime };
}

describe("IndexingService", () => {
  it("shows the required indexing and enabled enrichment sequence", async () => {
    const { defaultChoices, receive, runtime } = createRuntime();
    runtime.store.set("numOfPages", 2);
    runtime.baseIntervalMs = 500;
    let checks = 0;
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: ++checks === 70 ? "completed" : "pending", data: "", etag: "metadata-etag" }));
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    const service = createIndexingService(runtime);

    const processing = service.process();
    await vi.runAllTimersAsync();
    await processing;

    expect(runtime.store.set).not.toHaveBeenCalledWith("indexChoices", expect.anything());
    expect(runtime.onIndexed).toHaveBeenCalledExactlyOnceWith({ session: "session-1", document: "session-1.pdf", etag: "metadata-etag" });
    expect(runtime.indexingWorkerClient.start).toHaveBeenCalledWith(
      "token-1",
      "session-1",
      "session-1.pdf",
      defaultChoices,
      null,
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
      ["Generating IQ report", "started"],
      ["Generating IQ report", "completed"],
    ]);
    expect(setTimeoutSpy.mock.calls.map(([, ms]) => ms)).toEqual(Array(69).fill(500));
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
    expect(new Set(events.map((event) => event.jobId)).size).toBe(10);
  });

  const stages = ["Refining document", "Recognizing document", "Identifying document", "Indexing document"];

  it.each([
    { intervalMs: 7500, pageMs: 2500, stepsPerCheck: 3 },
    { intervalMs: 6000, pageMs: 2500, stepsPerCheck: 3 },
    { intervalMs: 2500, pageMs: 2500, stepsPerCheck: 1 },
    { intervalMs: 1000, pageMs: 2500, stepsPerCheck: 1 },
  ])("accumulates $pageMs ms steps to $intervalMs ms and resets after each check", async ({ intervalMs, pageMs, stepsPerCheck }) => {
    const { receive, runtime } = createRuntime();
    runtime.baseIntervalMs = intervalMs;
    runtime.intervalPageMs = pageMs;
    runtime.store.set("numOfPages", 5);
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "pending", data: "", etag: "metadata-etag" }));
    const run = createIndexingService(runtime).process();
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledOnce();
    for (let step = 0; step < 20; step++) {
      const message = stages[Math.floor(step / 5)];
      expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({
        message, phase: "started", progress: { completed: step % 5 + 1, total: 5, unit: "pages" },
      }));
      await vi.advanceTimersByTimeAsync(pageMs - 1);
      expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(1 + Math.floor(step / stepsPerCheck));
      await vi.advanceTimersByTimeAsync(1);
      expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(1 + Math.floor((step + 1) / stepsPerCheck));
    }
    expect(runtime.onIndexed).not.toHaveBeenCalled();
    expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    for (const message of stages) {
      const jobs = receive.mock.calls.map(([event]) => event).filter(event => event.message === message);
      expect(new Set(jobs.map(event => event.jobId)).size).toBe(1);
      expect(jobs.at(-1)).toMatchObject({ phase: "completed", progress: { completed: 5, total: 5, unit: "pages" } });
    }
    const waits = [7500, 7500, 7500, 7500, 82500].flatMap(budget => {
      const waits = Array(Math.floor(budget / intervalMs)).fill(intervalMs);
      if (budget % intervalMs) waits.push(budget % intervalMs);
      return waits;
    });
    for (const [check, waitMs] of waits.entries()) {
      await vi.advanceTimersByTimeAsync(waitMs - 1);
      expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(1 + Math.floor(20 / stepsPerCheck) + check);
      await vi.advanceTimersByTimeAsync(1);
      expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(2 + Math.floor(20 / stepsPerCheck) + check);
    }
    await run;
    expect(receive.mock.calls.at(-2)?.[0]).toMatchObject({ message: "Retrieving processed data...", phase: "info", progress: null });
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ message: "Processing is taking longer than expected.", phase: "info" }));
    const checks = vi.mocked(runtime.indexingWorkerClient.status).mock.calls.length;
    await vi.advanceTimersByTimeAsync(intervalMs * 2);
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(checks);
    expect(runtime.store.get("indexingStepStatus")).toBe(false);
  });

  it.each(stages.flatMap(stage => [3, 6].flatMap(page => ["completed", "error"].map(status => ({ stage, page, status })))))
  ("stops $stage at accumulated page $page on $status", async ({ stage, page, status }) => {
    const { receive, runtime } = createRuntime();
    runtime.baseIntervalMs = 7500;
    runtime.intervalPageMs = 2500;
    runtime.store.set("numOfPages", 6);
    const lastCheck = 1 + stages.indexOf(stage) * 2 + page / 3;
    let checks = 0;
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: ++checks === lastCheck ? status : "processing", data: "worker failed", etag: "metadata-etag" }));
    const run = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await run;
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(lastCheck);
    expect(receive.mock.calls.map(([event]) => event).filter(event => event.message === stage).at(-1)).toMatchObject({
      message: stage, phase: status === "completed" ? "completed" : "failed",
      progress: { completed: page, total: 6, unit: "pages" },
    });
    expect(runtime.store.get("indexingStepStatus")).toBe(false);
    if (status === "completed") {
      expect(runtime.onIndexed).toHaveBeenCalledExactlyOnceWith({ session: "session-1", document: "session-1.pdf", etag: "metadata-etag" });
      expect(runtime.eventBus.emit).toHaveBeenCalledExactlyOnceWith(runtime.events.reRoute, { stage: "metadata" });
    } else {
      expect(receive.mock.calls.at(-1)?.[0].error).toBe("formatted:document processing worker failed");
      expect(runtime.onIndexed).not.toHaveBeenCalled();
      expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    }
    await vi.advanceTimersByTimeAsync(15000);
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(lastCheck);
  });

  it("starts each process with zero accumulated page time", async () => {
    const { runtime } = createRuntime();
    runtime.baseIntervalMs = 7500;
    runtime.intervalPageMs = 2500;
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "pending", data: "", etag: "metadata-etag" }));
    const service = createIndexingService(runtime);
    for (let attempt = 0; attempt < 2; attempt++) {
      vi.mocked(runtime.indexingWorkerClient.status).mockClear();
      const run = service.process();
      await vi.advanceTimersByTimeAsync(5000);
      expect(runtime.indexingWorkerClient.status).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(2500);
      expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(2);
      await vi.runAllTimersAsync();
      await run;
      expect(runtime.store.get("indexingStepStatus")).toBe(false);
    }
  });

  it("restarts the step sum after a delayed pending status response", async () => {
    const { runtime } = createRuntime();
    runtime.baseIntervalMs = 7500;
    runtime.intervalPageMs = 2500;
    runtime.store.set("numOfPages", 6);
    let resolve!: (value: unknown) => void;
    runtime.indexingWorkerClient.status = vi.fn()
      .mockResolvedValueOnce({ status: "pending", data: "", etag: "metadata-etag" })
      .mockImplementationOnce(() => new Promise(ready => { resolve = ready; }))
      .mockResolvedValue({ status: "completed", data: "", etag: "metadata-etag" });
    const run = createIndexingService(runtime).process();
    await vi.advanceTimersByTimeAsync(7500);
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10000);
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(2);
    resolve({ status: "pending", data: "", etag: "metadata-etag" });
    await vi.advanceTimersByTimeAsync(7499);
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await run;
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(3);
    expect(runtime.onIndexed).toHaveBeenCalledOnce();
  });

  it.each(stages.flatMap(stage => [1, 2, 7].flatMap(page => ["completed", "error"].map(status => ({ stage, page, status })))))
  ("stops $stage at page $page when status returns $status", async ({ stage, page, status }) => {
    const { receive, runtime } = createRuntime();
    runtime.store.set("numOfPages", 7);
    const stageIndex = stages.indexOf(stage);
    const lastCheck = 1 + stageIndex * 7 + page;
    let checks = 0;
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: ++checks === lastCheck ? status : "pending", etag: "metadata-etag", data: status === "error" ? "worker failed" : "" }));
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
    expect(events.filter(event => event.message === stage).at(-1)).toMatchObject({ message: stage, phase: status === "error" ? "failed" : "completed", progress: { completed: page, total: 7, unit: "pages" } });
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
    runtime.indexingWorkerClient.status = vi.fn().mockResolvedValueOnce({ status: "pending", data: "", etag: "metadata-etag" }).mockResolvedValue({ status: "completed", data: "", etag: "metadata-etag" });
    const run = createIndexingService(runtime).process();
    await vi.advanceTimersByTimeAsync(5000);
    expect(receive).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "Refining document", phase: "started" }));
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledOnce();
    const jobId = receive.mock.calls[0][0].jobId;
    if (status === "error") reject(new Error("Start unavailable"));
    else resolve();
    await vi.runAllTimersAsync();
    await run;
    expect(receive.mock.calls.map(([event]) => event).filter(event => event.message === "Refining document").at(-1)).toMatchObject({ jobId, message: "Refining document", phase: status === "error" ? "failed" : "completed" });
    expect(runtime.store.get("indexingStepStatus")).toBe(false);
    if (status === "error") {
      expect(receive.mock.calls.at(-1)?.[0].error).toContain("Start unavailable");
      expect(runtime.onIndexed).not.toHaveBeenCalled();
    }
  });

  it.each([
    { level: 0, pages: 24, scope: null, total: 24 },
    { level: 1, pages: 100, scope: { first: 1, last: 0 }, total: 1 },
    { level: 2, pages: 100, scope: { first: 2, last: 1 }, total: 3 },
    { level: 3, pages: 100, scope: { first: 5, last: 3 }, total: 8 },
    { level: 4, pages: 100, scope: { first: 8, last: 5 }, total: 13 },
    { level: 5, pages: 100, scope: { first: 12, last: 8 }, total: 20 },
    { level: 6, pages: 100, scope: { all: true as const }, total: 100 },
    { level: 2, pages: 2, scope: { first: 2, last: 1 }, total: 2 },
    { level: 3, pages: 2, scope: { first: 5, last: 3 }, total: 2 },
    { level: 4, pages: 2, scope: { first: 8, last: 5 }, total: 2 },
    { level: 5, pages: 2, scope: { first: 12, last: 8 }, total: 2 },
  ])("uses scope $level for all stages of a $pages-page document", async ({ level, pages, scope, total }) => {
    const choices = structuredClone(intakeConfig.choices).map(choice => choice.service === "Recognition" ? { ...choice, level } : choice);
    const { receive, runtime } = createRuntime({ numOfPages: pages });
    runtime.config.choices = choices;
    runtime.config.scope = scope;
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "pending", data: "", etag: "metadata-etag" }));
    const run = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await run;
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
      .mockResolvedValueOnce({ status: "pending", data: "", etag: "metadata-etag" })
      .mockResolvedValue({ status: "completed", data: "", etag: "metadata-etag" });

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
    runtime.store.set("numOfPages", 2);
    runtime.progress = result.current;
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "pending", data: "", etag: "metadata-etag" }));
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
    runtime.baseIntervalMs = 7500;
    runtime.intervalPageMs = 2500;
    runtime.store.set("numOfPages", 3);
    let resolve!: (value: unknown) => void;
    let checks = 0;
    runtime.indexingWorkerClient.status = vi.fn(() => ++checks === stages.indexOf(stage) + 2
      ? new Promise(ready => { resolve = ready; })
      : Promise.resolve({ status: "pending", data: "", etag: "metadata-etag" }));
    const run = createIndexingService(runtime).process();
    await vi.advanceTimersByTimeAsync((stages.indexOf(stage) + 1) * 7500);
    const event = { message: stage, phase: "started", progress: { completed: 3, total: 3, unit: "pages" } };
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining(event));
    const calls = receive.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(receive).toHaveBeenCalledTimes(calls);
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(stages.indexOf(stage) + 2);
    resolve({ status: "completed", data: "", etag: "metadata-etag" });
    await run;
    expect(receive.mock.calls.map(([job]) => job).filter(job => job.message === event.message).at(-1)).toMatchObject({ ...event, phase: "completed" });
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
    expect(receive.mock.calls.map(([event]) => [event.message, event.phase])).toEqual([["Generating IQ report", "started"], ["Generating IQ report", "completed"]]);
    expect(runtime.indexingWorkerClient.start).not.toHaveBeenCalled();
  });

  it("shows only supported enabled enrichment updates and uses the configured page interval independently of enabled services", async () => {
    const choices = structuredClone(intakeConfig.choices).map((choice) => ({
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
    const { receive, runtime } = createRuntime();
    runtime.config.choices = choices;
    runtime.baseIntervalMs = 500;
    runtime.store.set("numOfPages", 1);
    let checks = 0;
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: ++checks === 66 ? "completed" : "pending", data: "", etag: "metadata-etag" }));
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
      "Generating IQ report",
      "Generating IQ report",
    ]);
    expect(setTimeoutSpy.mock.calls.map(([, ms]) => ms)).toEqual(Array(65).fill(500));
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(66);
    setTimeoutSpy.mockRestore();
  });

  it("omits disabled enrichment updates", async () => {
    const choices = structuredClone(intakeConfig.choices).map((choice) => ({
      ...choice,
      level: ["LegalEnrichment", "PartyEnrichment", "Validation", "ChainEnrichment", "HistoryEnrichment", "FeeComputation"].includes(choice.service) ? 0 : choice.level,
    }));
    const { receive, runtime } = createRuntime();
    runtime.config.choices = choices;
    runtime.store.set("numOfPages", 1);
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "pending", data: "", etag: "metadata-etag" }));

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

  it("stops after eleven retrieval steps with a neutral delay message", async () => {
    const { receive, runtime } = createRuntime();
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "pending", data: "", etag: "metadata-etag" }));
    const service = createIndexingService(runtime);

    const processing = service.process();
    await vi.runAllTimersAsync();
    await processing;

    const retrievals = receive.mock.calls.filter(([event]) => (
      event.message === "Retrieving processed data..." && event.phase === "started"
    ));
    const lastRetrieval = retrievals.at(-1)?.[0];
    expect(retrievals).toHaveLength(166);
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
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(230);
    await vi.advanceTimersByTimeAsync(35000);
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(230);
    expect(receive.mock.calls.at(-1)?.[0].jobId).not.toBe(lastRetrieval?.jobId);
    expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    await receive.mock.calls.at(-1)?.[0].actions[0].onConfirm();
    expect(runtime.onIndexed).not.toHaveBeenCalled();
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(runtime.events.reRoute, { stage: "metadata" });
  });

  it.each(["pending", "processing", "completed", "error"] as const)("handles %s on the final retrieval attempt", async status => {
    const { receive, runtime } = createRuntime();
    let checks = 0;
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: ++checks === 230 ? status : "pending", etag: "metadata-etag", data: status === "error" ? "Retrieval failed" : "" }));
    const run = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await run;
    const events = receive.mock.calls.map(([event]) => event);
    const retrieval = events.filter(event => event.message === "Retrieving processed data...");
    expect(new Set(retrieval.map(event => event.jobId)).size).toBe(1);
    expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(230);
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

  it("returns indexing status with its completion ETag", async () => {
    const { runtime } = createRuntime();
    runtime.indexingWorkerClient.status = vi.fn()
      .mockResolvedValueOnce({ status: "processing", data: "", etag: "metadata-etag" })
      .mockResolvedValueOnce({ status: "completed", data: "", etag: "metadata-etag" });
    const service = createIndexingService(runtime);

    await expect(service.checkStatus("session-1")).resolves.toEqual({ status: "processing", data: "" });
    await expect(service.checkStatus("session-1")).resolves.toEqual({ status: "completed", data: "", etag: "metadata-etag" });
  });

  it("rejects worker error statuses without adding progress context", async () => {
    const { runtime } = createRuntime();
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "error", data: "worker failed", etag: "metadata-etag" }));
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
    runtime.store.set("numOfPages", 1);
    let checks = 0;
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: ++checks === 66 ? "error" : "pending", data: "worker failed", etag: "metadata-etag" }));
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

describe("IQ completion", () => {
  it.each([true, false])("waits for the IQ report after indexing completes; already complete=%s", async alreadyComplete => {
    const { receive, runtime } = createRuntime();
    if (!alreadyComplete) runtime.indexingWorkerClient.status = vi.fn()
      .mockResolvedValueOnce({ status: "pending", data: "", etag: "metadata-etag" })
      .mockResolvedValue({ status: "completed", data: "", etag: "metadata-etag" });
    let finish!: (report: Record<string, unknown>) => void;
    runtime.iqWorkerClient.generateReport = vi.fn(() => new Promise<Record<string, unknown>>(resolve => { finish = resolve; }));
    const service = createIndexingService(runtime);
    const processing = service.process();
    await vi.runAllTimersAsync();
    expect(runtime.iqWorkerClient.generateReport).toHaveBeenCalledExactlyOnceWith("token-1", "session-1");
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ message: "Generating IQ report", phase: "started" }));
    const job = receive.mock.calls.at(-1)![0];
    expect(runtime.onIndexed).not.toHaveBeenCalled();
    expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    expect(runtime.store.get("indexingStepStatus")).toBe(true);
    await service.process();
    expect(runtime.iqWorkerClient.generateReport).toHaveBeenCalledOnce();
    finish({ iq_doc: 98 });
    await processing;
    expect(receive).toHaveBeenLastCalledWith({ ...job, phase: "completed" });
    expect(receive.mock.invocationCallOrder.at(-1)).toBeLessThan(vi.mocked(runtime.onIndexed).mock.invocationCallOrder[0]);
    expect(vi.mocked(runtime.onIndexed).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(runtime.eventBus.emit).mock.invocationCallOrder[0]);
    expect(runtime.onIndexed).toHaveBeenCalledExactlyOnceWith({ session: "session-1", document: "session-1.pdf", etag: "metadata-etag" });
    expect(runtime.eventBus.emit).toHaveBeenCalledExactlyOnceWith(runtime.events.reRoute, { stage: "metadata" });
    expect(runtime.store.get("indexingStepStatus")).toBe(false);
  });

  it.each([true, false])("does not complete or navigate when IQ fails; already complete=%s", async alreadyComplete => {
    const { receive, runtime } = createRuntime();
    if (!alreadyComplete) runtime.indexingWorkerClient.status = vi.fn()
      .mockResolvedValueOnce({ status: "pending", data: "", etag: "metadata-etag" })
      .mockResolvedValue({ status: "completed", data: "", etag: "metadata-etag" });
    runtime.iqWorkerClient.generateReport = vi.fn().mockRejectedValue(new Error("IQ report unavailable"));
    const processing = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await processing;
    const iq = receive.mock.calls.map(([event]) => event).filter(event => event.message === "Generating IQ report");
    expect(iq).toHaveLength(2);
    expect(iq[0]).toMatchObject({ phase: "started" });
    expect(iq[1]).toMatchObject({ jobId: iq[0].jobId, phase: "failed", error: "formatted:document processing IQ report unavailable" });
    expect(runtime.onIndexed).not.toHaveBeenCalled();
    expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    expect(runtime.store.get("indexingStepStatus")).toBe(false);
  });

  it.each(["pending", "processing", "error"])("never generates IQ for %s indexing", async status => {
    const { receive, runtime } = createRuntime();
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status, data: "Indexing failed" }));
    const processing = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await processing;
    expect(runtime.iqWorkerClient.generateReport).not.toHaveBeenCalled();
    expect(receive.mock.calls.some(([event]) => event.message === "Generating IQ report")).toBe(false);
    expect(runtime.onIndexed).not.toHaveBeenCalled();
    if (status !== "error") {
      await receive.mock.calls.at(-1)![0].actions[0].onConfirm();
      expect(runtime.iqWorkerClient.generateReport).not.toHaveBeenCalled();
      expect(runtime.onIndexed).not.toHaveBeenCalled();
    }
  });

  it("uses the indexing session captured before polling for IQ generation", async () => {
    const { runtime } = createRuntime();
    let finish!: (value: { status: string; data: string; etag: string }) => void;
    runtime.indexingWorkerClient.status = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const processing = createIndexingService(runtime).process();
    runtime.store.set("session", "session-2");
    finish({ status: "completed", data: "", etag: "metadata-etag" });
    await processing;
    expect(runtime.iqWorkerClient.generateReport).toHaveBeenCalledExactlyOnceWith("token-1", "session-1");
  });
});

it.each(["completed", "processing", "error"] as const)("publishes only confirmed indexing completion: %s", async (status) => {
  const { runtime } = createRuntime();
  runtime.indexingWorkerClient.status = vi.fn(async () => ({ status, data: "", etag: "metadata-etag" }));
  const processing = createIndexingService(runtime).process();
  await vi.runAllTimersAsync();
  await processing;
  if (status === "completed") {
    expect(runtime.onIndexed).toHaveBeenCalledExactlyOnceWith({ session: "session-1", document: "session-1.pdf", etag: "metadata-etag" });
  } else {
    expect(runtime.onIndexed).not.toHaveBeenCalled();
  }
});

it("publishes the indexing session captured before polling", async () => {
  const { runtime } = createRuntime();
  let finish!: (value: { status: "completed"; data: string; etag: string }) => void;
  runtime.indexingWorkerClient.status = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
  const processing = createIndexingService(runtime).process();
  runtime.store.set("session", "session-2");
  finish({ status: "completed", data: "", etag: "metadata-etag" });
  await processing;
  expect(runtime.onIndexed).toHaveBeenCalledExactlyOnceWith({ session: "session-1", document: "session-1.pdf", etag: "metadata-etag" });
});


it.each(["Texas, Harris County", null])("passes jurisdiction %s through the indexing service", async (jurisdiction) => {
  const { runtime, defaultChoices } = createRuntime();
  const service = createIndexingService(runtime);
  await service.start("session-1", "source.pdf", defaultChoices, jurisdiction);
  expect(runtime.indexingWorkerClient.start).toHaveBeenCalledWith("token-1", "session-1", "source.pdf", defaultChoices, jurisdiction);
});


it.each([500, 7500].flatMap(intervalMs => (["pending", "completed", "error"] as const).map(terminal => ({ intervalMs, terminal }))))("preserves the indexing waiting budget at $intervalMs ms; terminal=$terminal", async ({ intervalMs, terminal }) => {
  const { receive, runtime } = createRuntime();
  runtime.baseIntervalMs = intervalMs;
  runtime.intervalPageMs = 2500;
  const started = Date.now();
  runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: Date.now() - started >= 122500 ? terminal : "processing", etag: "metadata-etag", data: terminal === "error" ? "Indexing failed" : "" }));
  const run = createIndexingService(runtime).process();
  await vi.advanceTimersByTimeAsync(122000);
  expect(runtime.store.get("indexingStepStatus")).toBe(true);
  expect(runtime.onIndexed).not.toHaveBeenCalled();
  expect(receive.mock.calls.some(([event]) => event.phase === "info")).toBe(false);
  await vi.advanceTimersByTimeAsync(500);
  expect(runtime.store.get("indexingStepStatus")).toBe(false);
  await run;
  expect(runtime.indexingWorkerClient.start).toHaveBeenCalledOnce();
  expect(runtime.onIndexed).toHaveBeenCalledTimes(terminal === "completed" ? 1 : 0);
  expect(runtime.store.get("indexingStepStatus")).toBe(false);
  expect(runtime.indexingWorkerClient.status).toHaveBeenCalledTimes(intervalMs === 500 ? 230 : 17);
  const events = receive.mock.calls.map(([event]) => event);
  expect(events.some(event => event.phase === "info")).toBe(terminal === "pending");
  for (const event of events) {
    if (event.progress) expect(event.progress.completed).toBeLessThanOrEqual(event.progress.total);
  }
});


describe("post-index workflow", () => {
  it.each([true, false].flatMap(iq => [true, false].flatMap(document => [true, false].map(complete => ({ iq, document, complete })))))
  ("runs only selected stages: IQ=$iq Document=$document already indexed=$complete", async ({ iq, document, complete }) => {
    const { runtime, receive } = createRuntime({}, { review: false, iq, document });
    if (!complete) runtime.indexingWorkerClient.status = vi.fn().mockResolvedValueOnce({ status: "pending", data: "", etag: "metadata-etag" }).mockResolvedValue({ status: "completed", data: "", etag: "metadata-etag" });
    const processing = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await processing;
    expect(runtime.iqWorkerClient.generateReport).toHaveBeenCalledTimes(Number(iq));
    expect(runtime.imageWorkerClient.generatePackage).toHaveBeenCalledTimes(Number(document));
    if (document) expect(runtime.imageWorkerClient.generatePackage).toHaveBeenCalledWith("token-1", "session-1");
    const messages = receive.mock.calls.map(([job]) => [job.message, job.phase]).filter(([message]) => message === "Generating IQ report" || message === "Generating the image package");
    expect(messages).toEqual([
      ...(iq ? [["Generating IQ report", "started"], ["Generating IQ report", "completed"]] : []),
      ...(document ? [["Generating the image package", "started"], ["Generating the image package", "completed"]] : []),
    ]);
    expect(runtime.onIndexed).toHaveBeenCalledExactlyOnceWith({ session: "session-1", document: "session-1.pdf", etag: "metadata-etag" });
    expect(runtime.eventBus.emit).toHaveBeenCalledExactlyOnceWith(runtime.events.reRoute, { stage: "metadata" });
  });

  it("waits for image generation, keeps the captured session and blocks duplicate processing", async () => {
    const { runtime, receive } = createRuntime({}, { review: false, iq: true, document: true });
    let finish!: (value: Awaited<ReturnType<typeof runtime.imageWorkerClient.generatePackage>>) => void;
    runtime.imageWorkerClient.generatePackage = vi.fn(() => new Promise<Awaited<ReturnType<typeof runtime.imageWorkerClient.generatePackage>>>(resolve => { finish = resolve; }));
    const service = createIndexingService(runtime);
    const processing = service.process();
    await vi.runAllTimersAsync();
    const job = receive.mock.calls.at(-1)![0];
    expect(job).toMatchObject({ message: "Generating the image package", phase: "started" });
    expect(runtime.onIndexed).not.toHaveBeenCalled();
    expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    expect(runtime.store.get("indexingStepStatus")).toBe(true);
    runtime.store.set("session", "session-2");
    await service.process();
    expect(runtime.imageWorkerClient.generatePackage).toHaveBeenCalledExactlyOnceWith("token-1", "session-1");
    finish({ status: "completed", data: { tiff: "https://storage.test/image.tiff", data: "https://storage.test/image.json" } });
    await processing;
    expect(receive).toHaveBeenLastCalledWith({ ...job, phase: "completed" });
    expect(runtime.onIndexed).toHaveBeenCalledExactlyOnceWith({ session: "session-1", document: "session-1.pdf", etag: "metadata-etag" });
    expect(runtime.store.get("indexingStepStatus")).toBe(false);
  });

  it("reports image failure without completing or navigating, then permits retry", async () => {
    const { runtime, receive } = createRuntime({}, { review: false, iq: true, document: true });
    runtime.imageWorkerClient.generatePackage = vi.fn().mockRejectedValueOnce(new Error("Image unavailable")).mockResolvedValue({ status: "completed", data: { tiff: "https://storage.test/image.tiff", data: "https://storage.test/image.json" } });
    const service = createIndexingService(runtime);
    await service.process();
    const jobs = receive.mock.calls.map(([job]) => job).filter(job => job.message === "Generating the image package");
    expect(jobs).toHaveLength(2);
    expect(jobs[1]).toMatchObject({ jobId: jobs[0].jobId, phase: "failed", error: "formatted:document processing Image unavailable" });
    expect(runtime.onIndexed).not.toHaveBeenCalled();
    expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    expect(runtime.store.get("indexingStepStatus")).toBe(false);
    await service.process();
    expect(runtime.onIndexed).toHaveBeenCalledOnce();
  });

  it.each(["pending", "processing", "error"])("does not generate an image package for indexing status %s", async status => {
    const { runtime } = createRuntime({}, { review: false, iq: true, document: true });
    runtime.indexingWorkerClient.status = vi.fn(async () => ({ status, data: "Index failed" }));
    const processing = createIndexingService(runtime).process();
    await vi.runAllTimersAsync();
    await processing;
    expect(runtime.imageWorkerClient.generatePackage).not.toHaveBeenCalled();
    expect(runtime.onIndexed).not.toHaveBeenCalled();
  });

  it("does not generate images after IQ failure", async () => {
    const { runtime } = createRuntime({}, { review: false, iq: true, document: true });
    runtime.iqWorkerClient.generateReport = vi.fn().mockRejectedValue(new Error("IQ unavailable"));
    await createIndexingService(runtime).process();
    expect(runtime.imageWorkerClient.generatePackage).not.toHaveBeenCalled();
  });
});


it.each([undefined, ""])("rejects completed indexing without its metadata ETag: %s", async etag => {
  const { runtime, receive } = createRuntime();
  runtime.indexingWorkerClient.status = vi.fn(async () => ({ status: "completed", data: "", etag }));
  await createIndexingService(runtime).process();
  expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ phase: "failed", error: expect.stringContaining("metadata ETag") }));
  expect(runtime.iqWorkerClient.generateReport).not.toHaveBeenCalled();
  expect(runtime.imageWorkerClient.generatePackage).not.toHaveBeenCalled();
  expect(runtime.onIndexed).not.toHaveBeenCalled();
  expect(runtime.eventBus.emit).not.toHaveBeenCalled();
});
