import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { IntakeContainer } from "../component/IntakeContainer";
it("owns only Select and Progress slots", () => {
  const view = render(<IntakeContainer panel="select" select={<div>Select</div>} progress={<div>Progress</div>} />);
  expect(screen.getByTestId("select-panel")).not.toHaveStyle({ display: "none" });
  expect(screen.getByTestId("progress-panel")).toHaveStyle({ display: "none" });
  expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
  view.rerender(<IntakeContainer panel="progress" select={<div>Select</div>} progress={<div>Progress</div>} />);
  expect(screen.getByTestId("progress-panel")).not.toHaveStyle({ display: "none" });
  expect(screen.getByTestId("select-panel")).toHaveStyle({ display: "none" });
});
