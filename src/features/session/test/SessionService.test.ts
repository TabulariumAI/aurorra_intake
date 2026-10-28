import { describe, expect, it, vi } from "vitest";
import { createSessionService, loadSession, validateSessionDocument } from "../service/SessionService";
import type { SessionRuntime } from "../type/session.types";
import type { StateKey, StoreAdapter, StoreValues } from "../../../store/type/store.types";
import { storeApi } from "../../../store/state/store";

function createStore(seed: Partial<StoreValues> = {}): StoreAdapter {
  const values: StoreValues = {
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
    onCreated: vi.fn(async () => undefined),
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
  it("registers the created session before allowing upload to start", async () => {
    const { runtime, emit, receive } = createRuntime();
    let commit!: () => void;
    vi.mocked(runtime.onCreated!).mockImplementation(() => new Promise<void>(resolve => { commit = resolve; }));
    const service = createSessionService(runtime);
    const processing = service.process(new File(["pdf"], "document.pdf", { type: "application/pdf" }), "job");
    await vi.waitFor(() => expect(runtime.onCreated).toHaveBeenCalledWith("session-1"));
    expect(emit).not.toHaveBeenCalled();
    expect(receive).not.toHaveBeenCalled();
    commit();
    await processing;
    expect(emit).toHaveBeenCalledWith(runtime.events.reRoute, expect.objectContaining({ stage: "upload" }));
  });

  it("keeps the original session ID and stops upload when registration fails", async () => {
    const { runtime, emit, receive, store } = createRuntime();
    vi.mocked(runtime.onCreated!).mockRejectedValueOnce(new Error("Registration failed"));
    await createSessionService(runtime).process(new File(["pdf"], "document.pdf", { type: "application/pdf" }), "job");
    expect(store.get("session")).toBe("session-1");
    expect(emit).not.toHaveBeenCalled();
    expect(receive).toHaveBeenCalledWith(expect.objectContaining({ phase: "failed", error: "Registration failed" }));
  });
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

  it("offers the original failure to the host before displaying progress errors", async () => {
    const { runtime, receive, emit, store } = createRuntime();
    const error = Object.assign(new Error("JWT decode error: ExpiredSignature"), {
      status: 401,
      code: "expired_token",
      details: { source: "session" },
    });
    runtime.onError = vi.fn(() => true);
    vi.mocked(runtime.sessionWorkerClient.newSession).mockRejectedValueOnce(error);

    const service = createSessionService(runtime);
    const file = new File(["pdf"], "document.pdf", { type: "application/pdf" });
    await service.process(file, "expired-job");

    expect(runtime.onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(vi.mocked(runtime.onError).mock.calls[0][0]).toBe(error);
    expect(receive).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(runtime.onCreated).not.toHaveBeenCalled();
    expect(store.get("session")).toBeNull();
    expect(store.get("isSessionInProcess")).toBe(false);

    await service.process(file, "next-job");

    expect(runtime.sessionWorkerClient.newSession).toHaveBeenCalledTimes(2);
    expect(runtime.onError).toHaveBeenCalledTimes(1);
    expect(receive).toHaveBeenCalledExactlyOnceWith({ jobId: "next-job", message: "Creating a session", phase: "completed" });
    expect(emit).toHaveBeenCalledExactlyOnceWith(runtime.events.reRoute, { stage: "upload", file });
  });

  it("keeps unhandled failures in the original progress job", async () => {
    const { runtime, receive, emit, store } = createRuntime();
    const error = Object.assign(new Error("The session service is unavailable."), { status: 503 });
    runtime.onError = vi.fn(() => {
      expect(receive).not.toHaveBeenCalled();
      return false;
    });
    vi.mocked(runtime.sessionWorkerClient.newSession).mockRejectedValueOnce(error);

    await createSessionService(runtime).process(new File(["pdf"], "document.pdf", { type: "application/pdf" }), "failed-job");

    expect(runtime.onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(receive).toHaveBeenCalledExactlyOnceWith({
      error: "The session service is unavailable.",
      jobId: "failed-job",
      message: "Creating a session",
      phase: "failed",
    });
    expect(emit).not.toHaveBeenCalled();
    expect(store.get("isSessionInProcess")).toBe(false);
  });

  it("routes registration failures to the same host handler without starting upload", async () => {
    const { runtime, receive, emit, store } = createRuntime();
    const error = Object.assign(new Error("Sign-in required"), { status: 401 });
    runtime.onError = vi.fn(() => true);
    vi.mocked(runtime.onCreated!).mockRejectedValueOnce(error);

    await createSessionService(runtime).process(new File(["pdf"], "document.pdf", { type: "application/pdf" }), "registration-job");

    expect(runtime.onError).toHaveBeenCalledExactlyOnceWith(error);
    expect(receive).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
    expect(store.get("session")).toBe("session-1");
    expect(store.get("isSessionInProcess")).toBe(false);
  });

  it("stores existing session data", async () => {
    const { receive, runtime } = createRuntime();
    const service = createSessionService(runtime);

    await expect(service.setSession("session-2")).resolves.toEqual({
      baseUrl: "https://storage-2.test",
      document: "session-2.pdf",
      sasToken: "sas-2",
      session: "session-2",
    });

    expect(runtime.sessionWorkerClient.sessionData).toHaveBeenCalledWith("token-1", "session-2");
    expect(storeApi.getState().document).toBe("session-2.pdf");
    expect(receive).not.toHaveBeenCalled();
  });

  it("loads existing session data through the package API", async () => {
    const { runtime } = createRuntime();

    await expect(loadSession({ authToken: "token-1", sessionWorkerClient: runtime.sessionWorkerClient }, "session-2")).resolves.toEqual({
      baseUrl: "https://storage-2.test",
      document: "session-2.pdf",
      sasToken: "sas-2",
      session: "session-2",
    });

    expect(runtime.sessionWorkerClient.sessionData).toHaveBeenCalledWith("token-1", "session-2");
    expect(storeApi.getState().session).toBe("session-2");
  });

});
