import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IntakeContainer } from "../component/IntakeContainer";

describe("IntakeContainer", () => {
  it("renders select, progress, and settings slots with visibility controlled by panel state", () => {
    const { rerender } = render(
      <IntakeContainer
        panel="progress"
        select={<div>Select form</div>}
        progress={<div>Progress timeline</div>}
        settings={<div>Settings form</div>}
      />,
    );

    expect(screen.queryByTestId("header-panel")).not.toBeInTheDocument();
    const container = screen.getByTestId("intake-container");
    expect(container).toHaveStyle({ height: "100%", minHeight: "0" });
    expect(container.style.backgroundColor).toBe("");
    expect(container.style.borderStyle).toBe("");
    expect(container.style.borderRadius).toBe("");
    expect(container.style.boxShadow).toBe("");
    expect(container.style.margin).toBe("");
    expect(container.style.padding).toBe("");
    expect(screen.getByTestId("select-panel")).toHaveStyle({ alignItems: "center", display: "none" });
    expect(screen.getByTestId("progress-panel")).toHaveStyle({ alignItems: "center", display: "flex" });
    expect(screen.getByTestId("settings-panel")).toHaveStyle({ alignItems: "center", display: "none" });
    expect(screen.queryByTestId("error-panel")).not.toBeInTheDocument();

    rerender(
      <IntakeContainer
        panel="progress"
        select={<div>Select form</div>}
        progress={<div>Progress timeline</div>}
        settings={<div>Settings form</div>}
      />,
    );

    expect(screen.getByTestId("select-panel")).toHaveStyle({ alignItems: "center", display: "none" });
    expect(screen.getByTestId("progress-panel")).toHaveStyle({ alignItems: "center", display: "flex" });
    expect(screen.getByText("Progress timeline")).toBeVisible();

    rerender(
      <IntakeContainer
        panel="settings"
        select={<div>Select form</div>}
        progress={<div>Progress timeline</div>}
        settings={<div>Settings form</div>}
      />,
    );

    expect(screen.getByTestId("settings-panel")).toHaveStyle({ alignItems: "center", display: "flex", overflow: "hidden" });
    expect(screen.getByText("Settings form")).toBeVisible();
  });
});
