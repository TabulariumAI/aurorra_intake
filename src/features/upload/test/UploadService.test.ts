import { describe, expect, it, vi } from "vitest";
import { createUploadService, resolveUploadContext } from "../service/UploadService";
import type { IntakeShellActions } from "../../intake/type/intakeShell.types";
import type { UploadRuntime } from "../type/upload.types";
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
    sasToken: "sas-1",
    baseUrl: "https://storage.test",
    document: "session-1.pdf",
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
  const runtime: UploadRuntime = {
    alert: { format: vi.fn((message) => `formatted:${String(message)}`) },
    messages: {
      UPLOAD_TOKEN_MISSING: "token missing",
      UPLOAD_BASEURL_MISSING: "base url missing",
      UPLOAD_DOCNAME_MISSING: "document missing",
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
    intakeShell: shell,
    uploadWorkerClient: {
      upload: vi.fn(async () => undefined),
    },
  };

  return { runtime, shell };
}

describe("UploadService", () => {
  it("resolves upload context from stored SAS, base URL, and document path", () => {
    const { runtime } = createRuntime();

    expect(resolveUploadContext(runtime)).toEqual({
      sasToken: "sas-1",
      baseUrl: "https://storage.test",
      docName: "session-1.pdf",
    });
  });

  it("uploads the selected document and reroutes to provision", async () => {
    const { runtime, shell } = createRuntime();
    const setState = vi.fn();
    const service = createUploadService(runtime, { setState });
    const file = new File(["pdf"], "source.pdf", { type: "application/pdf" });

    await service.process(file);

    expect(runtime.uploadWorkerClient.upload).toHaveBeenCalledWith({
      sasToken: "sas-1",
      baseUrl: "https://storage.test",
      file,
      path: "session-1.pdf",
    });
    expect(shell.progress.notify).toHaveBeenCalledWith("Uploading document...");
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "provision", file },
    );
    expect(setState).toHaveBeenLastCalledWith({ isProcessing: false, lastError: null });
  });

  it("emits an alert and new-session close handler on upload failure", async () => {
    const { runtime } = createRuntime();
    runtime.uploadWorkerClient.upload = vi.fn(async () => {
      throw { error: "Upload failed" };
    });
    const service = createUploadService(runtime, { setState: vi.fn() });

    await service.process(new File(["pdf"], "source.pdf", { type: "application/pdf" }));

    expect(runtime.eventBus.emit).toHaveBeenCalledWith(
      runtime.events.showAlert,
      expect.objectContaining({ message: "Upload failed" }),
    );
  });
});
