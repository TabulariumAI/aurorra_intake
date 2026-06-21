import { describe, expect, it, vi } from "vitest";
import { createSessionService, validateSessionDocument } from "../service/SessionService";
import type { IntakeShellActions } from "../../intake/type/intakeShell.types";
import type { SessionRuntime } from "../type/session.types";
import type { StateKey, StoreAdapter, StoreValues } from "../../../store/type/store.types";

function createStore(seed: Partial<StoreValues> = {}): StoreAdapter {
  const values: StoreValues = {
    isSessionInProcess: false,
    uploadingStepStatus: false,
    documentSelected: false,
    provisionStepStatus: false,
    indexingStepStatus: false,
    userToken: { token: "token-1" },
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
    reset: vi.fn((key: StateKey) => {
      (values as Record<StateKey, unknown>)[key] = null;
    }),
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
  const store = createStore(seed);
  const emit = vi.fn();
  const shell = createShell();
  const runtime: SessionRuntime = {
    alert: { format: vi.fn((message) => `formatted:${message.code}`) },
    messages: {
      DOC_START_NO_DOCUMENT: { code: "DOC_START_NO_DOCUMENT" },
      INV_FILE_FMT: { code: "INV_FILE_FMT" },
      TIFF_NOT_VALID: { code: "TIFF_NOT_VALID" },
      ERR_ACT: { code: "ERR_ACT", args: { action: "action" } },
    },
    eventBus: { emit },
    events: {
      reRoute: { detail: { stage: "stage", file: "file" } },
      showAlert: { name: "showAlert" },
    },
    store,
    intakeShell: shell,
    sessionWorkerClient: {
      newSession: vi.fn(async () => ({
        session: "session-1",
        sas_token: "sas-1",
        base_url: "https://storage.test",
      })),
      sessionData: vi.fn(async () => ({
        session: "session-2",
        sas_token: "sas-2",
        base_url: "https://storage-2.test",
      })),
      setTags: vi.fn(),
      summary: vi.fn(),
    },
    loadChoices: vi.fn(async () => ({ items: [{ service: "Recognition", level: 5 }] })),
  };

  return { emit, runtime, shell, store };
}

describe("SessionService", () => {
  it("validates supported PDF and TIFF documents", () => {
    const { runtime } = createRuntime();

    expect(validateSessionDocument(runtime, { name: "doc.pdf", type: "application/pdf" })).toBe("pdf");
    expect(validateSessionDocument(runtime, { name: "doc.tiff", type: "image/tiff" })).toBe("tiff");
    expect(() => validateSessionDocument(runtime, { name: "doc.txt", type: "text/plain" })).toThrow("formatted:INV_FILE_FMT");
    expect(() => validateSessionDocument(runtime, { name: "doc.tif", type: "application/octet-stream" })).toThrow("formatted:TIFF_NOT_VALID");
  });

  it("creates a session, stores runtime values, and reroutes to upload", async () => {
    const { emit, runtime, shell, store } = createRuntime();
    const service = createSessionService(runtime, { setState: vi.fn() });
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });

    await service.process(file);

    expect(runtime.sessionWorkerClient.newSession).toHaveBeenCalledWith("token-1");
    expect(store.set).toHaveBeenCalledWith("session", "session-1");
    expect(store.set).toHaveBeenCalledWith("sasToken", "sas-1");
    expect(store.set).toHaveBeenCalledWith("baseUrl", "https://storage.test");
    expect(store.set).toHaveBeenCalledWith("document", "session-1.pdf");
    expect(shell.progress.showOverlay).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "upload", file },
    );
  });

  it("stores existing session data and normalized choices", async () => {
    const { runtime, store } = createRuntime();
    const service = createSessionService(runtime, { setState: vi.fn() });

    await service.setSession("session-2");

    expect(runtime.loadChoices).toHaveBeenCalledWith("session-2");
    expect(runtime.sessionWorkerClient.sessionData).toHaveBeenCalledWith("token-1", "session-2");
    expect(store.set).toHaveBeenCalledWith("indexChoices", [{ service: "Recognition", level: 5 }]);
    expect(store.set).toHaveBeenCalledWith("document", "session-2.pdf");
  });

  it("clears persisted session values and progress state", () => {
    const { runtime, shell, store } = createRuntime();
    const service = createSessionService(runtime, { setState: vi.fn() });

    service.clear();

    expect(store.reset).toHaveBeenCalledWith("baseUrl");
    expect(store.reset).toHaveBeenCalledWith("sasToken");
    expect(store.reset).toHaveBeenCalledWith("session");
    expect(store.reset).toHaveBeenCalledWith("numOfPages");
    expect(shell.progress.endProcessing).toHaveBeenCalledTimes(1);
    expect(shell.progress.hideOverlay).toHaveBeenCalledTimes(1);
  });
});
