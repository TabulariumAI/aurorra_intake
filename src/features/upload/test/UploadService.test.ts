import { describe, expect, it, vi } from "vitest";
import { createUploadService, resolveUploadContext } from "../service/UploadService";
import type { IntakeShellActions } from "../../intake/type/intakeShell.types";
import type { UploadRuntime } from "../type/upload.types";
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
    sasToken: "sas-1",
    baseUrl: "https://storage.test",
    document: "session-1.pdf",
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

function createShell(): IntakeShellActions {
  return {
    showSelect: vi.fn(),
    showProvision: vi.fn(),
    clearHeader: vi.fn(),
  };
}

function createRuntime(seed: Partial<StoreValues> = {}) {
  const shell = createShell();
  const onJobEvent = vi.fn();
  const runtime: UploadRuntime = {
    alert: { format: vi.fn((message) => `formatted:${String(message)}`) },
    messages: {
      UPLOAD_TOKEN_MISSING: "token missing",
      UPLOAD_BASEURL_MISSING: "base url missing",
      UPLOAD_DOCNAME_MISSING: "document missing",
      SESSION_MISSING: "session missing",
      DOCUMENT_MISSING: "document missing",
      ERR_ACT: { args: { action: "action" } },
    },
    eventBus: { emit: vi.fn() },
    events: {
      showAlert: { name: "showAlert" },
      newSession: { name: "newSession" },
      reRoute: { detail: { stage: "stage", file: "file" } },
    },
    store: createStore(seed),
    onJobEvent,
    uploadWorkerClient: {
      upload: vi.fn(async () => undefined),
    },
  };

  return { onJobEvent, runtime, shell };
}

describe("UploadService", () => {
  it("resolves upload context from stored SAS, base URL, and document path", () => {
    const { runtime } = createRuntime({ session: "session-1" });

    expect(resolveUploadContext(runtime)).toEqual({
      sasToken: "sas-1",
      baseUrl: "https://storage.test",
      docName: "session-1.pdf",
      session: "session-1",
    });
  });

  it("uploads the selected document and reroutes to provision", async () => {
    const { onJobEvent, runtime } = createRuntime({ session: "session-1" });
    const service = createUploadService(runtime);
    const file = new File(["pdf"], "source.pdf", { type: "application/pdf" });

    await service.process(file);

    expect(runtime.uploadWorkerClient.upload).toHaveBeenCalledWith({
      sasToken: "sas-1",
      baseUrl: "https://storage.test",
      file,
      path: "session-1.pdf",
    });
    expect(onJobEvent.mock.calls.map(([event]) => event.phase)).toEqual(["started", "completed"]);
    expect(onJobEvent.mock.calls[0][0].jobId).toBe(onJobEvent.mock.calls[1][0].jobId);
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "provision", file },
    );
  });

  it("emits an alert and new-session close handler on upload failure", async () => {
    const { onJobEvent, runtime } = createRuntime({ session: "session-1" });
    runtime.uploadWorkerClient.upload = vi.fn(async () => {
      throw { error: "Upload failed" };
    });
    const service = createUploadService(runtime);

    await service.process(new File(["pdf"], "source.pdf", { type: "application/pdf" }));

    expect(runtime.eventBus.emit).toHaveBeenCalledWith(
      runtime.events.showAlert,
      expect.objectContaining({ message: "Upload failed" }),
    );
    expect(onJobEvent).toHaveBeenLastCalledWith(expect.objectContaining({
      error: "Upload failed",
      message: "Document upload failed",
      phase: "failed",
      session: "session-1",
    }));
  });
});
