import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChoiceForm } from "../component/ChoiceForm";
import { ChoiceData, CHOICESTRUCTURE, DEFAULT_WORKFLOW_SETTINGS } from "../service/choicesData";
import { createChoicesService, loadSessionData } from "../service/ChoicesService";
import { createStoreAdapter } from "../../../store/adapter/storeAdapter";
import { storeApi, LOCAL_STATE_STORAGE_KEY } from "../../../store/state/store";

const choices = new ChoiceData(CHOICESTRUCTURE).generateDefaultJson();

function openSettings(jurisdiction: string | null = null, editable = true) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const view = render(<ChoiceForm structure={CHOICESTRUCTURE} initialChoices={choices}
    initialWorkflow={DEFAULT_WORKFLOW_SETTINGS} initialJurisdiction={jurisdiction}
    choicesEditable={editable} onSave={onSave} onCancel={onCancel} />);
  return { ...view, onSave, onCancel };
}

beforeEach(() => storeApi.getState().resetAllState());

describe("jurisdiction settings", () => {
  it("requires a state before searching and treats state alone as no selection", () => {
    openSettings();
    expect(screen.getByRole("combobox", { name: "Jurisdiction" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "State" }), { target: { value: "Texas" } });
    expect(screen.getByRole("combobox", { name: "Jurisdiction" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
  });

  it("filters by state and text, selects by keyboard, and preserves other settings", () => {
    const { onSave } = openSettings();
    fireEvent.change(screen.getByLabelText("State", { exact: true }), { target: { value: "Texas" } });
    const input = screen.getByRole("combobox", { name: "Jurisdiction" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "harris" } });
    expect(screen.getByRole("option", { name: "Harris County" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "Los Angeles County" })).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("Harris County");
    expect(input).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(onSave).toHaveBeenCalledWith({ choices, workflow: DEFAULT_WORKFLOW_SETTINGS, jurisdiction: "Texas, Harris County" });
  });

  it.each([
    ["Louisiana", "Orleans Parish"],
    ["Alaska", "Anchorage Municipality"],
    ["Virginia", "Richmond city"],
    ["Connecticut", "Capitol Planning Region"],
  ])("allows county equivalents in %s", (state, county) => {
    const { onSave } = openSettings();
    fireEvent.change(screen.getByLabelText("State", { exact: true }), { target: { value: state } });
    const input = screen.getByRole("combobox", { name: "Jurisdiction" });
    fireEvent.change(input, { target: { value: county } });
    fireEvent.click(screen.getByRole("option", { name: county }));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ jurisdiction: `${state}, ${county}` }));
  });

  it("clears a previous county when the state changes and permits explicit no selection", () => {
    const { onSave } = openSettings("Texas, Harris County");
    expect(screen.getByLabelText("State", { exact: true })).toHaveValue("Texas");
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("State", { exact: true }), { target: { value: "California" } });
    expect(screen.getByLabelText("Jurisdiction", { exact: true })).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ jurisdiction: null }));
  });

  it("rejects arbitrary text and disables Update until an option is selected or cleared", () => {
    const { onSave } = openSettings("Texas, Harris County");
    const input = screen.getByLabelText("Jurisdiction", { exact: true });
    fireEvent.change(input, { target: { value: "unlisted county" } });
    expect(screen.getByRole("status")).toHaveTextContent("No matching jurisdictions");
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ jurisdiction: null }));
  });

  it("discards Cancel drafts, supports reverting, and respects locked settings", () => {
    const first = openSettings("Texas, Harris County");
    fireEvent.change(screen.getByLabelText("Jurisdiction", { exact: true }), { target: { value: "Travis" } });
    fireEvent.click(screen.getByRole("option", { name: "Travis County" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(first.onSave).not.toHaveBeenCalled();
    expect(first.onCancel).toHaveBeenCalledOnce();
    first.unmount();
    openSettings("Texas, Harris County", false);
    expect(screen.getByLabelText("State", { exact: true })).toBeDisabled();
    expect(screen.getByLabelText("Jurisdiction", { exact: true })).toHaveValue("Harris County");
    expect(screen.getByLabelText("Jurisdiction", { exact: true })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Review Before Index" }));
    expect(screen.getByRole("button", { name: "Update" })).toBeEnabled();
  });

  it("closes suggestions with Escape without closing Settings, and restores unchanged comparison", () => {
    openSettings("Texas, Harris County");
    const input = screen.getByLabelText("Jurisdiction", { exact: true });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("State", { exact: true })).toBeVisible();
    fireEvent.change(input, { target: { value: "Travis" } });
    fireEvent.click(screen.getByRole("option", { name: "Travis County" }));
    fireEvent.change(input, { target: { value: "Harris" } });
    fireEvent.click(screen.getByRole("option", { name: "Harris County" }));
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
  });
});

describe("jurisdiction persistence", () => {
  it("saves jurisdiction through Intake storage and reports only actual changes", () => {
    const runtime = { store: createStoreAdapter() };
    const service = createChoicesService(runtime);
    service.save(choices, DEFAULT_WORKFLOW_SETTINGS, "Texas, Harris County");
    expect(storeApi.getState().jurisdiction).toBe("Texas, Harris County");
    expect(JSON.parse(localStorage.getItem(LOCAL_STATE_STORAGE_KEY)!).state.jurisdiction).toBe("Texas, Harris County");
    expect(service.save(choices, DEFAULT_WORKFLOW_SETTINGS, "Texas, Harris County").changed).toBe(false);
    expect(service.save(choices, DEFAULT_WORKFLOW_SETTINGS, null).changed).toBe(true);
    expect(storeApi.getState().jurisdiction).toBeNull();
  });

  it("keeps jurisdictions with their sessions on repeated backend loads", async () => {
    const runtime = { authToken: "token-1", dataWorkerClient: { load: vi.fn()
      .mockResolvedValueOnce({ items: choices, jurisdiction: "Texas, Harris County" })
      .mockResolvedValueOnce({ items: choices, jurisdiction: null })
      .mockResolvedValueOnce({ items: choices, jurisdiction: "Texas, Harris County" }) } };
    const first = await loadSessionData(runtime, "first");
    expect(first).toEqual({ items: choices, jurisdiction: "Texas, Harris County" });
    expect(await loadSessionData(runtime, "second")).toEqual({ items: choices, jurisdiction: null });
    expect(await loadSessionData(runtime, "first")).toEqual(first);
    expect(runtime.dataWorkerClient.load).toHaveBeenCalledTimes(3);
  });

  it("retains concurrently loaded session entries", async () => {
    let finish!: (value: { items: typeof choices; jurisdiction: string }) => void;
    const runtime = { authToken: "token-1", dataWorkerClient: { load: vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce({ items: choices, jurisdiction: null }) } };
    const first = loadSessionData(runtime, "first");
    await loadSessionData(runtime, "second");
    finish({ items: choices, jurisdiction: "Texas, Harris County" });
    await first;
    expect(Object.keys(storeApi.getState().choicesBySession).sort()).toEqual(["first", "second"]);
  });
});
