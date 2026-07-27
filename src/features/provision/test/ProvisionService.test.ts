import { describe, expect, it, vi } from "vitest";
import { createProvisionService } from "../service/ProvisionService";
import type { IntakeShellActions } from "../../intake/type/intakeShell.types";
import type { ProvisionReviewOptions, ProvisionRuntime } from "../type/provision.types";
import type { StateKey, StoreAdapter, StoreValues } from "../../../store/type/store.types";

function createStore(seed: Partial<StoreValues> = {}): StoreAdapter {
  const values: StoreValues = {
    isSessionInProcess: false,
    uploadingStepStatus: false,
    documentSelected: false,
    provisionStepStatus: false,
    indexingStepStatus: false,
    userToken: { token: "token-1" },
    session: "session-1",
    sasToken: null,
    baseUrl: null,
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
  };
}

function createRuntime(seed: Partial<StoreValues> = {}) {
  const shell = createShell();
  const onJobEvent = vi.fn();
  let reviewOptions: ProvisionReviewOptions | null = null;
  const runtime: ProvisionRuntime = {
    alert: { format: vi.fn((message) => `formatted:${String(message)}`) },
    messages: {
      SESSION_MISSING: "session missing",
      DOCUMENT_MISSING: "document missing",
      ERR_ACT: { args: { action: "action" } },
    },
    eventBus: { emit: vi.fn() },
    events: {
      showAlert: { name: "showAlert" },
      newSession: { name: "newSession" },
      reRoute: { detail: { stage: "stage" } },
    },
    store: createStore(seed),
    intake: {
      actions: shell,
      provisionHost: document.createElement("section"),
    },
    onJobEvent,
    onCanceled: vi.fn(),
    provisionWorkerClient: {
      provision: vi.fn(async () => ({
        page_num: "4",
        description: "Document accepted",
        accepted: true,
      })),
      provisionData: vi.fn(),
    },
    createReview: vi.fn((_container, options) => {
      reviewOptions = options;
      return { dispose: vi.fn() };
    }),
  };

  return { onJobEvent, runtime, reviewOptions: () => reviewOptions, shell };
}

describe("ProvisionService", () => {
  it("screens the document, stores page count, and renders review", async () => {
    const { onJobEvent, runtime, reviewOptions, shell } = createRuntime();
    const service = createProvisionService(runtime, { setState: vi.fn() });
    const file = new File(["pdf"], "source.pdf", { type: "application/pdf" });

    await service.process(file);

    expect(runtime.provisionWorkerClient.provision).toHaveBeenCalledWith("token-1", "session-1", "session-1.pdf");
    expect(runtime.store.set).toHaveBeenCalledWith("numOfPages", 4);
    expect(runtime.createReview).toHaveBeenCalledWith(runtime.intake.provisionHost, expect.objectContaining({
      description: "Document accepted",
      accepted: true,
      document: file,
    }));
    expect(shell.showProvision).toHaveBeenCalledWith("", "");
    expect(onJobEvent.mock.calls.map(([event]) => event.phase)).toEqual(["started", "completed"]);
    expect(onJobEvent.mock.calls[0][0].jobId).toBe(onJobEvent.mock.calls[1][0].jobId);
  });

  it("continues from review by rerouting to indexing", async () => {
    const { runtime, reviewOptions, shell } = createRuntime();
    const service = createProvisionService(runtime, { setState: vi.fn() });

    await service.process(new File(["pdf"], "source.pdf", { type: "application/pdf" }));
    await reviewOptions()?.onContinue("session-1.pdf");

    expect(shell.showSelect).toHaveBeenCalledWith("", "");
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "indexing" },
    );
  });

  it("cancels review by starting a new session", async () => {
    const { runtime, reviewOptions, shell } = createRuntime();
    const service = createProvisionService(runtime, { setState: vi.fn() });

    await service.process(new File(["pdf"], "source.pdf", { type: "application/pdf" }));
    reviewOptions()?.onCancel();

    expect(shell.showSelect).toHaveBeenCalledWith("", "");
    expect(runtime.onCanceled).toHaveBeenCalledTimes(1);
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(runtime.events.newSession, undefined);
  });

  it("throws and alerts when the provision response is invalid", async () => {
    const { runtime } = createRuntime();
    runtime.provisionWorkerClient.provision = vi.fn(async () => ({ pageNum: "bad" }));
    const service = createProvisionService(runtime, { setState: vi.fn() });

    await expect(service.process(new File(["pdf"], "source.pdf", { type: "application/pdf" }))).rejects.toThrow("Invalid provision response");
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(
      runtime.events.showAlert,
      { message: "Invalid provision response" },
    );
  });
});
