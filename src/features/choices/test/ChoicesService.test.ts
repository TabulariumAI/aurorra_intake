import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChoicesService, loadSessionData, normalizeBackendChoices } from "../service/ChoicesService";
import type { WorkflowSettings } from "../type/choices.types";
import { createStoreAdapter } from "../../../store/adapter/storeAdapter";
import { storeApi } from "../../../store/state/store";

beforeEach(() => storeApi.getState().resetAllState());

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
    const runtime = {
      authToken: "token-1",
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
    expect(runtime.dataWorkerClient.load).toHaveBeenCalledTimes(2);
    expect(storeApi.getState().choicesBySession).toEqual({
      "session-1": loaded,
    });
  });

  it("refreshes choices while keeping other sessions", async () => {
    const runtime = {
      authToken: "token-1",
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
    expect(runtime.dataWorkerClient.load).toHaveBeenNthCalledWith(3, "token-1", "session-a");
    expect(runtime.dataWorkerClient.load).toHaveBeenCalledTimes(3);
    expect(storeApi.getState().choicesBySession).toEqual({
      "session-a": sessionA,
      "session-b": sessionB,
    });
  });

  it.each([
    { cached: null },
    { cached: [{ service: "Recognition", level: 5 }] },
    { cached: { items: [{ service: "Recognition", level: 5 }], jurisdiction: "California, Los Angeles County" } },
  ])("replaces cached choices $cached with normalized backend values", async ({ cached }) => {
    const runtime = {
      authToken: "token-1",
      dataWorkerClient: { load: vi.fn(async () => ({
        items: [
          { service: "Recognition", level: "Level2" },
          { service: "TransactionIndexing", level: 0 },
        ],
        jurisdiction: "Texas, Harris County",
      })) },
    };

    storeApi.getState().setValue("choicesBySession", { "session-1": cached });
    const choices = await loadSessionData(runtime, "session-1");

    expect(choices?.items).toHaveLength(17);
    expect(choices?.items).toContainEqual({ service: "Recognition", level: 2 });
    expect(choices?.items).toContainEqual({ service: "TransactionIndexing", level: 0 });
    expect(choices?.items).toContainEqual({ service: "EndorsementIndexing", level: 1 });
    expect(choices?.jurisdiction).toBe("Texas, Harris County");
    expect(runtime.dataWorkerClient.load).toHaveBeenCalledExactlyOnceWith("token-1", "session-1");
    expect(storeApi.getState().choicesBySession).toEqual({ "session-1": choices });
  });

  it("reloads backend changes for the same session", async () => {
    const runtime = {
      authToken: "token-1",
      dataWorkerClient: { load: vi.fn()
        .mockResolvedValueOnce({ items: [{ service: "Recognition", level: 2 }], jurisdiction: "Texas, Harris County" })
        .mockResolvedValueOnce({ items: [{ service: "Recognition", level: 6 }], jurisdiction: null }) },
    };

    await loadSessionData(runtime, "session-1");
    const latest = await loadSessionData(runtime, "session-1");

    expect(latest?.items).toContainEqual({ service: "Recognition", level: 6 });
    expect(latest?.jurisdiction).toBeNull();
    expect(storeApi.getState().choicesBySession).toEqual({ "session-1": latest });
    expect(runtime.dataWorkerClient.load).toHaveBeenCalledTimes(2);
  });

  it("returns missing backend choices instead of cached defaults", async () => {
    const runtime = {
      authToken: "token-1",
      dataWorkerClient: { load: vi.fn(async () => null) },
    };

    storeApi.getState().setValue("choicesBySession", { "session-1": [{ service: "Recognition", level: 5 }] });
    await expect(loadSessionData(runtime, "session-1")).resolves.toBeNull();
    expect(storeApi.getState().choicesBySession).toEqual({ "session-1": null });
    expect(runtime.dataWorkerClient.load).toHaveBeenCalledExactlyOnceWith("token-1", "session-1");
  });

  it("propagates backend failure without returning or replacing cached choices", async () => {
    const cached = { "session-1": [{ service: "Recognition", level: 5 }] };
    const error = new Error("Choices request failed");
    const runtime = {
      authToken: "token-1",
      dataWorkerClient: { load: vi.fn().mockRejectedValue(error) },
    };

    storeApi.getState().setValue("choicesBySession", cached);
    await expect(loadSessionData(runtime, "session-1")).rejects.toBe(error);
    expect(storeApi.getState().choicesBySession).toEqual(cached);
  });

  it("saves choices and workflow and reports actual changes", () => {
    const runtime = {
      store: createStoreAdapter(),
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
    expect(storeApi.getState().indexChoices).toEqual(choices);
    expect(storeApi.getState().workflow).toEqual(workflow);
    expect(service.save(choices, workflow, null).changed).toBe(false);
  });
});
