import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IntakeContainer } from "../component/IntakeContainer";

describe("IntakeContainer", () => {
  it("renders select and provision slots with visibility controlled by panel state", () => {
    render(
      <IntakeContainer
        panel="provision"
        title="Review"
        helper="Check the document"
        select={<div>Select form</div>}
        provision={<div>Provision review</div>}
      />,
    );

    expect(screen.getByTestId("title-panel")).toHaveTextContent("Review");
    expect(screen.getByTestId("helper-panel")).toHaveTextContent("Check the document");
    const container = screen.getByTestId("intake-container");
    expect(container).toHaveStyle({ height: "100%", minHeight: "0" });
    expect(container.style.backgroundColor).toBe("");
    expect(container.style.borderStyle).toBe("");
    expect(container.style.borderRadius).toBe("");
    expect(container.style.boxShadow).toBe("");
    expect(container.style.margin).toBe("");
    expect(container.style.padding).toBe("");
    expect(screen.getByTestId("select-panel")).toHaveStyle({ display: "none" });
    expect(screen.getByTestId("provision-panel")).not.toHaveStyle({ display: "none" });
    expect(screen.queryByTestId("error-panel")).not.toBeInTheDocument();
  });
});
