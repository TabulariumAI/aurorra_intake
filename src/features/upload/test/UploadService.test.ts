import { describe, expect, it, vi } from "vitest";
import { createUploadService, resolveUploadContext } from "../service/UploadService";
import type { UploadRuntime } from "../type/upload.types";
import type { StateKey, StoreAdapter, StoreValues } from "../../../store/type/store.types";
import { DEFAULT_WORKFLOW_SETTINGS } from "../../choices/service/choicesData";

function withReview(workflowValue: boolean): typeof DEFAULT_WORKFLOW_SETTINGS {
  return DEFAULT_WORKFLOW_SETTINGS.map((setting) => (
    setting.name === "Review" ? { ...setting, value: workflowValue } : setting
  ));
}

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
    sasToken: "sas-1",
    baseUrl: "https://storage.test",
    document: "session-1.pdf",
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
  const runtime: UploadRuntime = {
    alert: { format: vi.fn((message) => `formatted:${String(message)}`) },
    messages: {
      UPLOAD_TOKEN_MISSING: "token missing",
      UPLOAD_BASEURL_MISSING: "base url missing",
      UPLOAD_DOCNAME_MISSING: "document missing",
      SESSION_MISSING: "session missing",
      DOCUMENT_MISSING: "document missing",
    },
    eventBus: { emit: vi.fn() },
    events: {
      reRoute: { detail: { stage: "stage", file: "file" } },
    },
    store: createStore(seed),
    progress: { receive, reset: vi.fn() },
    uploadWorkerClient: {
      upload: vi.fn(async () => undefined),
    },
  };

  return { receive, runtime };
}

describe("UploadService", () => {
  it("exposes only the used process operation", () => {
    const { runtime } = createRuntime();

    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(createUploadService(runtime)))).toEqual([
      "constructor",
      "process",
    ]);
  });

  it("resolves upload context from stored SAS, base URL, and document path", () => {
    const { runtime } = createRuntime({ session: "session-1" });

    expect(resolveUploadContext(runtime)).toEqual({
      sasToken: "sas-1",
      baseUrl: "https://storage.test",
      docName: "session-1.pdf",
      session: "session-1",
    });
  });

  it("uploads the selected document and reroutes to provision when workflow is true", async () => {
    const { receive, runtime } = createRuntime({ session: "session-1", workflow: withReview(true) });
    const service = createUploadService(runtime);
    const file = new File(["pdf"], "source.pdf", { type: "application/pdf" });

    await service.process(file);

    expect(runtime.uploadWorkerClient.upload).toHaveBeenCalledWith({
      sasToken: "sas-1",
      baseUrl: "https://storage.test",
      file,
      path: "session-1.pdf",
    });
    expect(receive.mock.calls.map(([event]) => event.phase)).toEqual(["started", "completed"]);
    expect(receive.mock.calls.map(([event]) => event.message)).toEqual([
      "Uploading your document",
      "Uploading your document",
    ]);
    expect(receive.mock.calls[0][0].jobId).toBe(receive.mock.calls[1][0].jobId);
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "provision", file },
    );
  });

  it.each([false])("bypasses provision when Review workflow is %s", async (workflow) => {
    const { runtime } = createRuntime({ session: "session-1", workflow: withReview(workflow) });
    const service = createUploadService(runtime);
    const file = new File(["pdf"], "source.pdf", { type: "application/pdf" });

    await service.process(file);

    expect(runtime.eventBus.emit).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "indexing" },
    );
  });

  it("preserves the worker message and logs status and response details", async () => {
    const { receive, runtime } = createRuntime({ session: "session-1" });
    const error = Object.assign(new Error("Upload failed with status 403: Forbidden"), {
      status: 403,
      code: "upload_failed",
      details: { errorDetails: "AuthenticationFailed", status: 403 },
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      runtime.uploadWorkerClient.upload = vi.fn().mockRejectedValue(error);
      await createUploadService(runtime).process(new File(["pdf"], "source.pdf", { type: "application/pdf" }));
      expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ error: error.message, phase: "failed" }));
      expect(log).toHaveBeenCalledWith("[Intake:upload]", error);
      expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("keeps upload failure in the progress timeline", async () => {
    const { receive, runtime } = createRuntime({ session: "session-1" });
    runtime.uploadWorkerClient.upload = vi.fn(async () => {
      throw { error: "Upload failed" };
    });
    const service = createUploadService(runtime);

    await service.process(new File(["pdf"], "source.pdf", { type: "application/pdf" }));

    expect(runtime.eventBus.emit).not.toHaveBeenCalled();
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({
      error: "Upload failed",
      message: "Uploading your document",
      phase: "failed",
    }));
  });
});
