import { describe, expect, it, vi } from "vitest";
import { createSessionService, loadSession, validateSessionDocument } from "../service/SessionService";
import type { SessionRuntime } from "../type/session.types";
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
    userToken: { token: "token-1" },
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
    reset: vi.fn((key: StateKey) => {
      (values as Record<StateKey, unknown>)[key] = null;
    }),
    set: vi.fn(<Key extends StateKey>(key: Key, value: StoreValues[Key]) => {
      values[key] = value;
    }),
  } as unknown as StoreAdapter;
}

function createRuntime(seed: Partial<StoreValues> = {}) {
  const store = createStore(seed);
  const emit = vi.fn();
  const receive = vi.fn();
  const runtime: SessionRuntime = {
    alert: { format: vi.fn((message) => `formatted:${message.code}`) },
    messages: {
      DOC_START_NO_DOCUMENT: { code: "DOC_START_NO_DOCUMENT" },
      INV_FILE_FMT: { code: "INV_FILE_FMT" },
      TIFF_NOT_VALID: { code: "TIFF_NOT_VALID" },
    },
    eventBus: { emit },
    events: {
      reRoute: { detail: { stage: "stage", file: "file" } },
    },
    store,
    progress: { receive, reset: vi.fn() },
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
  };

  return { emit, receive, runtime, store };
}

describe("SessionService", () => {
  it("exposes only the used session operations", () => {
    const { runtime } = createRuntime();

    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(createSessionService(runtime)))).toEqual([
      "constructor",
      "process",
      "setSession",
    ]);
  });

  it("validates supported PDF and TIFF documents", () => {
    const { runtime } = createRuntime();

    expect(validateSessionDocument(runtime, { name: "doc.pdf", type: "application/pdf" })).toBe("pdf");
    expect(validateSessionDocument(runtime, { name: "doc.tiff", type: "image/tiff" })).toBe("tiff");
    expect(() => validateSessionDocument(runtime, { name: "doc.txt", type: "text/plain" })).toThrow("formatted:INV_FILE_FMT");
    expect(() => validateSessionDocument(runtime, { name: "doc.tif", type: "application/octet-stream" })).toThrow("formatted:TIFF_NOT_VALID");
  });

  it("creates a session, stores runtime values, and reroutes to upload", async () => {
    const { emit, receive, runtime, store } = createRuntime();
    const service = createSessionService(runtime);
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });

    await service.process(file, "job-1");

    expect(runtime.sessionWorkerClient.newSession).toHaveBeenCalledWith("token-1");
    expect(store.set).toHaveBeenCalledWith("session", "session-1");
    expect(store.set).toHaveBeenCalledWith("sasToken", "sas-1");
    expect(store.set).toHaveBeenCalledWith("baseUrl", "https://storage.test");
    expect(store.set).toHaveBeenCalledWith("document", "session-1.pdf");
    expect(receive).toHaveBeenCalledWith({
      jobId: "job-1",
      message: "Creating a session",
      phase: "completed",
    });
    expect(emit).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "upload", file },
    );
  });

  it("fails the supplied session job when session creation fails", async () => {
    const { emit, receive, runtime } = createRuntime();
    const service = createSessionService(runtime);
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });
    vi.mocked(runtime.sessionWorkerClient.newSession).mockRejectedValueOnce(new Error("Session API failed."));

    await service.process(file, "job-2");

    expect(receive).toHaveBeenCalledWith({
      error: "Session API failed.",
      jobId: "job-2",
      message: "Creating a session",
      phase: "failed",
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it("stores existing session data", async () => {
    const { receive, runtime, store } = createRuntime();
    const service = createSessionService(runtime);

    await expect(service.setSession("session-2")).resolves.toEqual({
      baseUrl: "https://storage-2.test",
      document: "session-2.pdf",
      sasToken: "sas-2",
      session: "session-2",
    });

    expect(runtime.sessionWorkerClient.sessionData).toHaveBeenCalledWith("token-1", "session-2");
    expect(store.set).toHaveBeenCalledWith("document", "session-2.pdf");
    expect(receive).not.toHaveBeenCalled();
  });

  it("loads existing session data through the package API", async () => {
    const { runtime, store } = createRuntime();

    await expect(loadSession(runtime, "session-2")).resolves.toEqual({
      baseUrl: "https://storage-2.test",
      document: "session-2.pdf",
      sasToken: "sas-2",
      session: "session-2",
    });

    expect(runtime.sessionWorkerClient.sessionData).toHaveBeenCalledWith("token-1", "session-2");
    expect(store.set).toHaveBeenCalledWith("session", "session-2");
  });

});
