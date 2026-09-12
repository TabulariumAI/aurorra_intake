import { describe, expect, it, vi } from "vitest";
import { createProvisionService } from "../service/ProvisionService";
import type { ProvisionRuntime } from "../type/provision.types";
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
    session: "session-1",
    sasToken: null,
    baseUrl: null,
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
  const restart = vi.fn();
  const runtime: ProvisionRuntime = {
    alert: { format: vi.fn((message) => `formatted:${String(message)}`) },
    messages: {
      SESSION_MISSING: "session missing",
      DOCUMENT_MISSING: "document missing",
    },
    eventBus: { emit: vi.fn() },
    events: {
      reRoute: { detail: { stage: "stage" } },
    },
    store: createStore(seed),
    progress: { receive, reset: vi.fn() },
    restart,
    provisionWorkerClient: {
      provision: vi.fn(async () => ({
        page_num: "4",
        description: "Document accepted",
        accepted: true,
      })),
    },
  };

  return { receive, restart, runtime };
}

describe("ProvisionService", () => {
  it("exposes only the used process operation", () => {
    const { runtime } = createRuntime();

    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(createProvisionService(runtime)))).toEqual([
      "constructor",
      "process",
    ]);
  });

  it("screens the document and adds the confirmation details to progress", async () => {
    const { receive, runtime } = createRuntime();
    const service = createProvisionService(runtime);

    await service.process();

    expect(runtime.provisionWorkerClient.provision).toHaveBeenCalledWith("token-1", "session-1", "session-1.pdf");
    expect(runtime.store.set).toHaveBeenCalledWith("numOfPages", 4);
    expect(receive.mock.calls.map(([event]) => event.phase)).toEqual(["started", "completed", "started", "completed"]);
    expect(receive.mock.calls.map(([event]) => event.message)).toEqual([
      "Reviewing your document",
      "Reviewing your document",
      "Screening complete",
      "Screening complete",
    ]);
    expect(receive.mock.calls[0][0].jobId).toBe(receive.mock.calls[1][0].jobId);
    expect(receive.mock.calls[3][0]).toMatchObject({
      detail: {
        description: "Document accepted",
        summary: "A comprehensive analysis of this document will now be performed to classify and extract all required information.",
      },
      message: "Screening complete",
      phase: "completed",
    });
    expect(receive.mock.calls[3][0].actions.map((action: { label: string }) => action.label)).toEqual([
      "Continue",
      "Cancel and Restart",
    ]);
  });

  it("records confirmation before rerouting to indexing", async () => {
    const { receive, runtime } = createRuntime();
    const service = createProvisionService(runtime);

    await service.process();
    await receive.mock.calls[3][0].actions[0].onConfirm();

    expect(runtime.eventBus.emit).toHaveBeenCalledWith(
      runtime.events.reRoute,
      { stage: "indexing" },
    );
    expect(receive.mock.calls.slice(-2).map(([event]) => [event.message, event.phase, event.detail])).toEqual([
      ["Screening complete", "completed", undefined],
      ["Confirmation received", "completed", undefined],
    ]);
  });

  it("cancels screening by starting a new session", async () => {
    const { receive, restart, runtime } = createRuntime();
    const service = createProvisionService(runtime);

    await service.process();
    receive.mock.calls[3][0].actions[1].onConfirm();

    expect(restart).toHaveBeenCalledTimes(1);
  });

  it("keeps an invalid provision response in the progress timeline", async () => {
    const { receive, runtime } = createRuntime();
    runtime.provisionWorkerClient.provision = vi.fn(async () => ({ pageNum: "bad" }));
    const service = createProvisionService(runtime);

    await expect(service.process()).resolves.toBeUndefined();
    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({
      error: "Invalid provision response",
      message: "Reviewing your document",
      phase: "failed",
    }));
    expect(runtime.eventBus.emit).not.toHaveBeenCalled();
  });

  it("keeps the review message when screening fails", async () => {
    const { receive, runtime } = createRuntime();
    runtime.provisionWorkerClient.provision = vi.fn(async () => {
      throw { error: "Screening unavailable" };
    });
    const service = createProvisionService(runtime);

    await service.process();

    expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({
      error: "Screening unavailable",
      message: "Reviewing your document",
      phase: "failed",
    }));
  });
});
