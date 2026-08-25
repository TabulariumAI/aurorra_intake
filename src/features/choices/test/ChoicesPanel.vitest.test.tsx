import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChoicesPanel } from "../component/ChoicesPanel";
import { ChoiceData, CHOICESTRUCTURE } from "../service/choicesData";

describe("ChoicesPanel", () => {
  it("renders Intake choices with the host Preview action", () => {
    const onClose = vi.fn();

    render(
      <ChoicesPanel
        disabledGroups={[]}
        initialAlwaysReview={false}
        initialChoices={[{ service: "Recognition", level: 4 }]}
        onCancel={onClose}
        onClose={onClose}
        onSave={vi.fn()}
        structure={CHOICESTRUCTURE}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close preview" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /4 -/ })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Studio Mode" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders enabled and disabled numeric choice levels", () => {
    const choices = new ChoiceData(CHOICESTRUCTURE).normalizeChoiceValues([
      { service: "EndorsementIndexing", level: 1 },
      { service: "MonetaryInfoIndexing", level: 0 },
      { service: "PartyClauseIndexing", level: 0 },
      { service: "PartyEnrichment", level: 0 },
    ]);

    render(
      <ChoicesPanel
        initialAlwaysReview={false}
        initialChoices={choices}
        onCancel={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        structure={CHOICESTRUCTURE}
      />,
    );

    expect(screen.getByRole("checkbox", { name: /Endorsement Indexing/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Reference Indexing/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Monetary Indexing/i })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Party Indexing/i })).not.toBeChecked();
  });
});
