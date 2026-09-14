import { describe, expect, it } from "vitest";
import { choiceFormStyles } from "../../choices/style/form.styles";
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
    expect(choiceFormStyles.panelHeader).toMatchObject({
      borderBottom: "1px solid var(--border-card)",
      boxSizing: "border-box",
      flex: "0 0 auto",
      minHeight: "var(--panel-header-height)",
      padding: "var(--panel-header-padding)",
    });
    expect(choiceFormStyles.panelTitle).toMatchObject({
      fontSize: "var(--panel-title-size)",
      fontWeight: "var(--panel-title-weight)",
      letterSpacing: "var(--panel-title-tracking)",
      lineHeight: "var(--panel-title-line-height)",
    });
    expect(choiceFormStyles.panel).toMatchObject({ color: "var(--title-ink)" });
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
