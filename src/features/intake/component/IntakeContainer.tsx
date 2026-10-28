import { getIntakeSlotStyle, intakeContainerStyles } from "../style/intakeContainer.styles";
import type { IntakeContainerProps } from "../type/intake.types";

export function IntakeContainer({
  panel,
  select,
  progress,
  selectPanelRef,
}: IntakeContainerProps) {
  const isSelectPanelVisible = panel === "select";
  const isProgressPanelVisible = panel === "progress";

  return (
    <div id="intake-container" data-testid="intake-container" style={intakeContainerStyles.shell}>
      <section
        id="select-panel"
        ref={selectPanelRef}
        data-testid="select-panel"
        style={getIntakeSlotStyle(isSelectPanelVisible)}
      >
        {select}
      </section>
      <section
        id="progress-panel"
        data-testid="progress-panel"
        style={getIntakeSlotStyle(isProgressPanelVisible)}
      >
        {progress}
      </section>
    </div>
  );
}
