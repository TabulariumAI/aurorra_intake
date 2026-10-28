import { describe, expect, it } from "vitest";
import { progressMessageStyles, progressStyles } from "../../progressview/style/progress.styles";
import { selectFormStyles, selectPanelStyles } from "../../select/style/select.styles";
import { intakeContainerStyles } from "../style/intakeContainer.styles";

describe("intake styles", () => {
  it("uses the workspace typography and structural border tokens", () => {
    expect(selectFormStyles.center).toMatchObject({ color: "var(--title-ink)" });
    expect(selectFormStyles.title).toMatchObject({ color: "var(--title-ink)" });
    expect(intakeContainerStyles).not.toHaveProperty("header");
    expect(intakeContainerStyles).not.toHaveProperty("title");
    expect(intakeContainerStyles).not.toHaveProperty("helper");
    expect(selectPanelStyles.reviewPanel).toMatchObject({ borderTop: "1px solid var(--border-card)" });
  });

  it("uses aligned progress and success feedback", () => {
    expect(progressStyles.avatar).toMatchObject({
      backgroundColor: "var(--gray-50)",
      border: "1px solid var(--primary-dark)",
      color: "var(--primary-dark)",
    });
    expect(progressStyles.introCopy).toMatchObject({
      backgroundColor: "var(--accent-surface)",
      borderRadius: "var(--radius-card)",
    });
    expect(progressMessageStyles.completed).toMatchObject({ backgroundColor: "#ECFDF3" });
  });
});
