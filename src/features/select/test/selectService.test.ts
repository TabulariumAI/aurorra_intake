import { describe, expect, it, vi } from "vitest";
import { createSelectService, getSelectErrorMessage } from "../service/selectService";
import type { SelectRuntime } from "../type/selectRuntime.types";
import type { StateKey, StoreAdapter, StoreValues } from "../../../store/type/store.types";
import { DEFAULT_WORKFLOW_SETTINGS } from "../../choices/service/choicesData";

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
    session: null,
    sasToken: null,
    baseUrl: null,
    document: null,
    numOfPages: 1,
    indexChoices: null,
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
  const receive = vi.fn();
  const runtime: SelectRuntime = {
    eventBus: {
      emit: vi.fn(),
      emitAsync: vi.fn(async () => undefined),
    },
    events: {
      reRoute: { detail: { stage: "stage", file: "file", jobId: "jobId" } },
      showChoices: { name: "showChoices" },
    },
    progress: { receive, reset: vi.fn() },
    store: createStore(seed),
  };

  return { receive, runtime };
}

describe("selectService", () => {
  it("resolves error message priority", () => {
    expect(getSelectErrorMessage({ error: "error text" }, "fallback")).toBe("error text");
    expect(getSelectErrorMessage({ details: "detail text" }, "fallback")).toBe("detail text");
    expect(getSelectErrorMessage({ message: "message text" }, "fallback")).toBe("message text");
    expect(getSelectErrorMessage({}, "fallback")).toBe("fallback");
    expect(getSelectErrorMessage({ details: { status: 403 }, message: "Forbidden" }, "fallback")).toBe("Forbidden");
  });

  it("completes preparation before starting and routing the session job", async () => {
    const { receive, runtime } = createRuntime();
    const service = createSelectService(runtime);
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });
    const getDocument = vi.fn(async () => file);

    service.setDocumentSelected(true);
    await service.start(7, getDocument);
    service.showSettings();

    expect(runtime.store.set).toHaveBeenCalledWith("documentSelected", true);
    expect(runtime.store.set).toHaveBeenCalledWith("numOfPages", 7);
    const prepareId = receive.mock.calls[0][0].jobId;
    const jobId = receive.mock.calls[2][0].jobId;
    expect(jobId).not.toBe(prepareId);
    expect(receive.mock.calls.map(([event]) => event)).toEqual([
      { jobId: prepareId, message: "Preparing your document…", phase: "started" },
      { jobId: prepareId, message: "Preparing your document…", phase: "completed", progress: null },
      { jobId, message: "Creating a session", phase: "started" },
    ]);
    expect(receive.mock.invocationCallOrder[0]).toBeLessThan(getDocument.mock.invocationCallOrder[0]);
    expect(runtime.progress.reset).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runtime.progress.reset).mock.invocationCallOrder[0]).toBeLessThan(receive.mock.invocationCallOrder[0]);
    expect(runtime.eventBus.emitAsync).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "session", file, jobId },
    );
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(runtime.events.showChoices);
  });

  it("fails only preparation when document preparation fails", async () => {
    const { receive, runtime } = createRuntime();
    const service = createSelectService(runtime);
    const failure = new Error("TIFF export failed.");

    await expect(service.start(7, vi.fn(async () => {
      throw failure;
    }))).rejects.toThrow(failure);

    expect(receive.mock.calls.map(([event]) => event.phase)).toEqual(["started", "failed"]);
    expect(receive.mock.calls[0][0].jobId).toBe(receive.mock.calls[1][0].jobId);
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({
      error: "TIFF export failed.",
      message: "Preparing your document…",
    }));
    expect(runtime.eventBus.emitAsync).not.toHaveBeenCalled();
  });

  it("keeps preparation active without routing while the document is pending", async () => {
    const { receive, runtime } = createRuntime();
    let resolve!: (file: File) => void;
    const document = new Promise<File>((ready) => { resolve = ready; });
    const file = new File(["tiff"], "document.tif", { type: "image/tiff" });
    const started = createSelectService(runtime).start(2, () => document);

    expect(receive).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ message: "Preparing your document…", phase: "started" }));
    expect(runtime.eventBus.emitAsync).not.toHaveBeenCalled();
    resolve(file);
    await started;
    expect(runtime.eventBus.emitAsync).toHaveBeenCalledTimes(1);
    expect(runtime.eventBus.emitAsync).toHaveBeenCalledWith(runtime.events.reRoute, expect.objectContaining({ file }));
  });

  it("fails preparation without creating a session when the document is missing", async () => {
    const { receive, runtime } = createRuntime();
    await expect(createSelectService(runtime).start(2, async () => null)).rejects.toThrow("Failed to get the selected file.");
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ message: "Preparing your document…", phase: "failed" }));
    expect(runtime.eventBus.emitAsync).not.toHaveBeenCalled();
  });

  it("keeps preparation completed when session routing rejects", async () => {
    const { receive, runtime } = createRuntime();
    const error = new Error("Routing failed");
    vi.mocked(runtime.eventBus.emitAsync).mockRejectedValueOnce(error);
    await expect(createSelectService(runtime).start(2, async () => new File(["pdf"], "document.pdf"))).rejects.toThrow(error);
    expect(receive.mock.calls.map(([event]) => [event.message, event.phase])).toEqual([
      ["Preparing your document…", "started"],
      ["Preparing your document…", "completed"],
      ["Creating a session", "started"],
      ["Creating a session", "failed"],
    ]);
    expect(receive.mock.calls[3][0].jobId).toBe(receive.mock.calls[2][0].jobId);
  });

  it("clears document selection", () => {
    const { runtime } = createRuntime({ documentSelected: true });
    const service = createSelectService(runtime);

    service.clear();

    expect(runtime.store.set).toHaveBeenCalledWith("documentSelected", false);
  });

  it("updates the preparation job with real page progress and waits through finalization", async () => {
    const { receive, runtime } = createRuntime();
    let resolve!: (file: File) => void;
    const ready = new Promise<File>((done) => { resolve = done; });
    let report!: Parameters<Parameters<ReturnType<typeof createSelectService>["start"]>[1]>[0];
    const started = createSelectService(runtime).start(3, (onProgress) => { report = onProgress; return ready; });
    const jobId = receive.mock.calls[0][0].jobId;
    report({ phase: "pages", completed: 1, total: 3 });
    expect(receive).toHaveBeenLastCalledWith({ jobId, message: "Preparing your document…", phase: "started", progress: { completed: 1, total: 3 } });
    report({ phase: "finalizing", completed: 3, total: 3 });
    expect(receive).toHaveBeenLastCalledWith({ jobId, message: "Finalizing your document…", phase: "started", progress: null });
    expect(runtime.eventBus.emitAsync).not.toHaveBeenCalled();
    resolve(new File(["tiff"], "document.tif"));
    await started;
    expect(receive).toHaveBeenCalledWith({ jobId, message: "Preparing your document…", phase: "completed", progress: null });
  });

  it("does not add a failed job when resetting the viewer aborts export", async () => {
    const { receive, runtime } = createRuntime();
    const canceled = new DOMException("TIFF export closed.", "AbortError");
    await expect(createSelectService(runtime).start(2, async () => { throw canceled; })).rejects.toBe(canceled);
    expect(receive).toHaveBeenCalledTimes(1);
    expect(runtime.eventBus.emitAsync).not.toHaveBeenCalled();
  });
});
