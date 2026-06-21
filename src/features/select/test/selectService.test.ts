import { describe, expect, it, vi } from "vitest";
import { createSelectService, getSelectErrorMessage } from "../service/selectService";
import type { IntakeShellActions } from "../../intake/type/intakeShell.types";
import type { SelectRuntime } from "../type/selectRuntime.types";
import type { StateKey, StoreAdapter, StoreValues } from "../../../store/type/store.types";

function createStore(seed: Partial<StoreValues> = {}): StoreAdapter {
  const values: StoreValues = {
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

function createShell(): IntakeShellActions {
  return {
    showSelect: vi.fn(),
    showProvision: vi.fn(),
    clearHeader: vi.fn(),
    clearError: vi.fn(),
    setError: vi.fn(),
    progress: {
      showOverlay: vi.fn(),
      hideOverlay: vi.fn(),
      startProcessing: vi.fn(),
      endProcessing: vi.fn(),
      notify: vi.fn(),
    },
  };
}

function createRuntime(seed: Partial<StoreValues> = {}) {
  const shell = createShell();
  const runtime: SelectRuntime = {
    alert: { format: vi.fn(() => "formatted fallback") },
    messages: { ERR_ACT: { code: "ERR_ACT", args: { action: "action" } } },
    eventBus: {
      emit: vi.fn(),
      emitAsync: vi.fn(async () => undefined),
    },
    events: {
      reRoute: { detail: { stage: "stage", file: "file" } },
      showChoices: { name: "showChoices" },
    },
    store: createStore(seed),
    intakeShell: shell,
    intervalMs: 250,
  };

  return { runtime, shell };
}

describe("selectService", () => {
  it("resolves error message priority", () => {
    expect(getSelectErrorMessage({ error: "error text" }, "fallback")).toBe("error text");
    expect(getSelectErrorMessage({ details: "detail text" }, "fallback")).toBe("detail text");
    expect(getSelectErrorMessage({ message: "message text" }, "fallback")).toBe("message text");
    expect(getSelectErrorMessage({}, "fallback")).toBe("fallback");
  });

  it("stores document selection and emits route events", async () => {
    const { runtime, shell } = createRuntime();
    const service = createSelectService(runtime);
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });

    service.setDocumentSelected(true);
    service.setPageCount(7);
    service.emitProgressStart();
    await service.emitRoute(file);
    service.showSettings();

    expect(runtime.store.set).toHaveBeenCalledWith("documentSelected", true);
    expect(runtime.store.set).toHaveBeenCalledWith("numOfPages", 7);
    expect(shell.progress.notify).toHaveBeenCalledWith("Screening document...");
    expect(runtime.eventBus.emitAsync).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "session", file },
    );
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(runtime.events.showChoices);
  });

  it("clears document selection and progress state", () => {
    const { runtime, shell } = createRuntime({ documentSelected: true });
    const service = createSelectService(runtime);

    service.clear();

    expect(runtime.store.set).toHaveBeenCalledWith("documentSelected", false);
    expect(shell.progress.endProcessing).toHaveBeenCalledTimes(1);
    expect(shell.progress.hideOverlay).toHaveBeenCalledTimes(1);
  });
});
