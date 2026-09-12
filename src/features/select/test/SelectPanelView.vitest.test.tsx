import { fireEvent, render, screen } from "@testing-library/react";
import type { IntakeItemRenderer } from "../../intake/type/intake.types";
import { describe, expect, it, vi } from "vitest";
import { SelectPanelView } from "../component/SelectPanelView";
import type { SelectPanelActions, UseSelectPanelResult } from "../type/select.types";

function createSelect(needsConfirm: boolean) {
  const cancel = vi.fn();
  const start = vi.fn();
  const refreshCancelConfirm = vi.fn(() => needsConfirm);
  const actions: SelectPanelActions = {
    selectFile: async () => undefined,
    start,
    showSettings: () => undefined,
    cancel,
    clear: () => undefined,
    initialize: () => undefined,
    resetStatus: () => undefined,
    refreshCancelConfirm,
  };
  const select: UseSelectPanelResult = {
    mode: "review",
    uploadStatus: { kind: "idle" },
    loading: false,
    viewer: { visible: false, props: null },
    review: {
      startDisabled: false,
      cancelDisabled: false,
    },
    actions,
  };

  return { cancel, refreshCancelConfirm, select, start };
}

const renderSelect: IntakeItemRenderer = ({ children }) => (
  <section data-testid="select-host"><h2>Select Document</h2>{children}</section>
);
const renderPreview: IntakeItemRenderer = ({ children }) => (
  <section data-testid="preview-host"><h2>Review Document</h2>{children}</section>
);

function view(select: UseSelectPanelResult) {
  return (
    <SelectPanelView
      active={true}
      dropTarget={document.createElement("section")}
      helper={select.mode === "review" ? "Review helper" : "Select helper"}
      renderPreview={renderPreview}
      renderSelect={renderSelect}
      select={select}
    />
  );
}

describe("SelectPanelView", () => {
  it("cancels an unchanged review on the first click", () => {
    const { cancel, refreshCancelConfirm, select } = createSelect(false);

    render(view(select));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(refreshCancelConfirm).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("requires a second click to cancel a changed review", () => {
    const { cancel, refreshCancelConfirm, select } = createSelect(true);

    render(view(select));

    const button = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(button);

    expect(refreshCancelConfirm).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
    expect(button).toHaveAttribute("data-armed", "true");

    fireEvent.click(button);

    expect(refreshCancelConfirm).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("data-armed", "false");
  });

  it("uses the standard aurora-core confirmation state before starting", () => {
    const { select, start } = createSelect(false);

    render(view(select));

    const button = screen.getByRole("button", { name: "Start" });
    fireEvent.click(button);

    expect(start).not.toHaveBeenCalled();
    expect(button).toHaveAttribute("data-armed", "true");
    expect(button).toHaveTextContent("Confirm");
    expect(button.style.backgroundColor).toBe("var(--primary)");
  });

  it("renders Review through the Preview wrapper and not the Select wrapper", () => {
    const { select } = createSelect(false);

    render(view(select));

    expect(screen.getByTestId("preview-host")).toHaveTextContent("Review Document");
    expect(screen.queryByTestId("select-host")).not.toBeInTheDocument();
  });
});


it.each(["select", "review"] as const)("reports activation changes for %s without switching renderers", (mode) => {
  const { select } = createSelect(false);
  select.mode = mode;
  const renderSelect = vi.fn(() => <span>Select</span>);
  const renderPreview = vi.fn(() => <span>Review</span>);
  const props = { dropTarget: document.createElement("section"), helper: "Helper", renderSelect, renderPreview, select };
  const { rerender } = render(<SelectPanelView {...props} active={true} />);
  const renderer = mode === "select" ? renderSelect : renderPreview;
  const inactive = mode === "select" ? renderPreview : renderSelect;
  expect(renderer).toHaveBeenLastCalledWith(expect.objectContaining({ active: true, helper: "Helper" }));
  rerender(<SelectPanelView {...props} active={false} />);
  expect(renderer).toHaveBeenLastCalledWith(expect.objectContaining({ active: false }));
  rerender(<SelectPanelView {...props} active={true} />);
  expect(renderer).toHaveBeenLastCalledWith(expect.objectContaining({ active: true }));
  expect(inactive).not.toHaveBeenCalled();
});
