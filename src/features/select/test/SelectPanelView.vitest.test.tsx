import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SelectPanelView } from "../component/SelectPanelView";
import type { SelectPanelActions, UseSelectPanelResult } from "../type/select.types";

function createSelect(needsConfirm: boolean) {
  const cancel = vi.fn();
  const refreshCancelConfirm = vi.fn(() => needsConfirm);
  const actions: SelectPanelActions = {
    selectFile: async () => undefined,
    start: async () => undefined,
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
    progress: { visible: false, showText: false, durationMs: 1000 },
    viewer: { visible: false, props: null },
    review: {
      startDisabled: false,
      cancelDisabled: false,
      cancelNeedsConfirm: needsConfirm,
    },
    actions,
  };

  return { cancel, refreshCancelConfirm, select };
}

describe("SelectPanelView", () => {
  it("cancels an unchanged review on the first click", () => {
    const { cancel, refreshCancelConfirm, select } = createSelect(false);

    render(<SelectPanelView dropTarget={document.createElement("section")} select={select} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(refreshCancelConfirm).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("requires a second click to cancel a changed review", () => {
    const { cancel, refreshCancelConfirm, select } = createSelect(true);

    render(<SelectPanelView dropTarget={document.createElement("section")} select={select} />);

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
});
