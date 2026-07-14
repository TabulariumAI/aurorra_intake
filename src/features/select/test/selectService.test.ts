import { describe, expect, it, vi } from "vitest";
import { createSelectService, getSelectErrorMessage } from "../service/selectService";
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

function createRuntime(seed: Partial<StoreValues> = {}) {
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
    intervalMs: 250,
  };

  return { runtime };
}

describe("selectService", () => {
  it("resolves error message priority", () => {
    expect(getSelectErrorMessage({ error: "error text" }, "fallback")).toBe("error text");
    expect(getSelectErrorMessage({ details: "detail text" }, "fallback")).toBe("detail text");
    expect(getSelectErrorMessage({ message: "message text" }, "fallback")).toBe("message text");
    expect(getSelectErrorMessage({}, "fallback")).toBe("fallback");
  });

  it("stores document selection and emits route events", async () => {
    const { runtime } = createRuntime();
    const service = createSelectService(runtime);
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });

    service.setDocumentSelected(true);
    service.setPageCount(7);
    await service.emitRoute(file);
    service.showSettings();

    expect(runtime.store.set).toHaveBeenCalledWith("documentSelected", true);
    expect(runtime.store.set).toHaveBeenCalledWith("numOfPages", 7);
    expect(runtime.eventBus.emitAsync).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "session", file },
    );
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(runtime.events.showChoices);
  });

  it("clears document selection", () => {
    const { runtime } = createRuntime({ documentSelected: true });
    const service = createSelectService(runtime);

    service.clear();

    expect(runtime.store.set).toHaveBeenCalledWith("documentSelected", false);
  });
});
