import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeApi } from "../../../store/state/store";
import { ChoicesPanel } from "../component/ChoicesPanel";
import { ChoiceData, CHOICESTRUCTURE } from "../service/choicesData";

beforeEach(() => storeApi.getState().resetAllState());

describe("ChoicesPanel", () => {
  it("disables unchanged actions and supports manually reverted settings without closing", () => {
    const onSave = vi.fn();
    storeApi.getState().setValue("indexChoices", [{ service: "Recognition", level: 4 }]);
    render(<ChoicesPanel onCancel={vi.fn()} choicesEditable onSave={onSave} />);
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Update", "Cancel"]);
    const original = screen.getByRole("radio", { name: /4 -/ });
    const changed = screen.getByRole("radio", { name: /3 -/ });
    fireEvent.click(changed);
    expect(screen.getByRole("button", { name: "Update" })).toBeVisible();
    fireEvent.click(original);
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
    fireEvent.click(changed);
    fireEvent.click(original);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(original).toBeChecked();
    expect(screen.getByRole("button", { name: "Update" })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });
  it("renders Intake choices with the host Preview action", () => {
    storeApi.getState().setValue("indexChoices", [{ service: "Recognition", level: 4 }]);

    render(
      <ChoicesPanel
        onCancel={vi.fn()}
        disabledGroups={[]}
        choicesEditable
        onSave={vi.fn()}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close preview" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Settings" }).querySelector("[data-panel-scroll='true']")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /4 -/ })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Studio Mode" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-service-id="LegalEnrichment"]')).toBeInTheDocument();
    expect(document.querySelector('[data-service-id="PartyEnrichment"]')).toBeInTheDocument();
    expect(document.querySelector('[data-service-id="ChainEnrichment"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-service-id="HistoryEnrichment"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-service-id="FeeComputation"]')).not.toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("renders enabled and disabled numeric choice levels", () => {
    const choices = new ChoiceData(CHOICESTRUCTURE).normalizeChoiceValues([
      { service: "EndorsementIndexing", level: 1 },
      { service: "MonetaryInfoIndexing", level: 0 },
      { service: "PartyClauseIndexing", level: 0 },
      { service: "PartyEnrichment", level: 0 },
    ]);

    storeApi.getState().setValue("indexChoices", choices);
    render(
      <ChoicesPanel
        onCancel={vi.fn()}
        choicesEditable={false}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: /Endorsement Indexing/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Reference Indexing/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Monetary Indexing/i })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Party Indexing/i })).not.toBeChecked();
  });
});
