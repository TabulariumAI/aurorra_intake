import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../../public-api";
import { storeApi, LOCAL_STATE_STORAGE_KEY } from "../../../store/state/store";
import { ChoiceData, CHOICESTRUCTURE } from "../service/choicesData";

beforeEach(() => storeApi.getState().resetAllState());
afterEach(cleanup);

describe("choices ownership", () => {
  it("does not export the mutable store, adapters, or internal choice machinery", () => {
    for (const name of ["useStore", "intakeStoreApi", "createStoreAdapter", "getStoredInformation", "setRuntimeAuthToken", "CHOICESTRUCTURE", "ChoiceData", "DEFAULT_WORKFLOW_SETTINGS", "normalizeWorkflowSettings", "workflowValue", "createIndexingPayload", "dataLevel"]) {
      expect(api).not.toHaveProperty(name);
    }
  });

  it("exposes reactive domain state without choices or mutation access", () => {
    const { result } = renderHook(() => api.useIntakeState(state => state.canRecord));
    expect(result.current).toBe(true);
    act(() => storeApi.getState().setValue("workflow", [{ name: "Record", label: "Endorse document", value: false }]));
    expect(result.current).toBe(false);
    expect(api.getIntakeState()).toEqual({ session: null, settingsOpen: false, canRecord: false, canRedact: true, canManifest: true });
    expect(api.useIntakeState).not.toHaveProperty("getState");
    expect(api.useIntakeState).not.toHaveProperty("setState");
  });

  it("loads into owner state and returns detached results", async () => {
    storeApi.getState().setValue("session", "selected");
    const dataWorkerClient = { load: vi.fn(async () => ({ items: [{ service: "Recognition", level: 2 }], jurisdiction: "Texas, Harris County" })) };
    const loaded = await api.loadSessionData({ dataWorkerClient, authToken: "token-1" }, "selected");
    expect(dataWorkerClient.load).toHaveBeenCalledExactlyOnceWith("token-1", "selected");
    expect(storeApi.getState().indexChoices).toContainEqual({ service: "Recognition", level: 2 });
    expect(storeApi.getState().jurisdiction).toBe("Texas, Harris County");
    loaded!.items[0].level = 6;
    loaded!.jurisdiction = null;
    expect(storeApi.getState().indexChoices).toContainEqual({ service: "Recognition", level: 2 });
    expect(storeApi.getState().choicesBySession.selected).toMatchObject({ jurisdiction: "Texas, Harris County" });
  });

  it("retains a late result with its session without replacing the selected choices", async () => {
    let finish!: (value: { items: { service: string; level: number }[]; jurisdiction: null }) => void;
    storeApi.getState().setValue("session", "old");
    const request = api.loadSessionData({ authToken: "token-1", dataWorkerClient: { load: () => new Promise(resolve => { finish = resolve; }) } }, "old");
    storeApi.getState().setValue("session", "new");
    storeApi.getState().setValue("indexChoices", [{ service: "Recognition", level: 4 }]);
    finish({ items: [{ service: "Recognition", level: 2 }], jurisdiction: null });
    await request;
    expect(storeApi.getState().indexChoices).toEqual([{ service: "Recognition", level: 4 }]);
    expect(storeApi.getState().choicesBySession.old).toMatchObject({ items: expect.arrayContaining([{ service: "Recognition", level: 2 }]) });
  });

  it("does not replace accepted choices with defaults when the backend reports missing choices", async () => {
    storeApi.getState().setValue("session", "selected");
    storeApi.getState().setValue("indexChoices", [{ service: "Recognition", level: 2 }]);
    storeApi.getState().setValue("jurisdiction", "Texas, Harris County");
    await expect(api.loadSessionData({ authToken: "token-1", dataWorkerClient: { load: async () => null } }, "selected")).resolves.toBeNull();
    expect(storeApi.getState().indexChoices).toEqual([{ service: "Recognition", level: 2 }]);
    expect(storeApi.getState().jurisdiction).toBe("Texas, Harris County");
    expect(storeApi.getState().choicesBySession.selected).toBeNull();
  });

  it("owns form values, saving, persistence and detached save notifications", () => {
    const choices = new ChoiceData(CHOICESTRUCTURE).generateDefaultJson();
    storeApi.getState().setValue("session", "selected");
    storeApi.getState().setValue("indexChoices", choices);
    api.intakeActions.openSettings();
    const onSave = vi.fn((saved: { service: string; level: number }[]) => { saved[0].level = 1; });
    render(<api.ChoicesPanel choicesEditable onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: /Level2 -/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Review Before Index" }));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(storeApi.getState().indexChoices).toContainEqual({ service: "Recognition", level: 2 });
    expect(storeApi.getState().choicesBySession.selected).toMatchObject({ items: expect.arrayContaining([{ service: "Recognition", level: 2 }]) });
    expect(api.getIntakeState().settingsOpen).toBe(false);
    expect(JSON.parse(localStorage.getItem(LOCAL_STATE_STORAGE_KEY)!).state.indexChoices).toContainEqual({ service: "Recognition", level: 2 });
  });

  it("replaces loaded choices in an open form without requiring a jurisdiction change", () => {
    storeApi.getState().setValue("session", "selected");
    storeApi.getState().setValue("indexChoices", [{ service: "Recognition", level: 2 }]);
    render(<api.ChoicesPanel choicesEditable={false} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /Level2 -/ })).toBeChecked();
    act(() => storeApi.getState().setValue("indexChoices", [{ service: "Recognition", level: 6 }]));
    expect(screen.getByRole("radio", { name: /Level6 -/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Level6 -/ })).toBeDisabled();
  });

  it.each([true, false])("clears the active session while preserving settings=%s and saved choices", preserveSettings => {
    api.intakeActions.resetSelection();
    const resetVersion = storeApi.getState().selectionResetVersion;
    storeApi.getState().setValue("session", "selected");
    storeApi.getState().setValue("indexChoices", [{ service: "Recognition", level: 2 }]);
    storeApi.getState().setValue("indexingStepStatus", true);
    api.intakeActions.openSettings();
    api.intakeActions.clearSession(preserveSettings);
    expect(api.getIntakeState()).toMatchObject({ session: null, settingsOpen: preserveSettings });
    expect(storeApi.getState().indexingStepStatus).toBe(false);
    expect(storeApi.getState().indexChoices).toEqual([{ service: "Recognition", level: 2 }]);
    expect(storeApi.getState().selectionResetVersion).toBeGreaterThan(resetVersion);
  });
});
