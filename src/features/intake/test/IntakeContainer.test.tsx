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
        error="Needs attention"
        select={<div>Select form</div>}
        provision={<div>Provision review</div>}
        overlay={<ProgressOverlay />}
      />,
    );

    expect(screen.getByTestId("title-panel")).toHaveTextContent("Review");
    expect(screen.getByTestId("helper-panel")).toHaveTextContent("Check the document");
    expect(screen.getByTestId("error-panel")).toHaveTextContent("Needs attention");
    expect(screen.getByTestId("select-panel")).toHaveStyle({ display: "none" });
    expect(screen.getByTestId("provision-panel")).not.toHaveStyle({ display: "none" });
    expect(screen.getByTestId("progress-overlay")).toBeInTheDocument();
  });
});
