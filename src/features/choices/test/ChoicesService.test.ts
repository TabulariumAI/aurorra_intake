import { describe, expect, it, vi } from "vitest";
import { createChoicesService, loadSessionData, normalizeBackendChoices } from "../service/ChoicesService";
import { DEFAULT_WORKFLOW_SETTINGS } from "../service/choicesData";
import type { ChoicesRuntime, WorkflowSettings } from "../type/choices.types";
import type { StateKey, StoreAdapter, StoreValues } from "../../../store/type/store.types";

function createStore(seed: Partial<StoreValues> = {}): StoreAdapter {
  const values: StoreValues = {
    jurisdiction: null,
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
    reset: vi.fn(),
    set: vi.fn(<Key extends StateKey>(key: Key, value: StoreValues[Key]) => {
      values[key] = value;
    }),
  } as unknown as StoreAdapter;
}

describe("ChoicesService", () => {
  it("normalizes backend choice payloads", () => {
    const normalized = normalizeBackendChoices({
      items: [
        { service: "Recognition", level: "Level3" },
        { service: "EndorsementIndexing", level: "Level1" },
        { service: "MonetaryInfoIndexing", level: 0 },
      ],
    });

    expect(normalizeBackendChoices(null)).toBeNull();
    expect(normalized?.items).toHaveLength(17);
    expect(normalized?.items).toContainEqual({ service: "Recognition", level: 3 });
    expect(normalized?.items).toContainEqual({ service: "EndorsementIndexing", level: 1 });
    expect(normalized?.items).toContainEqual({ service: "MonetaryInfoIndexing", level: 0 });
    expect(normalized?.items).toContainEqual({ service: "RecitalIndexing", level: 1 });
    expect(normalized?.items.every((choice) => typeof choice.level === "number")).toBe(true);
  });

  it("loads and retains session choices with runtime auth token", async () => {
    const runtime: ChoicesRuntime = {
      store: createStore(),
      eventBus: { emit: vi.fn() },
      events: { showChoices: { name: "showChoices" }, updateChoices: { name: "updateChoices" } },
      dataWorkerClient: {
        load: vi.fn(async () => ({ items: [{ service: "Recognition", level: "Level4" }] })),
      },
    };
    const loaded = await loadSessionData(runtime, "session-1");
    await expect(loadSessionData(runtime, "session-1")).resolves.toEqual(loaded);
    expect(loaded?.items).toHaveLength(17);
    expect(loaded?.items).toContainEqual({ service: "Recognition", level: 4 });
    expect(loaded?.items).toContainEqual({ service: "MonetaryInfoIndexing", level: 0 });
    expect(runtime.dataWorkerClient.load).toHaveBeenCalledWith("token-1", "session-1");
    expect(runtime.dataWorkerClient.load).toHaveBeenCalledTimes(1);
    expect(runtime.store.set).toHaveBeenCalledWith("choicesBySession", {
      "session-1": loaded,
    });
  });

  it("keeps cached choices with their session", async () => {
    const runtime: ChoicesRuntime = {
      store: createStore(),
      eventBus: { emit: vi.fn() },
      events: { showChoices: { name: "showChoices" }, updateChoices: { name: "updateChoices" } },
      dataWorkerClient: {
        load: vi.fn(async (_token: string, session: string) => ({
          items: [{ service: "Recognition", level: session === "session-a" ? "Level2" : "Level4" }],
        })),
      },
    };
    const sessionA = await loadSessionData(runtime, "session-a");
    const sessionB = await loadSessionData(runtime, "session-b");
    await expect(loadSessionData(runtime, "session-a")).resolves.toEqual(sessionA);

    expect(sessionA?.items).toContainEqual({ service: "Recognition", level: 2 });
    expect(sessionB?.items).toContainEqual({ service: "Recognition", level: 4 });

    expect(runtime.dataWorkerClient.load).toHaveBeenNthCalledWith(1, "token-1", "session-a");
    expect(runtime.dataWorkerClient.load).toHaveBeenNthCalledWith(2, "token-1", "session-b");
    expect(runtime.dataWorkerClient.load).toHaveBeenCalledTimes(2);
    expect(runtime.store.set).toHaveBeenLastCalledWith("choicesBySession", {
      "session-a": sessionA,
      "session-b": sessionB,
    });
  });

  it("normalizes stored session choices before providing them", async () => {
    const runtime: ChoicesRuntime = {
      store: createStore({
        choicesBySession: {
          "session-1": [
            { service: "Recognition", level: "Level2" },
            { service: "TransactionIndexing", level: 0 },
          ],
        },
      }),
      eventBus: { emit: vi.fn() },
      events: { showChoices: { name: "showChoices" }, updateChoices: { name: "updateChoices" } },
      dataWorkerClient: { load: vi.fn() },
    };

    const choices = await loadSessionData(runtime, "session-1");

    expect(choices?.items).toHaveLength(17);
    expect(choices?.items).toContainEqual({ service: "Recognition", level: 2 });
    expect(choices?.items).toContainEqual({ service: "TransactionIndexing", level: 0 });
    expect(choices?.items).toContainEqual({ service: "EndorsementIndexing", level: 1 });
    expect(runtime.dataWorkerClient.load).not.toHaveBeenCalled();
    expect(runtime.store.set).toHaveBeenCalledWith("choicesBySession", { "session-1": choices });
  });

  it("saves choices, workflow, and emits update only when values change", () => {
    const runtime: ChoicesRuntime = {
      store: createStore(),
      eventBus: { emit: vi.fn() },
      events: { showChoices: { name: "showChoices" }, updateChoices: { name: "updateChoices" } },
      dataWorkerClient: {
        load: vi.fn(),
      },
    };
    const service = createChoicesService(runtime);
    const choices = [{ service: "Recognition", level: 4 }];

    const workflow: WorkflowSettings = [
      { name: "Review", label: "Review Before Index", value: false },
      { name: "Redact", label: "Redact document", value: true },
      { name: "Manifest", label: "Generate manifest", value: true },
      { name: "Record", label: "Endorse document", value: true },
      { name: "Abstract", label: "Analyze document", value: true },
    ];

    expect(service.save(choices, workflow, null)).toEqual({
      choices,
      workflow,
      jurisdiction: null,
      changed: true,
    });
    expect(runtime.store.set).toHaveBeenCalledWith("indexChoices", choices);
    expect(runtime.store.set).toHaveBeenCalledWith("workflow", workflow);
    expect(runtime.eventBus.emit).toHaveBeenCalledWith(runtime.events.updateChoices);
    expect(runtime.eventBus.emit).toHaveBeenCalledTimes(1);
  });
});
