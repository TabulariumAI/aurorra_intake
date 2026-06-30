import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IntakeContainer } from "../component/IntakeContainer";
import { ProgressOverlay } from "../component/ProgressOverlay";

describe("IntakeContainer", () => {
  it("renders select and provision slots with visibility controlled by panel state", () => {
    render(
      <IntakeContainer
        panel="provision"
        title="Review"
        helper="Check the document"
        select={<div>Select form</div>}
        provision={<div>Provision review</div>}
        overlay={<ProgressOverlay />}
      />,
    );

    expect(screen.getByTestId("title-panel")).toHaveTextContent("Review");
    expect(screen.getByTestId("helper-panel")).toHaveTextContent("Check the document");
    expect(screen.getByTestId("intake-container")).toHaveStyle({ height: "100%", minHeight: "0" });
    expect(screen.getByTestId("select-panel")).toHaveStyle({ display: "none" });
    expect(screen.getByTestId("provision-panel")).not.toHaveStyle({ display: "none" });
    expect(screen.getByTestId("progress-overlay")).toBeInTheDocument();
    expect(screen.queryByTestId("error-panel")).not.toBeInTheDocument();
  });
});
