import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useIntakeShell } from "../hook/useIntakeShell";

describe("useIntakeShell", () => {
  it("updates container state through stable actions", () => {
    const { result } = renderHook(() => useIntakeShell());

    expect(Object.keys(result.current.actions)).toEqual(["showSelect", "showProgress"]);

    act(() => {
      result.current.actions.showProgress();
    });

    expect(result.current.state.container).toEqual({
      panel: "progress",
      helper: "Follow each step as it completes.",
    });
  });
});
