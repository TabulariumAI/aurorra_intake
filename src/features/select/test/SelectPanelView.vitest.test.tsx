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
    acceptSize: vi.fn(async () => undefined),
    selectFile: async () => undefined,
    start,
    cancel,
    clear: () => undefined,
    initialize: () => undefined,
    refreshCancelConfirm,
  };
  const select: UseSelectPanelResult = {
    sizeFailure: null,
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
      maxFileSizeBytes={20 * 1024 * 1024}
      active={true}
      dropTarget={document.createElement("section")}
      helper={select.mode === "review" ? "Review helper" : "Select helper"}
      renderTolerance={({ children }) => <div role="dialog">{children}</div>}
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
    expect(button.style.backgroundColor).toBe("var(--primary-dark)");
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
  const props = { renderTolerance: () => null, maxFileSizeBytes: 20 * 1024 * 1024, dropTarget: document.createElement("section"), helper: "Helper", renderSelect, renderPreview, select };
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


it("shows the rejected page and both explicit decisions through the host callout renderer", () => {
  const { select } = createSelect(false);
  select.mode = "select";
  select.sizeFailure = { sourceName: "16859820.pdf", pageNumber: 1, width: 1275, height: 1739, tolerance: 0.02, requiredTolerance: 0.035 };
  const anchor = document.createElement("section");
  const renderTolerance = vi.fn(({ children }) => <div role="dialog">{children}</div>);
  const { rerender } = render(<SelectPanelView active maxFileSizeBytes={20 * 1024 * 1024} dropTarget={anchor} helper="" renderPreview={renderPreview} renderSelect={renderSelect} renderTolerance={renderTolerance} select={select} />);
  expect(renderTolerance).toHaveBeenCalledWith(expect.objectContaining({ anchor: screen.getByRole("button", { name: "Select document" }), onClose: select.actions.cancel }));
  expect(screen.getByRole("dialog")).toHaveTextContent("16859820.pdf");
  expect(screen.getByRole("dialog")).toHaveTextContent("Page 1: 1275 × 1739 px");
  expect(screen.getByRole("dialog")).toHaveTextContent("2%");
  expect(screen.getByRole("dialog")).toHaveTextContent("3.5%");
  expect(screen.getByRole("dialog")).toHaveTextContent("only to this Intake");
  fireEvent.click(screen.getByRole("button", { name: "Process anyway" }));
  expect(select.actions.acceptSize).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(select.actions.cancel).toHaveBeenCalledTimes(1);
  rerender(<SelectPanelView active={false} maxFileSizeBytes={20 * 1024 * 1024} dropTarget={anchor} helper="" renderPreview={renderPreview} renderSelect={renderSelect} renderTolerance={renderTolerance} select={select} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
