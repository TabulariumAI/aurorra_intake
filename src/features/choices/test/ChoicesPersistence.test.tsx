import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStoreAdapter } from "../../../store/adapter/storeAdapter";
import { storeApi } from "../../../store/state/store";
import { ChoicesPanel } from "../component/ChoicesPanel";
import { createChoicesService } from "../service/ChoicesService";
import { ChoiceData, CHOICESTRUCTURE, createIndexingPayload, DEFAULT_WORKFLOW_SETTINGS } from "../service/choicesData";

const items = CHOICESTRUCTURE.choices.flatMap((choice) => choice.items ?? []);

function openSettings() {
  const store = createStoreAdapter();
  const service = createChoicesService({
    store,
    eventBus: { emit: vi.fn() },
    events: { showChoices: {}, updateChoices: {} },
    dataWorkerClient: { load: vi.fn() },
  });
  return render(<ChoicesPanel
    structure={CHOICESTRUCTURE}
    initialChoices={store.get("indexChoices")}
    initialWorkflow={store.get("workflow")}
    choicesEditable
    onCancel={vi.fn()}
    onSave={({ choices, workflow }) => service.save(choices, workflow)}
  />);
}

beforeEach(() => storeApi.getState().resetAllState());

describe("settings persistence", () => {
  it.each(items.filter((item) => !item.system))("preserves $name when disabled and enabled again", (item) => {
    // Start without dependants so each checkbox can be independently disabled.
    storeApi.getState().setValue("indexChoices", new ChoiceData(CHOICESTRUCTURE).generateDefaultJson().map((choice) => ({
      ...choice,
      level: choice.service === "Recognition" ? 5 : Number(choice.service === item.name),
    })));
    let view = openSettings();
    const checkbox = screen.getByRole("checkbox", { name: new RegExp(`^${item.label}`) });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    const saved = storeApi.getState().indexChoices;
    expect(saved).toContainEqual({ service: item.name, level: 0 });
    expect(new ChoiceData(CHOICESTRUCTURE).normalizeChoiceValues(saved)).toEqual(saved);
    expect(createIndexingPayload(saved)).toContainEqual({ service: item.name, level: 0 });
    view.unmount();

    view = openSettings();
    expect(screen.getByRole("checkbox", { name: new RegExp(`^${item.label}`) })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`^${item.label}`) }));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(storeApi.getState().indexChoices).toContainEqual({ service: item.name, level: 1 });
    expect(createIndexingPayload(storeApi.getState().indexChoices)).toContainEqual({ service: item.name, level: 1 });
    view.unmount();
    openSettings();
    expect(screen.getByRole("checkbox", { name: new RegExp(`^${item.label}`) })).toBeChecked();
  });

  it.each([
    ["Party Indexing", "Party Enrichment", "PartyClauseIndexing", "PartyEnrichment"],
    ["Property & Legal Indexing", "Legal Description Enrichment", "ExhibitIndexing", "LegalEnrichment"],
  ])("preserves %s while its dependant is selected", (parent, child, parentId, childId) => {
    const view = openSettings();
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`^${parent}`) }));
    expect(screen.getByRole("checkbox", { name: new RegExp(`^${parent}`) })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`^${child}`) }));
    expect(screen.getByRole("checkbox", { name: new RegExp(`^${parent}`) })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(storeApi.getState().indexChoices).toEqual(expect.arrayContaining([
      { service: parentId, level: 0 }, { service: childId, level: 0 },
    ]));
    view.unmount();
    openSettings();
    expect(screen.getByRole("checkbox", { name: new RegExp(`^${parent}`) })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: new RegExp(`^${child}`) })).not.toBeChecked();
  });

  it.each(DEFAULT_WORKFLOW_SETTINGS)("preserves workflow $name without changing choice defaults", (setting) => {
    const view = openSettings();
    fireEvent.click(screen.getByRole("checkbox", { name: setting.label }));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(storeApi.getState().indexChoices).toEqual(new ChoiceData(CHOICESTRUCTURE).generateDefaultJson());
    view.unmount();
    openSettings();
    expect(screen.getByRole("checkbox", { name: setting.label })).toHaveProperty("checked", !setting.value);
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
    const payload = createIndexingPayload(storeApi.getState().indexChoices);
    for (const service of ["Redact", "Manifest", "Record", "Abstract", ...items.filter((item) => item.system).map((item) => item.name)]) {
      expect(payload.filter((choice) => choice.service === service)).toEqual([{ service, level: 0 }]);
    }
  });

  it.each([1, 2, 3, 4, 5, 6])("preserves recognition level %i", (level) => {
    const view = openSettings();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`Level${level} -`) }));
    fireEvent.click(screen.getByRole("checkbox", { name: /^Endorsement Indexing/ }));
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(createIndexingPayload(storeApi.getState().indexChoices)).toContainEqual({ service: "Recognition", level });
    view.unmount();
    openSettings();
    expect(screen.getByRole("radio", { name: new RegExp(`Level${level} -`) })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^Endorsement Indexing/ })).not.toBeChecked();
  });
});
