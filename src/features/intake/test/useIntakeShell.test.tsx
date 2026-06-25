import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useIntakeShell } from "../hook/useIntakeShell";

describe("useIntakeShell", () => {
  it("updates container, overlay, and progress state through stable actions", () => {
    const { result } = renderHook(() => useIntakeShell());

    act(() => {
      result.current.actions.showProvision("Provision", "Review pages");
      result.current.actions.progress.showOverlay();
      result.current.actions.progress.startProcessing();
      result.current.actions.progress.notify("Working");
    });

    expect(result.current.state.container).toEqual({
      panel: "provision",
      title: "Provision",
      helper: "Review pages",
    });
    expect(result.current.state.overlay.isVisible).toBe(true);
    expect(result.current.state.progress).toEqual({
      isProcessing: true,
      messages: ["Working"],
    });

    act(() => {
      result.current.actions.clearHeader();
      result.current.actions.progress.hideOverlay();
      result.current.actions.progress.endProcessing();
    });

    expect(result.current.state.container.title).toBe("");
    expect(result.current.state.overlay.isVisible).toBe(false);
    expect(result.current.state.progress.isProcessing).toBe(false);
  });
});
