import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useIntakeShell } from "../hook/useIntakeShell";

describe("useIntakeShell", () => {
  it("updates container state through stable actions", () => {
    const { result } = renderHook(() => useIntakeShell());

    act(() => {
      result.current.actions.showProvision("Provision", "Review pages");
    });

    expect(result.current.state.container).toEqual({
      panel: "provision",
      title: "Provision",
      helper: "Review pages",
    });
    act(() => {
      result.current.actions.clearHeader();
    });

    expect(result.current.state.container.title).toBe("");
  });
});
