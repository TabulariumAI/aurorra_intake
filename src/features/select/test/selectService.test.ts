import { describe, expect, it, vi } from "vitest";
import { createSelectService, getSelectErrorMessage } from "../service/selectService";
import type { SelectRuntime } from "../type/selectRuntime.types";
import type { StateKey, StoreAdapter, StoreValues } from "../../../store/type/store.types";

function createStore(seed: Partial<StoreValues> = {}): StoreAdapter {
  const values: StoreValues = {
    settingsOpen: false,
    provisionRequest: null,
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
  const onJobEvent = vi.fn();
  const runtime: SelectRuntime = {
    eventBus: {
      emit: vi.fn(),
      emitAsync: vi.fn(async () => undefined),
    },
    events: {
      reRoute: { detail: { stage: "stage", file: "file", jobId: "jobId" } },
      showChoices: { name: "showChoices" },
    },
    onJobEvent,
    store: createStore(seed),
  };

  return { onJobEvent, runtime };
}

describe("selectService", () => {
  it("resolves error message priority", () => {
    expect(getSelectErrorMessage({ error: "error text" }, "fallback")).toBe("error text");
    expect(getSelectErrorMessage({ details: "detail text" }, "fallback")).toBe("detail text");
    expect(getSelectErrorMessage({ message: "message text" }, "fallback")).toBe("message text");
    expect(getSelectErrorMessage({}, "fallback")).toBe("fallback");
  });

  it("emits session start before resolving the document and routes the same job", async () => {
    const { onJobEvent, runtime } = createRuntime();
    const service = createSelectService(runtime);
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });
    const getDocument = vi.fn(async () => file);

    service.setDocumentSelected(true);
    await service.start(7, getDocument);
    service.showSettings();

    expect(runtime.store.set).toHaveBeenCalledWith("documentSelected", true);
    expect(runtime.store.set).toHaveBeenCalledWith("numOfPages", 7);
    expect(onJobEvent).toHaveBeenCalledWith({
      jobId: expect.any(String),
      message: "Creating a new session",
      phase: "started",
      session: null,
    });
    expect(onJobEvent.mock.invocationCallOrder[0]).toBeLessThan(getDocument.mock.invocationCallOrder[0]);
    const jobId = onJobEvent.mock.calls[0][0].jobId;
    expect(runtime.eventBus.emitAsync).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "session", file, jobId },
    );
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(runtime.events.showChoices);
  });

  it("fails the immediate session job when document preparation fails", async () => {
    const { onJobEvent, runtime } = createRuntime();
    const service = createSelectService(runtime);
    const failure = new Error("TIFF export failed.");

    await expect(service.start(7, vi.fn(async () => {
      throw failure;
    }))).rejects.toThrow(failure);

    expect(onJobEvent.mock.calls.map(([event]) => event.phase)).toEqual(["started", "failed"]);
    expect(onJobEvent.mock.calls[0][0].jobId).toBe(onJobEvent.mock.calls[1][0].jobId);
    expect(onJobEvent).toHaveBeenLastCalledWith(expect.objectContaining({
      error: "TIFF export failed.",
      message: "Session creation failed",
      session: null,
    }));
    expect(runtime.eventBus.emitAsync).not.toHaveBeenCalled();
  });

  it("clears document selection", () => {
    const { runtime } = createRuntime({ documentSelected: true });
    const service = createSelectService(runtime);

    service.clear();

    expect(runtime.store.set).toHaveBeenCalledWith("documentSelected", false);
  });
});
