import { describe, expect, it, vi } from "vitest";
import { createChoicesService, normalizeBackendChoices } from "../service/ChoicesService";
import type { ChoicesRuntime } from "../type/choices.types";
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
    userToken: { token: "token-1" },
    session: null,
    sasToken: null,
    baseUrl: null,
    document: null,
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

describe("ChoicesService", () => {
  it("normalizes backend choice payloads", () => {
    const items = [{ service: "Recognition", level: 5 }];

    expect(normalizeBackendChoices(null)).toBeNull();
    expect(normalizeBackendChoices(items)).toBe(items);
    expect(normalizeBackendChoices({ items })).toEqual(items);
    expect(normalizeBackendChoices({})).toEqual([]);
  });

  it("loads and retains session choices with runtime auth token", async () => {
    const onJobEvent = vi.fn();
    const runtime: ChoicesRuntime = {
      store: createStore(),
    eventBus: { emit: vi.fn() },
      events: { showChoices: { name: "showChoices" }, toggleLayout: { name: "toggleLayout" }, updateChoices: { name: "updateChoices" } },
      dataWorkerClient: {
        load: vi.fn(async () => ({ items: [{ service: "Recognition", level: 5 }] })),
      },
      onJobEvent,
    };
    const service = createChoicesService(runtime);

    await expect(service.load("session-1")).resolves.toEqual([{ service: "Recognition", level: 5 }]);
    await expect(service.load("session-1")).resolves.toEqual([{ service: "Recognition", level: 5 }]);
    expect(runtime.dataWorkerClient.load).toHaveBeenCalledWith("token-1", "session-1");
    expect(runtime.dataWorkerClient.load).toHaveBeenCalledTimes(1);
    expect(runtime.store.set).toHaveBeenCalledWith("choicesBySession", {
      "session-1": [{ service: "Recognition", level: 5 }],
    });
    expect(onJobEvent.mock.calls.map(([event]) => event.phase)).toEqual(["started", "completed"]);
    expect(onJobEvent.mock.calls[0][0].jobId).toBe(onJobEvent.mock.calls[1][0].jobId);
  });

  it("saves choices, workflow, and emits update only when values change", () => {
    const runtime: ChoicesRuntime = {
      store: createStore(),
    eventBus: { emit: vi.fn() },
      events: { showChoices: { name: "showChoices" }, toggleLayout: { name: "toggleLayout" }, updateChoices: { name: "updateChoices" } },
      dataWorkerClient: {
        load: vi.fn(),
      },
    };
    const service = createChoicesService(runtime);
    const choices = [{ service: "Recognition", level: 4 }];

    expect(service.save(choices, true, false)).toEqual({
      choices,
      alwaysReview: true,
      studioModeEnabled: false,
      changed: true,
    });
    expect(runtime.store.set).toHaveBeenCalledWith("indexChoices", choices);
    expect(runtime.store.set).toHaveBeenCalledWith("workflow", true);
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(runtime.events.updateChoices);
    return new Promise<void>((resolve) => {
      queueMicrotask(() => {
        expect(runtime.eventBus.emit).toHaveBeenCalledWith(runtime.events.toggleLayout, {
          studioModeEnabled: false,
        });
        resolve();
      });
    });
  });
});
