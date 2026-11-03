import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { IntakeContainer } from "../component/IntakeContainer";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it.each(["select", "progress"] as const)("contains the %s stage without removing its sibling", panel => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  function Broken(): never { throw new Error("Stage failed"); }
  render(<IntakeContainer panel={panel} selectPanelRef={createRef<HTMLDivElement>()}
    select={panel === "select" ? <Broken /> : <input aria-label="Retained selection" defaultValue="Draft" />}
    progress={panel === "progress" ? <Broken /> : <output>Retained progress</output>} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Stage failed");
  expect(panel === "select" ? screen.getByText("Retained progress") : screen.getByLabelText("Retained selection")).toBeInTheDocument();
});
